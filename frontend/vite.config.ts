import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";
import Icons from "unplugin-icons/vite";
import { configDefaults, defineConfig } from "vitest/config";

// Stryker's vitest runner transforms every project's test files; the WebKit probes import the Tailwind
// stylesheet, which vite's CSS plugin cannot transform in Stryker's workers. Mutation runs use the node tests only.
const mutating = process.env["STRYKER_MUTATOR_WORKER"] !== undefined;
const browserProject = {
  extends: true,
  test: {
    name: "browser",
    include: ["src/editor/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "webkit" as const }],
    },
  },
};

export default defineConfig({
  plugins: [vue(), tailwindcss(), Icons({ compiler: "vue3" })],
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
            "src/lsp/**/*.test.ts",
            "src/jsonrpc/**/*.test.ts",
            "src/agent/**/*.test.ts",
            "src/search/**/*.test.ts",
            "src/mergeRequests/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
          exclude: [...configDefaults.exclude, "**/*.browser.test.ts"],
        },
      },
      ...(mutating ? [] : [browserProject]),
    ],
  },
});
