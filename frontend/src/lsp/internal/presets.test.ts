import { expect, test } from "vitest";

import { DETECTED_PRESETS, PRESETS, type DetectedPreset } from "./presets";
import type { Look } from "./tool";

function preset(name: string): DetectedPreset {
  const found = DETECTED_PRESETS.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`no preset ${name}`);
  }
  return found;
}

function usedLook(name: string): Extract<Look, { kind: "used" }> {
  const { look } = preset(name);
  if (look.kind !== "used") {
    throw new Error(`${name} is not a used look`);
  }
  return look;
}

const SCRIPTS = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];

test("presets run formatters first, in the table's order, each in its ecosystem", () => {
  expect(PRESETS.map(({ name, ecosystem }) => `${name}:${ecosystem}`)).toEqual([
    "oxfmt:node",
    "Biome:node",
    "oxlint:node",
    "TypeScript:node",
    "eslint:node",
    "rust-analyzer:rust",
    "gopls:go",
    "ruff:python",
    "ty:python",
    "basedpyright:python",
    "pyright:python",
    "Phpactor:php",
    "clangd:clang",
    "Deno:null",
    "bash-language-server:null",
  ]);
  expect(DETECTED_PRESETS.map(({ name }) => name)).toEqual(
    PRESETS.slice(0, -2).map(({ name }) => name),
  );
  expect(PRESETS.slice(-2)).toEqual([
    expect.objectContaining({
      command: { program: "deno", args: ["lsp"] },
      fileTypes: ["js", "jsx", "ts", "tsx", "mjs", "mts"],
    }),
    expect.objectContaining({
      command: { program: "bash-language-server", args: ["start"] },
      fileTypes: ["sh", "bash"],
    }),
  ]);
  expect(PRESETS.map(({ name, formats }) => [name, formats.kind])).toEqual([
    ["oxfmt", "always"],
    ["Biome", "always"],
    ["oxlint", "never"],
    ["TypeScript", "never"],
    ["eslint", "never"],
    ["rust-analyzer", "always"],
    ["gopls", "always"],
    ["ruff", "always"],
    ["ty", "never"],
    ["basedpyright", "never"],
    ["pyright", "never"],
    ["Phpactor", "never"],
    ["clangd", "withConfig"],
    ["Deno", "always"],
    ["bash-language-server", "always"],
  ]);
  expect(preset("clangd").formats).toEqual({
    kind: "withConfig",
    files: [".clang-format", "_clang-format"],
  });
});

test("each preset serves its file types", () => {
  expect(preset("oxfmt").fileTypes).toEqual([
    ...SCRIPTS,
    ..."json jsonc json5 css scss less html vue md yaml yml toml graphql".split(" "),
  ]);
  expect(preset("Biome").fileTypes).toEqual([...SCRIPTS, "json", "jsonc", "css", "graphql"]);
  expect(preset("oxlint").fileTypes).toEqual([...SCRIPTS, "vue"]);
  expect(preset("TypeScript").fileTypes).toEqual(SCRIPTS);
  expect(preset("eslint").fileTypes).toEqual([...SCRIPTS, "vue"]);
  expect(preset("rust-analyzer").fileTypes).toEqual(["rs"]);
  expect(preset("gopls").fileTypes).toEqual(["go"]);
  for (const name of ["ruff", "ty", "basedpyright", "pyright"]) {
    expect(preset(name).fileTypes).toEqual(["py", "pyi"]);
  }
  expect(preset("Phpactor").fileTypes).toEqual(["php"]);
  expect(preset("clangd").fileTypes).toEqual(["c", "h", "cc", "cpp", "cxx", "hh", "hpp", "hxx"]);
});

