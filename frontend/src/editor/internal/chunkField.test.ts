import { history, redo, undo } from "@codemirror/commands";
import { EditorState, Transaction, type StateCommand, type StateField } from "@codemirror/state";
import { expect, test } from "vitest";

import { createFixtureSource, log, type FileMergeData } from "../../ipc";
import { chunkField, type ChunkSpan } from "./chunkField";

type Center = { state: EditorState; field: StateField<readonly ChunkSpan[]> };

const MAPPED_BASE = "zero\none\ntwo\nthree\nfour\n";

async function synthetic(
  base: string,
  ranges: readonly { start: number; len: number }[],
): Promise<FileMergeData> {
  const record = {
    path: "synthetic.ts",
    base,
    local: "",
    remote: "",
    eol: "Lf",
    language: null,
    chunks: ranges.map((base, id) => ({
      id,
      kind: "Conflict",
      base,
      local: { start: 0, len: 1 },
      remote: { start: 0, len: 1 },
    })),
  };
  return createFixtureSource(log, { "synthetic.json": record }).loadFile("synthetic.ts");
}

function center(data: FileMergeData): Center {
  const field = chunkField(data.chunks);
  const state = EditorState.create({ doc: data.base, extensions: [history(), field] });
  return { state, field };
}

async function mappedCenter(): Promise<Center> {
  return center(
    await synthetic(MAPPED_BASE, [
      { start: 1, len: 2 },
      { start: 4, len: 0 },
    ]),
  );
}

function ranges({ state, field }: Center): [number, number][] {
  return state.field(field).map((span) => [span.from, span.to]);
}

function edit(current: Center, from: number, to: number, insert: string): Center {
  return { ...current, state: current.state.update({ changes: { from, to, insert } }).state };
}

function run(command: StateCommand, current: Center): Center {
  let next = current;
  command({
    state: current.state,
    dispatch: (tr) => {
      next = { ...current, state: tr.state };
    },
  });
  return next;
}

test("a real fixture's chunks start at line starts; an empty base range is a point", async () => {
  const data = await createFixtureSource(log).loadFile("vite-modulepreload-polyfill.ts");
  const { state, field } = center(data);
  const doc = state.doc;

  const [first, insertion, , last] = state.field(field);

  expect(first).toMatchObject({ id: 0, kind: "Conflict", from: 0, to: doc.line(2).from });
  expect(insertion).toMatchObject({
    id: 1,
    kind: "LocalOnly",
    tone: "inserted",
    from: doc.line(9).from,
    to: doc.line(9).from,
  });
  expect(last).toMatchObject({ from: doc.line(21).from, to: doc.line(35).from });
});

test("a chunk ending on the last line ends at the document end", async () => {
  const terminated = center(await synthetic("a\nb\n", [{ start: 1, len: 1 }]));
  const unterminated = center(
    await synthetic("a\nb", [
      { start: 1, len: 1 },
      { start: 2, len: 0 },
    ]),
  );

  expect(ranges(terminated)).toEqual([[2, 4]]);
  expect(ranges(unterminated)).toEqual([
    [2, 3],
    [3, 3],
  ]);
});

test("typing at the end of an unterminated last line stays inside its chunk", async () => {
  const typed = edit(center(await synthetic("a\nb", [{ start: 1, len: 1 }])), 3, 3, "\nc");

  expect(ranges(typed)).toEqual([[2, 5]]);
});

test("typing at an empty chunk's point in the middle of a line lands after it", async () => {
  const typed = edit(center(await synthetic("a\nb", [{ start: 2, len: 0 }])), 3, 3, "c");

  expect(ranges(typed)).toEqual([[3, 3]]);
});

test("an edit before a chunk shifts it", async () => {
  const shifted = edit(await mappedCenter(), 0, 0, "new\n");

  expect(ranges(shifted)).toEqual([
    [9, 17],
    [23, 23],
  ]);
});

test("typing inside a chunk, including at its first line's start, grows it", async () => {
  const start = await mappedCenter();

  expect(ranges(edit(start, 9, 9, "XY"))[0]).toEqual([5, 15]);
  expect(ranges(edit(start, 5, 5, "XY\n"))[0]).toEqual([5, 16]);
});

test("typing at the start of the line after a chunk stays outside it", async () => {
  const typed = edit(await mappedCenter(), 13, 13, "XY\n");

  expect(ranges(typed)).toEqual([
    [5, 13],
    [22, 22],
  ]);
});

test("text typed at an empty chunk's point lands after it", async () => {
  const typed = edit(await mappedCenter(), 19, 19, "XY\n");

  expect(ranges(typed)[1]).toEqual([19, 19]);
});

test("deleting all of a chunk's lines collapses it; undo restores the range", async () => {
  const deleted = edit(await mappedCenter(), 5, 13, "");
  const restored = run(undo, deleted);

  expect(ranges(deleted)).toEqual([
    [5, 5],
    [11, 11],
  ]);
  expect(restored.state.doc.toString()).toBe(MAPPED_BASE);
  expect(ranges(restored)).toEqual([
    [5, 13],
    [19, 19],
  ]);
});

test("one undo restores a merged history event; redo re-applies it", async () => {
  const start = await mappedCenter();
  const sameTime = Transaction.time.of(0);
  const deleted = {
    ...start,
    state: start.state.update({ changes: { from: 5, to: 13 }, annotations: sameTime }).state,
  };
  const typed = {
    ...deleted,
    state: deleted.state.update({ changes: { from: 5, insert: "x" }, annotations: sameTime }).state,
  };

  const undone = run(undo, typed);
  const redone = run(redo, undone);

  expect(undone.state.doc.toString()).toBe(MAPPED_BASE);
  expect(ranges(undone)).toEqual([
    [5, 13],
    [19, 19],
  ]);
  expect(redone.state.doc.toString()).toBe("zero\nxthree\nfour\n");
  expect(ranges(redone)).toEqual([
    [5, 5],
    [12, 12],
  ]);
});
