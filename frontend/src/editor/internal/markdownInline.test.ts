import { expect, test } from "vitest";

import { parseInline } from "./markdownInline";

test("backticks win over emphasis", () => {
  expect(parseInline("*a `b*` c*")).toEqual([
    {
      kind: "emphasis",
      children: [
        { kind: "text", text: "a " },
        { kind: "code", text: "b*" },
        { kind: "text", text: " c" },
      ],
    },
  ]);
});

test("an unmatched `*` stays literal", () => {
  expect(parseInline("2 * 3 and *open and **half*")).toEqual([
    { kind: "text", text: "2 * 3 and *open and *" },
    { kind: "emphasis", children: [{ kind: "text", text: "half" }] },
  ]);
});

test("snake_case words keep their underscores", () => {
  expect(parseInline("call snake_case_name and _this_")).toEqual([
    { kind: "text", text: "call snake_case_name and " },
    { kind: "emphasis", children: [{ kind: "text", text: "this" }] },
  ]);
});

test("strong, strike and nested emphasis", () => {
  expect(parseInline("**a *b* c** ~~gone~~")).toEqual([
    {
      kind: "strong",
      children: [
        { kind: "text", text: "a " },
        { kind: "emphasis", children: [{ kind: "text", text: "b" }] },
        { kind: "text", text: " c" },
      ],
    },
    { kind: "text", text: " " },
    { kind: "strike", children: [{ kind: "text", text: "gone" }] },
  ]);
});

test("raw HTML stays text", () => {
  expect(parseInline('<script>alert(1)</script><img src=x onerror="y()">')).toEqual([
    { kind: "text", text: '<script>alert(1)</script><img src=x onerror="y()">' },
  ]);
});

test("an image is its alt text and address", () => {
  expect(parseInline('see ![the logo](https://x.test/logo.png "t") here')).toEqual([
    { kind: "text", text: "see the logo (https://x.test/logo.png) here" },
  ]);
});

test("a link is its text and address, an autolink its address", () => {
  expect(parseInline("[the `docs`](javascript:alert(1)) or <https://x.test/a>")).toEqual([
    {
      kind: "link",
      children: [
        { kind: "text", text: "the " },
        { kind: "code", text: "docs" },
      ],
      address: "javascript:alert(1)",
    },
    { kind: "text", text: " or https://x.test/a" },
  ]);
});

test("escapes, hard breaks and soft breaks", () => {
  expect(parseInline("\\*not\\* a  \nb\\\nc\nd")).toEqual([
    { kind: "text", text: "*not* a" },
    { kind: "break" },
    { kind: "text", text: "b" },
    { kind: "break" },
    { kind: "text", text: "c\nd" },
  ]);
});
