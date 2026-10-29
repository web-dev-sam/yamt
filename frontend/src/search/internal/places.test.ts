import { expect, test } from "vitest";

import {
  filePlaces,
  matcherOf,
  type Layout,
  type LineRange,
  type Place,
  type SearchedFile,
} from "../index";
import { digestOf } from "./digest";

type Merge = "left" | "center" | "right";
type Column = "left" | "right";

const MERGE: Layout<Merge> = { panes: ["left", "center", "right"], lead: "center" };
const RANGE: Layout<Column> = { panes: ["left", "right"], lead: "right" };

function range(start: number, len: number): LineRange {
  return { start, len };
}

function placesOf<P extends string>(
  file: Omit<SearchedFile<P>, "path">,
  layout: Layout<P>,
  query = "foo",
  limit = Infinity,
): { readonly places: readonly Place<P>[]; readonly cut: boolean } {
  const matcher = matcherOf({ text: query, matchCase: false });
  if (matcher === null) {
    throw new Error("a non-empty query builds a matcher");
  }
  return filePlaces({ path: "a.ts", ...file }, matcher, layout, limit);
}

function rows<P extends string>(places: readonly Place<P>[]): string[] {
  return places.map((place) =>
    place.hits.map(({ pane, hit }) => `${pane}:${hit.line}:${hit.from}`).join(" "),
  );
}

function mergeRows(
  texts: Readonly<Record<Merge, string | null>>,
  changes: readonly Readonly<Record<Merge, LineRange>>[] = [],
): string[] {
  return rows(placesOf({ texts, changes }, MERGE).places);
}

test("an unchanged line is one place with every pane, 3 panes and 2 panes (rows per pane)", () => {
  const text = "a\nfoo\nb";

  expect(mergeRows({ left: text, center: text, right: text })).toEqual([
    "left:1:0 center:1:0 right:1:0",
  ]);
  expect(rows(placesOf({ texts: { left: text, right: text }, changes: [] }, RANGE).places)).toEqual(
    ["left:1:0 right:1:0"],
  );
});

test("the same aligned line at different columns is two places (merging by line only)", () => {
  expect(mergeRows({ left: "foo x", center: "x foo", right: "x foo" })).toEqual([
    "left:0:0",
    "center:0:2 right:0:2",
  ]);
});

test("after changes of unequal length, alignment uses each pane's change end (raw line numbers taken as aligned)", () => {
  const changes = [{ left: range(0, 2), center: range(0, 1), right: range(0, 0) }];

  expect(mergeRows({ left: "l\nl\nfoo", center: "c\nfoo", right: "foo" }, changes)).toEqual([
    "left:2:0 center:1:0 right:0:0",
  ]);
});

test("alignment follows the last change ending at or before the line (a stale change end)", () => {
  const changes = [
    { left: range(0, 1), right: range(0, 2) },
    { left: range(2, 2), right: range(3, 1) },
  ];
  const texts = { left: "x\nfoo\nx\nx\nfoo", right: "y\ny\nfoo\ny\nfoo" };

  expect(rows(placesOf({ texts, changes }, RANGE).places)).toEqual([
    "left:1:0 right:2:0",
    "left:4:0 right:4:0",
  ]);
});

test("in one conflict the same text and column in two panes is one place; different text is two (rule b ignoring the text)", () => {
  const changes = [{ left: range(0, 1), center: range(0, 1), right: range(0, 1) }];

  expect(mergeRows({ left: "foo bar", center: "foo baz", right: "foo bar" }, changes)).toEqual([
    "left:0:0 right:0:0",
    "center:0:0",
  ]);
  expect(mergeRows({ left: "foo bar", center: "x", right: " foo bar" }, changes)).toEqual([
    "left:0:0",
    "right:0:1",
  ]);
});

test("two identical lines in one change pair first-with-first (cartesian merging)", () => {
  const changes = [{ left: range(0, 2), center: range(0, 1), right: range(0, 3) }];

  expect(mergeRows({ left: "foo\nfoo", center: "x", right: "foo\nfoo\nfoo" }, changes)).toEqual([
    "left:0:0 right:0:0",
    "left:1:0 right:1:0",
    "right:2:0",
  ]);
});

