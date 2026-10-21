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

test("ui importing @tauri-apps/api/window violates PM2", () => {
  const files = [
    {
      path: "src/ui/App.vue",
      text: `<script setup lang="ts">\nimport { getCurrentWindow } from "@tauri-apps/api/window";\n</script>`,
    },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/App.vue", specifier: "@tauri-apps/api/window" },
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

test("editor importing a Lucide icon as a component violates PM3", () => {
  const files = [
    { path: "src/editor/internal/strips.ts", text: `import x from "~icons/lucide/x";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM3", file: "src/editor/internal/strips.ts", specifier: "~icons/lucide/x" },
  ]);
});

test("a ?raw icon in editor and an icon component in ui violate nothing", () => {
  const files = [
    { path: "src/editor/internal/strips.ts", text: `import x from "~icons/lucide/x?raw";` },
    {
      path: "src/ui/FileList.vue",
      text: `<script setup lang="ts">\nimport C from "~icons/lucide/check";\n</script>`,
    },
  ];

  expect(violationsOf(files)).toEqual([]);
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

test("an extensionless two-file cycle violates PM5 once", () => {
  const files = [
    { path: "src/model/a.ts", text: `import "./b";` },
    { path: "src/model/b.ts", text: `import "./a";` },
  ];

  expect(violationsOf(files)).toEqual([{ rule: "PM5", file: "src/model/a.ts", specifier: "./b" }]);
});

test("a cycle through a .vue file violates PM5 once", () => {
  const files = [
    {
      path: "src/ui/A.vue",
      text: `<script setup lang="ts">\nimport { b } from "./b";\n</script>\n<template><p>{{ b }}</p></template>\n`,
    },
    { path: "src/ui/b.ts", text: `import "./A";\nexport const b = 1;` },
  ];

  expect(violationsOf(files)).toEqual([{ rule: "PM5", file: "src/ui/A.vue", specifier: "./b" }]);
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

test("a ?raw import of model from ui violates PM2", () => {
  const files = [{ path: "src/ui/s.ts", text: `import "../model?raw";` }];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/s.ts", specifier: "../model?raw" },
  ]);
});

test("ui importing an internal/ directory outside src/ is allowed", () => {
  const files = [{ path: "src/ui/s.ts", text: `import "../../fixtures/internal/x.txt?raw";` }];

  expect(violationsOf(files)).toEqual([]);
});

test("a module importing its own internal/ is allowed", () => {
  const files = [
    { path: "src/editor/index.ts", text: `export { pane } from "./internal/pane";` },
    { path: "src/editor/internal/pane.ts", text: `export const pane = 1;` },
  ];

  expect(violationsOf(files)).toEqual([]);
});

test("lsp importing vue or @tauri-apps violates PM3", () => {
  const files = [
    { path: "src/lsp/index.ts", text: `import { ref } from "vue";` },
    { path: "src/lsp/internal/server.ts", text: `import { Channel } from "@tauri-apps/api/core";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM3", file: "src/lsp/index.ts", specifier: "vue" },
    { rule: "PM3", file: "src/lsp/internal/server.ts", specifier: "@tauri-apps/api/core" },
  ]);
});

test("lsp importing editor, ui, model or connectors violates PM2", () => {
  const files = [
    { path: "src/lsp/index.ts", text: `import { MergeController } from "../editor";` },
    { path: "src/lsp/internal/a.ts", text: `import type { Store } from "../../ui/store";` },
    { path: "src/lsp/internal/b.ts", text: `import "../../model";` },
    { path: "src/lsp/internal/c.ts", text: `import { bandPath } from "../../connectors";` },
  ];

  expect(
    findFenceViolations(files).map(({ file, rule, reason }) => ({ file, rule, reason })),
  ).toEqual([
    { file: "src/lsp/index.ts", rule: "PM2", reason: "lsp/ never imports editor/" },
    { file: "src/lsp/internal/a.ts", rule: "PM2", reason: "lsp/ never imports ui/" },
    { file: "src/lsp/internal/b.ts", rule: "PM2", reason: "lsp/ never imports model/" },
    { file: "src/lsp/internal/c.ts", rule: "PM2", reason: "lsp/ never imports connectors/" },
  ]);
});

test("lsp importing ipc's index and its own internal/ violates nothing", () => {
  const files = [
    { path: "src/lsp/index.ts", text: `export { Server } from "./internal/server";` },
    { path: "src/lsp/internal/server.ts", text: `import type { ServerHost } from "../../ipc";` },
  ];

  expect(violationsOf(files)).toEqual([]);
});

test("a compare file importing the merge store, App.vue or lsp/ violates PM7", () => {
  const files = [
    { path: "src/ui/compareStore.ts", text: `import { useAppStore } from "./store";` },
    {
      path: "src/ui/CompareApp.vue",
      text: `<script setup lang="ts">\nimport App from "./App.vue";\n</script>`,
    },
    {
      path: "src/ui/CompareTabList.vue",
      text: `<script setup lang="ts">\nimport "./store.ts";\n</script>`,
    },
    {
      path: "src/ui/CompareLanguagePicker.vue",
      text: `<script setup lang="ts">\nimport "../lsp";\n</script>`,
    },
    { path: "src/ui/useCompareController.ts", text: `import type { X } from "../lsp/index.ts";` },
    { path: "src/ui/useCompareFormat.test.ts", text: `import "./store";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM7", file: "src/ui/compareStore.ts", specifier: "./store" },
    { rule: "PM7", file: "src/ui/CompareApp.vue", specifier: "./App.vue" },
    { rule: "PM7", file: "src/ui/CompareTabList.vue", specifier: "./store.ts" },
    { rule: "PM7", file: "src/ui/CompareLanguagePicker.vue", specifier: "../lsp" },
    { rule: "PM7", file: "src/ui/useCompareController.ts", specifier: "../lsp/index.ts" },
    { rule: "PM7", file: "src/ui/useCompareFormat.test.ts", specifier: "./store" },
  ]);
});

test("merge files importing the store and compare files importing their own neighbours violate nothing", () => {
  const files = [
    {
      path: "src/ui/MergeView.vue",
      text: `<script setup lang="ts">\nimport "./store";\n</script>`,
    },
    { path: "src/ui/compareStore.ts", text: `import "./settingsStore";\nimport "./storeless";` },
    { path: "src/ui/TabList.vue", text: `<script setup lang="ts">\nimport "./store";\n</script>` },
    {
      path: "src/ui/CompareView.vue",
      text: `<script setup lang="ts">\nimport "./compareStore";\n</script>`,
    },
  ];

  expect(violationsOf(files)).toEqual([]);
});
