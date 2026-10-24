import { fileURLToPath, URL } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const API_TARGET = process.env.API_URL ?? "http://127.0.0.1:8000"

// Shared zone: add plugins or aliases, don't rewrite.
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
