import { EditorState, type StateField } from "@codemirror/state";
import { expect, test } from "vitest";

import { loadFixture, type FileMergeData } from "../../ipc";
import { chunkField, type ChunkSpan } from "./chunkField";
import { toDocPos, type DocPos } from "./docPos";
import { changeLines, resultLineUp } from "./lineUp";
import { lineSeparator, paneDocs } from "./paneDocs";

type LocalChange = { readonly middle: number; readonly local: number; readonly localLen: number };

function docOf(text: string, crlf = false): EditorState {
  return EditorState.create({ doc: text, extensions: crlf ? lineSeparator("CrLf") : [] });
}

function numbered(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `line ${from + index}`);
}

function span(from: number, to: number): { from: DocPos; to: DocPos } {
  return { from: toDocPos(from), to: toDocPos(to) };
}

async function localChanges(local: string[], changes: LocalChange[]): Promise<FileMergeData> {
  const middle = numbered(1, 60);
  const record = {
    path: "synthetic.ts",
    deleted: null,
    middle: { kind: "Stages", text: `${middle.join("\n")}\n` },
    local: `${local.join("\n")}\n`,
    remote: `${middle.join("\n")}\n`,
    eol: "Lf",
    disk_version: 0,
    chunks: changes.map((change, id) => ({
      chunk: {
        id,
        kind: "LocalOnly",
        base: { start: change.middle, len: 1 },
        local: { start: change.local, len: change.localLen },
        remote: { start: change.middle, len: 1 },
      },
      middle: { start: change.middle, len: 1 },
      words: {
        chunk: id,
        local: { changed: [], removals: [] },
        remote: { changed: [], removals: [] },
      },
      waiting: { kind: "SideLines" },
    })),
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

type Result = { readonly state: EditorState; readonly field: StateField<readonly ChunkSpan[]> };

function resultState(data: FileMergeData): Result {
  const field = chunkField(data.chunks);
  return { state: EditorState.create({ doc: paneDocs(data).center, extensions: field }), field };
}

test("changeLines: a span of whole lines, an insertion point between lines and one after a last line without a break", () => {
  const doc = docOf("a\nb\nc").doc;

  expect(changeLines(doc, span(2, 4))).toEqual({ start: 1, len: 1 });
  expect(changeLines(doc, span(2, 2))).toEqual({ start: 1, len: 0 });
  expect(changeLines(doc, span(5, 5))).toEqual({ start: 3, len: 0 });
  expect(changeLines(doc, span(0, 0))).toEqual({ start: 0, len: 0 });
});

test("changeLines: a span ending mid-line at the document's end holds that last line", () => {
  const doc = docOf("a\nb\nc").doc;

  expect(changeLines(doc, span(2, 5))).toEqual({ start: 1, len: 2 });
  expect(changeLines(doc, span(4, 5))).toEqual({ start: 2, len: 1 });
});

test("changeLines on a CRLF document counts each \\r\\n as one line break", () => {
  const state = docOf("a\r\nb\r\nc\r\n", true);
  const { doc } = state;
  const second = doc.line(2);
  const end = doc.line(4).from;

  expect(doc.lines).toBe(4);
  expect(changeLines(doc, span(second.from, end))).toEqual({ start: 1, len: 2 });
  expect(changeLines(doc, span(end, end))).toEqual({ start: 3, len: 0 });
});

test("resultLineUp: the Result's text, each change's live lines in the Result and its fixed side lines", async () => {
  const local = [...numbered(1, 10), "local a", "local b", ...numbered(12, 60)];
  const data = await localChanges(local, [{ middle: 10, local: 10, localLen: 2 }]);
  const { state, field } = resultState(data);
  const typed = state.update({ changes: { from: state.doc.line(11).to, insert: "\nmore" } }).state;

  expect(resultLineUp(state, field, "shown")).toEqual({
    result: "shown",
    changes: [
      {
        left: { start: 10, len: 2 },
        center: { start: 10, len: 1 },
        right: { start: 10, len: 1 },
      },
    ],
  });
  expect(resultLineUp(typed, field, "typed").changes).toEqual([
    {
      left: { start: 10, len: 2 },
      center: { start: 10, len: 2 },
      right: { start: 10, len: 1 },
    },
  ]);
});

test("resultLineUp: two changes whose shared edge became mid-line get disjoint Result lines, the later one starting where the earlier ends", async () => {
  const local = [...numbered(1, 10), "local a", "local b", "local c", ...numbered(13, 60)];
  const data = await localChanges(local, [
    { middle: 10, local: 10, localLen: 2 },
    { middle: 11, local: 12, localLen: 1 },
  ]);
  const { state, field } = resultState(data);
  const breakAt = state.doc.line(11).to;
  const joined = state.update({ changes: { from: breakAt, to: breakAt + 1 } }).state;

  expect(resultLineUp(state, field, "").changes.map((change) => change.center)).toEqual([
    { start: 10, len: 1 },
    { start: 11, len: 1 },
  ]);
  expect(resultLineUp(joined, field, "").changes.map((change) => change.center)).toEqual([
    { start: 10, len: 1 },
    { start: 11, len: 0 },
  ]);
});
