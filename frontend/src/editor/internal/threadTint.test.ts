import { EditorState, type RangeSet, type RangeValue } from "@codemirror/state";
import { EditorView, gutterLineClass, type GutterMarker } from "@codemirror/view";
import { expect, test } from "vitest";

import {
  changedThreadLine,
  diffLineOf,
  loadCompareFixture,
  onePlace,
  unchangedThreadLine,
} from "../../ipc";
import { placesTint, sameSpans, showTint, threadTint } from "./threadTint";

const TINT = "cm-thread-tint";

function fresh(): EditorState {
  return EditorState.create({ doc: "a\nb\nc\nd\ne", extensions: threadTint });
}

function linesOf<V extends RangeValue>(
  state: EditorState,
  sets: readonly RangeSet<V>[],
  has: (value: V) => boolean,
): number[] {
  const lines: number[] = [];
  for (const set of sets) {
    set.between(0, state.doc.length, (from, _to, value) => {
      if (has(value)) {
        lines.push(state.doc.lineAt(from).number);
      }
    });
  }
  return lines;
}

function tintedLines(state: EditorState): number[] {
  const sets = state
    .facet(EditorView.decorations)
    .flatMap((set) => (typeof set === "function" ? [] : [set]));
  return linesOf(state, sets, (decoration) => decoration.spec.class === TINT);
}

function tintedCells(state: EditorState): number[] {
  return linesOf(state, state.facet(gutterLineClass), (marker: GutterMarker) =>
    marker.elementClass.split(" ").includes(TINT),
  );
}

test("tinted lines and their gutter cells carry the class, whatever the spans' order; a line past the end is skipped", () => {
  const state = fresh().update({
    effects: showTint.of([
      { start: 4, len: 3 },
      { start: 1, len: 2 },
    ]),
  }).state;

  expect(tintedLines(state)).toEqual([2, 3, 5]);
  expect(tintedCells(state)).toEqual([2, 3, 5]);
});

test("a new set replaces the old, an empty set clears, a transaction without one keeps it", () => {
  const first = fresh().update({ effects: showTint.of([{ start: 0, len: 1 }]) }).state;
  const second = first.update({ effects: showTint.of([{ start: 3, len: 1 }]) }).state;
  const kept = second.update({ changes: { from: 0, insert: "x" } }).state;
  const cleared = kept.update({ effects: showTint.of([]) }).state;

  expect(tintedLines(second)).toEqual([4]);
  expect(tintedCells(second)).toEqual([4]);
  expect(tintedLines(kept)).toEqual([4]);
  expect(tintedCells(kept)).toEqual([4]);
  expect(tintedLines(cleared)).toEqual([]);
  expect(tintedCells(cleared)).toEqual([]);
});

test("places' lines are merged per column into sorted spans that neither overlap nor touch", async () => {
  const words = { changed: [], removals: [] };
  const change = { left: { start: 2, len: 1 }, right: { start: 2, len: 1 } };
  const files = {
    "case.json": {
      left: "",
      right: "",
      differences: [{ ...change, words: { left: words, right: words } }],
    },
  };
  const { differences } = (await loadCompareFixture("case", files)).comparison;
  const removedLine = changedThreadLine("left", 2);

  const tint = placesTint(differences, [
    {
      start: diffLineOf(unchangedThreadLine("right", { left: 5, right: 5 })),
      end: unchangedThreadLine("right", { left: 8, right: 8 }),
    },
    { start: diffLineOf(removedLine), end: changedThreadLine("right", 2) },
    onePlace(unchangedThreadLine("right", { left: 3, right: 3 })),
    onePlace(removedLine),
    onePlace(unchangedThreadLine("left", { left: 6, right: 6 })),
  ]);

  expect(tint).toEqual({
    left: [
      { start: 2, len: 2 },
      { start: 5, len: 4 },
    ],
    right: [
      { start: 2, len: 2 },
      { start: 5, len: 4 },
    ],
  });
});

test("spans are the same only with the same starts and lengths in the same order", () => {
  const spans = [
    { start: 1, len: 2 },
    { start: 5, len: 1 },
  ];

  expect(sameSpans(spans, [...spans])).toBe(true);
  expect(sameSpans(spans, [{ start: 1, len: 2 }])).toBe(false);
  expect(sameSpans([{ start: 1, len: 2 }], spans)).toBe(false);
  expect(
    sameSpans(spans, [
      { start: 1, len: 2 },
      { start: 5, len: 2 },
    ]),
  ).toBe(false);
  expect(
    sameSpans(spans, [
      { start: 1, len: 2 },
      { start: 6, len: 1 },
    ]),
  ).toBe(false);
  expect(sameSpans([], [])).toBe(true);
});
