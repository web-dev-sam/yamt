import { SearchQuery } from "@codemirror/search";
import { EditorSelection, EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import { findLabel, stepMatch } from "./find";

const DOC = "foo bar\nFoo baz\nqux FOO\n";
const FIRST = { from: 0, to: 3 };
const LAST = { from: 20, to: 23 };

function query(search: string): SearchQuery {
  return new SearchQuery({ search, literal: true });
}

function selected(range: { from: number; to: number }, doc = DOC): EditorState {
  return EditorState.create({ doc, selection: EditorSelection.single(range.from, range.to) });
}

function step(state: EditorState, direction: "next" | "previous"): EditorState {
  const spec = stepMatch(state, { query: query("foo"), direction });
  if (spec === null) {
    throw new Error("no match");
  }
  return state.update(spec).state;
}

test("an empty field shows nothing and a text without matches shows No results", () => {
  const state = selected({ from: 0, to: 0 });

  expect(findLabel(state, query(""))).toBe("");
  expect(findLabel(state, query("zzz"))).toBe("No results");
  expect(stepMatch(state, { query: query("zzz"), direction: "next" })).toBeNull();
});

test("a selection off a match counts every case-insensitive match", () => {
  expect(findLabel(selected({ from: 1, to: 1 }), query("foo"))).toBe("3 results");
  expect(findLabel(selected({ from: 0, to: 2 }), query("foo"))).toBe("3 results");
  expect(findLabel(selected({ from: 0, to: 0 }), query("bar"))).toBe("1 result");
});

test("a selection on a match shows its place; next from the last wraps to the first", () => {
  expect(findLabel(selected(FIRST), query("foo"))).toBe("1 of 3");
  expect(findLabel(selected(LAST), query("FOO"))).toBe("3 of 3");
  expect(findLabel(step(selected(LAST), "next"), query("foo"))).toBe("1 of 3");
  expect(findLabel(step(selected(FIRST), "next"), query("foo"))).toBe("2 of 3");
  expect(findLabel(step(selected(FIRST), "previous"), query("foo"))).toBe("3 of 3");
  expect(findLabel(step(selected({ from: 0, to: 0 }), "next"), query("foo"))).toBe("1 of 3");
});

test("the count follows edits", () => {
  const state = selected(FIRST);

  const edited = state.update({ changes: { from: DOC.length, insert: "foo\n" } }).state;

  expect(findLabel(edited, query("foo"))).toBe("1 of 4");
});
