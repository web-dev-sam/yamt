import { expect, test } from "vitest";

import {
  createFixtureCompareSource,
  log,
  parseKey,
  type Key,
  type SourceFailure,
  type TabId,
} from "../ipc";
import type { Problem, ProblemCause } from "./problem";
import { problemText } from "./problemText";

const PATH = "src/a.ts";
const SETTINGS = "/home/me/.config/yamt/settings.json";
const LINUX = "Linux x86_64";
const TAB = await openedTab();

async function openedTab(): Promise<TabId> {
  const reply = await createFixtureCompareSource(log, "", {}).openCompare();
  if (!reply.ok) {
    throw new Error("the fixture opened no tab");
  }
  return reply.value.list.shown;
}

function onFinish(cause: ProblemCause): Problem {
  return { action: "finish", path: PATH, cause };
}

function text(problem: Problem): string {
  return problemText(problem, LINUX);
}

function key(written: string): Key {
  const parsed = parseKey(written);
  if (parsed === null) {
    throw new Error(`${written} does not parse`);
  }
  return parsed;
}

test.each([
  ["open", `Could not open ${PATH}`],
  ["finish", `Could not mark ${PATH} as resolved`],
  ["save", `Could not save ${PATH}`],
  ["take", `Could not resolve ${PATH} with one side`],
  ["reset", `Could not reset ${PATH}`],
] as const)("a failed %s names the file and what failed", (action, words) => {
  const said = text({ action, path: PATH, cause: { kind: "Unexpected", message: "boom" } });

  expect(said).toContain(words);
  expect(said).toContain("boom");
});

test("a failed list says the list could not be read, with the cause", () => {
  const said = text({ action: "list", cause: { kind: "Unexpected", message: "repo gone" } });

  expect(said).toContain("Could not list the conflicted files");
  expect(said).toContain("repo gone");
});

test("Git carries git's own message", () => {
  const said = text(onFinish({ kind: "Git", message: "git add failed: index.lock\n" }));

  expect(said).toContain(`Could not mark ${PATH} as resolved`);
  expect(said).toContain("git add failed: index.lock");
  expect(said.endsWith("\n")).toBe(false);
});

test("UnknownPath names the path", () => {
  const said = text({ action: "open", path: PATH, cause: { kind: "UnknownPath", path: PATH } });

  expect(said).toContain(`${PATH} is not one of the conflicted files`);
});

test("WriteFailed names the path and the system's message", () => {
  const said = text(onFinish({ kind: "WriteFailed", path: PATH, message: "disk full" }));

  expect(said).toContain(`writing ${PATH} failed`);
  expect(said).toContain("disk full");
});

test("NotAFile says nothing was written because the path is not a regular file", () => {
  expect(text(onFinish({ kind: "NotAFile", path: PATH }))).toBe(
    `Could not mark ${PATH} as resolved: ${PATH} is not a regular file on disk; nothing was written`,
  );
});

test("a failed save says the file could not be saved, with the write's own cause", () => {
  const said = text({
    action: "save",
    path: PATH,
    cause: { kind: "WriteFailed", path: PATH, message: "Permission denied (os error 13)" },
  });

  expect(said).toBe(
    `Could not save ${PATH}: writing ${PATH} failed: Permission denied (os error 13)`,
  );
});

test("ReadFailed names the path and the system's message", () => {
  const said = text({
    action: "take",
    path: PATH,
    cause: { kind: "ReadFailed", path: PATH, message: "permission denied\n" },
  });

  expect(said).toBe(
    `Could not resolve ${PATH} with one side: reading ${PATH} failed: permission denied`,
  );
});

test.each([
  ["Binary", "it is a binary file"],
  ["NonUtf8", "it is not UTF-8 text"],
  ["TooLarge", "it is larger than 8 MiB"],
  ["LocalDeleted", "it was deleted in your branch"],
  ["RemoteDeleted", "it was deleted in theirs"],
  ["Symlink", "it is a symbolic link"],
  ["Submodule", "it is a submodule"],
] as const)("Unsupported %s says why the file cannot be shown", (reason, words) => {
  const cause: SourceFailure = { kind: "Unsupported", path: "src/logo.png", reason };
  const said = text({ action: "open", path: "src/logo.png", cause });

  expect(said).toContain("src/logo.png cannot be shown in the editor");
  expect(said).toContain(words);
});

test("a broken settings file names its line and column and what to do", () => {
  const message = "expected `,` or `}` at line 3 column 7";

  expect(
    text({ action: "settings", cause: { kind: "SettingsBroken", path: SETTINGS, message } }),
  ).toBe(
    `The settings file ${SETTINGS} has an error at line 3, column 7: expected \`,\` or \`}\`. Fix it or choose another file.`,
  );
});

