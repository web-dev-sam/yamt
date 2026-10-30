import { expect, test } from "vitest";

import { endsWithStop, exitMustAsk, finishMustAsk } from "./question";

test("Mark resolved asks exactly when the summary counts a conflict or a change", () => {
  expect(finishMustAsk({ conflicts: 0, changes: 0, remembered: 0 })).toBe(false);
  expect(finishMustAsk({ conflicts: 1, changes: 0, remembered: 0 })).toBe(true);
  expect(finishMustAsk({ conflicts: 0, changes: 1, remembered: 0 })).toBe(true);
});

test("Mark resolved never asks for conflicts git rerere filled in, but still asks for the others (catches a remembered conflict blocking with Unprocessed Changes)", () => {
  expect(finishMustAsk({ conflicts: 0, changes: 0, remembered: 2 })).toBe(false);
  expect(finishMustAsk({ conflicts: 1, changes: 0, remembered: 2 })).toBe(true);
  expect(finishMustAsk({ conflicts: 0, changes: 1, remembered: 2 })).toBe(true);
});

test("quitting asks exactly when some file has unsaved work", () => {
  expect(exitMustAsk([])).toBe(false);
  expect(exitMustAsk(["src/App.vue"])).toBe(true);
});

test("both Continue questions are about the stop and end with it; the exit question does not", () => {
  expect(endsWithStop({ kind: "continueUnsaved", operation: "Rebase", files: ["a.ts"] })).toBe(
    true,
  );
  expect(endsWithStop({ kind: "rewords" })).toBe(true);
  expect(endsWithStop({ kind: "exit", files: ["a.ts"] })).toBe(false);
});

test("the abort question, of a merge yamt started too, is about the stop and ends with it", () => {
  const operation = { kind: "Merge", merging: null, into: null } as const;
  const mergeRequest = {
    branch: "feature/due-dates",
    target: "main",
    returnTo: null,
    branchBefore: { kind: "unchanged" },
  } as const;

  expect(endsWithStop({ kind: "abort", operation, mergeRequest: null })).toBe(true);
  expect(endsWithStop({ kind: "abort", operation, mergeRequest })).toBe(true);
});

test("Mark resolved's question ends with the stop; the clash and servers questions do not", () => {
  const summary = { conflicts: 1, changes: 0, remembered: 0 };

  expect(endsWithStop({ kind: "unprocessed", summary })).toBe(true);
  expect(endsWithStop({ kind: "servers", found: [], added: [] })).toBe(false);
});
