import {defineConfig} from 'vite';
import {resolve} from 'path';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      manifest: {
        display: 'standalone',
        name: 'Status Bar',
        short_name: 'Status Bar',
        background_color: '#4c4c4c',
        theme_color: '#4c4c4c',
        display_override: ['window-controls-overlay'],
        icons: [
          {
            src: './icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        oauth: resolve(__dirname, 'oauth.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
      preserveEntrySignatures: 'strict',
      output: {
        // Has to be false to avoid firebase error:
        // "Service database is not available".
        preserveModules: false,
      },
    },
  },
  esbuild: {
    keepNames: true, // Need to keep names for modules loader to work.
  },
});
