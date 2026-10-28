import { insertNewlineAndIndent } from "@codemirror/commands";
import { Facet, type EditorState } from "@codemirror/state";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DEFAULT_KEYS, loadCompareFixture, type Column } from "../../ipc";
import { differenceField, showDifferences } from "./compareFields";
import { columnMarks } from "./compareMarks";
import { editableColumnState, readOnlyColumnState } from "./compareViews";
import type { PaneSettings } from "./pane";

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};
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

beforeEach(() => {
  vi.stubGlobal("document", { body: {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function readOnly(text: string): EditorState {
  return readOnlyColumnState(
    { column: "left", text },
    { settings: SETTINGS, updated: () => {}, extensions: () => [] },
  );
}

function pressedEnter(state: EditorState): EditorState {
  let after = state;
  insertNewlineAndIndent({
    state,
    dispatch: (tr) => {
      after = tr.state;
    },
  });
  return after;
}

test("a read-only column's state refuses a user insert and keeps its text", () => {
  const state = readOnly(LEFT);
  const at = state.update({ selection: { anchor: LEFT.indexOf("word") } }).state;

  expect(at.readOnly).toBe(true);
  expect(insertNewlineAndIndent({ state: at, dispatch: () => {} })).toBe(false);
  expect(pressedEnter(at).sliceDoc()).toBe(LEFT);
});

test("a read-only column holds differenceField, so showDifferences lands", async () => {
  const state = readOnly(LEFT);
  const { comparison } = await loadCompareFixture("case", { "case.json": CASE });
  const marks = columnMarks(state.doc, comparison.differences, "left");

  const shown = state.update({ effects: showDifferences.of(marks) }).state;

  expect(shown.field(differenceField, false)?.spans).toEqual([
    { from: LEFT.indexOf("old"), to: LEFT.indexOf("b\n"), tone: "modified" },
  ]);
});

test("an editable column still refuses an insert over its byte limit", () => {
  const refused = vi.fn<(column: Column) => void>();
  const state = editableColumnState(
    { column: "right", text: RIGHT },
    { settings: SETTINGS, columnLimit: RIGHT.length, refused, updated: () => {} },
  );
  const at = state.update({ selection: { anchor: RIGHT.indexOf("word") } }).state;

  const after = pressedEnter(at);

  expect(after.sliceDoc()).toBe(RIGHT);
  expect(refused.mock.calls).toEqual([["right"]]);
});

test("each read-only column gets its own column's extensions", () => {
  const owner = Facet.define<Column>();
  const states = (["left", "right"] as const).map((column) =>
    readOnlyColumnState(
      { column, text: LEFT },
      { settings: SETTINGS, updated: () => {}, extensions: (asked) => owner.of(asked) },
    ),
  );

  expect(states.map((state) => state.facet(owner))).toEqual([["left"], ["right"]]);
});
