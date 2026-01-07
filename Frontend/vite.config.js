import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";
import { VitePWA } from 'vite-plugin-pwa';


export default defineConfig({
  base: "/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Enable service worker in development for push notification testing
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Pickleball Community',
        short_name: 'PB Community',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Import push notification handlers into the service worker
        importScripts: ['/push-handler.js'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/auth/, /^\/api/, /^\/asset/],
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
