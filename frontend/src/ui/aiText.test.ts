import { expect, test } from "vitest";

import type { AgentFailure } from "../agent";
import {
  diffFailureText,
  editTitle,
  failureText,
  moreLinesText,
  refusedText,
  RETRY,
  skippedLinesText,
  STEP_STATUS_WORDS,
  STOPPED_TEXT,
  THINKING_AND_STEPS,
  TOO_LARGE_TEXT,
} from "./aiText";

const LINUX = "Linux x86_64";

const SENTENCES: Readonly<Record<AgentFailure["kind"], readonly [AgentFailure, string]>> = {
  checkoutFailed: [
    { kind: "checkoutFailed", message: "fatal: not a git repository\n" },
    "The AI's checkout could not be made: fatal: not a git repository",
  ],
  notFound: [
    { kind: "notFound", program: "omp", searched: ["/usr/bin", "/home/me/.bun/bin"] },
    "omp was not found (searched: /usr/bin, /home/me/.bun/bin). Set the Agent command in Settings.",
  ],
  spawnFailed: [
    { kind: "spawnFailed", program: "omp", message: "permission denied\n" },
    "omp could not be started: permission denied",
  ],
  noCommand: [{ kind: "noCommand" }, "The Agent command in Settings is empty."],
  crashed: [
    { kind: "crashed", code: 1, lastLog: "panic: out of memory\n" },
    "The AI stopped unexpectedly (exit code 1): panic: out of memory",
  ],
  refused: [
    { kind: "refused", method: "session/new", message: "no model configured" },
    "The AI refused session/new: no model configured",
  ],
  sessionGone: [{ kind: "sessionGone" }, "omp no longer has this thread's conversation."],
  ended: [{ kind: "ended", reason: "max_tokens" }, "The AI ended the turn: max_tokens."],
  busy: [{ kind: "busy" }, "The AI is still answering in this thread."],
  app: [
    { kind: "app", failure: { kind: "AiOff" } },
    "The AI could not answer: the AI is off; start yamt with --ai to use it.",
  ],
};

test.each(Object.values(SENTENCES))("a %o failure reads as one sentence", (failure, sentence) => {
  expect(failureText(failure, LINUX)).toBe(sentence);
});

test("a crash without an exit code or a last log line says only that the AI stopped", () => {
  expect(failureText({ kind: "crashed", code: null, lastLog: null }, LINUX)).toBe(
    "The AI stopped unexpectedly.",
  );
  expect(failureText({ kind: "crashed", code: 2, lastLog: " \n" }, LINUX)).toBe(
    "The AI stopped unexpectedly (exit code 2).",
  );
});

test("a program not found with no searched folders names none", () => {
  expect(failureText({ kind: "notFound", program: "omp", searched: [] }, LINUX)).toBe(
    "omp was not found. Set the Agent command in Settings.",
  );
});

test("an edit is named Edited, a new file Created", () => {
  expect(editTitle({ path: "README.md", oldText: "a\n", newText: "b\n" })).toBe("Edited README.md");
  expect(editTitle({ path: "notes.md", oldText: "", newText: "b\n" })).toBe("Edited notes.md");
  expect(editTitle({ path: "new.md", oldText: null, newText: "b\n" })).toBe("Created new.md");
});

test("a diff the app or the call could not make says so in the window's problem words", () => {
  expect(diffFailureText({ kind: "appFailed", failure: { kind: "WorkerStopped" } }, LINUX)).toBe(
    "Could not show the diff: yamt's worker stopped; try again.",
  );
  expect(diffFailureText({ kind: "failed", message: "Error: ipc gone" }, LINUX)).toBe(
    "Could not show the diff: Error: ipc gone",
  );
});

test("the step words, the refusal and the diff's counts", () => {
  expect(Object.values(STEP_STATUS_WORDS)).toEqual([
    "Waiting",
    "Running",
    "Done",
    "Failed",
    "No result",
  ]);
  expect(refusedText("Move a to b")).toBe("yamt refused: Move a to b — outside the AI's checkout");
  expect([moreLinesText(1), moreLinesText(1000)]).toEqual([
    "1 more line not shown",
    "1000 more lines not shown",
  ]);
  expect([skippedLinesText(1), skippedLinesText(7)]).toEqual([
    "1 unchanged line",
    "7 unchanged lines",
  ]);
});

test("the turn view's fixed words", () => {
  expect([THINKING_AND_STEPS, STOPPED_TEXT, RETRY, TOO_LARGE_TEXT]).toEqual([
    "Thinking and steps",
    "You stopped the AI.",
    "Retry",
    "This edit is too large to show as a diff.",
  ]);
});
