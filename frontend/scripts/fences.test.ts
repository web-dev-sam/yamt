import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import {
  findFenceViolations,
  readSourceTree,
  type FenceViolation,
  type SourceFile,
} from "./fences";

const FRONTEND_ROOT = fileURLToPath(new URL("..", import.meta.url));

function violationsOf(files: SourceFile[]): Omit<FenceViolation, "reason">[] {
  return findFenceViolations(files).map(({ rule, file, specifier }) => ({ rule, file, specifier }));
}

test("the real source tree has no fence violations", () => {
  expect(findFenceViolations(readSourceTree(FRONTEND_ROOT))).toEqual([]);
});

test("readSourceTree reports PM2 probes on disk and skips src/ipc/bindings.ts", () => {
  const root = mkdtempSync(join(tmpdir(), "yamt-fences-"));
  try {
    const probes: Record<string, string> = {
      "src/ui/probe.ts": `import "@codemirror/state";\n`,
      "src/ui/Probe.vue": `<script setup lang="ts">\nimport { EditorView } from "@codemirror/view";\n</script>\n<template><p>{{ EditorView }}</p></template>\n`,
      "src/ipc/bindings.ts": `import "./bindings";\n`,
    };
    for (const [path, text] of Object.entries(probes)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }

    expect(violationsOf(readSourceTree(root))).toEqual([
      { rule: "PM2", file: "src/ui/Probe.vue", specifier: "@codemirror/view" },
      { rule: "PM2", file: "src/ui/probe.ts", specifier: "@codemirror/state" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ui importing @codemirror/view violates PM2", () => {
  const files = [
    { path: "src/ui/Pane.ts", text: `import { EditorView } from "@codemirror/view";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/Pane.ts", specifier: "@codemirror/view" },
  ]);
});

test("ui importing editor/internal violates PM2", () => {
  const files = [
    { path: "src/ui/Pane.ts", text: `import { pane } from "../editor/internal/pane";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/Pane.ts", specifier: "../editor/internal/pane" },
  ]);
});

test("ui side-effect importing model violates PM2", () => {
  const files = [{ path: "src/ui/store.ts", text: `import "../model";` }];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/store.ts", specifier: "../model" },
  ]);
});

test("editor dynamically importing vue violates PM3", () => {
  const files = [
    { path: "src/editor/index.ts", text: `export async function load() { return import("vue"); }` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM3", file: "src/editor/index.ts", specifier: "vue" },
  ]);
});

test("connectors re-exporting @vueuse/core violates PM3", () => {
  const files = [
    { path: "src/connectors/raf.ts", text: `export { useRafFn } from "@vueuse/core";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM3", file: "src/connectors/raf.ts", specifier: "@vueuse/core" },
  ]);
});

test("both script blocks of a ui .vue file are checked", () => {
  const text = `<script lang="ts">
import "@codemirror/state";
</script>
<script setup lang="ts">
import { pane } from "../editor/internal";
</script>
<template><p>{{ pane }}</p></template>
`;
  const files = [{ path: "src/ui/MergeView.vue", text }];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/MergeView.vue", specifier: "@codemirror/state" },
    { rule: "PM2", file: "src/ui/MergeView.vue", specifier: "../editor/internal" },
  ]);
});

test("editor importing ipc/internal violates PM5", () => {
  const files = [{ path: "src/editor/apply.ts", text: `import { x } from "../ipc/internal/x";` }];

  expect(violationsOf(files)).toEqual([
    { rule: "PM5", file: "src/editor/apply.ts", specifier: "../ipc/internal/x" },
  ]);
});

test("a two-file cycle violates PM5 once", () => {
  const files = [
    { path: "src/model/a.ts", text: `import { b } from "./b";\nexport const a = 1;` },
    { path: "src/model/b/index.ts", text: `import { a } from "../a.ts";\nexport const b = a;` },
  ];

  expect(violationsOf(files)).toEqual([{ rule: "PM5", file: "src/model/a.ts", specifier: "./b" }]);
});

test("a type-only import into model violates PM2", () => {
  const files = [{ path: "src/ui/store.ts", text: `import type { Chunk } from "../model/chunk";` }];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/store.ts", specifier: "../model/chunk" },
  ]);
});

test("a ?raw import of an allowed file violates nothing", () => {
  const files = [
    {
      path: "src/editor/index.ts",
      text: `import theme from "./theme.css?raw";\nexport { theme };`,
    },
  ];

  expect(violationsOf(files)).toEqual([]);
});

test("a module importing its own internal/ is allowed", () => {
  const files = [
    { path: "src/editor/index.ts", text: `export { pane } from "./internal/pane";` },
    { path: "src/editor/internal/pane.ts", text: `export const pane = 1;` },
  ];

  expect(violationsOf(files)).toEqual([]);
});
