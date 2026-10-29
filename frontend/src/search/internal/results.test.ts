import { expect, test } from "vitest";

import {
  MAX_ROWS,
  dismissFile,
  dismissPlace,
  emptyResults,
  filePlaces,
  listRows,
  matcherOf,
  withFile,
  type FileGroup,
  type Layout,
  type Place,
  type PlaceKey,
  type SearchResults,
} from "../index";

type Column = "left" | "right";
type FoundFile = {
  readonly path: string;
  readonly rank: number;
  readonly places: readonly Place<Column>[];
  readonly cut: boolean;
};

const RANGE: Layout<Column> = { panes: ["left", "right"], lead: "right" };
const QUERY = { text: "foo", matchCase: false };
const ON: ReadonlySet<Column> = new Set(["left", "right"]);

function fileOf(path: string, rank: number, text: string): FoundFile {
  const matcher = matcherOf(QUERY);
  if (matcher === null) {
    throw new Error("a non-empty query builds a matcher");
  }
  const file = { path, texts: { left: text, right: text }, changes: [] };
  return { path, rank, ...filePlaces(file, matcher, RANGE, MAX_ROWS) };
}

function shown(results: SearchResults<Column>): string[] {
  return listRows(results, ON, new Set()).map((row) =>
    row.kind === "group"
      ? `${row.path} ${row.count}`
      : `${row.place.preview.before}${row.place.preview.match}`,
  );
}

function groupOf(results: SearchResults<Column>, path: string): FileGroup<Column> {
  const group = results.groups.find((candidate) => candidate.path === path);
  if (group === undefined) {
    throw new Error(`no group for ${path}`);
  }
  return group;
}

function keyAt(results: SearchResults<Column>, path: string, index: number): PlaceKey {
  const place = groupOf(results, path).places.at(index);
  if (place === undefined) {
    throw new Error(`no place ${index} in ${path}`);
  }
  return place.key;
}

function foos(count: number): string {
  return "foo\n".repeat(count);
}

function searched(...files: FoundFile[]): SearchResults<Column> {
  return files.reduce(withFile, emptyResults<Column>(QUERY));
}

test("a dismissal survives a one-file re-run with lines inserted above (line-number keys)", () => {
  const first = searched(fileOf("a", 0, "foo\nbar foo"));
  const dismissed = dismissPlace(first, "a", keyAt(first, "a", 1));

  expect(shown(dismissed)).toEqual(["a 1", "foo"]);
  const rerun = withFile(dismissed, fileOf("a", 0, "new\nfoo\nbar foo"));

  expect(shown(rerun)).toEqual(["a 1", "foo"]);
  expect(groupOf(rerun, "a").dismissed).toEqual(new Set([keyAt(rerun, "a", 1)]));
});

test("a dismissal is dropped once the line text changes (stale keys)", () => {
  const first = searched(fileOf("a", 0, "foo\nbar foo"));
  const dismissed = dismissPlace(first, "a", keyAt(first, "a", 1));
  const rerun = withFile(dismissed, fileOf("a", 0, "foo\nbaz foo"));

  expect(shown(rerun)).toEqual(["a 2", "foo", "baz foo"]);
  expect(groupOf(rerun, "a").dismissed.size).toBe(0);
});

test("two identical places dismiss independently (over-dismissal)", () => {
  const first = searched(fileOf("a", 0, "foo\nfoo"));
  const dismissed = dismissPlace(first, "a", keyAt(first, "a", 0));

  expect(shown(dismissed)).toEqual(["a 1", "foo"]);
  expect(groupOf(dismissed, "a").dismissed).toEqual(new Set([keyAt(first, "a", 0)]));
});

test("a dismissal only holds keys among its file's places", () => {
  const other = searched(fileOf("a", 0, " foo"));
  const results = searched(fileOf("a", 0, "foo"), fileOf("b", 1, " foo"));
  const stale = dismissPlace(results, "a", keyAt(other, "a", 0));

  expect(groupOf(stale, "a").dismissed.size).toBe(0);
  expect(groupOf(stale, "b").dismissed.size).toBe(0);
  expect(shown(stale)).toEqual(["a 1", "foo", "b 1", "foo"]);
});

