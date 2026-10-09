import { expect, test } from "vitest";

import { languageOf } from "./language";

test.each([
  ["App.vue", "Vue"],
  ["src/components/Provider.tsx", "TSX"],
  ["use-magic-keys.ts", "TypeScript"],
  ["vite.config.mts", "TypeScript"],
  ["public/index.php", "PHP"],
  ["src/docker/Dockerfile", "Dockerfile"],
])("%s is coloured as %s", (path, name) => {
  expect(languageOf(path)?.name).toBe(name);
});

test("a file name no language claims stays plain", () => {
  expect(languageOf("notes.yamt-unknown")).toBeNull();
});
