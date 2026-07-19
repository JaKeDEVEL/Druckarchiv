import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "development") },
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  build: { target: "es2021", minify: false, cssMinify: false, sourcemap: false }
});
