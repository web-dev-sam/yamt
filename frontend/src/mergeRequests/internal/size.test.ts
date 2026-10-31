import { expect, test } from "vitest";

import { sizeParts, sizeTitle } from "../index";

test("the size comes in parts: +added, −removed, the files", () => {
  expect(sizeParts({ additions: 120, deletions: 40, files: 6 })).toEqual({
    added: "+120",
    removed: "\u221240",
    files: "6 files",
  });
});

test("the removed count's minus is a real minus sign (U+2212), not a hyphen", () => {
  expect(sizeParts({ additions: 1, deletions: 2, files: 2 }).removed.codePointAt(0)).toBe(0x2212);
});

test("one file is a file, not files", () => {
  expect(sizeParts({ additions: 3, deletions: 0, files: 1 }).files).toBe("1 file");
});

test("the title spells the counts out, plural", () => {
  expect(sizeTitle({ additions: 120, deletions: 40, files: 6 })).toBe(
    "120 lines added, 40 removed in 6 files",
  );
});

test("the title's singulars: one line added, one file", () => {
  expect(sizeTitle({ additions: 1, deletions: 1, files: 1 })).toBe(
    "1 line added, 1 removed in 1 file",
  );
});

test("no line added is plural, as English says it", () => {
  expect(sizeTitle({ additions: 0, deletions: 2, files: 2 })).toBe(
    "0 lines added, 2 removed in 2 files",
  );
});
