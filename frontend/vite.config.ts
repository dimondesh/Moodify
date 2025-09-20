// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

const BUNNY_CDN_HOSTNAME = "moodify-one.b-cdn.net";

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
            urlPattern: new RegExp(`^https://${BUNNY_CDN_HOSTNAME}/.*`, "i"),
            handler: "CacheFirst",
            options: {
              cacheName: "moodify-assets-cache",
              expiration: {
                maxEntries: 750,
                maxAgeSeconds: 60 * 60 * 24 * 60,
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
        "Spotify.svg",
        "liked.png",
        "liked.svg",
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
        theme_color: "#7B39EC",
        background_color: "#18181b",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
