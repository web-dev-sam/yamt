import { expect, test } from "vitest";

import type { SourceFailure } from "../ipc";
import { problemText } from "./problemText";
import type { Problem, ProblemCause } from "./store";

const PATH = "src/a.ts";

function onFinish(cause: ProblemCause): Problem {
  return { action: "finish", path: PATH, cause };
}

test.each([
  ["open", `Could not open ${PATH}`],
  ["finish", `Could not mark ${PATH} as resolved`],
  ["reset", `Could not reset ${PATH}`],
] as const)("a failed %s names the file and what failed", (action, words) => {
  const text = problemText({ action, path: PATH, cause: { kind: "Unexpected", message: "boom" } });

  expect(text).toContain(words);
  expect(text).toContain("boom");
});

test("a failed list says the list could not be read, with the cause", () => {
  const text = problemText({ action: "list", cause: { kind: "Unexpected", message: "repo gone" } });

  expect(text).toContain("Could not list the conflicted files");
  expect(text).toContain("repo gone");
});

test("Git carries git's own message", () => {
  const text = problemText(onFinish({ kind: "Git", message: "git add failed: index.lock\n" }));

  expect(text).toContain(`Could not mark ${PATH} as resolved`);
  expect(text).toContain("git add failed: index.lock");
  expect(text.endsWith("\n")).toBe(false);
});

test("UnknownPath names the path", () => {
  const text = problemText({
    action: "open",
    path: PATH,
    cause: { kind: "UnknownPath", path: PATH },
  });

  expect(text).toContain(`${PATH} is not one of the conflicted files`);
});

test("WriteFailed names the path and the system's message", () => {
  const text = problemText(onFinish({ kind: "WriteFailed", path: PATH, message: "disk full" }));

  expect(text).toContain(`writing ${PATH} failed`);
  expect(text).toContain("disk full");
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
  const text = problemText({ action: "open", path: "src/logo.png", cause });

  expect(text).toContain("src/logo.png cannot be shown in the editor");
  expect(text).toContain(words);
});
