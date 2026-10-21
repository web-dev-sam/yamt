import { expect, test } from "vitest";

import type { FileEntry, OperationView } from "../ipc";
import { emptyStop, type StopFacts } from "./emptyStop";
import type { Problem } from "./problem";

const REBASE: OperationView = {
  kind: "Rebase",
  branch: "feature",
  onto: null,
  replaying: null,
  progress: { step: 2, total: 3 },
  editor_steps_ahead: false,
};
const MESSAGE = "Could not apply 1a2b3c4... add c";
const STOPPED: Problem = { action: "stopped", operation: "Rebase", message: `${MESSAGE}\n` };
const CLOSE: Problem = { action: "close" };
const A: FileEntry = { path: "a.ts", status: "Unresolved", unsupported: null };

const EMPTY_STOP: StopFacts = {
  operation: REBASE,
  files: [],
  screen: { kind: "files" },
  problem: STOPPED,
  stopMessage: `${MESSAGE}\n`,
};

test("an empty stop shows git's message, trimmed, in the stop view and keeps it out of the bar", () => {
  expect(emptyStop(EMPTY_STOP)).toEqual({ stopView: { message: MESSAGE }, barProblem: null });
});

test.each([null, "", " \n"])(
  "an empty stop without a message (%j) shows the stop view without one",
  (stopMessage) => {
    expect(emptyStop({ ...EMPTY_STOP, problem: null, stopMessage })).toEqual({
      stopView: { message: null },
      barProblem: null,
    });
  },
);

test("a stop with files shows no stop view, and its problems stay in the bar", () => {
  expect(emptyStop({ ...EMPTY_STOP, files: [A] })).toEqual({ stopView: null, barProblem: STOPPED });
  expect(emptyStop({ ...EMPTY_STOP, files: [A], problem: CLOSE }).barProblem).toBe(CLOSE);
});

test("without a recorded operation there is no stop view, and git's stop goes to the bar", () => {
  expect(emptyStop({ ...EMPTY_STOP, operation: null })).toEqual({
    stopView: null,
    barProblem: STOPPED,
  });
});

test.each([{ kind: "settings" }, { kind: "serverLog", name: "oxlint" }] as const)(
  "on another screen ($kind) the stop view is hidden and the bar still leaves git's message out",
  (screen) => {
    expect(emptyStop({ ...EMPTY_STOP, screen })).toEqual({ stopView: null, barProblem: null });
  },
);

test("a later close or continue problem goes to the bar and leaves git's message in the stop view", () => {
  const refused: Problem = {
    action: "continue",
    operation: "Rebase",
    cause: { kind: "Git", message: "hook says no" },
  };
  for (const problem of [CLOSE, refused]) {
    expect(emptyStop({ ...EMPTY_STOP, problem })).toEqual({
      stopView: { message: MESSAGE },
      barProblem: problem,
    });
  }
});
