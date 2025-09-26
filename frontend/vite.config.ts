// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  base: "/",

  plugins: [
    react(),
    visualizer({
      template: "treemap",
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: "bundle-analysis.html",
    }),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wav,mp3}"],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,

        runtimeCaching: [
          {
            // Этот кэш будет использоваться для явного скачивания HLS и обложек
            urlPattern: ({ url }) => url.hostname === "moodify-one.b-cdn.net",
            handler: "CacheFirst",
            options: {
              cacheName: "moodify-hls-assets-cache", // Новое, более точное имя
              expiration: {
                maxEntries: 1000, // Увеличим лимит для сегментов
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 дней
              },
              rangeRequests: true,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://moodify-fpvm.onrender.com/api",
            handler: "NetworkFirst",
            options: {
              cacheName: "moodify-api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      includeAssets: [
        "silent.mp3",
        "Moodify.svg",
        "Moodify.png",
        "default-album-cover.png",
        "robots.txt",
        "ir/small-room.wav",
        "ir/medium-room.wav",
        "ir/large-hall.wav",
      ],
      manifest: {
        name: "Moodify",
        short_name: "Moodify",
        description:
          "An advanced music streaming service for enthusiasts. Create complex mixes, use AI-generated playlists, and connect with friends in a rich audio environment.",
        theme_color: "#8b5cf6",
        background_color: "#18181b",
        icons: [
          {
            src: "Moodify.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "Moodify.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "Moodify.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "Moodify.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
