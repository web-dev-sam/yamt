import { expect, test } from "vitest";

import { presetChoices } from "./choices";

test("presetChoices: every preset's own server command in table order, PHP as Phpactor then Intelephense, each name once", () => {
  const choices = presetChoices();

  expect(choices.map(({ name, command }) => `${name}: ${command.join(" ")}`)).toEqual([
    "oxfmt: oxfmt --lsp",
    "Biome: biome lsp-proxy",
    "oxlint: oxlint --lsp",
    "TypeScript: typescript-language-server --stdio",
    "eslint: vscode-eslint-language-server --stdio",
    "rust-analyzer: rust-analyzer",
    "gopls: gopls",
    "ruff: ruff server",
    "ty: ty server",
    "basedpyright: basedpyright-langserver --stdio",
    "pyright: pyright-langserver --stdio",
    "Phpactor: phpactor language-server",
    "Intelephense: intelephense --stdio",
    "clangd: clangd",
    "Deno: deno lsp",
    "bash-language-server: bash-language-server start",
  ]);
  expect(new Set(choices.map(({ name }) => name)).size).toBe(choices.length);
});

test("presetChoices: each server's file types are its preset's", () => {
  const types = Object.fromEntries(presetChoices().map(({ name, fileTypes }) => [name, fileTypes]));

  expect(types["TypeScript"]).toEqual(["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"]);
  expect(types["Intelephense"]).toEqual(["php"]);
  expect(types["Deno"]).toEqual(["js", "jsx", "ts", "tsx", "mjs", "mts"]);
  expect(types["bash-language-server"]).toEqual(["sh", "bash"]);
});
