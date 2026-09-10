import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.PLEGA_BASE_PATH || "/",
  server: { port: 5903, strictPort: true },
  preview: { port: 4903, strictPort: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 1100 },
});
