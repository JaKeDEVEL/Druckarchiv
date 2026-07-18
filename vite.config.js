import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  build: { target: "es2021", minify: false, cssMinify: false, sourcemap: false }
});