test("the same text in two changes is two places (merging across changes)", () => {
  const changes = [
    { left: range(0, 1), center: range(0, 1), right: range(0, 1) },
    { left: range(2, 1), center: range(2, 1), right: range(2, 1) },
  ];

  expect(mergeRows({ left: "foo\nx\nl", center: "c\nx\nc", right: "r\nx\nfoo" }, changes)).toEqual([
    "left:0:0",
    "right:2:0",
  ]);
});

test("a line only one side has is its own place with only that pane (lost side-only hits)", () => {
  const changes = [{ left: range(1, 0), center: range(1, 0), right: range(1, 1) }];

  expect(mergeRows({ left: "a\nb", center: "a\nb", right: "a\nfoo\nb" }, changes)).toEqual([
    "right:1:0",
  ]);
});

test("a null text yields nothing; an insertion range holds no line (DiskNotText and empty ranges counted as inside)", () => {
  expect(mergeRows({ left: "foo", center: null, right: "foo" })).toEqual(["left:0:0 right:0:0"]);
  const changes = [{ left: range(1, 0), right: range(1, 1) }];
  const texts = { left: "a\nfoo", right: "a\nnew\nfoo" };

  expect(rows(placesOf({ texts, changes }, RANGE).places)).toEqual(["left:1:0 right:2:0"]);
});

test("lead order by line, then column (an unsorted list)", () => {
  expect(mergeRows({ left: "x\n  foo\nfoo", center: "foo\nfoo", right: "y\ny\ny" })).toEqual([
    "center:0:0",
    "center:1:0",
    "left:1:2",
    "left:2:0",
  ]);
});

test("a side-only place sorts at its change's lead start, before that line's lead rows, left before right (rule 7's change place)", () => {
  const changes = [{ left: range(1, 1), center: range(1, 2), right: range(1, 1) }];
  const texts = {
    left: "foo0\nleft foo\nz",
    center: "foo0\nfoo c\nmid foo\nz",
    right: "foo0\nfoo right\nz",
  };

  expect(mergeRows(texts, changes)).toEqual([
    "left:0:0 center:0:0 right:0:0",
    "left:1:5",
    "right:1:0",
    "center:1:0",
    "center:2:4",
  ]);
});

test("range: a left-only place sorts at its difference's right start (rule 7's change place)", () => {
  const changes = [{ left: range(2, 1), right: range(1, 2) }];
  const texts = { left: "a\nb\nold foo\nz foo", right: "a\nfoo new\nfoo\nz foo" };

  expect(rows(placesOf({ texts, changes }, RANGE).places)).toEqual([
    "left:2:4",
    "right:1:0",
    "right:2:0",
    "left:3:2 right:3:2",
  ]);
});

test("a place's preview comes from the lead hit, else the first hit", () => {
  const changes = [{ left: range(0, 1), center: range(0, 1), right: range(0, 1) }];
  const { places } = placesOf(
    { texts: { left: "l foo", center: "c foo", right: "r foo" }, changes },
    MERGE,
  );

  expect(places.map((place) => place.preview.before)).toEqual(["l ", "r ", "c "]);
  const outside = placesOf(
    { texts: { left: "y foo", center: "x foo", right: null }, changes: [] },
    MERGE,
  );

  expect(outside.places.map((place) => place.preview)).toEqual([
    { before: "x ", match: "foo", after: "" },
  ]);
  const sides = placesOf(
    { texts: { left: "y foo", center: null, right: "z foo" }, changes: [] },
    MERGE,
  );

  expect(sides.places.map((place) => place.preview.before)).toEqual(["y "]);
});

test("keys differ by panes, column, line digest and ordinal, never by line number (line-number keys)", () => {
  function keysOf(left: string): readonly string[] {
    return placesOf({ texts: { left, right: null }, changes: [] }, RANGE).places.map(
      (place) => place.key,
    );
  }
  const [first, second, third] = keysOf("foo\nfoo\n foo");

  expect([first, second, third]).toEqual([
    JSON.stringify([["left"], 0, digestOf("foo"), 0]),
    JSON.stringify([["left"], 0, digestOf("foo"), 1]),
    JSON.stringify([["left"], 1, digestOf(" foo"), 0]),
  ]);
  expect(keysOf("x\nfoo\nfoo\n foo")).toEqual([first, second, third]);
  expect(
    placesOf({ texts: { left: "foo", right: "foo" }, changes: [] }, RANGE).places[0]?.key,
  ).toBe(JSON.stringify([["left", "right"], 0, digestOf("foo"), 0]));
});

