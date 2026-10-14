import { expect, test } from "vitest";

import type { FileEntry } from "../ipc";
import { folderPaths, revealed, treeRows, type TreeRow } from "./fileTree";

function entry(path: string): FileEntry {
  return { path, status: "Unresolved", unsupported: null };
}

function shown(rows: readonly TreeRow[]): string[] {
  return rows.map((row) => {
    switch (row.kind) {
      case "folder":
        return `${row.depth} ${row.open ? "v" : ">"} ${row.label} [${row.path}]`;
      case "file":
        return `${row.depth} ${row.label} [${row.file.path}]`;
    }
  });
}

function tree(paths: readonly string[], closed: readonly string[] = []): string[] {
  return shown(treeRows(paths.map(entry), new Set(closed)));
}

test("treeRows: puts folders before files at each level", () => {
  expect(tree(["z.ts", "a/y.ts", "a/b/x.ts", "a/c.ts", "b/w.ts"])).toEqual([
    "0 v a [a]",
    "1 v b [a/b]",
    "2 x.ts [a/b/x.ts]",
    "1 c.ts [a/c.ts]",
    "1 y.ts [a/y.ts]",
    "0 v b [b]",
    "1 w.ts [b/w.ts]",
    "0 z.ts [z.ts]",
  ]);
});

test("treeRows: orders names naturally and ignoring case, with a total tie-break", () => {
  expect(tree(["file10.ts", "file2.ts", "b.ts", "B.ts", "a.ts", "A.ts", "C.ts"])).toEqual([
    "0 A.ts [A.ts]",
    "0 a.ts [a.ts]",
    "0 B.ts [B.ts]",
    "0 b.ts [b.ts]",
    "0 C.ts [C.ts]",
    "0 file2.ts [file2.ts]",
    "0 file10.ts [file10.ts]",
  ]);
  expect(tree(["a.ts", "A.ts"])).toEqual(tree(["A.ts", "a.ts"]));
});

test("treeRows: orders folders naturally and ignoring case too", () => {
  expect(tree(["v10/x", "V2/x", "v2/y", "v1/x"]).filter((row) => row.includes(" v "))).toEqual([
    "0 v v1 [v1]",
    "0 v V2 [V2]",
    "0 v v2 [v2]",
    "0 v v10 [v10]",
  ]);
});

test("treeRows: joins a chain of single folders into one row", () => {
  expect(tree(["packages/core/src/b.ts", "packages/core/src/a.ts"])).toEqual([
    "0 v packages/core/src [packages/core/src]",
    "1 a.ts [packages/core/src/a.ts]",
    "1 b.ts [packages/core/src/b.ts]",
  ]);
});

test("treeRows: ends a chain at a folder holding files and folders", () => {
  expect(tree(["a/b/x.ts", "a/b/c/y.ts"])).toEqual([
    "0 v a/b [a/b]",
    "1 v c [a/b/c]",
    "2 y.ts [a/b/c/y.ts]",
    "1 x.ts [a/b/x.ts]",
  ]);
});

test("treeRows: never joins a folder holding a file to its child", () => {
  expect(tree(["a/x.ts", "a/b/c/y.ts"])).toEqual([
    "0 v a [a]",
    "1 v b/c [a/b/c]",
    "2 y.ts [a/b/c/y.ts]",
    "1 x.ts [a/x.ts]",
  ]);
});

test("treeRows: does not join a folder holding one file to anything", () => {
  expect(tree(["a/b/x.ts", "a/c/y.ts"])).toEqual([
    "0 v a [a]",
    "1 v b [a/b]",
    "2 x.ts [a/b/x.ts]",
    "1 v c [a/c]",
    "2 y.ts [a/c/y.ts]",
  ]);
});

test("treeRows: keeps top-level files at depth 0 beside top-level folders", () => {
  expect(tree(["README.md", "src/main.ts"])).toEqual([
    "0 v src [src]",
    "1 main.ts [src/main.ts]",
    "0 README.md [README.md]",
  ]);
});

test("treeRows: hides every descendant of a closed folder and only those", () => {
  const paths = ["a/b/x.ts", "a/b/c/y.ts", "a/z.ts", "d/w.ts", "top.ts"];
  expect(tree(paths, ["a/b"])).toEqual([
    "0 v a [a]",
    "1 > b [a/b]",
    "1 z.ts [a/z.ts]",
    "0 v d [d]",
    "1 w.ts [d/w.ts]",
    "0 top.ts [top.ts]",
  ]);
  expect(tree(paths, ["a"])).toEqual([
    "0 > a [a]",
    "0 v d [d]",
    "1 w.ts [d/w.ts]",
    "0 top.ts [top.ts]",
  ]);
});

test("treeRows: keys a chained row by its last folder", () => {
  const paths = ["packages/core/src/a.ts"];
  expect(tree(paths, ["packages/core/src"])).toEqual(["0 > packages/core/src [packages/core/src]"]);
  expect(tree(paths, ["packages", "packages/core"])).toEqual(tree(paths));
});

test("treeRows: ignores a closed key that names no folder", () => {
  const paths = ["a/b/x.ts", "a/y.ts", "top.ts"];
  expect(tree(paths, ["nothing", "a/y.ts", "top.ts", "a/"])).toEqual(tree(paths));
});

test("treeRows: gives the whole entry to a file row", () => {
  const resolved: FileEntry = { path: "a/x.ts", status: "Resolved", unsupported: null };
  expect(treeRows([resolved], new Set())).toEqual([
    { kind: "folder", path: "a", label: "a", depth: 0, open: true },
    { kind: "file", file: resolved, label: "x.ts", depth: 1 },
  ]);
});

test("treeRows: shows nothing for no files", () => {
  expect(treeRows([], new Set())).toEqual([]);
});

test("folderPaths: names every folder holding a file, outermost first", () => {
  expect(folderPaths("a/b/c.ts")).toEqual(["a", "a/b"]);
});

test("folderPaths: is empty for a top-level file", () => {
  expect(folderPaths("c.ts")).toEqual([]);
});

test("revealed: opens a closed chained row holding the file", () => {
  const path = "packages/core/src/a.ts";
  const closed = new Set(["packages/core/src"]);
  expect([...revealed(closed, path)]).toEqual([]);
  expect(tree([path], [...revealed(closed, path)])).toEqual(tree([path]));
});

test("revealed: opens every closed folder holding the file and keeps unrelated ones closed", () => {
  const closed = new Set(["a", "b", "a/b", "a/b/c", "a/bx"]);
  expect([...revealed(closed, "a/b/x.ts")]).toEqual(["b", "a/b/c", "a/bx"]);
  expect([...revealed(new Set(["a", "b"]), "a/b/x.ts")]).toEqual(["b"]);
  expect([...closed]).toEqual(["a", "b", "a/b", "a/b/c", "a/bx"]);
});

test("revealed: returns the same set when no folder holding the file is closed", () => {
  const closed = new Set(["b", "a/b/c"]);
  expect(revealed(closed, "a/b/x.ts")).toBe(closed);
});

test("revealed: changes nothing for a top-level file", () => {
  const closed = new Set(["top.ts", "a"]);
  expect(revealed(closed, "top.ts")).toBe(closed);
  expect([...closed]).toEqual(["top.ts", "a"]);
});
