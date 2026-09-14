import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:4319" },
    watch: { ignored: ["**/src-tauri/**", "**/native/**", "**/resources/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: { target: "safari17", sourcemap: true },
});
