import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";
import { VitePWA } from 'vite-plugin-pwa';


export default defineConfig({
  base: "/",
  // Set build time for service worker cache-busting
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(Date.now().toString())
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Enable service worker in development for push notification testing
      devOptions: {
        enabled: true
      },
      // Use existing manifest.json from public folder (more complete)
      manifest: false,
      // Manual registration via registerSW() in main.jsx
      injectRegister: false,
      workbox: {
        // Import push notification handlers into the service worker
        importScripts: ['/push-handler.js'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/auth/, /^\/api/, /^\/asset/],
        // Exclude manifest.webmanifest since we use manifest.json from public folder
        globPatterns: ['**/*.{js,css,html}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@public": fileURLToPath(new URL("./public", import.meta.url)),
    },
  },
  publicDir: "public",
  envDir: "./src",
  server: {
    port: 3000,
  },
});