test("a dismissal stays in its own file when another file holds the same place (over-dismissal)", () => {
  const results = searched(fileOf("a", 0, "foo"), fileOf("b", 1, "foo"));
  const dismissed = dismissPlace(results, "a", keyAt(results, "a", 0));
  const rerun = withFile(dismissed, fileOf("b", 1, "foo"));

  expect(shown(rerun)).toEqual(["b 1", "foo"]);
  expect(groupOf(rerun, "b").dismissed.size).toBe(0);
});

test("a group dismissal survives a one-file re-run; a full run clears it (rule 9 vs rule 10)", () => {
  const results = searched(fileOf("a", 0, "foo"), fileOf("b", 1, "foo"));
  const dismissed = dismissFile(results, "a");

  expect(shown(dismissed)).toEqual(["b 1", "foo"]);
  expect(shown(withFile(dismissed, fileOf("a", 0, "foo\nfoo")))).toEqual(["b 1", "foo"]);
  const fullRun = emptyResults<Column>(QUERY);

  expect(fullRun.dismissedFiles.size).toBe(0);
  expect(shown(withFile(fullRun, fileOf("a", 0, "foo")))).toEqual(["a 1", "foo"]);
});

test("dismissing a file without a group changes nothing", () => {
  const results = searched(fileOf("a", 0, "foo"));

  expect(dismissFile(results, "b")).toBe(results);
});

test("groups follow the window's file order; a re-run replaces its group; a file without places has none", () => {
  const results = searched(fileOf("b", 2, "foo"), fileOf("a", 0, "foo"), fileOf("c", 1, "foo"));

  expect(results.groups.map((group) => group.path)).toEqual(["a", "c", "b"]);
  const rerun = withFile(results, fileOf("c", 1, "foo\nfoo"));

  expect(rerun.groups.map((group) => `${group.path} ${group.places.length}`)).toEqual([
    "a 1",
    "c 2",
    "b 1",
  ]);
  expect(rerun.found).toBe(4);
  const emptied = withFile(rerun, fileOf("c", 1, "bar"));

  expect(emptied.groups.map((group) => group.path)).toEqual(["a", "b"]);
  expect(emptied.found).toBe(2);
});

test("cut at 20,000 places across files; later files are not added (an off-by-one at the limit)", () => {
  const full = searched(fileOf("a", 0, foos(15_000)), fileOf("b", 1, foos(5_000)));

  expect(full).toMatchObject({ found: MAX_ROWS, cut: false });
  const over = withFile(full, fileOf("c", 2, "foo"));

  expect(over).toMatchObject({ found: MAX_ROWS, cut: true });
  expect(over.groups.map((group) => group.path)).toEqual(["a", "b"]);
  const split = searched(fileOf("a", 0, foos(15_000)), fileOf("b", 1, foos(6_000)));

  expect(split).toMatchObject({ found: MAX_ROWS, cut: true });
  expect(groupOf(split, "b").places).toHaveLength(5_000);
});

test("a one-file re-run under a cut result re-applies the cap (uncapped growth)", () => {
  const results = searched(
    fileOf("a", 0, foos(15_000)),
    fileOf("b", 1, foos(5_000)),
    fileOf("c", 2, "foo"),
  );
  const dismissed = dismissPlace(results, "b", keyAt(results, "b", -1));
  const grown = withFile(dismissed, fileOf("a", 0, foos(15_001)));

  expect(grown).toMatchObject({ found: MAX_ROWS, cut: true });
  expect(groupOf(grown, "b").places).toHaveLength(4_999);
  expect(groupOf(grown, "b").dismissed.size).toBe(0);
  const shrunk = withFile(grown, fileOf("a", 0, foos(14_000)));

  expect(shrunk).toMatchObject({ found: 18_999, cut: true });
});

test("a file cut at its pane limit cuts the results", () => {
  const file = { ...fileOf("a", 0, "foo"), cut: true };

  expect(withFile(emptyResults<Column>(QUERY), file).cut).toBe(true);
  expect(searched(fileOf("a", 0, "foo")).cut).toBe(false);
});

test("a file without places keeps the results' cut and adds its own", () => {
  const cutResults = { ...searched(fileOf("a", 0, "foo")), cut: true };
  const noPlaces = { path: "a", rank: 0, places: [], cut: false };

  expect(withFile(cutResults, noPlaces).cut).toBe(true);
  expect(withFile(emptyResults<Column>(QUERY), { ...noPlaces, cut: true }).cut).toBe(true);
  expect(withFile(emptyResults<Column>(QUERY), noPlaces).cut).toBe(false);
});
