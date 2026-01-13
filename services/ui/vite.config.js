import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api/ingest": {
        target: "http://ingest:4301",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ingest/, "")
      },
      "/api/observe": {
        target: "http://observe:4302",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/observe/, "")
      },
      "/api/diagnose": {
        target: "http://diagnose:4303",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/diagnose/, "")
      }
    }
  }
});
