import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/main.ts'),
        output: {
          entryFileNames: 'index.js',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: {
          entryFileNames: 'index.mjs',
        },
      },
    },
  },
  renderer: {
    root: '.',
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
  },
});