test("a broken settings entry without a position names the error only", () => {
  const message = "`theme`: unknown variant `blue`, expected `dark` or `light`";

  expect(
    text({ action: "settings", cause: { kind: "SettingsBroken", path: SETTINGS, message } }),
  ).toBe(`The settings file ${SETTINGS} has an error: ${message}. Fix it or choose another file.`);
});

test("the other settings failures say the settings file could not be used and why", () => {
  expect(text({ action: "settings", cause: { kind: "NotAbsolute", path: "yamt.json" } })).toBe(
    "Could not use the settings file: yamt.json is not an absolute path; start it with / or ~/.",
  );
  expect(text({ action: "settings", cause: { kind: "NoConfigFolder" } })).toBe(
    "Could not use the settings file: this system has no config folder to keep it in.",
  );
  expect(
    text({
      action: "settings",
      cause: { kind: "ReadFailed", path: SETTINGS, message: "Permission denied (os error 13)" },
    }),
  ).toBe(
    `Could not use the settings file: reading ${SETTINGS} failed: Permission denied (os error 13)`,
  );
  expect(
    text({
      action: "settings",
      cause: { kind: "WriteFailed", path: SETTINGS, message: "Read-only file system" },
    }),
  ).toBe(`Could not use the settings file: writing ${SETTINGS} failed: Read-only file system`);
});

test("an action after an abort says the merge was aborted", () => {
  expect(text({ action: "save", path: PATH, cause: { kind: "MergeAborted" } })).toBe(
    `Could not save ${PATH}: the merge was aborted.`,
  );
});

test("an unknown compare tab says the tab was closed", () => {
  expect(text({ action: "list", cause: { kind: "UnknownTab", tab: 3 } })).toBe(
    "Could not list the conflicted files: that tab was closed.",
  );
});

test("a range file Rust does not list says it is not part of this range", () => {
  expect(text({ action: "open", path: PATH, cause: { kind: "UnknownRangeFile", file: 3 } })).toBe(
    `Could not open ${PATH}: that file is not part of this range.`,
  );
});

test("a column over the limit names the limit from the reply in MiB", () => {
  const limit = 8 * 1024 * 1024;

  expect(text({ action: "list", cause: { kind: "ColumnTooLarge", limit } })).toBe(
    "Could not list the conflicted files: a column holds up to 8 MiB.",
  );
  expect(text({ action: "list", cause: { kind: "ColumnTooLarge", limit: limit / 2 } })).toBe(
    "Could not list the conflicted files: a column holds up to 4 MiB.",
  );
});

test("a stopped worker says to try again", () => {
  expect(text({ action: "list", cause: { kind: "WorkerStopped" } })).toBe(
    "Could not list the conflicted files: yamt's worker stopped; try again.",
  );
});

test.each<[ProblemCause, string]>([
  [{ kind: "UnknownThread", thread: 4 }, "that thread is not on a file of this range."],
  [{ kind: "UnknownMessage", message: 9 }, "that message is not on a file of this range."],
  [{ kind: "EmptyMessage" }, "the message is empty."],
  [{ kind: "MessagePending", message: 9 }, "that message is already pending on GitLab."],
  [
    { kind: "NotANote", message: 9 },
    "that message is an AI answer; only your own comments can be changed.",
  ],
  [{ kind: "SendRunning" }, "a send to GitLab is still running; try again when it is done."],
  [{ kind: "AiOff" }, "the AI is off; start yamt with --ai to use it."],
])("the review failure %o has its fixed reason", (cause, reason) => {
  expect(text({ action: "openRange", cause })).toBe(`Could not open the range: ${reason}`);
});

test("a failed removal names the folder and the system's message", () => {
  expect(
    text({
      action: "openRange",
      cause: { kind: "RemoveFailed", folder: "/d/pair/checkout", message: "busy\n" },
    }),
  ).toBe("Could not open the range: removing /d/pair/checkout failed: busy");
});

test.each([
  [{ action: "tabs" }, "Could not update the tabs: boom"],
  [{ action: "loadTab", name: "Compare 2" }, "Could not load Compare 2: boom"],
  [
    { action: "saveTab", tab: TAB, column: "left", name: "Compare 2" },
    "Could not save Compare 2: boom",
  ],
] as const)("a failed compare call %o says what failed, naming the tab", (failed, words) => {
  expect(text({ ...failed, cause: { kind: "Unexpected", message: "boom" } })).toBe(words);
});

test("a failed openRange says the range could not be opened, with git's words", () => {
  expect(text({ action: "openRange", cause: { kind: "Git", message: "bad revision\n" } })).toBe(
    "Could not open the range: bad revision",
  );
});

