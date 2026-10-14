import { expect, test } from "vitest";

import type { InstallHint, PackageManager, ServerSpec, ServerState } from "../lsp";
import {
  dotKind,
  formatNote,
  installText,
  logTime,
  problemsTitle,
  projectLabel,
  serverActions,
  serverLabel,
  stateLine,
} from "./serverText";

type Row = { readonly state: ServerState; readonly line: string; readonly dot: string };

const TS_HINT: InstallHint = {
  package: "typescript-language-server",
  program: "typescript-language-server",
  folder: "frontend",
  manager: "pnpm",
  reason: { kind: "typescript", version: "5.9.3" },
};

const ESLINT_HINT: InstallHint = {
  package: "vscode-langservers-extracted",
  program: "vscode-eslint-language-server",
  folder: "",
  manager: "npm",
  reason: { kind: "eslint" },
};

const ROWS: readonly Row[] = [
  { state: { kind: "stopped" }, line: "Stopped", dot: "stopped" },
  { state: { kind: "starting" }, line: "Starting…", dot: "busy" },
  { state: { kind: "running" }, line: "Running", dot: "running" },
  { state: { kind: "stopping" }, line: "Stopping…", dot: "busy" },
  { state: { kind: "crashed", code: 3 }, line: "Stopped: exited with code 3", dot: "problem" },
  { state: { kind: "crashed", code: null }, line: "Stopped: exited", dot: "problem" },
  {
    state: {
      kind: "failed",
      reason: {
        kind: "notFound",
        program: "oxlint",
        searched: ["frontend/node_modules/.bin", "/usr/bin"],
      },
    },
    line: "Not found: looked in frontend/node_modules/.bin, /usr/bin",
    dot: "problem",
  },
  {
    state: { kind: "failed", reason: { kind: "spawnFailed", message: "permission denied" } },
    line: "Could not start: permission denied",
    dot: "problem",
  },
  {
    state: { kind: "failed", reason: { kind: "initializeFailed", message: "bad reply" } },
    line: "Could not start: bad reply",
    dot: "problem",
  },
  {
    state: { kind: "failed", reason: { kind: "timedOut" } },
    line: "Did not answer in time",
    dot: "problem",
  },
  {
    state: { kind: "failed", reason: { kind: "noHost" } },
    line: "Runs only in the app",
    dot: "problem",
  },
  {
    state: { kind: "failed", reason: { kind: "outsideRepository", project: "../x" } },
    line: "Its folder is outside the repository",
    dot: "problem",
  },
  { state: { kind: "notInstalled", hint: TS_HINT }, line: "Not installed", dot: "warning" },
];

test.each(ROWS)("rule 2/3: $state.kind reads $line with a $dot dot", ({ state, line, dot }) => {
  expect(stateLine(state)).toBe(line);
  expect(dotKind(state)).toBe(dot);
});

test("rule 3: the actions that apply per state", () => {
  expect(serverActions({ kind: "stopped" })).toEqual(["start"]);
  expect(serverActions({ kind: "starting" })).toEqual(["stop"]);
  expect(serverActions({ kind: "running" })).toEqual(["stop", "restart"]);
  expect(serverActions({ kind: "stopping" })).toEqual([]);
  expect(serverActions({ kind: "crashed", code: 1 })).toEqual(["start", "restart"]);
  expect(serverActions({ kind: "failed", reason: { kind: "timedOut" } })).toEqual([
    "start",
    "restart",
  ]);
  expect(serverActions({ kind: "failed", reason: { kind: "noHost" } })).toEqual([]);
  expect(serverActions({ kind: "notInstalled", hint: TS_HINT })).toEqual([]);
});

test.each<[PackageManager, string, string]>([
  ["npm", "npm install -D p", "npm install -g p"],
  ["pnpm", "pnpm add -D p", "pnpm add -g p"],
  ["yarn", "yarn add -D p", "yarn global add p"],
  ["yarnBerry", "yarn add -D p", "npm install -g p"],
  ["bun", "bun add --dev p", "bun add -g p"],
])("rule 4: %s installs with `%s` here and `%s` for all projects", (manager, project, global) => {
  const text = installText({ ...TS_HINT, package: "p", manager });

  expect(text.steps.map((step) => step.command)).toEqual([project, global]);
  expect(text.managerNote).toBeNull();
});

test("rule 4: an unknown manager gets npm's commands and the note to use your own", () => {
  const text = installText({ ...TS_HINT, manager: null });

  expect(text.steps.map((step) => step.command)).toEqual([
    "npm install -D typescript-language-server",
    "npm install -g typescript-language-server",
  ]);
  expect(text.managerNote).toBe("Or the same with your package manager.");
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
  expect(eslint.comeBack).toBe("yamt finds it when you come back to this window.");
});

test('rule 4: the folder line names the project folder, or the repository root for ""', () => {
  expect(installText(TS_HINT).steps.map((step) => step.label)).toEqual([
    "In frontend/:",
    "Or for all projects:",
  ]);
  expect(installText(ESLINT_HINT).steps[0].label).toBe("In the repository root:");
});

test("a project folder reads as the folder with a slash, the root as the repository root", () => {
  expect(projectLabel("frontend")).toBe("frontend/");
  expect(projectLabel("packages/web")).toBe("packages/web/");
  expect(projectLabel("")).toBe("the repository root");
});

test("a server reads as its name, marked when it is not installed", () => {
  const installed: ServerSpec = {
    name: "TypeScript",
    project: "frontend",
    command: { program: "typescript-language-server", args: ["--stdio"] },
    fileTypes: ["ts"],
    settings: null,
    initializationOptions: null,
    formats: false,
    install: null,
  };

  expect(serverLabel(installed)).toBe("TypeScript");
  expect(serverLabel({ ...installed, install: TS_HINT })).toBe("TypeScript (not installed)");
});

test("rule 2: the format note is shown for the four refusals and hidden otherwise", () => {
  expect(formatNote({ kind: "notRunning", server: "oxfmt", state: { kind: "stopped" } })).toBe(
    "Not formatted: oxfmt is not running",
  );
  expect(formatNote({ kind: "failed", server: "oxfmt", message: "boom" })).toBe(
    "Not formatted: oxfmt failed: boom",
  );
  expect(formatNote({ kind: "timedOut", server: "oxfmt" })).toBe(
    "Not formatted: oxfmt did not answer in time",
  );
  expect(formatNote({ kind: "changedMeanwhile", server: "oxfmt" })).toBe(
    "Not formatted: the Result changed while oxfmt was formatting",
  );
  expect(formatNote({ kind: "formatted", server: "oxfmt" })).toBeNull();
  expect(formatNote({ kind: "unchanged", server: "oxfmt" })).toBeNull();
  expect(formatNote({ kind: "noFormatter" })).toBeNull();
  expect(formatNote(undefined)).toBeNull();
});

test("rule 2: the counts' title counts errors and warnings in words", () => {
  expect(problemsTitle({ errors: 1, warnings: 0, other: 4 })).toBe("1 error, 0 warnings");
  expect(problemsTitle({ errors: 2, warnings: 1, other: 0 })).toBe("2 errors, 1 warning");
});

test("rule 5: a log line's time is HH:MM:SS", () => {
  expect(logTime(new Date(2026, 9, 14, 9, 5, 7).getTime())).toBe("09:05:07");
  expect(logTime(new Date(2026, 9, 14, 23, 59, 0).getTime())).toBe("23:59:00");
});
