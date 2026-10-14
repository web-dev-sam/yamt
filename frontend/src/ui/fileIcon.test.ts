import { expect, test } from "vitest";
import DefaultFile from "~icons/vscode-icons/default-file";
import Bazel from "~icons/vscode-icons/file-type-bazel";
import CMake from "~icons/vscode-icons/file-type-cmake";
import DartLang from "~icons/vscode-icons/file-type-dartlang";
import Docker from "~icons/vscode-icons/file-type-docker";
import Git from "~icons/vscode-icons/file-type-git";
import Jenkins from "~icons/vscode-icons/file-type-jenkins";
import Json from "~icons/vscode-icons/file-type-json";
import Meson from "~icons/vscode-icons/file-type-meson";
import Npm from "~icons/vscode-icons/file-type-npm";
import ReactTs from "~icons/vscode-icons/file-type-reactts";
import TypeScript from "~icons/vscode-icons/file-type-typescript";
import TypeScriptDef from "~icons/vscode-icons/file-type-typescriptdef";
import Vue from "~icons/vscode-icons/file-type-vue";

import { fileIcon, ICON_ROWS } from "./fileIcon";

function repeatedOrEmptyKeys(rows: (typeof ICON_ROWS)["byName"]): string[] {
  const keys = rows.flatMap(([, rowKeys]) => rowKeys.split(" "));
  return keys.filter((key, index) => key === "" || keys.indexOf(key) !== index);
}

test("fileIcon: prefers the file name over the extension", () => {
  expect(fileIcon("package.json")).toBe(Npm);
  expect(fileIcon("data.json")).toBe(Json);
  expect(fileIcon("meson.build")).toBe(Meson);
  expect(fileIcon("meson.build")).not.toBe(Bazel);
  expect(fileIcon("rules.build")).toBe(Bazel);
});

test("fileIcon: knows literal file names without an extension", () => {
  expect(fileIcon("BUILD")).toBe(Bazel);
  expect(fileIcon("Jenkinsfile")).toBe(Jenkins);
});

test("fileIcon: names every key once, none empty, in the name rows and in the extension rows", () => {
  expect(repeatedOrEmptyKeys(ICON_ROWS.byName)).toEqual([]);
  expect(repeatedOrEmptyKeys(ICON_ROWS.byExtension)).toEqual([]);
});

test("fileIcon: resolves every table name to its row's icon", () => {
  for (const [icon, names] of ICON_ROWS.byName) {
    for (const name of names.split(" ")) {
      expect(fileIcon(`dir/${name}`)).toBe(icon);
    }
  }
});

test("fileIcon: prefers the longer extension over its suffix", () => {
  expect(fileIcon("env.d.ts")).toBe(TypeScriptDef);
  expect(fileIcon("main.ts")).toBe(TypeScript);
  expect(fileIcon("main.test.ts")).toBe(TypeScript);
  expect(fileIcon("config.cmake.in")).toBe(CMake);
});

test("fileIcon: maps languages the editor colours", () => {
  expect(fileIcon("main.dart")).toBe(DartLang);
});

test("fileIcon: matches extensions and names regardless of case", () => {
  expect(fileIcon("App.VUE")).toBe(Vue);
  expect(fileIcon("Dockerfile")).toBe(Docker);
});

test("fileIcon: looks only at the last path segment", () => {
  expect(fileIcon("src/app/main.tsx")).toBe(ReactTs);
  expect(fileIcon("package.json/readme")).toBe(DefaultFile);
  expect(fileIcon("web.d/.gitignore")).toBe(Git);
});

test("fileIcon: falls back to the generic file icon", () => {
  expect(fileIcon("NOTES")).toBe(DefaultFile);
  expect(fileIcon(".prettierrc")).toBe(DefaultFile);
  expect(fileIcon("archive.unknownext")).toBe(DefaultFile);
});

test("fileIcon: ignores keys inherited from Object.prototype", () => {
  expect(fileIcon("constructor")).toBe(DefaultFile);
  expect(fileIcon("__proto__")).toBe(DefaultFile);
  expect(fileIcon("weird.constructor")).toBe(DefaultFile);
  expect(fileIcon("weird.__proto__")).toBe(DefaultFile);
});

test("fileIcon: does not take a dotfile's name as its extension", () => {
  expect(fileIcon(".ts")).toBe(DefaultFile);
});
