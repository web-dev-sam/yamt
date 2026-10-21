import { expect, test } from "vitest";

import type { OperationView, SideName } from "../ipc";
import {
  abortLabel,
  abortMessage,
  abortTitle,
  allResolvedText,
  continueLabel,
  operationLine,
} from "./operationText";

const MAIN: SideName = { kind: "Branch", name: "main" };
const FEATURE: SideName = { kind: "Branch", name: "feature/reminders" };
const FIX_LOGIN: SideName = {
  kind: "Commit",
  short_id: "3f2c1a0",
  subject: "Fix login",
  message: "Fix login\n\nThe session cookie expired too early.\n",
};
const ADD_CACHE: SideName = {
  kind: "Revert",
  short_id: "9b8e7d6",
  subject: "Add cache",
  message: "Add cache\n\nKeeps answers for a minute.",
};

const REBASE: OperationView = {
  kind: "Rebase",
  branch: "feature",
  onto: MAIN,
  replaying: FIX_LOGIN,
  progress: { step: 2, total: 5 },
  editor_steps_ahead: false,
};

test.each<[string, OperationView, string]>([
  [
    "a merge",
    { kind: "Merge", merging: FEATURE, into: MAIN },
    "Merging feature/reminders into main",
  ],
  [
    "a squash merge",
    { kind: "SquashMerge", merging: FEATURE, into: MAIN },
    "Squash-merging feature/reminders into main",
  ],
  ["a rebase", REBASE, "Rebasing feature onto main · 2 of 5"],
  [
    "a cherry-pick of several",
    { kind: "CherryPick", picking: FIX_LOGIN, progress: { step: 1, total: 3 } },
    "Cherry-picking 3f2c1a0 Fix login · 1 of 3",
  ],
  [
    "a revert of several",
    { kind: "Revert", reverting: ADD_CACHE, progress: { step: 1, total: 2 } },
    "Reverting 9b8e7d6 Add cache · 1 of 2",
  ],
  [
    "a patch series",
    { kind: "Am", subject: "Fix typo", message: "Fix typo", progress: { step: 2, total: 4 } },
    "Applying patch 2 of 4: Fix typo",
  ],
])("%s reads as plan #87 words it", (_case, operation, text) => {
  expect(operationLine(operation).text).toBe(text);
});

test.each<[string, OperationView, string]>([
  [
    "a single cherry-pick",
    { kind: "CherryPick", picking: FIX_LOGIN, progress: { step: 1, total: 1 } },
    "Cherry-picking 3f2c1a0 Fix login",
  ],
  [
    "a cherry-pick without a sequence",
    { kind: "CherryPick", picking: FIX_LOGIN, progress: null },
    "Cherry-picking 3f2c1a0 Fix login",
  ],
  [
    "a single patch",
    { kind: "Am", subject: "Fix typo", message: "Fix typo", progress: { step: 1, total: 1 } },
    "Applying patch: Fix typo",
  ],
])("%s shows no count", (_case, operation, text) => {
  expect(operationLine(operation).text).toBe(text);
});

test.each<[string, OperationView, string]>([
  [
    "a merge without what it merges",
    { kind: "Merge", merging: null, into: MAIN },
    "Merging into main",
  ],
  [
    "a merge without HEAD's name",
    { kind: "Merge", merging: FEATURE, into: null },
    "Merging feature/reminders",
  ],
  [
    "a rebase on a detached HEAD",
    { ...REBASE, branch: null },
    "Rebasing detached HEAD onto main · 2 of 5",
  ],
  ["a rebase without its upstream", { ...REBASE, onto: null }, "Rebasing feature · 2 of 5"],
  [
    "a revert without its commit",
    { kind: "Revert", reverting: null, progress: { step: 1, total: 2 } },
    "Reverting · 1 of 2",
  ],
  [
    "a patch without a subject",
    { kind: "Am", subject: "", message: "", progress: { step: 2, total: 4 } },
    "Applying patch 2 of 4",
  ],
  [
    "a commit without a subject",
    { kind: "CherryPick", picking: { ...FIX_LOGIN, subject: "" }, progress: null },
    "Cherry-picking 3f2c1a0",
  ],
])("%s drops only the missing part", (_case, operation, text) => {
  expect(operationLine(operation).text).toBe(text);
});

test("the tooltip holds the line and the full message of the commit applied; a branch adds nothing", () => {
  expect(operationLine(REBASE).tooltip).toBe(
    "Rebasing feature onto main · 2 of 5\n\nFix login\n\nThe session cookie expired too early.",
  );
  expect(operationLine({ kind: "Merge", merging: FEATURE, into: MAIN }).tooltip).toBe(
    "Merging feature/reminders into main",
  );
});

