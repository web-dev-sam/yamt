import { search, SearchQuery, setSearchQuery } from "@codemirror/search";
import { EditorSelection, EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import { findLabel, labelOutdated, stepMatch } from "./find";

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

test("the count is recomputed after a document, selection or query change and only then", () => {
  const state = EditorState.create({
    doc: DOC,
    selection: EditorSelection.single(FIRST.from, FIRST.to),
    extensions: search({ literal: true }),
  });
  const transactions = {
    edit: state.update({ changes: { from: DOC.length, insert: "foo\n" } }),
    select: state.update({ selection: EditorSelection.single(LAST.from, LAST.to) }),
    query: state.update({ effects: setSearchQuery.of(query("bar")) }),
    none: state.update({}),
  };

  expect(labelOutdated(state, transactions.edit.state)).toBe(true);
  expect(labelOutdated(state, transactions.select.state)).toBe(true);
  expect(labelOutdated(state, transactions.query.state)).toBe(true);
  expect(labelOutdated(state, transactions.none.state)).toBe(false);
  expect(findLabel(transactions.edit.state, query("foo"))).toBe("1 of 4");
});
