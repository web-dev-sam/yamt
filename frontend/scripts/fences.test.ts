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

test("jsonrpc importing vue, @vueuse, @tauri-apps or an icon component violates PM3", () => {
  const files = [
    { path: "src/jsonrpc/index.ts", text: `import { ref } from "vue";` },
    {
      path: "src/jsonrpc/internal/connection.ts",
      text: `import { useTimeoutFn } from "@vueuse/core";`,
    },
    {
      path: "src/jsonrpc/internal/timers.ts",
      text: `import { Channel } from "@tauri-apps/api/core";`,
    },
    { path: "src/jsonrpc/internal/messages.ts", text: `import x from "~icons/lucide/x";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM3", file: "src/jsonrpc/index.ts", specifier: "vue" },
    { rule: "PM3", file: "src/jsonrpc/internal/connection.ts", specifier: "@vueuse/core" },
    { rule: "PM3", file: "src/jsonrpc/internal/timers.ts", specifier: "@tauri-apps/api/core" },
    { rule: "PM3", file: "src/jsonrpc/internal/messages.ts", specifier: "~icons/lucide/x" },
  ]);
});

test("jsonrpc importing any other src/ module violates PM2", () => {
  const files = [
    { path: "src/jsonrpc/index.ts", text: `import type { ServerHost } from "../ipc";` },
    { path: "src/jsonrpc/internal/connection.ts", text: `import "../../lsp/index.ts";` },
    { path: "src/jsonrpc/internal/messages.ts", text: `import { log } from "../../ipc/log";` },
    { path: "src/jsonrpc/internal/timers.ts", text: `import "../../main";` },
    { path: "src/jsonrpc/a.ts", text: `import "../jsonrpcx/b";` },
  ];

  expect(
    findFenceViolations(files).map(({ file, rule, reason }) => ({ file, rule, reason })),
  ).toEqual(
    files.map(({ path }) => ({
      file: path,
      rule: "PM2",
      reason: "jsonrpc/ imports no other src/ module",
    })),
  );
});

test("jsonrpc importing itself and valibot, and lsp importing jsonrpc, violate nothing", () => {
  const files = [
    { path: "src/jsonrpc/index.ts", text: `export { Connection } from "./internal/connection";` },
    {
      path: "src/jsonrpc/internal/connection.ts",
      text: `import { parseIncoming } from "./messages";\nimport type { Timers } from "./timers.ts";`,
    },
    {
      path: "src/jsonrpc/internal/connection.test.ts",
      text: `import { Connection } from "../index";`,
    },
    { path: "src/jsonrpc/internal/messages.ts", text: `import * as v from "valibot";` },
    { path: "src/jsonrpc/sample.ts", text: `import "../../fixtures/sample/base.ts.txt?raw";` },
    { path: "src/lsp/internal/attempt.ts", text: `import { Connection } from "../../jsonrpc";` },
    { path: "src/lsp/index.ts", text: `import type { Timers } from "../jsonrpc/index.ts";` },
  ];

  expect(violationsOf(files)).toEqual([]);
});

test("lsp importing jsonrpc's internal/ violates PM5", () => {
  const files = [
    {
      path: "src/lsp/internal/a.ts",
      text: `import { Connection } from "../../jsonrpc/internal/connection";`,
    },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM5", file: "src/lsp/internal/a.ts", specifier: "../../jsonrpc/internal/connection" },
  ]);
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

test("a range file importing the merge root, the compare root or lsp/ violates PM9", () => {
  const files = [
    { path: "src/ui/rangeStore.ts", text: `import { useAppStore } from "./store";` },
    {
      path: "src/ui/RangeApp.vue",
      text: `<script setup lang="ts">\nimport App from "./App.vue";\n</script>`,
    },
    {
      path: "src/ui/RangeView.vue",
      text: `<script setup lang="ts">\nimport { useCompareStore } from "./compareStore";\n</script>`,
    },
    {
      path: "src/ui/RangeFileRow.vue",
      text: `<script setup lang="ts">\nimport "./CompareApp.vue";\n</script>`,
    },
    { path: "src/ui/rangeText.ts", text: `import "./compareStore.ts";` },
    { path: "src/ui/useRangeController.ts", text: `import type { X } from "../lsp";` },
    { path: "src/ui/useRangeLoad.test.ts", text: `import "./store.ts";` },
  ];

  expect(findFenceViolations(files)).toEqual([
    {
      rule: "PM9",
      file: "src/ui/rangeStore.ts",
      specifier: "./store",
      reason: "the range window never imports the merge window's root",
    },
    {
      rule: "PM9",
      file: "src/ui/RangeApp.vue",
      specifier: "./App.vue",
      reason: "the range window never imports the merge window's root",
    },
    {
      rule: "PM9",
      file: "src/ui/RangeView.vue",
      specifier: "./compareStore",
      reason: "the range window never imports the compare window's root",
    },
    {
      rule: "PM9",
      file: "src/ui/RangeFileRow.vue",
      specifier: "./CompareApp.vue",
      reason: "the range window never imports the compare window's root",
    },
    {
      rule: "PM9",
      file: "src/ui/rangeText.ts",
      specifier: "./compareStore.ts",
      reason: "the range window never imports the compare window's root",
    },
    {
      rule: "PM9",
      file: "src/ui/useRangeController.ts",
      specifier: "../lsp",
      reason: "the range window never imports lsp/",
    },
    {
      rule: "PM9",
      file: "src/ui/useRangeLoad.test.ts",
      specifier: "./store.ts",
      reason: "the range window never imports the merge window's root",
    },
  ]);
});

test("a compare file importing the range root violates PM7", () => {
  const files = [
    { path: "src/ui/compareStore.ts", text: `import { useRangeStore } from "./rangeStore";` },
    {
      path: "src/ui/CompareApp.vue",
      text: `<script setup lang="ts">\nimport RangeApp from "./RangeApp.vue";\n</script>`,
    },
  ];

  expect(findFenceViolations(files)).toEqual([
    {
      rule: "PM7",
      file: "src/ui/compareStore.ts",
      specifier: "./rangeStore",
      reason: "the compare window never imports the range window's root",
    },
    {
      rule: "PM7",
      file: "src/ui/CompareApp.vue",
      specifier: "./RangeApp.vue",
      reason: "the compare window never imports the range window's root",
    },
  ]);
});

test("range files importing shared ui files and their own neighbours violate nothing", () => {
  const files = [
    {
      path: "src/ui/RangeApp.vue",
      text: `<script setup lang="ts">\nimport FileList from "./FileList.vue";\nimport "./rangeStore";\n</script>`,
    },
    { path: "src/ui/rangeStore.ts", text: `import "./settingsStore";\nimport "./fileListKey";` },
    {
      path: "src/ui/RangeView.vue",
      text: `<script setup lang="ts">\nimport "./paneSplit";\n</script>`,
    },
    { path: "src/ui/useRangeController.ts", text: `import "../editor";` },
    { path: "src/ui/storeRange.ts", text: `import "./compareStore";` },
  ];

  expect(violationsOf(files)).toEqual([]);
});

test("a ui file importing MarkdownView from editor/index.ts outside useMarkdown.ts violates PM2", () => {
  const files = [
    {
      path: "src/ui/AiTurn.vue",
      text: `<script setup lang="ts">\nimport { MarkdownView as View } from "../editor/index.ts";\n</script>`,
    },
    { path: "src/ui/answer.ts", text: `export { MarkdownView } from "../editor";` },
    { path: "src/ui/whole.ts", text: `import * as editor from "../editor";` },
    { path: "src/ui/direct.ts", text: `import type { X } from "../editor/markdown";` },
    { path: "src/ui/star.ts", text: `export * from "../editor";` },
    { path: "src/ui/direct2.ts", text: `import { X } from "../editor/markdown.ts";` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM2", file: "src/ui/AiTurn.vue", specifier: "../editor/index.ts" },
    { rule: "PM2", file: "src/ui/answer.ts", specifier: "../editor" },
    { rule: "PM2", file: "src/ui/whole.ts", specifier: "../editor" },
    { rule: "PM2", file: "src/ui/direct.ts", specifier: "../editor/markdown" },
    { rule: "PM2", file: "src/ui/star.ts", specifier: "../editor" },
    { rule: "PM2", file: "src/ui/direct2.ts", specifier: "../editor/markdown.ts" },
  ]);
});

test("useMarkdown.ts importing MarkdownView and other ui files importing the editor's other names violate nothing", () => {
  const files = [
    { path: "src/ui/useMarkdown.ts", text: `import { MarkdownView } from "../editor";` },
    { path: "src/ui/useMergeController.ts", text: `import { MergeController } from "../editor";` },
    {
      path: "src/ui/AiTurn.vue",
      text: `<script setup lang="ts">\nimport { useMarkdown } from "./useMarkdown";\n</script>`,
    },
    { path: "src/editor/index.ts", text: `export { MarkdownView } from "./markdown";` },
    { path: "src/ui/ns.ts", text: `import * as sides from "./sides";` },
    { path: "src/ui/re.ts", text: `export { MergeController } from "../editor";` },
  ];

  expect(violationsOf(files)).toEqual([]);
});

test("reading clipboardData or navigator.clipboard outside ui/linuxPaste.ts violates PM8", () => {
  const files = [
    {
      path: "src/editor/internal/paste.ts",
      text: `view.dom.addEventListener("paste", (event) => event.clipboardData?.getData("text/plain"));`,
    },
    { path: "src/ui/copy.ts", text: `const text = await navigator.clipboard.readText();` },
    {
      path: "src/ipc/items.ts",
      text: `const items = await window.navigator["clipboard"]["read"]();`,
    },
    {
      path: "src/ui/Field.vue",
      text: `<script setup lang="ts">\nfunction onPaste({ clipboardData }: ClipboardEvent) {}\n</script>`,
    },
    { path: "src/lsp/internal/take.ts", text: `const { readText } = navigator.clipboard;` },
    { path: "src/ui/data.ts", text: `const data = event["clipboardData"];` },
  ];

  expect(violationsOf(files)).toEqual([
    { rule: "PM8", file: "src/editor/internal/paste.ts", specifier: "event.clipboardData" },
    { rule: "PM8", file: "src/ui/copy.ts", specifier: "navigator.clipboard.readText" },
    { rule: "PM8", file: "src/ipc/items.ts", specifier: `window.navigator["clipboard"]["read"]` },
    { rule: "PM8", file: "src/ui/Field.vue", specifier: "clipboardData" },
    { rule: "PM8", file: "src/lsp/internal/take.ts", specifier: "readText" },
    { rule: "PM8", file: "src/ui/data.ts", specifier: `event["clipboardData"]` },
  ]);
  expect(findFenceViolations(files.slice(0, 1)).map(({ reason }) => reason)).toEqual([
    "only ui/linuxPaste.ts reads the clipboard through WebKit (plan §2 #99)",
  ]);
});

test("ui/linuxPaste.ts reading, and writing the clipboard or a paste's data anywhere, violate nothing", () => {
  const files = [
    {
      path: "src/ui/linuxPaste.ts",
      text: `const text = event.clipboardData?.getData("text/plain");`,
    },
    { path: "src/ui/ServerMenu.ts", text: `await navigator.clipboard.writeText(command);` },
    {
      path: "src/ui/paste.ts",
      text: `new ClipboardEvent("paste", { clipboardData, bubbles: true });\nconst read = file.read();`,
    },
    { path: "src/ui/reader.ts", text: "function f({ readText }: Clipboard) {}" },
    { path: "src/ui/linuxPaste.test.ts", text: "const data = event.clipboardData;" },
  ];

  expect(violationsOf(files)).toEqual([]);
});
