import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Flightline",
        short_name: "Flightline",
        description: "Know before the gate does. Track flights, predict delays, and see the aircraft coming your way.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FAFAF8",
        theme_color: "#FAFAF8",
        categories: ["travel", "utilities"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.gstatic\.com\/flights\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "airline-logos",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['transportation-accidents-efficiently-calm.trycloudflare.com'],
  },
});
