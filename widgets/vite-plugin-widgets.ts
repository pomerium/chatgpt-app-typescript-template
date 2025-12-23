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

    config() {
      const entries = fg.sync('src/widgets/*.{tsx,jsx}', {
        absolute: false,
        onlyFiles: true,
        deep: 1,
      });

      widgets = entries.map((entry) => {
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

      const input: Record<string, string> = {};
      widgets.forEach((widget) => {
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
                if (assetInfo.name?.endsWith('.css')) {
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
      let moduleId = id;
      if (moduleId.startsWith('/')) {
        moduleId = moduleId.slice(1);
      }

      if (moduleId.startsWith('virtual:widget-')) {
        return '\0' + moduleId;
      }

      if (moduleId.endsWith('.css')) {
        const name = moduleId.slice(0, -4);
        if (widgets.find((w) => w.name === name)) {
          return '\0virtual:style:' + name + '.css';
        }
      }
    },

    load(id) {
      const cleanId = id.startsWith('\0') ? id.slice(1) : id;

      if (cleanId.startsWith('virtual:style:') && cleanId.endsWith('.css')) {
        const widgetName = cleanId
          .replace('virtual:style:', '')
          .replace('.css', '');
        const widget = widgets.find((w) => w.name === widgetName);

        if (!widget) {
          return null;
        }

        const toServerRoot = (abs: string) => {
          const rel = path.relative(process.cwd(), abs).replace(/\\/g, '/');
          if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
            return '/@fs/' + abs.replace(/\\/g, '/');
          }
          return './' + rel;
        };

        const globalCss = path.resolve('src/index.css');
        const lines = ['@source "./src";'];

        if (fs.existsSync(globalCss)) {
          lines.push(`@import "${toServerRoot(globalCss)}";`);
        }

        const widgetCss = path.resolve(widget.dir, `../index.css`);
        if (fs.existsSync(widgetCss)) {
          lines.push(`@import "${toServerRoot(widgetCss)}";`);
        }

        return {
          code: lines.join('\n'),
          map: null,
        };
      }

      if (cleanId.startsWith('virtual:widget-') && cleanId.endsWith('.js')) {
        const widgetName = cleanId
          .replace('virtual:widget-', '')
          .replace('.js', '');
        const widget = widgets.find((w) => w.name === widgetName);

        if (!widget) {
          throw new Error(`Widget not found: ${widgetName}`);
        }

        const toFs = (abs: string) => '/@fs/' + abs.replace(/\\/g, '/');
        const widgetPath = toFs(widget.path);

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
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const url = req.url.split('?')[0];

        const htmlMatch = url.match(/^\/([\w-]+)(?:\.html)?$/);
        if (!htmlMatch) return next();

        const widgetName = htmlMatch[1];
        const widget = widgets.find((w) => w.name === widgetName);

        if (!widget) return next();

        const widgetPort = process.env.WIDGET_PORT || '4444';
        const baseUrl = `http://localhost:${widgetPort}`;

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
      const outDir = config.build.outDir;

      widgets.forEach((widget) => {
        const jsPath = path.join(outDir, `${widget.name}.js`);
        const cssPath = path.join(outDir, `${widget.name}.css`);

        if (!fs.existsSync(jsPath)) {
          console.warn(`Warning: ${jsPath} not found after build`);
          return;
        }

        const jsHash = generateContentHash(jsPath);
        const cssHash = fs.existsSync(cssPath)
          ? generateContentHash(cssPath)
          : null;

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

        const widgetPort = process.env.WIDGET_PORT || '4444';
        const defaultBaseUrl = `http://localhost:${widgetPort}`;
        const baseUrlCandidate = process.env.BASE_URL?.trim() ?? '';
        const baseUrlRaw =
          baseUrlCandidate.length > 0 ? baseUrlCandidate : defaultBaseUrl;
        const baseUrl = baseUrlRaw.replace(/\/+$/, '') || defaultBaseUrl;

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
