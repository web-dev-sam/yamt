type Command = { readonly program: string; readonly args: readonly string[] };

type Installable = { readonly command: Command; readonly package: string };

export type Look =
  | { readonly kind: "projectProgram"; readonly command: Command }
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

export type Preset = {
  readonly name: string;
  readonly look: Look;
  readonly fileTypes: readonly string[];
  readonly formats: boolean;
  readonly settings: unknown;
  readonly initializationOptions: ((workspaceUri: string) => unknown) | null;
};

const SCRIPTS = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
const TS_LSP_ARGS = ["--lsp", "--stdio"];
const STDIO = ["--stdio"];

/** Detection order is spec order: the formatter first, since the first formatting spec formats. */
export const PRESETS: readonly Preset[] = [
  {
    name: "oxfmt",
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
    formats: true,
    settings: null,
    initializationOptions: null,
  },
  {
    name: "oxlint",
    look: { kind: "projectProgram", command: { program: "oxlint", args: ["--lsp"] } },
    fileTypes: [...SCRIPTS, "vue"],
    formats: false,
    settings: null,
    initializationOptions: (workspaceUri) => [{ workspaceUri, options: { run: "onType" } }],
  },
  {
    name: "TypeScript",
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
    formats: false,
    settings: null,
    initializationOptions: null,
  },
  {
    name: "eslint",
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
    formats: false,
    settings: { validate: "on", run: "onType" },
    initializationOptions: null,
  },
];
