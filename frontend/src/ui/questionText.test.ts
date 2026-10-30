import { expect, test } from "vitest";

import { parseKey, type Leftover, type MergeView } from "../ipc";
import { serverKey, type ServerSpec } from "../lsp";
import { endsWithStop } from "./question";
import { questionText } from "./questionText";

const LINUX = "Linux x86_64";

function unprocessed(conflicts: number, changes: number, remembered = 0): string {
  return questionText({ kind: "unprocessed", summary: { conflicts, changes, remembered } }, LINUX)
    .message;
}

test("the unprocessed sentence never mentions remembered conflicts", () => {
  const message = unprocessed(1, 0, 3);
  expect(message).toContain("1 unresolved conflict still remains.");
  expect(message).not.toContain("3");
  expect(message).not.toContain("remembered");
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
  expect(unprocessed(0, 4)).toBe(
    "4 unprocessed changes still remain. The file will be saved exactly as shown in the Result pane.",
  );
  expect(unprocessed(0, 4)).not.toContain("conflict");
  expect(unprocessed(5, 0)).not.toContain("change");
});

test("the unprocessed question carries WebStorm's title and buttons", () => {
  expect(
    questionText(
      { kind: "unprocessed", summary: { conflicts: 1, changes: 0, remembered: 0 } },
      LINUX,
    ),
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
  expect(endsWithStop(clash)).toBe(false);

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
      kind: "lines",
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
  ).toEqual({ kind: "lines", lines: ["pylsp — added by you"] });
  expect(questionText({ kind: "servers", found, added: [] }, LINUX).list).toEqual({
    kind: "lines",
    lines: [
      "oxfmt, oxlint, TypeScript (not installed) — frontend/",
      "oxlint (repository root) — the repository root",
    ],
  });
});

test("aborting a merge asks with plan #74's words, unchanged", () => {
  const operation = { kind: "Merge", merging: null, into: null } as const;

  expect(questionText({ kind: "abort", operation, mergeRequest: null }, LINUX)).toEqual({
    title: "Abort Merge",
    message:
      "Every resolution and every save in this merge will be lost, and so will unsaved edits. The repository goes back to how it was before the merge, and yamt closes.",
    list: { kind: "none" },
    note: null,
    confirm: "Abort Merge",
    cancel: "Cancel",
  });
});

test("aborting a rebase names it and counts the commits already replayed", () => {
  const operation = {
    kind: "Rebase",
    branch: "feature",
    onto: null,
    replaying: null,
    progress: { step: 3, total: 3 },
    editor_steps_ahead: false,
  } as const;

  const text = questionText({ kind: "abort", operation, mergeRequest: null }, LINUX);

  expect([text.title, text.confirm]).toEqual(["Abort Rebase", "Abort Rebase"]);
  expect(text.message).toBe(
    "Every resolution and every save in this rebase will be lost, and so will unsaved edits. The 2 commits already replayed are undone too. The repository goes back to how it was before the rebase, and yamt closes.",
  );
});

const MERGING = { kind: "Merge", merging: null, into: null } as const;
const DEVELOP = { kind: "branch", name: "develop" } as const;
const COMMIT = { kind: "commit", id: "9b0d4e1" } as const;

function dueDates(
  returnTo: MergeView["returnTo"],
  branchBefore: MergeView["branchBefore"],
): MergeView {
  return { branch: "feature/due-dates", target: "main", returnTo, branchBefore };
}

test.each<[MergeView["returnTo"], string]>([
  [DEVELOP, "Abort the merge of main into feature/due-dates and return to develop?"],
  [COMMIT, "Abort the merge of main into feature/due-dates and return to commit 9b0d4e1?"],
  [null, "Abort the merge of main into feature/due-dates?"],
])("aborting a merge yamt started names the place it returns to: %j", (returnTo, message) => {
  const mergeRequest = dueDates(returnTo, { kind: "unchanged" });

  expect(questionText({ kind: "abort", operation: MERGING, mergeRequest }, LINUX)).toEqual({
    title: "Abort Merge",
    message,
    list: { kind: "none" },
    note: null,
    confirm: "Abort Merge",
    cancel: "Cancel",
  });
});

