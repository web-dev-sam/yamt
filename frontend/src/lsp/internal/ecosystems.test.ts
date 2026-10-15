import { expect, test } from "vitest";

import type { ProjectFile } from "../../ipc";
import {
  ECOSYSTEMS,
  EVERY_ECOSYSTEM_FOLDERS,
  fileHolds,
  manifestPaths,
  projectOf,
  tomlTable,
  type Ecosystem,
  type Files,
} from "./ecosystems";

function files(tree: Readonly<Record<string, string | ProjectFile>>): Files {
  return new Map(
    Object.entries(tree).map(([path, entry]): [string, ProjectFile] => [
      path,
      typeof entry === "string" ? { kind: "Text", text: entry } : entry,
    ]),
  );
}

test.each<[Ecosystem, string]>([
  ["node", "package.json"],
  ["python", "pyproject.toml"],
  ["python", "setup.py"],
  ["python", "setup.cfg"],
  ["python", "requirements.txt"],
  ["rust", "Cargo.toml"],
  ["go", "go.mod"],
  ["go", "go.work"],
  ["php", "composer.json"],
  ["clang", "compile_commands.json"],
  ["clang", "compile_flags.txt"],
  ["clang", ".clangd"],
])("%s: %s makes its folder a project, nested, at the root, or not at all", (ecosystem, name) => {
  expect(projectOf(ecosystem, "a/b/src", files({ [`a/b/${name}`]: "" }))).toBe("a/b");
  expect(projectOf(ecosystem, "a/b/src", files({ [name]: "" }))).toBe("");
  expect(projectOf(ecosystem, "", files({ [name]: "" }))).toBe("");
  expect(projectOf(ecosystem, "a/b/src", files({ [`x/${name}`]: "" }))).toBeNull();
  expect(projectOf(ecosystem, "a/b/src", files({ [`a/${name}`]: { kind: "Folder" } }))).toBeNull();
});

test("rust: the nearest workspace Cargo.toml beats a member's own", () => {
  const tree = files({
    "rs/Cargo.toml": '[workspace]\nmembers = ["core"]\n',
    "rs/core/Cargo.toml": '[package]\nname = "core"\n',
  });

  expect(projectOf("rust", "rs/core/src", tree)).toBe("rs");
});

test("rust: a [workspace.*] table counts as a workspace, a mention in text does not", () => {
  const dotted = files({
    "Cargo.toml": "[package]\n[workspace.dependencies]\n",
    "core/Cargo.toml": "",
  });
  const mention = files({
    "Cargo.toml": '[package]\ndescription = "no [workspace] here"\n',
    "core/Cargo.toml": "",
  });

  expect(projectOf("rust", "core/src", dotted)).toBe("");
  expect(projectOf("rust", "core/src", mention)).toBe("core");
});

test("rust: no workspace anywhere, the nearest Cargo.toml", () => {
  const tree = files({ "Cargo.toml": "[package]\n", "tools/x/Cargo.toml": "[package]\n" });

  expect(projectOf("rust", "tools/x/src", tree)).toBe("tools/x");
});

test("rust: a workspace Cargo.toml too large to read is a plain Cargo.toml", () => {
  const tree = files({ "Cargo.toml": { kind: "TooLarge" }, "core/Cargo.toml": "" });

  expect(projectOf("rust", "core/src", tree)).toBe("core");
  expect(projectOf("rust", "src", tree)).toBe("");
});

test("go: go.work beats a nearer go.mod", () => {
  const tree = files({ "go.work": "go 1.22\n", "svc/go.mod": "module svc\n" });

  expect(projectOf("go", "svc/calc", tree)).toBe("");
  expect(projectOf("go", "svc/calc", files({ "svc/go.mod": "" }))).toBe("svc");
});

test("clang: build/compile_commands.json makes the folder holding build/ the project", () => {
  const tree = files({ "c/build/compile_commands.json": "[]" });

  expect(projectOf("clang", "c/src", tree)).toBe("c");
  expect(manifestPaths("clang", "c")).toContain("c/build/compile_commands.json");
});

test("manifests are read along the folder chain, rule by rule", () => {
  expect(manifestPaths("node", "a/b")).toEqual([
    "a/b/package.json",
    "a/package.json",
    "package.json",
  ]);
  expect(manifestPaths("go", "a")).toEqual(["a/go.work", "go.work", "a/go.mod", "go.mod"]);
});

test("program folders per ecosystem", () => {
  expect(
    Object.fromEntries(Object.entries(ECOSYSTEMS).map(([name, facts]) => [name, facts.folders])),
  ).toEqual({
    node: { project: ["node_modules/.bin"], home: [] },
    python: {
      project: [".venv/bin", ".venv/Scripts", "venv/bin", "venv/Scripts"],
      home: [".local/bin"],
    },
    rust: { project: [], home: [".cargo/bin"] },
    go: { project: [], home: ["go/bin"] },
    php: {
      project: ["vendor/bin"],
      home: [".config/composer/vendor/bin", ".composer/vendor/bin", ".local/bin"],
    },
    clang: { project: [], home: [] },
  });
});

test("added servers look in every ecosystem's folders, de-duplicated, in table order", () => {
  expect(EVERY_ECOSYSTEM_FOLDERS).toEqual({
    project: [
      "node_modules/.bin",
      ".venv/bin",
      ".venv/Scripts",
      "venv/bin",
      "venv/Scripts",
      "vendor/bin",
    ],
    home: [
      ".local/bin",
      ".cargo/bin",
      "go/bin",
      ".config/composer/vendor/bin",
      ".composer/vendor/bin",
    ],
  });
});

test("a TOML table header: plain, indented or dotted counts; a commented line or a longer name does not", () => {
  const ruff = tomlTable("tool.ruff");

  expect(
    ["[tool.ruff]", "  [tool.ruff]", "\t[tool.ruff.lint]", "x = 1\n[tool.ruff]"].map((text) =>
      ruff.test(text),
    ),
  ).toEqual([true, true, true, true]);
  expect(
    ["# [tool.ruff]", "[tool.ruffle]", "[toolxruff]", "x = '[tool.ruff]'"].map((text) =>
      ruff.test(text),
    ),
  ).toEqual([false, false, false, false]);
});

test("rust: an indented [workspace] header counts", () => {
  const tree = files({
    "Cargo.toml": '  [workspace]\nmembers = ["core"]\n',
    "core/Cargo.toml": "",
  });

  expect(projectOf("rust", "core/src", tree)).toBe("");
});

test("a pattern holds only in a readable text file", () => {
  const pattern = /^\[workspace\]/m;

  expect(fileHolds({ kind: "Text", text: "[workspace]" }, pattern)).toBe(true);
  expect(fileHolds({ kind: "Text", text: "[package]" }, pattern)).toBe(false);
  expect(fileHolds({ kind: "TooLarge" }, pattern)).toBe(false);
  expect(fileHolds(undefined, pattern)).toBe(false);
});
