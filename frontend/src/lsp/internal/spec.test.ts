import { expect, test } from "vitest";

import { languageId } from "./languageIds";
import { extensionOf, serves, type ServerSpec } from "./spec";

const SPEC: ServerSpec = {
  name: "oxlint",
  command: { program: "oxlint", args: [] },
  project: "frontend",
  fileTypes: ["ts", "vue"],
  formats: false,
  settings: null,
  initializationOptions: null,
  install: null,
};

test("the extension is the last dotted part of the file name, lower case", () => {
  expect(extensionOf("src/App.VUE")).toBe("vue");
  expect(extensionOf("a.d.ts")).toBe("ts");
  expect(extensionOf("v1.2/Makefile")).toBe("");
  expect(extensionOf(".gitignore")).toBe("");
  expect(extensionOf("src/.env")).toBe("");
});

test("a spec serves files with its extensions under its project folder only", () => {
  expect(serves(SPEC, "frontend/src/a.ts")).toBe(true);
  expect(serves(SPEC, "frontend/a.css")).toBe(false);
  expect(serves(SPEC, "frontendish/a.ts")).toBe(false);
  expect(serves(SPEC, "a.ts")).toBe(false);
  expect(serves({ ...SPEC, project: "" }, "deep/down/a.ts")).toBe(true);
});

test("language ids come from the table; an unknown extension is its own id", () => {
  expect(languageId("a.ts")).toBe("typescript");
  expect(languageId("a.tsx")).toBe("typescriptreact");
  expect(languageId("a.YML")).toBe("yaml");
  expect(languageId("a.zig")).toBe("zig");
  expect(languageId("a.constructor")).toBe("constructor");
});
