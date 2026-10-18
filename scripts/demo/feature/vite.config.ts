import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": { target: "https://staging.taskboard.example", changeOrigin: true },
    },
  },
});
