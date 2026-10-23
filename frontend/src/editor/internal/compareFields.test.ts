import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { loadCompareFixture } from "../../ipc";
import { differenceField, showDifferences } from "./compareFields";
import { columnMarks } from "./compareMarks";

const LEFT = "a\nold word\nb\n";
const RIGHT = "a\nnew word\nb\n";

const CASE = {
  left: LEFT,
  right: RIGHT,
  differences: [
    {
      left: { start: 1, len: 1 },
      right: { start: 1, len: 1 },
      words: {
        left: { changed: [{ line: 1, start: 0, len: 3 }], removals: [] },
        right: { changed: [{ line: 1, start: 0, len: 3 }], removals: [] },
      },
    },
  ],
};

async function shown(): Promise<EditorState> {
  const state = EditorState.create({ doc: LEFT, extensions: differenceField });
  const { comparison } = await loadCompareFixture("case", { "case.json": CASE });
  const marks = columnMarks(state.doc, comparison.differences, "left");
  return state.update({ effects: showDifferences.of(marks) }).state;
}

function typed(state: EditorState, at: number, insert: string): EditorState {
  return state.update({ changes: { from: at, insert } }).state;
}

function spanTexts(state: EditorState): string[] {
  return state.field(differenceField).spans.map(({ from, to }) => state.sliceDoc(from, to));
}

function painted(state: EditorState): string[] {
  const found: string[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source !== "function") {
      source.between(0, state.doc.length, (from, to, decoration) => {
        const text = from < to ? ` ${state.sliceDoc(from, to)}` : "";
        found.push(`${state.doc.lineAt(from).number} ${String(decoration.spec.class)}${text}`);
      });
    }
  }
  return found;
}

test("typing inside a difference grows it; typing at the start of the next line stays outside", async () => {
  const start = await shown();
  const inside = typed(start, LEFT.indexOf("old"), "x");
  const after = typed(inside, inside.doc.line(3).from, "y");

  expect(spanTexts(inside)).toEqual(["xold word\n"]);
  expect(spanTexts(after)).toEqual(["xold word\n"]);
  expect(after.doc.line(3).text).toBe("yb");
});

test("bands and word marks follow their text through an edit above them", async () => {
  const state = typed(await shown(), 0, "zz\n");

  expect(painted(state)).toEqual(["3 chunk-modified chunk-band", "3 chunk-word-modified old"]);
  expect(spanTexts(state)).toEqual(["old word\n"]);
});

test("a new comparison replaces the spans, bands and word marks", async () => {
  const state = await shown();
  const cleared = state.update({
    effects: showDifferences.of(columnMarks(state.doc, [], "left")),
  }).state;

  expect(painted(state)).toHaveLength(2);
  expect(cleared.field(differenceField).spans).toEqual([]);
  expect(painted(cleared)).toEqual([]);
});
