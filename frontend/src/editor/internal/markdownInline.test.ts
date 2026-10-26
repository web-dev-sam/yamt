import { expect, test } from "vitest";

import { parseInline } from "./markdownInline";
import { MAX_NESTING, type Inline } from "./markdownTree";

const LINEAR_MS = 500;

function depthOf(inlines: readonly Inline[]): number {
  return Math.max(
    0,
    ...inlines.map((inline) => ("children" in inline ? 1 + depthOf(inline.children) : 0)),
  );
}

function textOf(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) =>
      "children" in inline ? textOf(inline.children) : "text" in inline ? inline.text : "",
    )
    .join("");
}

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

test("emphasis never crosses a link's text, and a link inside a link stays text", () => {
  expect(parseInline("*a [b*](c) d* [x [y](z)](w)")).toEqual([
    {
      kind: "emphasis",
      children: [
        { kind: "text", text: "a " },
        { kind: "link", children: [{ kind: "text", text: "b*" }], address: "c" },
        { kind: "text", text: " d" },
      ],
    },
    { kind: "text", text: " [x " },
    { kind: "link", children: [{ kind: "text", text: "y" }], address: "z" },
    { kind: "text", text: "](w)" },
  ]);
});

test("a strong closer shared by two openers and the rule of three", () => {
  expect(parseInline("***a***")).toEqual([
    {
      kind: "emphasis",
      children: [{ kind: "strong", children: [{ kind: "text", text: "a" }] }],
    },
  ]);
  expect(parseInline("*a**b*")).toEqual([
    { kind: "emphasis", children: [{ kind: "text", text: "a**b" }] },
  ]);
});

test("a 10,000-deep emphasis stops at MAX_NESTING, the rest literal", () => {
  const levels = 10_000;
  const inner = levels - MAX_NESTING;
  const parsed = parseInline(`${"*a ".repeat(levels)}${"a* ".repeat(levels)}`);
  expect(depthOf(parsed)).toBe(MAX_NESTING);
  expect(textOf(parsed)).toBe(
    `${"a ".repeat(MAX_NESTING)}${"*a ".repeat(inner)}${"a* ".repeat(inner)}${"a ".repeat(MAX_NESTING)}`,
  );
});

test("unmatched openers, closers, brackets and code spans parse in linear time", () => {
  const unmatched = "*a ".repeat(20_000);
  const brackets = "[](".repeat(20_000);
  const unpaired = `${unmatched}${"a_ ".repeat(20_000)}`;
  const codeSpans = "`a` ".repeat(20_000);
  const spanNodes = Array.from({ length: 20_000 }, () => [
    { kind: "code", text: "a" },
    { kind: "text", text: " " },
  ]).flat();
  const started = performance.now();
  expect(parseInline(unmatched)).toEqual([{ kind: "text", text: unmatched }]);
  expect(parseInline(brackets)).toEqual([{ kind: "text", text: brackets }]);
  expect(parseInline(unpaired)).toEqual([{ kind: "text", text: unpaired }]);
  expect(parseInline(codeSpans)).toEqual(spanNodes);
  expect(performance.now() - started).toBeLessThan(LINEAR_MS);
});
