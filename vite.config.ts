import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png", "icon-180.png"],
      manifest: {
        name: "Flightline",
        short_name: "Flightline",
        description: "Know before the gate does. Track flights, predict delays, and see the aircraft coming your way.",
        scope: "/",
        start_url: "/#/",
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
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['transportation-accidents-efficiently-calm.trycloudflare.com'],
  },
});
