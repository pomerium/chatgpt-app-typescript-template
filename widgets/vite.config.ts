import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'vite-plugin-compression';
import { widgetDiscoveryPlugin } from './vite-plugin-widgets';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';
const widgetPort = Number(process.env.WIDGET_PORT || 4444);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(), // React plugin first to handle JSX transforms
    widgetDiscoveryPlugin(), // Then widget discovery
    tailwindcss(),
    // Production compression only
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
  },
  build: {
    target: 'es2023',
    outDir: '../assets',
    emptyOutDir: false,
    sourcemap: true,
    minify: isProd ? 'esbuild' : false, // Use esbuild instead of terser
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
        manualChunks: undefined, // Single bundle per widget
      },
    },
    chunkSizeWarningLimit: 500,
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    target: 'es2023',
  },
});