test("a patch whose progress git did not record has a line without a count", () => {
  expect(
    operationLine({ kind: "Am", subject: "Fix typo", message: "Fix typo", progress: null }).text,
  ).toBe("Applying patch: Fix typo");
});

test("a patch's tooltip holds the line and the patch message trimmed; an empty message adds nothing", () => {
  const progress = { step: 2, total: 4 };
  expect(
    operationLine({
      kind: "Am",
      subject: "Fix typo",
      message: "\nFix typo\n\nThe label said 'Sumbit'.\n\n",
      progress,
    }).tooltip,
  ).toBe("Applying patch 2 of 4: Fix typo\n\nFix typo\n\nThe label said 'Sumbit'.");
  expect(operationLine({ kind: "Am", subject: "", message: " \n", progress }).tooltip).toBe(
    "Applying patch 2 of 4",
  );
});

test.each<[OperationView, string, string]>([
  [{ kind: "Merge", merging: FEATURE, into: MAIN }, "Abort merge", "Abort Merge"],
  [
    { kind: "SquashMerge", merging: FEATURE, into: MAIN },
    "Abort squash merge",
    "Abort Squash Merge",
  ],
  [REBASE, "Abort rebase", "Abort Rebase"],
  [{ kind: "CherryPick", picking: null, progress: null }, "Abort cherry-pick", "Abort Cherry-Pick"],
  [{ kind: "Revert", reverting: null, progress: null }, "Abort revert", "Abort Revert"],
  [
    { kind: "Am", subject: "", message: "", progress: null },
    "Abort patch application",
    "Abort Patch Application",
  ],
])("%j is aborted by %j under the title %j", (operation, label, title) => {
  expect(abortLabel(operation)).toBe(label);
  expect(abortTitle(operation)).toBe(title);
});

test("a merge's abort message is plan #74's, word for word", () => {
  expect(abortMessage({ kind: "Merge", merging: FEATURE, into: MAIN })).toBe(
    "Every resolution and every save in this merge will be lost, and so will unsaved edits. The repository goes back to how it was before the merge, and yamt closes.",
  );
});

test.each<[OperationView, string]>([
  [REBASE, " The 1 commit already replayed is undone too. "],
  [
    { ...REBASE, progress: { step: 4, total: 5 } },
    " The 3 commits already replayed are undone too. ",
  ],
  [
    { kind: "CherryPick", picking: FIX_LOGIN, progress: { step: 3, total: 3 } },
    " The 2 commits already picked are undone too. ",
  ],
  [
    { kind: "Am", subject: "", message: "", progress: { step: 3, total: 4 } },
    " The 2 patches already applied are undone too. ",
  ],
])("the abort message counts the steps already done: %j", (operation, sentence) => {
  expect(abortMessage(operation)).toContain(sentence);
});

test.each<OperationView>([
  { ...REBASE, progress: { step: 1, total: 5 } },
  { ...REBASE, progress: null },
  { kind: "Revert", reverting: ADD_CACHE, progress: { step: 1, total: 2 } },
])("the first step has nothing done to name: %j", (operation) => {
  expect(abortMessage(operation)).not.toContain("undone too");
});

test.each<[OperationView, string]>([
  [REBASE, "Continue rebase"],
  [{ kind: "CherryPick", picking: FIX_LOGIN, progress: null }, "Continue cherry-pick"],
  [{ kind: "Revert", reverting: ADD_CACHE, progress: null }, "Continue revert"],
  [{ kind: "Am", subject: "", message: "", progress: null }, "Continue applying patches"],
  [{ kind: "Merge", merging: FEATURE, into: MAIN }, "Commit merge"],
  [{ kind: "SquashMerge", merging: FEATURE, into: MAIN }, "Commit merge"],
])("Continue is labelled per operation (a merge commits): %j", (operation, label) => {
  expect(continueLabel(operation)).toBe(label);
});

test("the all-resolved line names the next step, and without an operation keeps its old words", () => {
  expect(allResolvedText(REBASE)).toBe("All files are resolved. Continue rebase to let git go on.");
  expect(allResolvedText({ kind: "Am", subject: "", message: "", progress: null })).toBe(
    "All files are resolved. Continue applying patches to let git go on.",
  );
  expect(allResolvedText({ kind: "SquashMerge", merging: FEATURE, into: MAIN })).toBe(
    "All files are resolved. Commit merge to commit it.",
  );
  expect(allResolvedText(null)).toBe(
    "All files are resolved. Close the window to finish the merge.",
  );
});
