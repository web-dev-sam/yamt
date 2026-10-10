import { describe, expect, it } from "vitest";
import DefaultFile from "~icons/vscode-icons/default-file";
import Bazel from "~icons/vscode-icons/file-type-bazel";
import CMake from "~icons/vscode-icons/file-type-cmake";
import DartLang from "~icons/vscode-icons/file-type-dartlang";
import Docker from "~icons/vscode-icons/file-type-docker";
import Git from "~icons/vscode-icons/file-type-git";
import Jenkins from "~icons/vscode-icons/file-type-jenkins";
import Json from "~icons/vscode-icons/file-type-json";
import Npm from "~icons/vscode-icons/file-type-npm";
import ReactTs from "~icons/vscode-icons/file-type-reactts";
import TypeScript from "~icons/vscode-icons/file-type-typescript";
import TypeScriptDef from "~icons/vscode-icons/file-type-typescriptdef";
import Vue from "~icons/vscode-icons/file-type-vue";

import { fileIcon } from "./fileIcon";

describe("fileIcon", () => {
  it("prefers the file name over the extension", () => {
    expect(fileIcon("package.json")).toBe(Npm);
    expect(fileIcon("data.json")).toBe(Json);
    expect(fileIcon("BUILD")).toBe(Bazel);
    expect(fileIcon("Jenkinsfile")).toBe(Jenkins);
  });

  it("prefers the longer extension over its suffix", () => {
    expect(fileIcon("env.d.ts")).toBe(TypeScriptDef);
    expect(fileIcon("main.ts")).toBe(TypeScript);
    expect(fileIcon("main.test.ts")).toBe(TypeScript);
    expect(fileIcon("config.cmake.in")).toBe(CMake);
  });

  it("maps languages the editor colours", () => {
    expect(fileIcon("main.dart")).toBe(DartLang);
  });

  it("matches extensions and names regardless of case", () => {
    expect(fileIcon("App.VUE")).toBe(Vue);
    expect(fileIcon("Dockerfile")).toBe(Docker);
  });

  it("looks only at the last path segment", () => {
    expect(fileIcon("src/app/main.tsx")).toBe(ReactTs);
    expect(fileIcon("package.json/readme")).toBe(DefaultFile);
    expect(fileIcon("web.d/.gitignore")).toBe(Git);
  });

  it("falls back to the generic file icon", () => {
    expect(fileIcon("NOTES")).toBe(DefaultFile);
    expect(fileIcon(".prettierrc")).toBe(DefaultFile);
    expect(fileIcon("archive.unknownext")).toBe(DefaultFile);
  });

  it("ignores keys inherited from Object.prototype", () => {
    expect(fileIcon("constructor")).toBe(DefaultFile);
    expect(fileIcon("__proto__")).toBe(DefaultFile);
    expect(fileIcon("weird.constructor")).toBe(DefaultFile);
    expect(fileIcon("weird.__proto__")).toBe(DefaultFile);
  });

  it("does not take a dotfile's name as its extension", () => {
    expect(fileIcon(".ts")).toBe(DefaultFile);
  });
});
