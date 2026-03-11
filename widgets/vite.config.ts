import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'vite-plugin-compression';
import { widgetDiscoveryPlugin } from './vite-plugin-widgets';
import path from 'path';

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads all .env vars (not just VITE_-prefixed ones).
  // Inject into process.env so vite-plugin-widgets can read BASE_URL at build time.
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  if (env.BASE_URL && !process.env.BASE_URL) {
    process.env.BASE_URL = env.BASE_URL;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const inlineAssets = env.INLINE_DEV_MODE === 'true';
  const widgetPort = Number(process.env.WIDGET_PORT || env.WIDGET_PORT || 4444);

  return {
    envDir: '..', // load .env from repo root for import.meta.env in client code
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
      widgetDiscoveryPlugin(),
      tailwindcss(),
      ...(isProd
        ? [
            compression({
              algorithm: 'gzip',
              ext: '.gz',
            }),
            compression({
              algorithm: 'brotliCompress',
              ext: '.br',
            }),
          ]
        : []),
    ],
    server: {
      port: widgetPort,
      strictPort: true,
      cors: true,
      fs: {
        allow: ['..'],
      },
    },
    publicDir: '../assets',
    build: {
      target: 'es2023',
      outDir: '../assets',
      emptyOutDir: false,
      sourcemap: true,
      ...(inlineAssets ? { assetsInlineLimit: 100 * 1024 } : {}), // 100KB in inline mode to embed local images as data URIs
      minify: isProd ? 'esbuild' : false,
      ...(isProd
        ? {
            terserOptions: {
              compress: {
                drop_console: true,
                drop_debugger: true,
              },
            },
          }
        : {}),
      rollupOptions: {
        output: {
          format: 'es',
          manualChunks: undefined,
        },
      },
      chunkSizeWarningLimit: 500,
    },
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react',
      target: 'es2023',
    },
  };
});