test.each<[MergeView["branchBefore"], string | null]>([
  [{ kind: "created" }, "yamt deletes feature/due-dates, which it created for this merge."],
  [
    { kind: "movedFrom", id: "3f1c2a9" },
    "feature/due-dates goes back to 3f1c2a9, where it was before.",
  ],
  [{ kind: "unchanged" }, null],
])("the abort note says what happens to the branch: %j", (branchBefore, note) => {
  for (const returnTo of [DEVELOP, COMMIT, null]) {
    const mergeRequest = dueDates(returnTo, branchBefore);
    expect(questionText({ kind: "abort", operation: MERGING, mergeRequest }, LINUX).note).toBe(
      note,
    );
  }
});

test("the push question offers Push and Keep Local, and never ends with a stop", () => {
  const question = { kind: "push", branch: "feature/due-dates" } as const;

  expect(questionText(question, LINUX)).toEqual({
    title: "Push to GitLab",
    message: "Push feature/due-dates to GitLab?",
    list: { kind: "none" },
    note: "The merge is committed on feature/due-dates. Keep Local leaves it there; you can push it later.",
    confirm: "Push",
    cancel: "Keep Local",
  });
  expect(endsWithStop(question)).toBe(false);
});

test("a failed push asks again with git's words, Push Again or Keep Local, and never ends with a stop", () => {
  const question = {
    kind: "pushFailed",
    branch: "feature/due-dates",
    message: "[rejected] (fetch first)",
  } as const;

  expect(questionText(question, LINUX)).toEqual({
    title: "Push Failed",
    message: "git did not push feature/due-dates: [rejected] (fetch first)",
    list: { kind: "none" },
    note: "The merge commit stays on your feature/due-dates.",
    confirm: "Push Again",
    cancel: "Keep Local",
  });
  expect(endsWithStop(question)).toBe(false);
});

test("what an abort left is a notice with one Close button listing each leftover, and never ends with a stop", () => {
  const leftovers: Leftover[] = [
    { kind: "notReturned", to: DEVELOP },
    { kind: "branchKept", branch: "feature/due-dates" },
  ];
  const question = {
    kind: "abortLeftovers",
    mergeRequest: dueDates(DEVELOP, { kind: "created" }),
    leftovers,
  } as const;

  expect(questionText(question, LINUX)).toEqual({
    title: "Merge Aborted",
    message:
      "The merge of main into feature/due-dates is aborted, but yamt did not put everything back:",
    list: {
      kind: "lines",
      lines: [
        "HEAD moved after the merge started, so yamt did not check out develop again.",
        "feature/due-dates changed after the merge started, so yamt left it as it is.",
      ],
    },
    note: null,
    confirm: "Close",
    cancel: null,
  });
  expect(endsWithStop(question)).toBe(false);
});

test("Continue with unsaved edits names the files and continues or commits by the operation", () => {
  const files = ["src/App.vue", "a.ts"];

  expect(questionText({ kind: "continueUnsaved", operation: "Rebase", files }, LINUX)).toEqual({
    title: "Unsaved Changes",
    message:
      "These files have changes that are not saved to disk. Continue the rebase without saving them?",
    list: { kind: "files", files },
    note: null,
    confirm: "Continue Without Saving",
    cancel: "Cancel",
  });
  expect(questionText({ kind: "continueUnsaved", operation: "Merge", files }, LINUX)).toMatchObject(
    {
      message:
        "These files have changes that are not saved to disk. Commit the merge without saving them?",
      confirm: "Commit Without Saving",
    },
  );
});