test("the line right after a change is outside it, a line before it too (a change's edges)", () => {
  const after = [{ left: range(0, 1), right: range(0, 1) }];

  expect(
    rows(placesOf({ texts: { left: "foo\nfoo", right: "x\nfoo" }, changes: after }, RANGE).places),
  ).toEqual(["left:0:0", "left:1:0 right:1:0"]);
  const before = [{ left: range(1, 1), right: range(1, 1) }];

  expect(
    rows(
      placesOf({ texts: { left: "foo a\nx", right: "foo b\ny" }, changes: before }, RANGE).places,
    ),
  ).toEqual(["left:0:0 right:0:0"]);
});

test("an outside side-only place sorts at its aligned lead line (rule 7's order)", () => {
  const changes = [{ left: range(0, 1), right: range(0, 3) }];
  const texts = { left: "x\n  foo", right: "a\nb\nc\nfoo\nfoo" };

  expect(rows(placesOf({ texts, changes }, RANGE).places)).toEqual([
    "right:3:0",
    "left:1:2",
    "right:4:0",
  ]);
});

test("a pane stops at the limit and the file says it was cut", () => {
  const texts = { left: "foo\nfoo\nfoo", right: "foo" };

  expect(placesOf({ texts, changes: [] }, RANGE, "foo", 2)).toMatchObject({ cut: true });
  expect(rows(placesOf({ texts, changes: [] }, RANGE, "foo", 2).places)).toEqual([
    "left:0:0 right:0:0",
    "left:1:0",
  ]);
  expect(placesOf({ texts, changes: [] }, RANGE, "foo", 3)).toMatchObject({ cut: false });
});

test("two side hits outside changes aligned to one lead line stay apart (a place with two hits of one pane)", () => {
  const changes = [
    { left: range(0, 1), center: range(0, 1), right: range(0, 1) },
    { left: range(4, 1), center: range(2, 1), right: range(4, 1) },
  ];
  const texts = { left: "a\nb\nc\nfoo\nd\nfoo", center: "a\nb\nc\nfoo", right: "a\nb\nc\nd\ne\nf" };
  const { places } = placesOf({ texts, changes }, MERGE);

  expect(rows(places)).toEqual(["left:3:0 center:3:0", "left:5:0"]);
  for (const place of places) {
    const panes = place.hits.map((entry) => entry.pane);

    expect(new Set(panes).size).toBe(panes.length);
  }
});

const MIB = 1024 * 1024;
const TIME_BUDGET_MS = 2000;
const MAX_KEY_CHARS = 100;

function timed<T>(run: () => T): { readonly value: T; readonly ms: number } {
  const start = performance.now();
  const value = run();
  return { value, ms: performance.now() - start };
}

test("a 1 MiB line with many hits in a change takes little time and short keys (keys copying the line)", () => {
  const hitsPerLine = 1024;
  const line = `${"x".repeat(MIB / hitsPerLine - "foo".length)}foo`.repeat(hitsPerLine);
  const changes = [{ left: range(0, 1), right: range(0, 1) }];
  const texts = { left: line, right: `${line}y` };
  const { value, ms } = timed(() => placesOf({ texts, changes }, RANGE).places);

  expect(value).toHaveLength(2 * hitsPerLine);
  expect(Math.max(...value.map((place) => place.key.length))).toBeLessThan(MAX_KEY_CHARS);
  expect(ms).toBeLessThan(TIME_BUDGET_MS);
});

test("a 1 MiB text where every line matches takes little time (per-line work growing with the text)", () => {
  const lineLength = 64;
  const lines = MIB / lineLength;
  const text = `foo ${"x".repeat(lineLength - "foo \n".length)}\n`.repeat(lines);
  const { value, ms } = timed(
    () => placesOf({ texts: { left: text, right: text }, changes: [] }, RANGE).places,
  );

  expect(value).toHaveLength(lines);
  expect(ms).toBeLessThan(TIME_BUDGET_MS);
});
