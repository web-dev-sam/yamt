import { expect, test } from "vitest";

import type { RangeLineCounts } from "../ipc";
import { folderSums } from "./rangeFolderSums";

function counted(path: string, added: number, removed: number) {
  return { path, lines: { kind: "counted", added, removed } satisfies RangeLineCounts };
}

function notCounted(path: string) {
  return { path, lines: { kind: "notCounted" } satisfies RangeLineCounts };
}

function sums(files: Parameters<typeof folderSums>[0]): Record<string, [number, number]> {
  return Object.fromEntries(
    [...folderSums(files)].map(([path, { added, removed }]) => [path, [added, removed]]),
  );
}

test("folderSums: a file three folders deep counts in all three, beside the files at each level", () => {
  expect(
    sums([
      counted("src/board/parts/card.ts", 5, 2),
      counted("src/board/view.ts", 3, 1),
      counted("src/main.ts", 10, 20),
      counted("docs/README.md", 4, 1),
    ]),
  ).toEqual({
    src: [18, 23],
    "src/board": [8, 3],
    "src/board/parts": [5, 2],
    docs: [4, 1],
  });
});

test("folderSums: a joined chain has the chain's sum at its deepest folder, the key its row carries", () => {
  expect(sums([counted("a/b/c/x.ts", 7, 3), counted("a/b/c/y.ts", 1, 1)])).toEqual({
    a: [8, 4],
    "a/b": [8, 4],
    "a/b/c": [8, 4],
  });
});

test("folderSums: a notCounted file beside counted ones adds nothing", () => {
  expect(sums([notCounted("public/logo.png"), counted("public/index.html", 2, 1)])).toEqual({
    public: [2, 1],
  });
});

test("folderSums: a folder holding only notCounted files has no entry", () => {
  const files = [notCounted("public/logo.png"), notCounted("public/icons/a.png")];
  expect(folderSums(files).size).toBe(0);
});

test("folderSums: a counted +0 −0 file alone in a folder gives zeros", () => {
  expect(folderSums([counted("tools/build.sh", 0, 0)]).get("tools")).toEqual({
    kind: "counted",
    added: 0,
    removed: 0,
  });
});

test("folderSums: a root-level file adds to no key", () => {
  expect(sums([counted("config", 3, 3), counted("data/x.json", 1, 0)])).toEqual({
    data: [1, 0],
  });
});