test("the reword question says the message stays as git prepares it (plan §2 #91)", () => {
  expect(questionText({ kind: "rewords" }, LINUX)).toEqual({
    title: "Commit Messages",
    message:
      "This step or a later one rewords or squashes a commit. yamt cannot open an editor, so that message stays as git prepares it.",
    list: { kind: "none" },
    note: null,
    confirm: "Continue rebase",
    cancel: "Cancel",
  });
});

test("closing a tab that holds text asks with its name, Yes or No, and never ends with a stop (catches a question that does not name the tab)", () => {
  const question = { kind: "closeTab", name: "Compare 2" } as const;

  expect(questionText(question, LINUX)).toEqual({
    title: "Close Tab",
    message: "Close Compare 2? Its text is lost.",
    list: { kind: "none" },
    note: null,
    confirm: "Yes",
    cancel: "No",
  });
  expect(endsWithStop(question)).toBe(false);
});

test("deleting a note asks GitLab's question, Delete or Cancel, and never ends with a stop", () => {
  const question = { kind: "deleteNote" } as const;

  expect(questionText(question, LINUX)).toEqual({
    title: "Delete Comment",
    message: "Delete this comment?",
    list: { kind: "none" },
    note: null,
    confirm: "Delete",
    cancel: "Cancel",
  });
  expect(endsWithStop(question)).toBe(false);
});

const CHECKOUT = "/home/me/.local/share/yamt/range/repo/pair/checkout";
const NO_REFS = { branches: [], stash: false } as const;

test("the AI's changes question lists the files and the folder, Keep Changes the confirm", () => {
  const question = {
    kind: "keepAiChanges",
    folder: CHECKOUT,
    files: ["README.md", "src/a.ts"],
    headMoved: false,
    refs: NO_REFS,
  } as const;

  expect(questionText(question, LINUX)).toEqual({
    title: "Keep the AI's changes?",
    message: `The AI changed these files in its checkout at ${CHECKOUT}:`,
    list: { kind: "files", files: ["README.md", "src/a.ts"] },
    note: null,
    confirm: "Keep Changes",
    cancel: "Discard Changes",
  });
  expect(endsWithStop(question)).toBe(false);
});

test.each([
  [true, NO_REFS, "It also made commits there."],
  [false, { branches: ["fix"], stash: false }, "It also left the branch fix there."],
  [false, { branches: ["fix", "try"], stash: false }, "It also left the branches fix, try there."],
  [false, { branches: [], stash: true }, "It also left a stash there."],
  [false, { branches: ["stash"], stash: false }, "It also left the branch stash there."],
  [
    true,
    { branches: ["fix"], stash: true },
    "It also made commits and left the branch fix and a stash there.",
  ],
] as const)(
  "a moved HEAD (%s) and the AI's refs %o are named in the note",
  (headMoved, refs, note) => {
    const text = questionText(
      { kind: "keepAiChanges", folder: CHECKOUT, files: ["a"], headMoved, refs },
      LINUX,
    );

    expect(text.note).toBe(note);
  },
);

test("work without changed files says the AI left work there, without 'also'", () => {
  const text = questionText(
    { kind: "keepAiChanges", folder: CHECKOUT, files: [], headMoved: true, refs: NO_REFS },
    LINUX,
  );

  expect([text.message, text.note]).toEqual([
    `The AI left work in its checkout at ${CHECKOUT}.`,
    "It made commits there.",
  ]);
});

test("an unreadable checkout asks the same question with git's words, Keep the confirm", () => {
  const question = {
    kind: "keepUnreadableCheckout",
    folder: CHECKOUT,
    message: "fatal: bad object HEAD\n",
  } as const;

  expect(questionText(question, LINUX)).toEqual({
    title: "Keep the AI's changes?",
    message: `Git cannot read the AI's checkout at ${CHECKOUT}, so yamt cannot tell what the AI changed there: fatal: bad object HEAD`,
    list: { kind: "none" },
    note: "Discard Changes removes the checkout.",
    confirm: "Keep Changes",
    cancel: "Discard Changes",
  });
  expect(endsWithStop(question)).toBe(false);
});
