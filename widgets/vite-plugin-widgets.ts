import type { Plugin, ResolvedConfig } from 'vite';
import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

interface WidgetEntry {
  name: string;
  path: string;
  dir: string;
}

/**
 * Vite plugin that auto-discovers widgets and builds them separately
 * Widgets must include mounting code at the bottom of their files
 */
export function widgetDiscoveryPlugin(): Plugin {
  let config: ResolvedConfig;
  let widgets: WidgetEntry[] = [];

  return {
    name: 'widget-discovery',
    // Let plugin order in vite.config.ts determine execution order

    config() {
      // Discover widgets during config phase
      // Look for top-level files in src/widgets/ only (not nested folders)
      const entries = fg.sync('src/widgets/*.{tsx,jsx}', {
        absolute: false,
        onlyFiles: true,
        deep: 1, // Only top-level files in widgets folder
      });

      widgets = entries.map((entry) => {
        // Widget name is the filename without extension
        const name = path.basename(entry, path.extname(entry));
        return {
          name,
          path: path.resolve(entry),
          dir: path.dirname(path.resolve(entry)),
        };
      });

      console.log(`\nFound ${widgets.length} widget(s):`);
      widgets.forEach((w) => console.log(`  - ${w.name}`));
      console.log();

      if (widgets.length === 0) {
        throw new Error('No widgets found in src/widgets/*.{tsx,jsx}');
      }

      // Build multi-entry configuration using virtual modules
      const input: Record<string, string> = {};
      widgets.forEach((widget) => {
        // Use virtual module as entry (injects preamble, then imports widget)
        input[widget.name] = `virtual:widget-${widget.name}.js`;
      });

      return {
        build: {
          rollupOptions: {
            input,
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: '[name]-[hash].js',
              assetFileNames: (assetInfo) => {
                // Name CSS files after their widget
                if (assetInfo.name?.endsWith('.css')) {
                  // Extract widget name from the source
                  return '[name].css';
                }
                return '[name]-[hash][extname]';
              },
            },
          },
        },
      };
    },

    resolveId(id) {
      // Strip leading slash from browser requests
      let moduleId = id;
      if (moduleId.startsWith('/')) {
        moduleId = moduleId.slice(1);
      }

      // Handle virtual module IDs (Rollup convention: use \0 prefix)
      if (moduleId.startsWith('virtual:widget-')) {
        return '\0' + moduleId; // Return with null byte prefix
      }

      // Handle CSS virtual modules (pizza demo pattern)
      if (moduleId.endsWith('.css')) {
        const name = moduleId.slice(0, -4);
        if (widgets.find((w) => w.name === name)) {
          return '\0virtual:style:' + name + '.css';
        }
      }
    },

    load(id) {
      // Handle virtual modules (strip \0 prefix for matching)
      const cleanId = id.startsWith('\0') ? id.slice(1) : id;

      // Handle CSS virtual modules
      if (cleanId.startsWith('virtual:style:') && cleanId.endsWith('.css')) {
        const widgetName = cleanId
          .replace('virtual:style:', '')
          .replace('.css', '');
        const widget = widgets.find((w) => w.name === widgetName);

        if (!widget) {
          return null;
        }

        // Import global CSS and widget-specific CSS
        const toServerRoot = (abs: string) => {
          const rel = path.relative(process.cwd(), abs).replace(/\\/g, '/');
          if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
            return '/@fs/' + abs.replace(/\\/g, '/');
          }
          return './' + rel;
        };

        // Find CSS files in widget directory and global index.css
        const globalCss = path.resolve('src/index.css');
        const lines = ['@source "./src";'];

        if (fs.existsSync(globalCss)) {
          lines.push(`@import "${toServerRoot(globalCss)}";`);
        }

        // Add widget-specific CSS if it exists
        const widgetCss = path.resolve(widget.dir, `../index.css`);
        if (fs.existsSync(widgetCss)) {
          lines.push(`@import "${toServerRoot(widgetCss)}";`);
        }

        return {
          code: lines.join('\n'),
          map: null,
        };
      }

      // Handle widget entry virtual modules
      if (cleanId.startsWith('virtual:widget-') && cleanId.endsWith('.js')) {
        const widgetName = cleanId
          .replace('virtual:widget-', '')
          .replace('.js', '');
        const widget = widgets.find((w) => w.name === widgetName);

        if (!widget) {
          throw new Error(`Widget not found: ${widgetName}`);
        }

        // Convert to /@fs/ path (pizza demo pattern)
        const toFs = (abs: string) => '/@fs/' + abs.replace(/\\/g, '/');
        const widgetPath = toFs(widget.path);

        // Inject preamble BEFORE importing widget (exact pizza demo pattern)
        // This ensures Fast Refresh is set up before the widget code runs
        return {
          code: `import "/@vite/client";

import RefreshRuntime from "/@react-refresh";

if (!window.__vite_plugin_react_preamble_installed__) {
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
}

import "./src/index.css";
await import(${JSON.stringify(widgetPath)});`,
          map: null,
        };
      }
    },

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    configureServer(server) {
      // Serve HTML pages during development
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const url = req.url.split('?')[0];

        // Match /widget-name.html or /widget-name
        const htmlMatch = url.match(/^\/([\w-]+)(?:\.html)?$/);
        if (!htmlMatch) return next();

        const widgetName = htmlMatch[1];
        const widget = widgets.find((w) => w.name === widgetName);

        if (!widget) return next();

        // Get the widget port for absolute URLs (needed for iframe embedding)
        const widgetPort = process.env.WIDGET_PORT || '4444';
        const baseUrl = `http://localhost:${widgetPort}`;

        // Import virtual module (sets up preamble, then loads widget)
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${widget.name}</title>
  <script type="module" src="${baseUrl}/virtual:widget-${widget.name}.js"></script>
</head>
<body>
  <div id="${widget.name}-root"></div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      });
    },

    writeBundle() {
      // Generate hashed assets and HTML templates after build
      const outDir = config.build.outDir;

      widgets.forEach((widget) => {
        const jsPath = path.join(outDir, `${widget.name}.js`);
        const cssPath = path.join(outDir, `${widget.name}.css`);

        if (!fs.existsSync(jsPath)) {
          console.warn(`Warning: ${jsPath} not found after build`);
          return;
        }

        // Generate content hashes
        const jsHash = generateContentHash(jsPath);
        const cssHash = fs.existsSync(cssPath)
          ? generateContentHash(cssPath)
          : null;

        // Create hashed copies
        const jsHashedPath = path.join(outDir, `${widget.name}-${jsHash}.js`);
        const cssHashedPath = cssHash
          ? path.join(outDir, `${widget.name}-${cssHash}.css`)
          : null;

        fs.copyFileSync(jsPath, jsHashedPath);
        if (cssHash && cssHashedPath) {
          fs.copyFileSync(cssPath, cssHashedPath);
        }

        console.log(`  ${widget.name}.js → ${widget.name}-${jsHash}.js`);
        if (cssHash) {
          console.log(`  ${widget.name}.css → ${widget.name}-${cssHash}.css`);
        }

        // Determine base URL for widget assets
        // Matches OpenAI Apps SDK pattern: use BASE_URL env var, fallback to localhost:WIDGET_PORT
        const widgetPort = process.env.WIDGET_PORT || '4444';
        const defaultBaseUrl = `http://localhost:${widgetPort}`;
        const baseUrlCandidate = process.env.BASE_URL?.trim() ?? '';
        const baseUrlRaw =
          baseUrlCandidate.length > 0 ? baseUrlCandidate : defaultBaseUrl;
        const baseUrl = baseUrlRaw.replace(/\/+$/, '') || defaultBaseUrl;

        // Generate HTML template
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${widget.name}</title>
  <link rel="modulepreload" href="${baseUrl}/${widget.name}-${jsHash}.js">
  ${cssHash ? `<link rel="preload" href="${baseUrl}/${widget.name}-${cssHash}.css" as="style">` : ''}
  <script type="module" src="${baseUrl}/${widget.name}-${jsHash}.js"></script>
  ${cssHash ? `<link rel="stylesheet" href="${baseUrl}/${widget.name}-${cssHash}.css">` : ''}
</head>
<body>
  <div id="${widget.name}-root"></div>
</body>
</html>`;

        // Write HTML files
        const htmlPath = path.join(outDir, `${widget.name}.html`);
        fs.writeFileSync(htmlPath, html, 'utf-8');
        console.log(`  ${widget.name}.html (with preload hints)`);
      });

      console.log(`\n✨ ${widgets.length} widget(s) built successfully\n`);
    },
  };
}

/**
 * Generate content-based hash for a file
 */
function generateContentHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}
