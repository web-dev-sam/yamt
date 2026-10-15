import { expect, test } from "vitest";

import type { InstallHint, PackageManager, PythonManager, ServerState } from "../lsp";
import { failureHelp, installText } from "./installText";

type NodeHint = Extract<InstallHint, { kind: "node" }>;

type PythonHint = Extract<InstallHint, { kind: "python" }>;

const TS_HINT: NodeHint = {
  kind: "node",
  package: "typescript-language-server",
  program: "typescript-language-server",
  folder: "frontend",
  manager: "pnpm",
  reason: { kind: "typescript", version: "5.9.3" },
};

const ESLINT_HINT: NodeHint = {
  kind: "node",
  package: "vscode-langservers-extracted",
  program: "vscode-eslint-language-server",
  folder: "",
  manager: "npm",
  reason: { kind: "eslint" },
};

const VUE_HINT: NodeHint = {
  kind: "node",
  package: "@vue/typescript-plugin",
  program: "@vue/typescript-plugin",
  folder: "web",
  manager: "pnpm",
  reason: { kind: "vue" },
};

const RUFF_HINT: PythonHint = {
  kind: "python",
  package: "ruff",
  program: "ruff",
  folder: "py",
  manager: "uv",
};

const COME_BACK = "yamt finds it when you come back to this window.";

test.each<[PackageManager, string, string]>([
  ["npm", "npm install -D p", "npm install -g p"],
  ["pnpm", "pnpm add -D p", "pnpm add -g p"],
  ["yarn", "yarn add -D p", "yarn global add p"],
  ["yarnBerry", "yarn add -D p", "npm install -g p"],
  ["bun", "bun add --dev p", "bun add -g p"],
])("rule 4: %s installs with `%s` here and `%s` for all projects", (manager, project, global) => {
  const text = installText({ ...TS_HINT, package: "p", manager });

  expect(text.steps.map((step) => step.command)).toEqual([project, global]);
  expect(text.notes).toEqual([]);
});

test("rule 4: an unknown manager gets npm's commands and the note to use your own", () => {
  const text = installText({ ...TS_HINT, manager: null });

  expect(text.steps.map((step) => step.command)).toEqual([
    "npm install -D typescript-language-server",
    "npm install -g typescript-language-server",
  ]);
  expect(text.notes).toEqual(["Or the same with your package manager."]);
});

test("rule 4: the TypeScript and eslint sentences, the PATH line and the come-back line", () => {
  const typescript = installText(TS_HINT);
  const eslint = installText(ESLINT_HINT);

  expect(typescript.reason).toBe(
    "This project uses TypeScript 5.9.3, which needs the separate package typescript-language-server.",
  );
  expect(eslint.reason).toBe(
    "eslint's language server is the separate package vscode-langservers-extracted.",
  );
  expect(eslint.otherWay).toBe(
    "Or install it any other way that puts vscode-eslint-language-server on your PATH.",
  );
  expect(eslint.comeBack).toBe(COME_BACK);
});

test('rule 4: the folder line names the project folder, or the repository root for ""', () => {
  expect(installText(TS_HINT).steps.map((step) => step.label)).toEqual([
    "In frontend/:",
    "Or for all projects:",
  ]);
  expect(installText(ESLINT_HINT).steps.map((step) => step.label)).toEqual([
    "In the repository root:",
    "Or for all projects:",
  ]);
});

test("vue: the plugin goes into the project only, with no PATH line", () => {
  expect(installText(VUE_HINT)).toEqual({
    reason:
      "This project uses Vue; its .vue files need the package @vue/typescript-plugin in this project.",
    steps: [{ label: "In web/:", command: "pnpm add -D @vue/typescript-plugin" }],
    notes: [],
    otherWay: null,
    comeBack: COME_BACK,
  });
  expect(installText({ ...VUE_HINT, manager: null }).notes).toEqual([
    "Or the same with your package manager.",
  ]);
});

const POETRY_VENV =
  "yamt looks in the project's .venv, which Poetry uses only with virtualenvs.in-project set to true.";

