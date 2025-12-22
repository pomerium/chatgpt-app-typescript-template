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
 */
export function widgetDiscoveryPlugin(): Plugin {
  let config: ResolvedConfig;
  let widgets: WidgetEntry[] = [];

  return {
    name: 'widget-discovery',

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
        throw new Error('No widgets found in src/**/index.{tsx,jsx}');
      }

      // Build multi-entry configuration
      const input: Record<string, string> = {};
      widgets.forEach((widget) => {
        input[widget.name] = widget.path;
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

    configResolved(resolvedConfig) {
      config = resolvedConfig;
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
        const cssHash = fs.existsSync(cssPath) ? generateContentHash(cssPath) : null;

        // Create hashed copies
        const jsHashedPath = path.join(outDir, `${widget.name}-${jsHash}.js`);
        const cssHashedPath = cssHash ? path.join(outDir, `${widget.name}-${cssHash}.css`) : null;

        fs.copyFileSync(jsPath, jsHashedPath);
        if (cssHash && cssHashedPath) {
          fs.copyFileSync(cssPath, cssHashedPath);
        }

        console.log(`  ${widget.name}.js → ${widget.name}-${jsHash}.js`);
        if (cssHash) {
          console.log(`  ${widget.name}.css → ${widget.name}-${cssHash}.css`);
        }

        // Determine base URL
        const baseUrl = process.env.ASSET_BASE_URL || '/assets';

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