test.each([
  ["list", "Could not load the threads: boom"],
  ["add", "Could not add the thread: boom"],
  ["note", "Could not add the note: boom"],
  ["queue", "Could not queue the message: boom"],
  ["unqueue", "Could not unqueue the message: boom"],
  ["edit", "Could not edit the comment: boom"],
  ["delete", "Could not delete the comment: boom"],
  ["check", "Could not check GitLab: boom"],
  ["send", "Could not send to GitLab: boom"],
  ["session", "Could not store the AI's conversation: boom"],
  ["answer", "Could not store the AI's answer: boom"],
] as const)("a failed thread call at %s says what failed", (step, words) => {
  expect(text({ action: "threads", step, cause: { kind: "Unexpected", message: "boom" } })).toBe(
    words,
  );
});

test.each([
  ["ask", "The AI could not answer: the AI is off; start yamt with --ai to use it."],
  ["diff", "Could not show the diff: the AI is off; start yamt with --ai to use it."],
  [
    "discard",
    "The AI's checkout could not be removed: the AI is off; start yamt with --ai to use it.",
  ],
] as const)("a failed AI call at %s says what failed", (step, words) => {
  expect(text({ action: "ai", step, cause: { kind: "AiOff" } })).toBe(words);
});

test("a failed discard names the checkout and the system's message", () => {
  expect(
    text({
      action: "ai",
      step: "discard",
      cause: { kind: "RemoveFailed", folder: "/d/pair/checkout", message: "busy\n" },
    }),
  ).toBe("The AI's checkout could not be removed: removing /d/pair/checkout failed: busy");
});

test("a save to a tab another call closed says the tab was closed", () => {
  expect(
    text({
      action: "saveTab",
      tab: TAB,
      column: "right",
      name: "Compare 2",
      cause: { kind: "UnknownTab", tab: 2 },
    }),
  ).toBe("Could not save Compare 2: that tab was closed.");
});

test.each([
  ["StopMovedOn", "The operation moved on; the list is being read again."],
  ["GitRunning", "Git is still running; try again when it is done."],
  ["MergeFinished", "The operation is finished."],
  ["NoOperation", "Git has no operation to continue or abort."],
] as const)("%s says what git is at, whatever was tried", (kind, words) => {
  expect(text({ action: "save", path: PATH, cause: { kind } })).toBe(words);
  expect(text({ action: "abort", operation: "Rebase", cause: { kind } })).toBe(words);
});

test.each([
  ["Merge", "Could not abort the merge: error: Entry 'a.ts' not uptodate."],
  ["Rebase", "Could not abort the rebase: error: Entry 'a.ts' not uptodate."],
  ["Am", "Could not abort the patch application: error: Entry 'a.ts' not uptodate."],
] as const)("an abort git refused names the %s", (operation, words) => {
  const cause = { kind: "Git", message: "error: Entry 'a.ts' not uptodate.\n" } as const;

  expect(text({ action: "abort", operation, cause })).toBe(words);
});

test.each([
  ["Rebase", "Could not continue the rebase: hook says no"],
  ["CherryPick", "Could not continue the cherry-pick: hook says no"],
  ["Merge", "Could not commit the merge: hook says no"],
  ["SquashMerge", "Could not commit the squash merge: hook says no"],
] as const)("a Continue git refused names the %s and keeps git's words", (operation, words) => {
  const cause = { kind: "Git", message: "hook says no\n" } as const;

  expect(text({ action: "continue", operation, cause })).toBe(words);
});

test("a close refused while git runs says to wait for git", () => {
  expect(text({ action: "close" })).toBe("Git is still running; close yamt when it is done.");
});

test("a stop with nothing to list shows git's message as it came, naming the operation or git", () => {
  const message = "Rebasing (2/3)\rerror: could not apply cdc3800... card title\n";

  expect(text({ action: "stopped", operation: "Rebase", message })).toBe(
    "The rebase stopped: Rebasing (2/3)\rerror: could not apply cdc3800... card title",
  );
  expect(text({ action: "stopped", operation: null, message: "hook failed" })).toBe(
    "Git stopped: hook failed",
  );
});

test("key problems name the action, the key and what yamt does instead", () => {
  const said = problemText(
    {
      action: "settings",
      cause: {
        kind: "Keys",
        path: SETTINGS,
        problems: [
          { kind: "unreadable", action: "redo", text: "Ctrl+Q" },
          { kind: "twice", key: key("Mod-f"), actions: ["find", "indent"] },
        ],
      },
    },
    LINUX,
  );

  expect(said).toBe(
    `The settings file ${SETTINGS} gives Redo the key "Ctrl+Q", which yamt cannot read; Redo keeps its default keys. ` +
      `The settings file ${SETTINGS} gives Ctrl+F to both Find and Indent; only Find uses it.`,
  );
  expect(
    problemText(
      {
        action: "settings",
        cause: {
          kind: "Keys",
          path: SETTINGS,
          problems: [{ kind: "twice", key: key("Mod-f"), actions: ["find", "indent"] }],
        },
      },
      "MacIntel",
    ),
  ).toContain("gives ⌘F to both");
});
