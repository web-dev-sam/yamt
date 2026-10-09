import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/model/**/*.test.ts",
            "src/connectors/**/*.test.ts",
            "src/ipc/**/*.test.ts",
            "src/ui/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/editor/**/*.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "webkit" }],
          },
        },
      },
    ],
  },
});
