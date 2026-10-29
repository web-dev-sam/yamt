import { expect, test } from "vitest";

import {
  MAX_ROWS,
  dismissFile,
  dismissPlace,
  emptyResults,
  filePlaces,
  goToPane,
  listRows,
  matcherOf,
  summaryOf,
  withFile,
  type Layout,
  type ListRow,
  type PaneEntry,
  type PaneHit,
  type Place,
  type SearchResults,
  type Summary,
} from "../index";

type Merge = "left" | "center" | "right";

const MERGE: Layout<Merge> = { panes: ["left", "center", "right"], lead: "center" };
const QUERY = { text: "foo", matchCase: false };
const ALL: ReadonlySet<Merge> = new Set(["left", "center", "right"]);
const NONE: ReadonlySet<Merge> = new Set();
const OPEN: ReadonlySet<string> = new Set();

function searchedFile(
  results: SearchResults<Merge>,
  path: string,
  texts: Readonly<Record<Merge, string>>,
): SearchResults<Merge> {
  const matcher = matcherOf(QUERY);
  if (matcher === null) {
    throw new Error("a non-empty query builds a matcher");
  }
  const found = filePlaces({ path, texts, changes: [] }, matcher, MERGE, MAX_ROWS);
  return withFile(results, { path, rank: results.groups.length, ...found });
}

function twoPlaces(): SearchResults<Merge> {
  return searchedFile(emptyResults(QUERY), "a.ts", {
    left: "foo\nx",
    center: "foo\nx",
    right: "x\nfoo",
  });
}

function placeAt(results: SearchResults<Merge>, index: number): Place<Merge> {
  const place = results.groups[0]?.places[index];
  if (place === undefined) {
    throw new Error(`no place ${index}`);
  }
  return place;
}

function described(rows: readonly ListRow<Merge>[]): string[] {
  return rows.map((row) =>
    row.kind === "group"
      ? `${row.path} ${row.count} ${row.open ? "open" : "closed"}`
      : `${row.place.hits[0].hit.line}: ${row.shown.map((entry) => entry.pane).join(" ")}`,
  );
}

test("a row shows while one of its panes is on, with only the on panes' icons (filter leaks)", () => {
  const results = twoPlaces();

  expect(described(listRows(results, ALL, OPEN))).toEqual([
    "a.ts 2 open",
    "0: left center",
    "1: right",
  ]);
  expect(described(listRows(results, new Set<Merge>(["right"]), OPEN))).toEqual([
    "a.ts 1 open",
    "1: right",
  ]);
  expect(described(listRows(results, new Set<Merge>(["left"]), OPEN))).toEqual([
    "a.ts 1 open",
    "0: left",
  ]);
});

test("every pane off → filteredOut and no rows (an empty-list wording bug)", () => {
  const results = twoPlaces();
  const summary: Summary | null = summaryOf(results, NONE, false);

  expect(summary).toEqual({ kind: "filteredOut" });
  expect(summaryOf(results, NONE, true)).toEqual({ kind: "filteredOut" });
  expect(listRows(results, NONE, OPEN)).toEqual([]);
});

test("the summary: an empty box, searching, no results, counts and the cut (a stale summary)", () => {
  const empty = emptyResults<Merge>(QUERY);

  expect(summaryOf(null, ALL, false)).toBeNull();
  expect(summaryOf(null, ALL, true)).toEqual({ kind: "searching" });
  expect(summaryOf(empty, ALL, true)).toEqual({ kind: "searching" });
  expect(summaryOf(empty, ALL, false)).toEqual({ kind: "noResults" });
  const two = searchedFile(twoPlaces(), "b.ts", { left: "foo", center: "foo", right: "foo" });

  expect(summaryOf(two, ALL, true)).toEqual({ kind: "results", rows: 3, files: 2, cut: false });
  expect(summaryOf({ ...two, cut: true }, ALL, false)).toEqual({
    kind: "results",
    rows: 3,
    files: 2,
    cut: true,
  });
});

test("counts follow dismissals (a stale summary)", () => {
  const results = searchedFile(twoPlaces(), "b.ts", { left: "foo", center: "foo", right: "foo" });
  const placeGone = dismissPlace(results, "a.ts", placeAt(results, 0).key);

  expect(summaryOf(placeGone, ALL, false)).toEqual({
    kind: "results",
    rows: 2,
    files: 2,
    cut: false,
  });
  expect(described(listRows(placeGone, ALL, OPEN))[0]).toBe("a.ts 1 open");
  const fileGone = dismissFile(placeGone, "b.ts");

  expect(summaryOf(fileGone, ALL, false)).toEqual({
    kind: "results",
    rows: 1,
    files: 1,
    cut: false,
  });
  expect(described(listRows(fileGone, ALL, OPEN))).toEqual(["a.ts 1 open", "1: right"]);
});

test("a filter change restores nothing dismissed (filters touching dismissals)", () => {
  expect(listRows(twoPlaces(), ALL, OPEN).map((row) => row.kind)).toEqual([
    "group",
    "place",
    "place",
  ]);
  const results = twoPlaces();
  const dismissed = dismissPlace(results, "a.ts", placeAt(results, 0).key);

  expect(listRows(dismissed, new Set<Merge>(["left"]), OPEN)).toEqual([]);
  expect(summaryOf(dismissed, new Set<Merge>(["left"]), false)).toEqual({ kind: "noResults" });
  expect(described(listRows(dismissed, ALL, OPEN))).toEqual(["a.ts 1 open", "1: right"]);
});

test("goToPane takes the lead pane when on, else the leftmost on pane (the rule-8 choice)", () => {
  const results = twoPlaces();
  const both = placeAt(results, 0);
  const rightOnly = placeAt(results, 1);

  expect(goToPane(both, ALL, MERGE)?.pane).toBe("center");
  expect(goToPane(both, new Set<Merge>(["left", "right"]), MERGE)?.pane).toBe("left");
  expect(goToPane(both, new Set<Merge>(["right"]), MERGE)).toBeNull();
  const hit: PaneHit = { line: 1, from: 0, to: 3 };
  const entry: PaneEntry<Merge> = { pane: "right", hit };

  expect(goToPane(rightOnly, ALL, MERGE)).toEqual(entry);
});

test("a closed group shows only its header; an all-dismissed group disappears (ghost groups)", () => {
  const results = searchedFile(twoPlaces(), "b.ts", { left: "foo", center: "foo", right: "foo" });

  expect(described(listRows(results, ALL, new Set(["a.ts"])))).toEqual([
    "a.ts 2 closed",
    "b.ts 1 open",
    "0: left center right",
  ]);
  const first = dismissPlace(results, "a.ts", placeAt(results, 0).key);
  const both = dismissPlace(first, "a.ts", placeAt(results, 1).key);

  expect(described(listRows(both, ALL, OPEN))).toEqual(["b.ts 1 open", "0: left center right"]);
});