test("settings and start options: oxlint on type, eslint on type, rust-analyzer without cargo check, Phpactor without its trust prompt", () => {
  expect(preset("oxlint").initializationOptions?.("file:///repo/frontend")).toEqual([
    { workspaceUri: "file:///repo/frontend", options: { run: "onType" } },
  ]);
  expect(preset("eslint").settings).toEqual({ validate: "on", run: "onType" });
  expect(preset("rust-analyzer").settings).toEqual({ "rust-analyzer": { checkOnSave: false } });
  expect(preset("rust-analyzer").initializationOptions?.("file:///repo/rs")).toEqual({
    checkOnSave: false,
  });
  expect(preset("Phpactor").initializationOptions?.("file:///repo/php")).toEqual({
    "language_server.enable_trust_check": false,
  });
  expect(PRESETS.filter((p) => p.initializationOptions !== null).map(({ name }) => name)).toEqual([
    "oxlint",
    "rust-analyzer",
    "Phpactor",
    "Deno",
  ]);
  expect(PRESETS.filter((p) => p.settings !== null).map(({ name }) => name)).toEqual([
    "eslint",
    "rust-analyzer",
    "Deno",
  ]);
  const deno = PRESETS.find(({ name }) => name === "Deno");
  expect(deno?.initializationOptions?.("file:///repo")).toEqual({ enable: true, lint: true });
  expect(deno?.settings).toEqual({ deno: { enable: true, lint: true } });
  expect(
    PRESETS.filter((p) => p.fromProject.kind !== "nothing").map((p) => [
      p.name,
      p.fromProject.kind,
    ]),
  ).toEqual([
    ["pyright", "venvPython"],
    ["Phpactor", "integrations"],
  ]);
});

test("commands: Biome's proxy, the Python servers, Phpactor then Intelephense", () => {
  expect(preset("Biome").look).toEqual({
    kind: "projectProgram",
    command: { program: "biome", args: ["lsp-proxy"] },
  });
  expect(
    ["rust-analyzer", "gopls", "ruff", "ty", "basedpyright", "pyright", "Phpactor", "clangd"].map(
      (name) => {
        const { command } = usedLook(name);
        return [command.program, ...command.args].join(" ");
      },
    ),
  ).toEqual([
    "rust-analyzer",
    "gopls",
    "ruff server",
    "ty server",
    "basedpyright-langserver --stdio",
    "pyright-langserver --stdio",
    "phpactor language-server",
    "clangd",
  ]);
  expect(usedLook("Phpactor").orElse).toEqual([
    {
      name: "Intelephense",
      command: { program: "intelephense", args: ["--stdio"] },
      formats: { kind: "never" },
      settings: null,
      initializationOptions: null,
      fromProject: { kind: "nothing" },
    },
  ]);
});

test("install recipes per ecosystem", () => {
  expect(usedLook("rust-analyzer").recipe).toEqual({ kind: "rustup", component: "rust-analyzer" });
  expect(usedLook("gopls").recipe).toEqual({
    kind: "go",
    module: "golang.org/x/tools/gopls@latest",
  });
  expect(["ruff", "ty", "basedpyright", "pyright"].map((name) => usedLook(name).recipe)).toEqual([
    { kind: "python", package: "ruff" },
    { kind: "python", package: "ty" },
    { kind: "python", package: "basedpyright" },
    { kind: "python", package: "pyright" },
  ]);
  expect(usedLook("Phpactor").recipe).toEqual({
    kind: "download",
    command:
      "curl --create-dirs -Lo ~/.local/bin/phpactor https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar && chmod a+x ~/.local/bin/phpactor",
    needs: "PHP 8.2 or later",
  });
  expect(usedLook("clangd").recipe).toEqual({ kind: "system" });
});

test("pyproject sections match the tool's own tables only", () => {
  const ruff = usedLook("ruff").signs.find((sign) => sign.kind === "section");
  const line = ruff?.kind === "section" ? ruff.line : /$^/;

  expect(
    ["[tool.ruff]", "[tool.ruff.lint]", "  [tool.ruff]"].map((text) => line.test(text)),
  ).toEqual([true, true, true]);
  expect(["[tool.ruffle]", "# [tool.ruff]", "[tool.black]"].map((text) => line.test(text))).toEqual(
    [false, false, false],
  );
});

test("eslint's configs are the flat config and the legacy .eslintrc forms", () => {
  const { look } = preset("eslint");
  expect(look.kind === "eslint" && look.configs).toEqual([
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    "eslint.config.mts",
    "eslint.config.cts",
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yaml",
    ".eslintrc.yml",
  ]);
});
