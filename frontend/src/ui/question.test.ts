import { expect, test } from "vitest";

import { parseKey } from "../ipc";
import { exitMustAsk, finishMustAsk, questionText } from "./question";

const LINUX = "Linux x86_64";

function unprocessed(conflicts: number, changes: number): string {
  return questionText({ kind: "unprocessed", summary: { conflicts, changes } }, LINUX).message;
}

test("Mark resolved asks exactly when the summary counts a conflict or a change", () => {
  expect(finishMustAsk({ conflicts: 0, changes: 0 })).toBe(false);
  expect(finishMustAsk({ conflicts: 1, changes: 0 })).toBe(true);
  expect(finishMustAsk({ conflicts: 0, changes: 1 })).toBe(true);
});

test("quitting asks exactly when some file has unsaved work", () => {
  expect(exitMustAsk([])).toBe(false);
  expect(exitMustAsk(["src/App.vue"])).toBe(true);
});

test("the unprocessed sentence names only the non-zero counts with singular and plural", () => {
  const both = unprocessed(2, 3);
  expect(both).toContain("2 unresolved conflicts and 3 unprocessed changes still remain.");
  expect(both).toContain("The file will be saved exactly as shown in the Result pane.");

  expect(unprocessed(1, 1)).toContain(
    "1 unresolved conflict and 1 unprocessed change still remain.",
  );
  expect(unprocessed(1, 0)).toContain("1 unresolved conflict still remains.");
  expect(unprocessed(0, 1)).toContain("1 unprocessed change still remains.");
  expect(unprocessed(0, 4)).toContain("4 unprocessed changes still remain.");
  expect(unprocessed(0, 4)).not.toContain("conflict");
  expect(unprocessed(5, 0)).not.toContain("change");
});

test("each question carries WebStorm's title and buttons, and the exit one lists its files", () => {
  expect(
    questionText({ kind: "unprocessed", summary: { conflicts: 1, changes: 0 } }, LINUX),
  ).toMatchObject({
    title: "Unprocessed Changes",
    files: [],
    confirm: "Save Current Result",
    cancel: "Back to Resolving",
  });
  expect(questionText({ kind: "exit", files: ["src/App.vue", "a.ts"] }, LINUX)).toMatchObject({
    title: "Cancel File Merge",
    message: "Are you sure you want to exit without applying changes?",
    files: ["src/App.vue", "a.ts"],
    confirm: "Exit",
    cancel: "Cancel",
  });
});

test("the clash question names the key in the platform's words, its owner and the asking action", () => {
  const key = parseKey("Mod-f");
  if (key === null) {
    throw new Error("Mod-f does not parse");
  }
  const clash = { kind: "clash", key, action: "undo", owner: "find" } as const;

  expect(questionText(clash, LINUX)).toEqual({
    title: "Key Already in Use",
    message: "Ctrl+F is already used by Find. Move it to Undo?",
    files: [],
    confirm: "Move",
    cancel: "Cancel",
  });
  expect(questionText(clash, "MacIntel").message).toBe(
    "⌘F is already used by Find. Move it to Undo?",
  );
});
