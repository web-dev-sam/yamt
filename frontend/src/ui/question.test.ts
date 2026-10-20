import { expect, test } from "vitest";

import { parseKey } from "../ipc";
import { serverKey, type ServerSpec } from "../lsp";
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

test("the unprocessed question carries WebStorm's title and buttons", () => {
  expect(
    questionText({ kind: "unprocessed", summary: { conflicts: 1, changes: 0 } }, LINUX),
  ).toMatchObject({
    title: "Unprocessed Changes",
    list: { kind: "none" },
    note: null,
    confirm: "Save Current Result",
    cancel: "Back to Resolving",
  });
});

test("the exit question says the listed files are not saved to disk (plan §2 #69)", () => {
  expect(questionText({ kind: "exit", files: ["src/App.vue", "a.ts"] }, LINUX)).toEqual({
    title: "Unsaved Changes",
    message: "These files have changes that are not saved to disk. Exit without saving them?",
    list: { kind: "files", files: ["src/App.vue", "a.ts"] },
    note: null,
    confirm: "Exit Without Saving",
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
    list: { kind: "none" },
    note: null,
    confirm: "Move",
    cancel: "Cancel",
  });
  expect(questionText(clash, "MacIntel").message).toBe(
    "⌘F is already used by Find. Move it to Undo?",
  );
});

function spec(name: string, project: string, installed = true): ServerSpec {
  return {
    key: serverKey(`${name} (${project})`),
    name,
    command: { program: name, args: [] },
    project,
    folders: { project: ["node_modules/.bin"], home: [] },
    fileTypes: ["ts"],
    formats: false,
    settings: null,
    initializationOptions: null,
    install: installed
      ? null
      : {
          kind: "node",
          package: "typescript-language-server",
          program: "typescript-language-server",
          folder: project,
          manager: "pnpm",
          reason: { kind: "typescript", version: "5.9.3" },
        },
    help: null,
    notes: [],
  };
}

test("the servers question lists the found servers per project folder, the added ones, and the note (plan §2 #67)", () => {
  const found = [
    spec("oxfmt", "frontend"),
    spec("oxlint", "frontend"),
    spec("TypeScript", "frontend", false),
    spec("oxlint (repository root)", ""),
  ];
  const added = [spec("pylsp", ""), spec("gopls", "")];

  expect(questionText({ kind: "servers", found, added }, LINUX)).toEqual({
    title: "Language Servers",
    message: "Start this project's language servers?",
    list: {
      kind: "servers",
      lines: [
        "oxfmt, oxlint, TypeScript (not installed) — frontend/",
        "oxlint (repository root) — the repository root",
        "pylsp, gopls — added by you",
      ],
    },
    note: "yamt remembers your answer for this repository. You can change it in Settings.",
    confirm: "Start",
    cancel: "Don't start",
  });
  expect(
    questionText({ kind: "servers", found: [], added: [spec("pylsp", "")] }, LINUX).list,
  ).toEqual({ kind: "servers", lines: ["pylsp — added by you"] });
  expect(questionText({ kind: "servers", found, added: [] }, LINUX).list).toEqual({
    kind: "servers",
    lines: [
      "oxfmt, oxlint, TypeScript (not installed) — frontend/",
      "oxlint (repository root) — the repository root",
    ],
  });
});
