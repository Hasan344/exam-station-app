// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend route prefixes — bunlar dev-də backend serverinə proxy olunur
const API_PREFIXES = [
  "/auth", "/sections", "/commissions", "/exercises",
  "/exams", "/students", "/results", "/imports", "/exports", "/api",
];

const proxy = Object.fromEntries(
  API_PREFIXES.map(p => [p, { target: "http://localhost:5050", changeOrigin: true }])
);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
