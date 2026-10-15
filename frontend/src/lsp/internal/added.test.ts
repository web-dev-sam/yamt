import { expect, test } from "vitest";

import { addedSpecs } from "./added";
import { EVERY_ECOSYSTEM_FOLDERS } from "./ecosystems";

const ROOT = "/repo";

test("addedSpecs: an unmatched program keeps its file name, served at the repository root, formatting allowed", () => {
  const specs = addedSpecs(
    [
      { command: ["/opt/bin/pylsp", "--check"], fileTypes: ["py"] },
      { command: ["C:\\tools\\taplo.exe", "lsp", "stdio"], fileTypes: ["toml"] },
    ],
    [],
    ROOT,
  );

  expect(specs).toEqual([
    {
      name: "pylsp",
      command: { program: "/opt/bin/pylsp", args: ["--check"] },
      project: "",
      folders: EVERY_ECOSYSTEM_FOLDERS,
      fileTypes: ["py"],
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
      help: null,
      notes: [],
    },
    {
      name: "taplo.exe",
      command: { program: "C:\\tools\\taplo.exe", args: ["lsp", "stdio"] },
      project: "",
      folders: EVERY_ECOSYSTEM_FOLDERS,
      fileTypes: ["toml"],
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
      help: null,
      notes: [],
    },
  ]);
});

test("addedSpecs: a repeated or taken name gets (2), (3) …; an empty command is skipped", () => {
  const specs = addedSpecs(
    [
      { command: ["oxlint", "--lsp"], fileTypes: ["ts"] },
      { command: [], fileTypes: ["ts"] },
      { command: [""], fileTypes: ["ts"] },
      { command: ["bin/"], fileTypes: ["ts"] },
      { command: ["pylsp"], fileTypes: ["py"] },
      { command: ["bin/pylsp"], fileTypes: ["pyi"] },
      { command: ["oxlint"], fileTypes: ["vue"] },
    ],
    ["oxlint", "oxlint (2)"],
    ROOT,
  );

  expect(specs.map(({ name }) => name)).toEqual(["oxlint (3)", "pylsp", "pylsp (2)", "oxlint (4)"]);
});

test("addedSpecs: `ruff server` matches ruff: its name, rules and help; the typed program and file types stay", () => {
  const [ruff] = addedSpecs(
    [{ command: ["/home/u/.venv/bin/ruff", "server"], fileTypes: ["py", "pyw"] }],
    ["ruff"],
    ROOT,
  );

  expect(ruff).toEqual({
    name: "ruff (2)",
    command: { program: "/home/u/.venv/bin/ruff", args: ["server"] },
    project: "",
    folders: EVERY_ECOSYSTEM_FOLDERS,
    fileTypes: ["py", "pyw"],
    formats: true,
    settings: null,
    initializationOptions: null,
    install: null,
    help: { kind: "python", package: "ruff", program: "ruff", folder: "", manager: null },
    notes: [],
  });
});

test("addedSpecs: `intelephense.cmd --stdio` in a folder matches Intelephense and never formats", () => {
  const [intelephense] = addedSpecs(
    [{ command: ["/opt/x/intelephense.cmd", "--stdio"], fileTypes: ["php"] }],
    [],
    ROOT,
  );

  expect(intelephense).toEqual(
    expect.objectContaining({ name: "Intelephense", formats: false, help: null }),
  );
});

test("addedSpecs: a preset's start options are built for the repository root; a tool that may format (its rule or a formatting integration) formats", () => {
  const specs = addedSpecs(
    [
      { command: ["oxlint", "--lsp"], fileTypes: ["ts"] },
      { command: ["phpactor.bat", "language-server"], fileTypes: ["php"] },
      { command: ["rust-analyzer.EXE"], fileTypes: ["rs"] },
      { command: ["deno", "lsp"], fileTypes: ["ts"] },
      { command: ["vscode-eslint-language-server", "--stdio"], fileTypes: ["js"] },
    ],
    [],
    ROOT,
  );

  expect(specs.map(({ name, formats }) => [name, formats])).toEqual([
    ["oxlint", false],
    ["Phpactor", true],
    ["rust-analyzer", true],
    ["Deno", true],
    ["eslint", false],
  ]);
  expect(specs[0]?.initializationOptions).toEqual([
    { workspaceUri: "file:///repo", options: { run: "onType" } },
  ]);
  expect(specs[1]?.initializationOptions).toEqual({ "language_server.enable_trust_check": false });
  expect(specs[2]?.help).toEqual({
    kind: "rustup",
    component: "rust-analyzer",
    program: "rust-analyzer",
  });
  expect(specs[3]?.settings).toEqual({ deno: { enable: true, lint: true } });
  expect(specs[4]?.help).toEqual({
    kind: "node",
    package: "vscode-langservers-extracted",
    program: "vscode-eslint-language-server",
    folder: "",
    manager: null,
    reason: { kind: "eslint" },
  });
});

test("addedSpecs: other arguments, or a name that only contains a preset's, match nothing", () => {
  const specs = addedSpecs(
    [
      { command: ["ruff", "server", "--preview"], fileTypes: ["py"] },
      { command: ["ruff"], fileTypes: ["py"] },
      { command: ["myruff", "server"], fileTypes: ["py"] },
      { command: ["ruff.exe.old", "server"], fileTypes: ["py"] },
    ],
    [],
    ROOT,
  );

  expect(specs.map(({ name, help }) => [name, help])).toEqual([
    ["ruff", null],
    ["ruff (2)", null],
    ["myruff", null],
    ["ruff.exe.old", null],
  ]);
});
