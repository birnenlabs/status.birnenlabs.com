import {defineConfig} from 'vite'
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  esbuild: {
    keepNames: true, // Need to keep names for modules loader to work.
  },
});
