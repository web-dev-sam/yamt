import { expect, test } from "vitest";

import {
  isMergeRequestIid,
  type MergeRequestIid,
  type RangeEntry,
  type RangeSide,
  type RangeStart,
} from "../ipc";
import {
  branchedOffNote,
  changeMark,
  columnNames,
  columnText,
  emptyRangeText,
  fileHeading,
  fileSentence,
  headingLine,
  lineCounts,
  modeNote,
  REVIEW_MARK_WORDS,
  reviewedCount,
  sideLabel,
  type ColumnName,
  type ColumnNames,
  type HeadingLine,
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
const FEATURE: RangeSide = {
  label: { kind: "named", name: "feature" },
  shortId: "9c1ba3f",
  subject: "Remind",
};
const BASE_ID = "531ea52f0c2b6a7d9e8f1a2b3c4d5e6f7a8b9c0d";
const HEAD_ID = "9c1ba3f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6";
const MR_BASE: RangeSide = {
  label: { kind: "named", name: BASE_ID },
  shortId: "531ea52",
  subject: "Base",
};
const MR_HEAD: RangeSide = {
  label: { kind: "named", name: HEAD_ID },
  shortId: "9c1ba3f",
  subject: "Remind",
};

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is no merge-request iid`);
  }
  return value;
}

type Sides = Pick<RangeStart, "heading" | "left" | "right">;

const TWO_DOTS: Sides = { heading: { kind: "typed" }, left: MAIN, right: DEV };
const THREE_DOTS: Sides = { heading: { kind: "typed" }, left: BASE, right: FEATURE };
const MERGE_REQUEST: Sides = {
  heading: {
    kind: "mergeRequest",
    iid: iid(12),
    names: { title: "Reminders before a card is due", source: "feature", target: "main" },
  },
  left: MR_BASE,
  right: MR_HEAD,
};
const UNNAMED: Sides = {
  heading: { kind: "unnamedMergeRequest", iid: iid(12) },
  left: MR_BASE,
  right: MR_HEAD,
};

function entry(change: RangeEntry["change"]): Pick<RangeEntry, "path" | "change"> {
  return { path: "src/keys.md", change };
}

test("a named side is its name, the left of three dots the merge base of both names, an empty side HEAD", () => {
  expect(sideLabel(MAIN)).toBe("main");
  expect(sideLabel(BASE)).toBe("merge base of main and feature");
  expect(sideLabel(HEAD)).toBe("HEAD");
});

test.each<[string, Sides, ColumnNames]>([
  [
    "two typed names: each side its name",
    TWO_DOTS,
    {
      left: {
        kind: "named",
        name: "main",
        branchedOff: null,
        shortId: "1b2cfed",
        subject: "Start",
      },
      right: { kind: "named", name: "dev", branchedOff: null, shortId: "2b3b4b5", subject: "Dev" },
    },
  ],
  [
    "three dots: the left is the left name, where the right one branched off",
    THREE_DOTS,
    {
      left: {
        kind: "named",
        name: "main",
        branchedOff: "feature",
        shortId: "0a1b2c3",
        subject: "Fork",
      },
      right: {
        kind: "named",
        name: "feature",
        branchedOff: null,
        shortId: "9c1ba3f",
        subject: "Remind",
      },
    },
  ],
  [
    "a merge request: the target where the source branched off, then the source",
    MERGE_REQUEST,
    {
      left: {
        kind: "named",
        name: "main",
        branchedOff: "feature",
        shortId: "531ea52",
        subject: "Base",
      },
      right: {
        kind: "named",
        name: "feature",
        branchedOff: null,
        shortId: "9c1ba3f",
        subject: "Remind",
      },
    },
  ],
  [
    "a merge request without names: the commits",
    UNNAMED,
    {
      left: { kind: "commit", shortId: "531ea52", subject: "Base" },
      right: { kind: "commit", shortId: "9c1ba3f", subject: "Remind" },
    },
  ],
])("columnNames of %s", (_case, sides, columns) => {
  expect(columnNames(sides)).toEqual(columns);
});

test("a merge-base label on the right is named by its left name, where its right one branched off", () => {
  expect(columnNames({ heading: { kind: "typed" }, left: MAIN, right: BASE }).right).toEqual({
    kind: "named",
    name: "main",
    branchedOff: "feature",
    shortId: "0a1b2c3",
    subject: "Fork",
  });
});

test.each<[ColumnName, string]>([
  [
    { kind: "named", name: "main", branchedOff: "feature", shortId: "531ea52", subject: "s" },
    "main, where feature branched off (531ea52)",
  ],
  [
    { kind: "named", name: "feature", branchedOff: null, shortId: "9c1ba3f", subject: "s" },
    "feature (9c1ba3f)",
  ],
  [{ kind: "commit", shortId: "9c1ba3f", subject: "s" }, "9c1ba3f"],
])("columnText of %o is %s", (column, text) => {
  expect(columnText(column)).toBe(text);
});

test("the branched-off note names the branch", () => {
  expect(branchedOffNote("feature")).toBe("where feature branched off");
});

test.each<[Sides, string]>([
  [TWO_DOTS, "main (1b2cfed) and dev (2b3b4b5) have the same files."],
  [
    THREE_DOTS,
    "main, where feature branched off (0a1b2c3) and feature (9c1ba3f) have the same files.",
  ],
  [
    MERGE_REQUEST,
    "main, where feature branched off (531ea52) and feature (9c1ba3f) have the same files.",
  ],
])("an empty range names both columns as their headers do: %s", (sides, text) => {
  expect(emptyRangeText(sides)).toBe(text);
});

test.each<[string, Sides, HeadingLine]>([
  [
    "a merge request: reference, title, source and target",
    MERGE_REQUEST,
    {
      kind: "mergeRequest",
      reference: "!12",
      title: "Reminders before a card is due",
      source: "feature",
      target: "main",
    },
  ],
  [
    "a merge request without names: reference, the right commit as source, the left as target",
    UNNAMED,
    { kind: "unnamedMergeRequest", reference: "!12", source: "9c1ba3f", target: "531ea52" },
  ],
  ["two dots", TWO_DOTS, { kind: "typed", left: "main", dots: "..", right: "dev" }],
  ["three dots", THREE_DOTS, { kind: "typed", left: "main", dots: "...", right: "feature" }],
  [
    "a merge-base label on the right: its right name",
    { heading: { kind: "typed" }, left: MAIN, right: BASE },
    { kind: "typed", left: "main", dots: "..", right: "feature" },
  ],
])("headingLine of %s", (_case, sides, line) => {
  expect(headingLine(sides)).toEqual(line);
});

test("no header text of a merge request without names holds a 40-character name", () => {
  const { left, right } = columnNames(UNNAMED);
  const texts = [
    columnText(left),
    columnText(right),
    emptyRangeText(UNNAMED),
    ...Object.values(headingLine(UNNAMED)),
  ];

  expect(texts.filter((text) => text.includes(BASE_ID) || text.includes(HEAD_ID))).toEqual([]);
  expect(texts.slice(0, 2)).toEqual(["531ea52", "9c1ba3f"]);
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

test("the reviewed count reads N of M reviewed", () => {
  expect(reviewedCount({ reviewed: 0, of: 13 })).toBe("0 of 13 reviewed");
  expect(reviewedCount({ reviewed: 13, of: 13 })).toBe("13 of 13 reviewed");
});

test("each review mark has its word", () => {
  expect(REVIEW_MARK_WORDS).toEqual({
    reviewed: "reviewed",
    changedSinceReview: "changed since reviewed",
  });
});
