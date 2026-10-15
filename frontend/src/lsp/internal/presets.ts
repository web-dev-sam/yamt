import type { Ecosystem } from "./ecosystems";

type Command = { readonly program: string; readonly args: readonly string[] };

type Installable = { readonly command: Command; readonly package: string };

export type Formats =
  | { readonly kind: "always" }
  | { readonly kind: "never" }
  | { readonly kind: "withConfig"; readonly files: readonly string[] };

export type Tool = {
  readonly name: string;
  readonly formats: Formats;
  readonly settings: unknown;
  readonly initializationOptions: ((workspaceUri: string) => unknown) | null;
};

export type Recipe =
  | { readonly kind: "python"; readonly package: string }
  | { readonly kind: "rustup"; readonly component: string }
  | { readonly kind: "go"; readonly module: string }
  | { readonly kind: "download"; readonly command: string; readonly needs: string | null }
  | { readonly kind: "system" };

export type Sign =
  | { readonly kind: "manifest" }
  | { readonly kind: "file"; readonly name: string }
  | { readonly kind: "section"; readonly file: string; readonly line: RegExp };

export type Look =
  | { readonly kind: "projectProgram"; readonly command: Command }
  | {
      readonly kind: "used";
      readonly signs: readonly Sign[];
      readonly orProjectProgram: boolean;
      readonly command: Command;
      readonly recipe: Recipe;
      readonly orElse: readonly (Tool & { readonly command: Command })[];
    }
  | {
      readonly kind: "typescript";
      readonly configs: readonly string[];
      readonly package: string;
      readonly firstLspMajor: number;
      readonly compiler: Command;
      readonly nativePreview: Command;
      readonly server: Installable;
    }
  | {
      readonly kind: "eslint";
      readonly configs: readonly string[];
      readonly package: string;
      readonly server: Installable;
    };

export type Preset = Tool & {
  readonly ecosystem: Ecosystem;
  readonly look: Look;
  readonly fileTypes: readonly string[];
};

const SCRIPTS = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
const PYTHON = ["py", "pyi"];
const TS_LSP_ARGS = ["--lsp", "--stdio"];
const STDIO = ["--stdio"];
const ALWAYS: Formats = { kind: "always" };
const NEVER: Formats = { kind: "never" };
const MANIFEST: readonly Sign[] = [{ kind: "manifest" }];
const NO_OPTIONS = { settings: null, initializationOptions: null } as const;

function pyprojectSection(tool: string): Sign {
  return {
    kind: "section",
    file: "pyproject.toml",
    line: new RegExp(`^[ \\t]*\\[tool\\.${tool}[\\].]`, "m"),
  };
}

type PythonTool = {
  readonly name: string;
  readonly command: Command;
  readonly signs: readonly Sign[];
  readonly orProjectProgram: boolean;
  readonly formats: Formats;
};

function pythonTool({ name, command, signs, orProjectProgram, formats }: PythonTool): Preset {
  return {
    name,
    ecosystem: "python",
    look: {
      kind: "used",
      signs,
      orProjectProgram,
      command,
      recipe: { kind: "python", package: name },
      orElse: [],
    },
    fileTypes: PYTHON,
    formats,
    ...NO_OPTIONS,
  };
}

const RUST_ANALYZER_OPTIONS = { checkOnSave: false };

const PHPACTOR_RELEASE =
  "https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar";

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
    command: { program: "ruff", args: ["server"] },
    signs: [
      { kind: "file", name: "ruff.toml" },
      { kind: "file", name: ".ruff.toml" },
      pyprojectSection("ruff"),
    ],
    orProjectProgram: true,
    formats: ALWAYS,
  }),
  pythonTool({
    name: "ty",
    command: { program: "ty", args: ["server"] },
    signs: [{ kind: "file", name: "ty.toml" }, pyprojectSection("ty")],
    orProjectProgram: true,
    formats: NEVER,
  }),
  pythonTool({
    name: "basedpyright",
    command: { program: "basedpyright-langserver", args: STDIO },
    signs: [pyprojectSection("basedpyright")],
    orProjectProgram: true,
    formats: NEVER,
  }),
  pythonTool({
    name: "pyright",
    command: { program: "pyright-langserver", args: STDIO },
    signs: [{ kind: "file", name: "pyrightconfig.json" }, pyprojectSection("pyright")],
    orProjectProgram: false,
    formats: NEVER,
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
        command: `curl -Lo ~/.local/bin/phpactor ${PHPACTOR_RELEASE} && chmod a+x ~/.local/bin/phpactor`,
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
    formats: NEVER,
    settings: null,
    initializationOptions: () => ({ "language_server.enable_trust_check": false }),
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
];
