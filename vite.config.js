import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  // VITE_BASE_URL is set in CI to the GitHub Pages sub-path (e.g. /cinegraph/)
  // Locally it defaults to '/' so dev server works without any config
  base: process.env.VITE_BASE_URL || "/",
  server: {
    proxy: {
      "/api/tmdb": {
        target: "https://api.themoviedb.org/3",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tmdb/, ""),
      },
    },
  },
})
