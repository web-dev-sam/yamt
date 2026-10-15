import { expect, test } from "vitest";

import type { InstallHint, ServerSpec, ServerState } from "../lsp";
import {
  dotKind,
  formatNote,
  logTime,
  noteLine,
  problemsTitle,
  projectLabel,
  serverActions,
  serverLabel,
  stateLine,
} from "./serverText";

type Row = { readonly state: ServerState; readonly line: string; readonly dot: string };

const CLANGD_HINT: InstallHint = { kind: "system", program: "clangd" };

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
    state: { kind: "failed", reason: { kind: "exited", code: 1 } },
    line: "Stopped while starting: exited with code 1",
    dot: "problem",
  },
  {
    state: { kind: "failed", reason: { kind: "exited", code: null } },
    line: "Stopped while starting: exited",
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
  { state: { kind: "notInstalled", hint: CLANGD_HINT }, line: "Not installed", dot: "warning" },
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
  expect(serverActions({ kind: "notInstalled", hint: CLANGD_HINT })).toEqual([]);
});

test("the TypeScript 7 Vue note names the project's TypeScript version", () => {
  expect(noteLine({ kind: "vueNeedsTypeScript6", program: "tsc", version: "7.0.2" })).toBe(
    "Vue files get no type problems: TypeScript 7.0.2 runs no plugins, and Vue needs TypeScript 6.",
  );
});

test("the tsgo Vue note names the native preview, not the typescript package's version", () => {
  expect(noteLine({ kind: "vueNeedsTypeScript6", program: "tsgo", version: "5.9.3" })).toBe(
    "Vue files get no type problems: TypeScript's native preview (tsgo) runs no plugins, and Vue needs TypeScript 6.",
  );
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
    folders: { project: ["node_modules/.bin"], home: [] },
    command: { program: "typescript-language-server", args: ["--stdio"] },
    fileTypes: ["ts"],
    settings: null,
    initializationOptions: null,
    formats: false,
    install: null,
    help: null,
    notes: [],
  };

  expect(serverLabel(installed)).toBe("TypeScript");
  expect(serverLabel({ ...installed, install: CLANGD_HINT })).toBe("TypeScript (not installed)");
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
