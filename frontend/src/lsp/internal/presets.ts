import { tomlTable, type Ecosystem } from "./ecosystems";
import { PHPACTOR_INTEGRATIONS } from "./integrations";
import type { Command, Formats, FromProject, Look, Sign, Tool } from "./tool";

type Served = Tool & { readonly fileTypes: readonly string[] };

export type DetectedPreset = Served & { readonly ecosystem: Ecosystem; readonly look: Look };

type ListOnlyPreset = Served & { readonly ecosystem: null; readonly command: Command };

export type Preset = DetectedPreset | ListOnlyPreset;

const SCRIPTS = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
const PYTHON = ["py", "pyi"];
const TS_LSP_ARGS = ["--lsp", "--stdio"];
const STDIO = ["--stdio"];
const ALWAYS: Formats = { kind: "always" };
const NEVER: Formats = { kind: "never" };
const MANIFEST: readonly Sign[] = [{ kind: "manifest" }];
const NOTHING: FromProject = { kind: "nothing" };
const NO_OPTIONS = { settings: null, initializationOptions: null, fromProject: NOTHING } as const;

function pyprojectSection(tool: string): Sign {
  return { kind: "section", file: "pyproject.toml", line: tomlTable(`tool.${tool}`) };
}

type PythonTool = {
  readonly name: string;
  readonly package: string;
  readonly command: Command;
  readonly signs: readonly Sign[];
  readonly orProjectProgram: boolean;
  readonly formats: Formats;
  readonly fromProject: FromProject;
};

function pythonTool(tool: PythonTool): DetectedPreset {
  const { name, command, signs, orProjectProgram, formats, fromProject } = tool;
  return {
    name,
    ecosystem: "python",
    look: {
      kind: "used",
      signs,
      orProjectProgram,
      command,
      recipe: { kind: "python", package: tool.package },
      orElse: [],
    },
    fileTypes: PYTHON,
    formats,
    settings: null,
    initializationOptions: null,
    fromProject,
  };
}

const RUST_ANALYZER_OPTIONS = { checkOnSave: false };

const PHPACTOR_RELEASE =
  "https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar";

const DENO_OPTIONS = { enable: true, lint: true };

