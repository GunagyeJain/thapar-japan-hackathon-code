import { fileURLToPath, URL } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"

const API_TARGET = process.env.API_URL ?? "http://127.0.0.1:8000"

// m8: the service worker precaches the app shell so /crew opens in airplane mode.
// Japanese/Devanagari font subsets are cached as they are used (iPad falls back to system fonts).
const pwa = VitePWA({
  registerType: "autoUpdate",
  injectRegister: "auto",
  manifest: {
    name: "ThaliBento Crew · JL740",
    short_name: "TB Crew",
    start_url: "/crew",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0B1220",
    theme_color: "#0A2A66",
    icons: [{ src: "/crew/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,ico}", "**/{inter,archivo}-latin-*.woff2"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.endsWith(".woff2") || url.pathname.endsWith(".woff"),
        handler: "CacheFirst",
        options: { cacheName: "fonts", expiration: { maxEntries: 400 } },
      },
    ],
  },
})

// Shared zone: add plugins or aliases, don't rewrite.
export default defineConfig({
  plugins: [react(), tailwindcss(), pwa],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: { allow: [".."] },
    proxy: { "/api": { target: API_TARGET, changeOrigin: true } },
  },
  test: { environment: "node", include: ["src/**/*.test.ts", "src/**/*.test.tsx"] },
})
