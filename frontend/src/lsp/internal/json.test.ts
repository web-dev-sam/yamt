import { expect, test } from "vitest";

import { sameValue, sectionOf } from "./json";

test("sameValue compares JSON values deeply, whatever the key order", () => {
  expect(sameValue({ a: [1, { b: null }], c: "x" }, { c: "x", a: [1, { b: null }] })).toBe(true);
  expect(sameValue([], [])).toBe(true);
  expect(sameValue(null, null)).toBe(true);
});

test("sameValue tells apart arrays of other lengths or items, and arrays from objects", () => {
  expect(sameValue(["--lsp"], [])).toBe(false);
  expect(sameValue([], ["--lsp"])).toBe(false);
  expect(sameValue(["a", "b"], ["a", "c"])).toBe(false);
  expect(sameValue(["a", "b"], ["b", "a"])).toBe(false);
  expect(sameValue([], {})).toBe(false);
  expect(sameValue({}, [])).toBe(false);
  expect(sameValue({ length: 0 }, [])).toBe(false);
  expect(sameValue([], { length: 0 })).toBe(false);
});

test("sameValue tells apart objects with more, fewer or other keys", () => {
  expect(sameValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  expect(sameValue({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  expect(sameValue({ a: undefined }, { b: undefined })).toBe(false);
  expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
  expect(sameValue({ a: null }, { a: {} })).toBe(false);
});

test("sectionOf walks dotted sections; an empty section is the whole value", () => {
  const settings = { a: { b: { c: 0 } }, list: [1] };

  expect(sectionOf(settings, "")).toBe(settings);
  expect(sectionOf(settings, "a.b.c")).toBe(0);
  expect(sectionOf(settings, "a.x")).toBeNull();
  expect(sectionOf(settings, "list.0")).toBeNull();
  expect(sectionOf(settings, "a.b.c.d")).toBeNull();
  expect(sectionOf(settings, "toString")).toBeNull();
  expect(sectionOf(null, "a")).toBeNull();
});