/** Detection order is spec order: the formatter first, since the first formatting spec formats. */
export const PRESETS: readonly Preset[] = [
  {
    name: "oxfmt",
    ecosystem: "node",
    look: { kind: "projectProgram", command: { program: "oxfmt", args: ["--lsp"] } },
    fileTypes: [
      ...SCRIPTS,
      "json",
      "jsonc",
      "json5",
      "css",
      "scss",
      "less",
      "html",
      "vue",
      "md",
      "yaml",
      "yml",
      "toml",
      "graphql",
    ],
    formats: ALWAYS,
    ...NO_OPTIONS,
  },
  {
    name: "Biome",
    ecosystem: "node",
    look: { kind: "projectProgram", command: { program: "biome", args: ["lsp-proxy"] } },
    fileTypes: [...SCRIPTS, "json", "jsonc", "css", "graphql"],
    formats: ALWAYS,
    ...NO_OPTIONS,
  },
  {
    name: "oxlint",
    ecosystem: "node",
    look: { kind: "projectProgram", command: { program: "oxlint", args: ["--lsp"] } },
    fileTypes: [...SCRIPTS, "vue"],
    formats: NEVER,
    settings: null,
    initializationOptions: (workspaceUri) => [{ workspaceUri, options: { run: "onType" } }],
    fromProject: NOTHING,
  },
  {
    name: "TypeScript",
    ecosystem: "node",
    look: {
      kind: "typescript",
      configs: ["tsconfig.json", "jsconfig.json"],
      package: "typescript",
      firstLspMajor: 7,
      compiler: { program: "tsc", args: TS_LSP_ARGS },
      nativePreview: { program: "tsgo", args: TS_LSP_ARGS },
      server: {
        command: { program: "typescript-language-server", args: STDIO },
        package: "typescript-language-server",
      },
    },
    fileTypes: SCRIPTS,
    formats: NEVER,
    ...NO_OPTIONS,
  },
  {
    name: "eslint",
    ecosystem: "node",
    look: {
      kind: "eslint",
      configs: [
        ...["js", "mjs", "cjs", "ts", "mts", "cts"].map((ext) => `eslint.config.${ext}`),
        ...["", ".js", ".cjs", ".json", ".yaml", ".yml"].map((ext) => `.eslintrc${ext}`),
      ],
      package: "eslint",
      server: {
        command: { program: "vscode-eslint-language-server", args: STDIO },
        package: "vscode-langservers-extracted",
      },
    },
    fileTypes: [...SCRIPTS, "vue"],
    formats: NEVER,
    settings: { validate: "on", run: "onType" },
    initializationOptions: null,
    fromProject: NOTHING,
  },
  {
    name: "rust-analyzer",
    ecosystem: "rust",
    look: {
      kind: "used",
      signs: MANIFEST,
      orProjectProgram: false,
      command: { program: "rust-analyzer", args: [] },
      recipe: { kind: "rustup", component: "rust-analyzer" },
      orElse: [],
    },
    fileTypes: ["rs"],
    formats: ALWAYS,
    settings: { "rust-analyzer": RUST_ANALYZER_OPTIONS },
    initializationOptions: () => RUST_ANALYZER_OPTIONS,
    fromProject: NOTHING,
  },
  {
    name: "gopls",
    ecosystem: "go",
    look: {
      kind: "used",
      signs: MANIFEST,
      orProjectProgram: false,
      command: { program: "gopls", args: [] },
      recipe: { kind: "go", module: "golang.org/x/tools/gopls@latest" },
      orElse: [],
    },
    fileTypes: ["go"],
    formats: ALWAYS,
    ...NO_OPTIONS,
  },
  pythonTool({
    name: "ruff",
    package: "ruff",
    command: { program: "ruff", args: ["server"] },
    signs: [
      { kind: "file", name: "ruff.toml" },
      { kind: "file", name: ".ruff.toml" },
      pyprojectSection("ruff"),
    ],
    orProjectProgram: true,
    formats: ALWAYS,
    fromProject: NOTHING,
  }),
  pythonTool({
    name: "ty",
    package: "ty",
    command: { program: "ty", args: ["server"] },
    signs: [{ kind: "file", name: "ty.toml" }, pyprojectSection("ty")],
    orProjectProgram: true,
    formats: NEVER,
    fromProject: NOTHING,
  }),
  pythonTool({
    name: "basedpyright",
    package: "basedpyright",
    command: { program: "basedpyright-langserver", args: STDIO },
    signs: [pyprojectSection("basedpyright")],
    orProjectProgram: true,
    formats: NEVER,
    fromProject: NOTHING,
  }),
  pythonTool({
    name: "pyright",
    package: "pyright",
    command: { program: "pyright-langserver", args: STDIO },
    signs: [{ kind: "file", name: "pyrightconfig.json" }, pyprojectSection("pyright")],
    orProjectProgram: false,
    formats: NEVER,
    fromProject: { kind: "venvPython" },
  }),
  {
    name: "Phpactor",
    ecosystem: "php",
    look: {
      kind: "used",
      signs: MANIFEST,
      orProjectProgram: false,
      command: { program: "phpactor", args: ["language-server"] },
      recipe: {
        kind: "download",
        command: `curl --create-dirs -Lo ~/.local/bin/phpactor ${PHPACTOR_RELEASE} && chmod a+x ~/.local/bin/phpactor`,
        needs: "PHP 8.2 or later",
      },
      orElse: [
        {
          name: "Intelephense",
          command: { program: "intelephense", args: STDIO },
          formats: NEVER,
          ...NO_OPTIONS,
        },
      ],
    },
    fileTypes: ["php"],
    formats: { kind: "withIntegration" },
    settings: null,
    initializationOptions: () => ({ "language_server.enable_trust_check": false }),
    fromProject: { kind: "integrations", integrations: PHPACTOR_INTEGRATIONS },
  },
  {
    name: "clangd",
    ecosystem: "clang",
    look: {
      kind: "used",
      signs: MANIFEST,
      orProjectProgram: false,
      command: { program: "clangd", args: [] },
      recipe: { kind: "system" },
      orElse: [],
    },
    fileTypes: ["c", "h", "cc", "cpp", "cxx", "hh", "hpp", "hxx"],
    formats: { kind: "withConfig", files: [".clang-format", "_clang-format"] },
    ...NO_OPTIONS,
  },
  {
    name: "Deno",
    ecosystem: null,
    command: { program: "deno", args: ["lsp"] },
    fileTypes: ["js", "jsx", "ts", "tsx", "mjs", "mts"],
    formats: ALWAYS,
    settings: { deno: DENO_OPTIONS },
    initializationOptions: () => DENO_OPTIONS,
    fromProject: NOTHING,
  },
  {
    name: "bash-language-server",
    ecosystem: null,
    command: { program: "bash-language-server", args: ["start"] },
    fileTypes: ["sh", "bash"],
    formats: ALWAYS,
    ...NO_OPTIONS,
  },
];

export const DETECTED_PRESETS: readonly DetectedPreset[] = PRESETS.flatMap((preset) =>
  preset.ecosystem === null ? [] : [preset],
);
