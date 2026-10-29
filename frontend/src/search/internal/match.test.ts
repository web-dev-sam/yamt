import { expect, test } from "vitest";

import { matcherOf, type Matcher, type Query } from "../index";
import { paneHits } from "./match";

function matcher(text: string, matchCase = false): Matcher {
  const query: Query = { text, matchCase };
  const built = matcherOf(query);
  if (built === null) {
    throw new Error("a non-empty query builds a matcher");
  }
  return built;
}

function spots(text: string, query: string, matchCase = false): string[] {
  return paneHits(text, matcher(query, matchCase), Infinity).hits.map(
    ({ line, from, to }) => `${line}:${from}-${to}`,
  );
}

test("a.b does not match axb (an unescaped RegExp)", () => {
  expect(spots("axb a.b", "a.b")).toEqual(["0:4-7"]);
});

test("every RegExp syntax character is matched as itself (an unescaped RegExp)", () => {
  const syntax = String.raw`^$\.*+?()[]{}|/`;

  expect(spots(`x ${syntax} y`, syntax)).toEqual([`0:2-${2 + syntax.length}`]);
  expect(spots("a-b", "-")).toEqual(["0:1-2"]);
});

test("case-insensitive by default; Match Case narrows Foo/foo (an inverted flag)", () => {
  expect(spots("Foo foo", "foo")).toEqual(["0:0-3", "0:4-7"]);
  expect(spots("Foo foo", "foo", true)).toEqual(["0:4-7"]);
  expect(spots("Foo foo", "Foo", true)).toEqual(["0:0-3"]);
});

test("İx foo puts foo at column 3 (lowercasing the line shifts offsets)", () => {
  expect(spots("İx foo", "FOO")).toEqual(["0:3-6"]);
});

test("😀foo puts foo at column 2 (code-point columns instead of UTF-16)", () => {
  expect(spots("😀foo", "foo")).toEqual(["0:2-5"]);
});

test("CRLF: the line text has no \\r and the line count is right (\\r\\n counted as two breaks)", () => {
  const { hits } = paneHits("one\r\ntwo foo\r\nfoo\r\n", matcher("foo"), Infinity);

  expect(hits).toEqual([
    { line: 1, from: 4, to: 7, lineText: "two foo" },
    { line: 2, from: 0, to: 3, lineText: "foo" },
  ]);
});

test("lines are counted across gaps without matches and kept for hits on one line", () => {
  const { hits } = paneHits("foo\n\nx\ny foo foo\nz", matcher("foo"), Infinity);

  expect(hits).toEqual([
    { line: 0, from: 0, to: 3, lineText: "foo" },
    { line: 3, from: 2, to: 5, lineText: "y foo foo" },
    { line: 3, from: 6, to: 9, lineText: "y foo foo" },
  ]);
});

test("aaa/aa gives one hit; two separate hits on one line give two (overlapping or merged hits)", () => {
  expect(spots("aaa", "aa")).toEqual(["0:0-2"]);
  expect(spots("aa aa", "aa")).toEqual(["0:0-2", "0:3-5"]);
});

test("an empty query gives no matcher (showing everything)", () => {
  expect(matcherOf({ text: "", matchCase: false })).toBeNull();
  expect(matcherOf({ text: "", matchCase: true })).toBeNull();
});

test("a match never crosses a line or covers its \\r (a cross-line hit)", () => {
  expect(spots("xa\nbx", "a\nb")).toEqual([]);
  expect(spots("fo\r\nfo", "o\r")).toEqual([]);
});

test("a pane stops scanning at the limit (an unbounded array)", () => {
  const text = "x x\nx";

  expect(paneHits(text, matcher("x"), 2)).toEqual({
    hits: [
      { line: 0, from: 0, to: 1, lineText: "x x" },
      { line: 0, from: 2, to: 3, lineText: "x x" },
    ],
    cut: true,
  });
  expect(paneHits(text, matcher("x"), 3)).toMatchObject({ cut: false });
});

test("a dropped cross-line match does not count toward the limit", () => {
  expect(paneHits("o\r\no x", matcher("o\r"), 0).cut).toBe(false);
});

test("a match starting on a line break stays on its line and is dropped (a negative column)", () => {
  expect(spots("a\nb", "\nb")).toEqual([]);
  expect(spots("a\nb\nc", "\nc")).toEqual([]);
});
