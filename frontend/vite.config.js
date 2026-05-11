// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
export default defineConfig({
    base: "/",
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            devOptions: {
                enabled: false,
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,wav,mp3}"],
                maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
                navigateFallback: "/index.html",
                cleanupOutdatedCaches: true,
                sourcemap: false,
                runtimeCaching: [
                    {
                        // HLS manifests + segments + keys from CDN
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.pathname.endsWith(".m3u8") ||
                                url.pathname.endsWith(".ts") ||
                                url.pathname.endsWith(".m4s") ||
                                url.pathname.endsWith(".aac") ||
                                url.pathname.endsWith(".key");
                        },
                        handler: "CacheFirst",
                        options: {
                            cacheName: "moodify-hls-assets-cache",
                            expiration: {
                                maxEntries: 5000,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // Images (covers, artists) for offline library
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === "image";
                        },
                        handler: "CacheFirst",
                        options: {
                            cacheName: "moodify-image-cache",
                            expiration: {
                                maxEntries: 2000,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
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
                description: "An advanced music streaming service for enthusiasts. Create complex mixes and connect with friends in a rich audio environment.",
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
