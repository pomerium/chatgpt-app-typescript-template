#!/usr/bin/env tsx

import { build, type InlineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'vite-plugin-compression';
import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import pLimit from 'p-limit';

const WIDGETS_DIR = path.resolve('widgets');
const SRC_DIR = path.join(WIDGETS_DIR, 'src');
const ASSETS_DIR = path.resolve('assets');
const GLOBAL_CSS = path.join(SRC_DIR, 'index.css');

// Determine build concurrency from environment or CPU count
const BUILD_CONCURRENCY =
  parseInt(process.env.BUILD_CONCURRENCY || '', 10) ||
  Math.max(1, Math.floor(os.cpus().length / 2));

console.log(`\nBuilding widgets with concurrency: ${BUILD_CONCURRENCY}\n`);

/**
 * Virtual CSS bundler plugin
 * Injects all CSS imports before the component entry
 */
function cssInjectionPlugin(
  virtualId: string,
  entryFile: string,
  cssPaths: string[]
): Plugin {
  return {
    name: `css-injection:${path.basename(entryFile)}`,
    resolveId(id) {
      if (id === virtualId) return id;
      return null;
    },
    load(id) {
      if (id !== virtualId) return null;

      const cssImports = cssPaths
        .map((css) => `import ${JSON.stringify(css)};`)
        .join('\n');

      return `
${cssImports}
export * from ${JSON.stringify(entryFile)};

import * as __entry from ${JSON.stringify(entryFile)};
export default (__entry.default ?? __entry.App);

import ${JSON.stringify(entryFile)};
`;
    },
  };
}

/**
 * Build a single widget
 */
async function buildWidget(entryPath: string): Promise<{ name: string; jsPath: string; cssPath: string }> {
  const name = path.basename(path.dirname(entryPath));
  const entryDir = path.dirname(entryPath);
  const entryAbs = path.resolve(entryPath);

  console.log(`Building: ${name}`);

  // Collect CSS files for this widget
  const perEntryCss = fg.sync('**/*.css', {
    cwd: entryDir,
    absolute: true,
    dot: false,
    ignore: ['**/*.module.css'],
  });

  // Include global CSS if it exists
  const globalCss = fs.existsSync(GLOBAL_CSS) ? [GLOBAL_CSS] : [];

  // Final CSS list (global first for predictable cascade)
  const cssToInclude = [...globalCss, ...perEntryCss].filter((p) =>
    fs.existsSync(p)
  );

  const virtualId = `\0virtual-entry:${entryAbs}`;

  // Vite build configuration
  const config: InlineConfig = {
    plugins: [
      cssInjectionPlugin(virtualId, entryAbs, cssToInclude),
      tailwindcss(),
      react(),
      // Production compression
      compression({ algorithm: 'gzip', ext: '.gz' }),
      compression({ algorithm: 'brotliCompress', ext: '.br' }),
    ],
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react',
      target: 'es2023',
    },
    build: {
      target: 'es2023',
      outDir: ASSETS_DIR,
      emptyOutDir: false,
      minify: 'esbuild',
      cssCodeSplit: false,
      rollupOptions: {
        input: virtualId,
        output: {
          format: 'es',
          entryFileNames: `${name}.js`,
          assetFileNames: (info) =>
            (info.name || '').endsWith('.css')
              ? `${name}.css`
              : `[name]-[hash][extname]`,
        },
        preserveEntrySignatures: 'allow-extension',
        treeshake: true,
      },
    },
    logLevel: 'warn',
  };

  await build(config);

  const jsPath = path.join(ASSETS_DIR, `${name}.js`);
  const cssPath = path.join(ASSETS_DIR, `${name}.css`);

  if (!fs.existsSync(jsPath)) {
    throw new Error(`Build failed: ${jsPath} not found`);
  }

  console.log(`Built: ${name}`);

  return { name, jsPath, cssPath };
}

/**
 * Generate content-based hash for a file
 */
function generateContentHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/**
 * Create hashed copies and HTML templates
 */
function generateHashedAssets(builtWidgets: Array<{ name: string; jsPath: string; cssPath: string }>) {
  console.log('\nGenerating hashed assets and HTML templates...\n');

  const baseUrl = process.env.ASSET_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? '/assets' : 'http://localhost:4444');

  for (const { name, jsPath, cssPath } of builtWidgets) {
    // Generate content-based hashes
    const jsHash = generateContentHash(jsPath);
    const cssHash = fs.existsSync(cssPath) ? generateContentHash(cssPath) : null;

    // Create hashed copies
    const jsHashedPath = path.join(ASSETS_DIR, `${name}-${jsHash}.js`);
    const cssHashedPath = cssHash ? path.join(ASSETS_DIR, `${name}-${cssHash}.css`) : null;

    fs.copyFileSync(jsPath, jsHashedPath);
    if (cssHash && cssHashedPath) {
      fs.copyFileSync(cssPath, cssHashedPath);
    }

    console.log(`  ${name}.js → ${name}-${jsHash}.js`);
    if (cssHash) {
      console.log(`  ${name}.css → ${name}-${cssHash}.css`);
    }

    // Generate HTML template with preload hints
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name}</title>
  <link rel="modulepreload" href="${baseUrl}/${name}-${jsHash}.js">
  ${cssHash ? `<link rel="preload" href="${baseUrl}/${name}-${cssHash}.css" as="style">` : ''}
  <script type="module" src="${baseUrl}/${name}-${jsHash}.js"></script>
  ${cssHash ? `<link rel="stylesheet" href="${baseUrl}/${name}-${cssHash}.css">` : ''}
</head>
<body>
  <div id="${name}-root"></div>
</body>
</html>`;

    // Write hashed HTML
    const htmlHashedPath = path.join(ASSETS_DIR, `${name}-${jsHash}.html`);
    fs.writeFileSync(htmlHashedPath, html, 'utf-8');

    // Write unhashed HTML (points to hashed assets)
    const htmlPath = path.join(ASSETS_DIR, `${name}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');

    console.log(`  ${name}.html (with preload hints)`);
  }
}

/**
 * Main build process
 */
async function main() {
  console.log('Starting widget build process...\n');

  // Clean assets directory
  if (fs.existsSync(ASSETS_DIR)) {
    fs.rmSync(ASSETS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  // Discover widget entry points
  const entries = fg.sync('src/**/index.{tsx,jsx}', {
    cwd: WIDGETS_DIR,
    absolute: false,
  });

  if (entries.length === 0) {
    console.error('No widget entries found in widgets/src/**/index.{tsx,jsx}');
    process.exit(1);
  }

  console.log(`Found ${entries.length} widget(s):\n`);
  entries.forEach((entry) => {
    const name = path.basename(path.dirname(entry));
    console.log(`  - ${name}`);
  });
  console.log();

  // Build widgets in parallel with concurrency limit
  const limit = pLimit(BUILD_CONCURRENCY);

  const buildPromises = entries.map((entry) =>
    limit(() => buildWidget(path.join(WIDGETS_DIR, entry)))
  );

  const builtWidgets = await Promise.all(buildPromises);

  // Generate hashed assets and HTML templates
  generateHashedAssets(builtWidgets);

  console.log('\nBuild complete!\n');
  console.log(`Assets directory: ${ASSETS_DIR}`);
  console.log(`Total widgets built: ${builtWidgets.length}\n`);
}

// Run
main().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
