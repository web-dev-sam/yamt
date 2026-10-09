import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";

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
            "src/editor/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
          exclude: [...configDefaults.exclude, "**/*.browser.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/editor/**/*.browser.test.ts"],
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
