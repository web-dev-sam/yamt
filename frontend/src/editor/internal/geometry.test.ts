import { EditorSelection, EditorState, Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { loadFixture } from "../../ipc";
import { chunkField, setStatus } from "./chunkField";
import { rangeSpan, rowsChanged } from "./geometry";
import { centerPane } from "./pane";
import { statusAfterIgnore } from "./status";

const LINE_PX = 20;

function spanOf(
  lines: readonly string[],
  from: number,
  to: number,
): { top: number; bottom: number } {
  const doc = Text.of(lines);
  return rangeSpan(doc, { from, to }, (pos) => {
    const top = (doc.lineAt(pos).number - 1) * LINE_PX;
    return { top, bottom: top + LINE_PX };
  });
}

test("lines in the middle span from the first line's top to the next line's top", () => {
  expect(spanOf(["a", "b", "c"], 2, 4)).toEqual({ top: 20, bottom: 40 });
});

test("an empty range at a line start is a point at that line's top", () => {
  expect(spanOf(["a", "b", "c"], 0, 0)).toEqual({ top: 0, bottom: 0 });
  expect(spanOf(["a", "b", "c"], 2, 2)).toEqual({ top: 20, bottom: 20 });
});

test("a range to the end of an unterminated last line ends at that line's bottom", () => {
  expect(spanOf(["a", "b", "c"], 2, 5)).toEqual({ top: 20, bottom: 60 });
});

test("an empty range at the end of an unterminated last line is a point at its bottom", () => {
  expect(spanOf(["a", "b", "c"], 5, 5)).toEqual({ top: 60, bottom: 60 });
});

test("a range to the end of a newline-terminated document ends at the empty last line's top", () => {
  expect(spanOf(["a", "b", ""], 2, 4)).toEqual({ top: 20, bottom: 40 });
  expect(spanOf(["a", "b", ""], 4, 4)).toEqual({ top: 40, bottom: 40 });
});

test("an empty document has one point at the top", () => {
  expect(spanOf([""], 0, 0)).toEqual({ top: 0, bottom: 0 });
});

test("chunk rows go stale on a status change, an edit or new measurements, not on a cursor move", async () => {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  const field = chunkField(data.chunks);
  const state = EditorState.create({
    doc: centerPane(data.middle, false).doc,
    extensions: field,
  });
  const [first] = state.field(field);
  if (first === undefined) {
    throw new Error("fixture lost its chunks");
  }
  const status = statusAfterIgnore(first.chunk, first.status, "local");
  const ignored = state.update({ effects: setStatus.of({ id: first.chunk.id, status }) }).state;
  const edited = state.update({ changes: { from: 0, insert: "x\n" } }).state;
  const moved = state.update({ selection: EditorSelection.cursor(1) }).state;
  const sidePane = EditorState.create({ doc: data.local });

  expect(rowsChanged({ geometryChanged: false, startState: state, state: ignored }, field)).toBe(
    true,
  );
  expect(rowsChanged({ geometryChanged: false, startState: state, state: edited }, field)).toBe(
    true,
  );
  expect(rowsChanged({ geometryChanged: false, startState: state, state: moved }, field)).toBe(
    false,
  );
  expect(rowsChanged({ geometryChanged: true, startState: state, state: moved }, field)).toBe(true);
  expect(
    rowsChanged({ geometryChanged: false, startState: sidePane, state: sidePane }, field),
  ).toBe(false);
  expect(rowsChanged({ geometryChanged: true, startState: sidePane, state: sidePane }, field)).toBe(
    true,
  );
});