test.each<[PythonManager, string, string, readonly string[]]>([
  ["uv", "uv add --dev ruff", "uv tool install ruff", []],
  ["poetry", "poetry add --group dev ruff", "pipx install ruff", [POETRY_VENV]],
  ["pdm", "pdm add -d ruff", "pipx install ruff", []],
])(
  "python: %s installs with `%s` here and `%s` for all projects",
  (manager, project, global, notes) => {
    expect(installText({ ...RUFF_HINT, manager })).toEqual({
      reason: null,
      steps: [
        { label: "In py/:", command: project },
        { label: "Or for all projects:", command: global },
      ],
      notes,
      otherWay: "Or install it any other way that puts ruff on your PATH.",
      comeBack: COME_BACK,
    });
  },
);

test("python: no lock file installs with pip in the project's virtual environment", () => {
  expect(installText({ ...RUFF_HINT, folder: "", manager: null })).toEqual({
    reason: null,
    steps: [
      {
        label: "In the repository root, in the project's virtual environment:",
        command: "python -m pip install ruff",
      },
      { label: "Or for all projects:", command: "pipx install ruff" },
    ],
    notes: ["Or the same with your package manager."],
    otherWay: "Or install it any other way that puts ruff on your PATH.",
    comeBack: COME_BACK,
  });
});

test("rustup, go and download: one step each, with their own lines", () => {
  expect(
    installText({ kind: "rustup", component: "rust-analyzer", program: "rust-analyzer" }),
  ).toEqual({
    reason: null,
    steps: [{ label: "For all projects:", command: "rustup component add rust-analyzer" }],
    notes: [],
    otherWay: "Or install it any other way that puts rust-analyzer on your PATH.",
    comeBack: COME_BACK,
  });
  expect(
    installText({ kind: "go", module: "golang.org/x/tools/gopls@latest", program: "gopls" }),
  ).toEqual({
    reason: null,
    steps: [{ label: "For all projects:", command: "go install golang.org/x/tools/gopls@latest" }],
    notes: ["It goes to Go's bin folder (usually ~/go/bin), where yamt looks too."],
    otherWay: "Or install it any other way that puts gopls on your PATH.",
    comeBack: COME_BACK,
  });
  const download = { kind: "download", program: "phpactor", command: "curl x" } as const;
  expect(installText({ ...download, needs: "PHP 8.2 or later" })).toEqual({
    reason: null,
    steps: [{ label: "For all projects:", command: "curl x" }],
    notes: ["Needs PHP 8.2 or later."],
    otherWay: "Or install it any other way that puts phpactor on your PATH.",
    comeBack: COME_BACK,
  });
  expect(installText({ ...download, needs: null }).notes).toEqual([]);
});

test("system: no step, the package-manager line", () => {
  expect(installText({ kind: "system", program: "clangd" })).toEqual({
    reason: null,
    steps: [],
    notes: ["Install clangd with your system's package manager."],
    otherWay: "Or install it any other way that puts clangd on your PATH.",
    comeBack: COME_BACK,
  });
});

const RUSTUP_HINT: InstallHint = {
  kind: "rustup",
  component: "rust-analyzer",
  program: "rust-analyzer",
};

test.each<ServerState>([
  { kind: "failed", reason: { kind: "notFound", program: "rust-analyzer", searched: ["/bin"] } },
  { kind: "failed", reason: { kind: "spawnFailed", message: "denied" } },
  { kind: "failed", reason: { kind: "initializeFailed", message: "Unknown binary" } },
  { kind: "failed", reason: { kind: "timedOut" } },
  { kind: "failed", reason: { kind: "exited", code: 1 } },
  { kind: "failed", reason: { kind: "exited", code: null } },
])("a failed start ($reason.kind) with help leads into the install text", (state) => {
  expect(failureHelp(state, RUSTUP_HINT)).toEqual({
    lead: "If it is not installed:",
    install: installText(RUSTUP_HINT),
  });
  expect(failureHelp(state, null)).toBeNull();
});

test.each<ServerState>([
  { kind: "failed", reason: { kind: "noHost" } },
  { kind: "failed", reason: { kind: "outsideRepository", project: "../x" } },
  { kind: "stopped" },
  { kind: "starting" },
  { kind: "running" },
  { kind: "stopping" },
  { kind: "notInstalled", hint: RUSTUP_HINT },
  { kind: "crashed", code: 1 },
  { kind: "crashed", code: null },
])("no install text under $kind, which installing would not fix", (state) => {
  expect(failureHelp(state, RUSTUP_HINT)).toBeNull();
});
