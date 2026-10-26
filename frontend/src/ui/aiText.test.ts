import { expect, test } from "vitest";

import { DEFAULT_FIRST_MESSAGE, unknownPlaceholders, type AgentFailure } from "../agent";
import {
  AI_SETTINGS_TEXT,
  diffFailureText,
  editTitle,
  failureText,
  LINE_ENDING_WORDS,
  LOADING_DIFF_TEXT,
  moreLinesText,
  NO_NEWLINE_TEXT,
  refusedText,
  RETRY,
  RUNNING_TEXT,
  skippedLinesText,
  STEP_STATUS_WORDS,
  STOPPED_TEXT,
  THINKING_AND_STEPS,
  TOO_LARGE_TEXT,
  unknownPlaceholderText,
  YOLO_NOTE,
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
    { kind: "refused", method: "session/new", message: " no model configured\n" },
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
    "⋯ 1 unchanged line",
    "⋯ 7 unchanged lines",
  ]);
});

test("the turn view's fixed words", () => {
  expect([
    THINKING_AND_STEPS,
    RUNNING_TEXT,
    STOPPED_TEXT,
    RETRY,
    LOADING_DIFF_TEXT,
    TOO_LARGE_TEXT,
    NO_NEWLINE_TEXT,
    LINE_ENDING_WORDS,
  ]).toEqual([
    "Thinking and steps",
    "working…",
    "You stopped the AI.",
    "Retry",
    "Making the diff…",
    "This edit is too large to show as a diff.",
    "\\ No newline at end of file",
    { crlf: "CRLF line ending", lf: "LF line ending" },
  ]);
});

test("each unknown placeholder is named once as typed; known ones are not", () => {
  expect(
    unknownPlaceholders("{{ FOO }} {{MESSAGE}} {{BAR}} {{ FOO }}").map(unknownPlaceholderText),
  ).toEqual([
    "{{ FOO }} is not a placeholder; it is sent as typed.",
    "{{BAR}} is not a placeholder; it is sent as typed.",
  ]);
  expect(unknownPlaceholders(DEFAULT_FIRST_MESSAGE)).toEqual([]);
});

test("the AI settings section's words and the yolo note", () => {
  expect(AI_SETTINGS_TEXT).toEqual({
    title: "AI",
    command: "Agent command",
    commandHint: "The command is split on spaces. It speaks the Agent Client Protocol.",
    message: "First message",
    messageHint: "Sent as the first message of a thread's conversation. Placeholders:",
    use: "Use",
    reset: "Default",
  });
  expect(YOLO_NOTE).toBe(
    "yamt allows the AI's commands, and its deletes and moves only inside its checkout. With omp's approval mode set to yolo, omp asks yamt nothing about deletes and moves, so they are allowed anywhere.",
  );
});
