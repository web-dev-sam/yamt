import { expect, test } from "vitest";

import { addedSpecs } from "./added";

test("addedSpecs: the program's file name, served at the repository root, formatting allowed", () => {
  const specs = addedSpecs(
    [
      { command: ["/opt/bin/pylsp", "--check"], fileTypes: ["py"] },
      { command: ["C:\\tools\\taplo.exe", "lsp", "stdio"], fileTypes: ["toml"] },
    ],
    [],
  );

  expect(specs).toEqual([
    {
      name: "pylsp",
      command: { program: "/opt/bin/pylsp", args: ["--check"] },
      project: "",
      fileTypes: ["py"],
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
    },
    {
      name: "taplo.exe",
      command: { program: "C:\\tools\\taplo.exe", args: ["lsp", "stdio"] },
      project: "",
      fileTypes: ["toml"],
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
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
  );

  expect(specs.map(({ name }) => name)).toEqual(["oxlint (3)", "pylsp", "pylsp (2)", "oxlint (4)"]);
});
