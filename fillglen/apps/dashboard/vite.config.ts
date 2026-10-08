import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@fillglen/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@panel": path.resolve(__dirname, "../extension/src/panel"),
    },
  },
  server: { port: 5173 },
});
