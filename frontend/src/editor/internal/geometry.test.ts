import { EditorSelection, EditorState, Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { loadFixture } from "../../ipc";
import { chunkField, setStatus } from "./chunkField";
import { toDocPos } from "./docPos";
import { foldField, showNextStep } from "./folds";
import { rangeSpan, rowsChanged, waveRows, type Pane } from "./geometry";
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

test("chunk rows go stale on a status change, an edit, a fold step or new measurements, not on a cursor move", async () => {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  const field = chunkField(data.chunks);
  const doc = centerPane(data.middle, false).doc;
  const lines = Text.of(doc.split("\n"));
  const hidden = { from: toDocPos(lines.line(3).from), to: toDocPos(lines.line(5).to) };
  const folds = foldField([{ hidden: [{ left: null, center: hidden, right: null }] }]);
  const state = EditorState.create({ doc, extensions: [field, folds] });
  const [first] = state.field(field);
  if (first === undefined) {
    throw new Error("fixture lost its chunks");
  }
  const status = statusAfterIgnore(first.chunk, first.status, "local");
  const ignored = state.update({ effects: setStatus.of({ id: first.chunk.id, status }) }).state;
  const edited = state.update({ changes: { from: 0, insert: "x\n" } }).state;
  const folded = state.update(showNextStep(state.field(folds), 0)).state;
  const moved = state.update({ selection: EditorSelection.cursor(1) }).state;
  const sidePane = EditorState.create({ doc: data.local });
  const fields = [field, folds];

  expect(rowsChanged({ geometryChanged: false, startState: state, state: ignored }, fields)).toBe(
    true,
  );
  expect(rowsChanged({ geometryChanged: false, startState: state, state: edited }, fields)).toBe(
    true,
  );
  expect(rowsChanged({ geometryChanged: false, startState: state, state: folded }, fields)).toBe(
    true,
  );
  expect(rowsChanged({ geometryChanged: false, startState: state, state: moved }, fields)).toBe(
    false,
  );
  expect(rowsChanged({ geometryChanged: true, startState: state, state: moved }, fields)).toBe(
    true,
  );
  expect(
    rowsChanged({ geometryChanged: false, startState: sidePane, state: sidePane }, fields),
  ).toBe(false);
  expect(
    rowsChanged({ geometryChanged: true, startState: sidePane, state: sidePane }, fields),
  ).toBe(true);
});

test("each pane's wave top is the block top at the start its own pane shows, null where it shows none", () => {
  const starts = {
    left: [toDocPos(11), null, null],
    center: [toDocPos(20), null, toDocPos(40)],
    right: [null, null, toDocPos(50)],
  };
  const offset: Readonly<Record<Pane, number>> = { left: 1000, center: 2000, right: 3000 };

  const rows = waveRows(starts, (pane, pos) => offset[pane] + pos);

  expect(rows).toEqual([
    { left: 1011, center: 2020, right: null },
    { left: null, center: null, right: null },
    { left: null, center: 2040, right: 3050 },
  ]);
});

test("a pane with fewer runs than the middle shows no wave for the missing runs", () => {
  const starts = { left: [], center: [toDocPos(0), toDocPos(9)], right: [toDocPos(3)] };

  expect(waveRows(starts, (_, pos) => pos)).toEqual([
    { left: null, center: 0, right: 3 },
    { left: null, center: 9, right: null },
  ]);
});
