import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'vite-plugin-compression';
import { widgetDiscoveryPlugin } from './vite-plugin-widgets';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [
    widgetDiscoveryPlugin(), // Auto-discovers widgets from src/**/index.{tsx,jsx}
    tailwindcss(),
    react(),
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
