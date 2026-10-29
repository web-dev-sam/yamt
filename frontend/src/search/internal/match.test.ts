import { expect, test } from "vitest";

import { matcherOf, type Matcher, type Query } from "../index";
import { digestOf } from "./digest";
import type { LineHit } from "./match";

function matcher(text: string, matchCase = false): Matcher {
  const query: Query = { text, matchCase };
  const built = matcherOf(query);
  if (built === null) {
    throw new Error("a non-empty query builds a matcher");
  }
  return built;
}

function spots(text: string, query: string, matchCase = false): string[] {
  return matcher(query, matchCase)
    .hits(text, Infinity)
    .hits.map(({ line, from, to }) => `${line}:${from}-${to}`);
}

function lineHit(line: number, from: number, to: number, lineText: string): LineHit {
  return { line, from, to, lineText, lineDigest: digestOf(lineText) };
}

test("a Matcher comes only from matcherOf (a forged or read pattern)", () => {
  // @ts-expect-error -- the pattern is an ES private field: no object literal is a Matcher
  const forged: Matcher = { pattern: /x/gu };

  expect(Object.keys(matcher("x"))).toEqual([]);
  expect(Object.keys(forged)).not.toEqual(Object.keys(matcher("x")));
});

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
  const { hits } = matcher("foo").hits("one\r\ntwo foo\r\nfoo\r\n", Infinity);

  expect(hits).toEqual([lineHit(1, 4, 7, "two foo"), lineHit(2, 0, 3, "foo")]);
});

test("lines are counted across gaps without matches and kept for hits on one line", () => {
  const { hits } = matcher("foo").hits("foo\n\nx\ny foo foo\nz", Infinity);

  expect(hits).toEqual([
    lineHit(0, 0, 3, "foo"),
    lineHit(3, 2, 5, "y foo foo"),
    lineHit(3, 6, 9, "y foo foo"),
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

  expect(matcher("x").hits(text, 2)).toEqual({
    hits: [lineHit(0, 0, 1, "x x"), lineHit(0, 2, 3, "x x")],
    cut: true,
  });
  expect(matcher("x").hits(text, 3)).toMatchObject({ cut: false });
});

test("a dropped cross-line match does not count toward the limit", () => {
  expect(matcher("o\r").hits("o\r\no x", 0).cut).toBe(false);
});

test("a match starting on a line break stays on its line and is dropped (a negative column)", () => {
  expect(spots("a\nb", "\nb")).toEqual([]);
  expect(spots("a\nb\nc", "\nc")).toEqual([]);
});
