import { expect, test } from "vitest";

import type { RangeEntry, RangeSide, RangeStart } from "../ipc";
import {
  changeMark,
  emptyRangeText,
  fileHeading,
  fileSentence,
  lineCounts,
  modeNote,
  sideHeading,
  sideLabel,
  type SentenceFile,
} from "./rangeText";

const MAIN: RangeSide = {
  label: { kind: "named", name: "main" },
  shortId: "1b2cfed",
  subject: "Start",
};
const DEV: RangeSide = {
  label: { kind: "named", name: "dev" },
  shortId: "2b3b4b5",
  subject: "Dev",
};
const BASE: RangeSide = {
  label: { kind: "mergeBase", left: "main", right: "feature" },
  shortId: "0a1b2c3",
  subject: "Fork",
};
const HEAD: RangeSide = { label: { kind: "named", name: "HEAD" }, shortId: "9f8e7d6", subject: "" };

function entry(change: RangeEntry["change"]): Pick<RangeEntry, "path" | "change"> {
  return { path: "src/keys.md", change };
}

test("a named side is its name, the left of three dots the merge base of both names, an empty side HEAD", () => {
  expect(sideLabel(MAIN)).toBe("main");
  expect(sideLabel(BASE)).toBe("merge base of main and feature");
  expect(sideLabel(HEAD)).toBe("HEAD");
});

test("a column header names the side and its short id", () => {
  expect(sideHeading(MAIN)).toBe("main (1b2cfed)");
  expect(sideHeading(BASE)).toBe("merge base of main and feature (0a1b2c3)");
  expect(sideHeading(HEAD)).toBe("HEAD (9f8e7d6)");
});

test("an empty range names both sides with their short ids", () => {
  const start: RangeStart = { range: "main..dev", left: MAIN, right: DEV, files: [] };
  expect(emptyRangeText(start)).toBe("main (1b2cfed) and dev (2b3b4b5) have the same files.");
});

test("a renamed file's header is old → new; every other change shows its path", () => {
  expect(fileHeading(entry({ kind: "renamed", oldPath: "docs/shortcuts.md" }))).toBe(
    "docs/shortcuts.md → src/keys.md",
  );
  expect(fileHeading(entry({ kind: "modified" }))).toBe("src/keys.md");
  expect(fileHeading(entry({ kind: "added" }))).toBe("src/keys.md");
  expect(fileHeading(entry({ kind: "deleted" }))).toBe("src/keys.md");
});

test("each change has its letter and word", () => {
  expect((["added", "modified", "deleted"] as const).map((kind) => changeMark({ kind }))).toEqual([
    { letter: "A", word: "added" },
    { letter: "M", word: "modified" },
    { letter: "D", word: "deleted" },
  ]);
  expect(changeMark({ kind: "renamed", oldPath: "a" })).toEqual({ letter: "R", word: "renamed" });
});

test("counted lines read +n −m with a real minus sign; a binary file has no counts", () => {
  expect(lineCounts({ kind: "counted", added: 12, removed: 3 })).toEqual({
    added: "+12",
    removed: "−3",
  });
  expect(lineCounts({ kind: "counted", added: 0, removed: 0 })).toEqual({
    added: "+0",
    removed: "−0",
  });
  expect(lineCounts({ kind: "notCounted" })).toBeNull();
});

test("a mode change beside a content change is a header note; the same mode none", () => {
  expect(modeNote({ kind: "changed", old: "file", new: "executable" })).toBe(
    "Mode changed: file → executable file",
  );
  expect(modeNote({ kind: "same" })).toBeNull();
});

test.each<[SentenceFile, string]>([
  [{ kind: "binary" }, "Binary file: not shown."],
  [{ kind: "tooLarge", limit: 8_388_608 }, "Larger than 8 MiB: not shown."],
  [{ kind: "notUtf8", sides: "left" }, "The left side is not UTF-8 text."],
  [{ kind: "notUtf8", sides: "right" }, "The right side is not UTF-8 text."],
  [{ kind: "notUtf8", sides: "both" }, "Neither side is UTF-8 text."],
  [
    { kind: "modeOnly", old: "file", new: "executable" },
    "Only the file mode changed: file → executable file.",
  ],
  [
    { kind: "modeOnly", old: "executable", new: "file" },
    "Only the file mode changed: executable file → file.",
  ],
  [{ kind: "kindChanged", old: "file", new: "link" }, "Changed from a file to a symbolic link."],
  [
    { kind: "kindChanged", old: "link", new: "executable" },
    "Changed from a symbolic link to an executable file.",
  ],
  [{ kind: "kindChanged", old: "submodule", new: "file" }, "Changed from a submodule to a file."],
  [{ kind: "submodule", old: "1a2b3c", new: "3c4d5e" }, "Submodule: 1a2b3c → 3c4d5e"],
  [{ kind: "submodule", old: null, new: "3c4d5e" }, "Submodule: none → 3c4d5e"],
  [{ kind: "submodule", old: "1a2b3c", new: null }, "Submodule: 1a2b3c → none"],
])("the %o sentence is %s", (file, sentence) => {
  expect(fileSentence(file)).toBe(sentence);
});
