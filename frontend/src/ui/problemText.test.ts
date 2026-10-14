import { expect, test } from "vitest";

import { parseKey, type Key, type SourceFailure } from "../ipc";
import type { Problem, ProblemCause } from "./problem";
import { problemText } from "./problemText";

const PATH = "src/a.ts";
const SETTINGS = "/home/me/.config/yamt/settings.json";
const LINUX = "Linux x86_64";

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
