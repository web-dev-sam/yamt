import { expect, test } from "vitest";

import { parseBlocks, type Block } from "./markdownBlocks";
import { MAX_NESTING } from "./markdownTree";

const LINEAR_MS = 500;

function blocks(text: string): Block[] {
  return parseBlocks(text).map(({ block }) => block);
}

function innermost(
  outer: readonly Block[],
  kind: "quote" | "list",
): { readonly depth: number; readonly blocks: readonly Block[] } {
  let depth = 0;
  let inside = outer;
  for (;;) {
    const [only] = inside;
    if (inside.length !== 1 || only?.kind !== kind) {
      return { depth, blocks: inside };
    }
    depth += 1;
    inside = only.kind === "quote" ? only.blocks : (only.items[0]?.blocks ?? []);
  }
}

test("a fenced block keeps a line that looks like a heading", () => {
  expect(blocks("```ts\n# not a heading\nconst a = 1;\n```\n# A heading")).toEqual([
    { kind: "code", info: "ts", code: "# not a heading\nconst a = 1;" },
    { kind: "heading", tag: "h1", text: "A heading" },
  ]);
});

test("a tilde fence closes only on its own marks and an open fence runs to the end", () => {
  expect(blocks("~~~\n```\n~~\n~~~~\nafter")).toEqual([
    { kind: "code", info: "", code: "```\n~~" },
    { kind: "paragraph", text: "after" },
  ]);
  expect(blocks("```python run\nprint(1)")).toEqual([
    { kind: "code", info: "python", code: "print(1)" },
  ]);
});

test("a list item's indented continuation joins the item", () => {
  expect(blocks("- one\n\n  more\n- two\n\nafter")).toEqual([
    {
      kind: "list",
      numbering: { kind: "bullet" },
      items: [
        {
          blocks: [
            { kind: "paragraph", text: "one" },
            { kind: "paragraph", text: "more" },
          ],
        },
        { blocks: [{ kind: "paragraph", text: "two" }] },
      ],
    },
    { kind: "paragraph", text: "after" },
  ]);
});

test("a lazy line joins the item's paragraph and an indented list nests", () => {
  expect(blocks("1. first\nlazy\n   - inner\n2. second")).toEqual([
    {
      kind: "list",
      numbering: { kind: "ordered", start: 1 },
      items: [
        {
          blocks: [
            { kind: "paragraph", text: "first\nlazy" },
            {
              kind: "list",
              numbering: { kind: "bullet" },
              items: [{ blocks: [{ kind: "paragraph", text: "inner" }] }],
            },
          ],
        },
        { blocks: [{ kind: "paragraph", text: "second" }] },
      ],
    },
  ]);
});

test("a table needs its delimiter row", () => {
  expect(blocks("| a | b |\n| c | d |")).toEqual([
    { kind: "paragraph", text: "| a | b |\n| c | d |" },
  ]);
  expect(blocks("| a | b |\n|:--|--:|\n| c \\| d | e |\nend\n\nafter")).toEqual([
    {
      kind: "table",
      align: ["left", "right"],
      header: ["a", "b"],
      rows: [
        ["c \\| d", "e"],
        ["end", ""],
      ],
    },
    { kind: "paragraph", text: "after" },
  ]);
});

test("a quote with a pipe right after a table starts a quote", () => {
  expect(blocks("| a |\n|---|\n> q | x")).toEqual([
    { kind: "table", align: ["none"], header: ["a"], rows: [] },
    { kind: "quote", blocks: [{ kind: "paragraph", text: "q | x" }] },
  ]);
});

test("a row of dashes after a data row stays a row of the same table", () => {
  expect(blocks("| name | a |\n|---|---|\n| x | 1 |\n| - | - |\n| y | 3 |")).toEqual([
    {
      kind: "table",
      align: ["none", "none"],
      header: ["name", "a"],
      rows: [
        ["x", "1"],
        ["-", "-"],
        ["y", "3"],
      ],
    },
  ]);
});

test("item and fence lines ending in U+2028 parse in linear time", () => {
  const spaces = " ".repeat(100_000);
  const backticks = "`".repeat(100_000);
  const emptyItem = { blocks: [] };
  const started = performance.now();
  expect(blocks(`-${spaces}\u2028`)).toEqual([
    { kind: "list", numbering: { kind: "bullet" }, items: [emptyItem] },
  ]);
  expect(blocks(`1.${spaces}\u2028`)).toEqual([
    { kind: "list", numbering: { kind: "ordered", start: 1 }, items: [emptyItem] },
  ]);
  expect(blocks(`${backticks}\u2028`)).toEqual([{ kind: "code", info: "", code: "" }]);
  expect(blocks(`p\n-${spaces}\u2028`)).toEqual([
    { kind: "paragraph", text: `p\n-${spaces}\u2028` },
  ]);
  expect(performance.now() - started).toBeLessThan(LINEAR_MS);
});

test("a heading drops its closing run only after a space, in linear time", () => {
  expect(blocks("# a#\n## b ##  \n### ###")).toEqual([
    { kind: "heading", tag: "h1", text: "a#" },
    { kind: "heading", tag: "h2", text: "b" },
    { kind: "heading", tag: "h3", text: "" },
  ]);
  const inner = " ".repeat(100_000);
  const started = performance.now();
  expect(blocks(`# a${inner}b`)).toEqual([{ kind: "heading", tag: "h1", text: `a${inner}b` }]);
  expect(performance.now() - started).toBeLessThan(LINEAR_MS);
});

test("a 10,000-deep quote and list stop nesting at MAX_NESTING, the rest a paragraph", () => {
  const levels = 10_000;
  const quote = blocks(`${">".repeat(levels)} deep`);
  expect(innermost(quote, "quote")).toEqual({
    depth: MAX_NESTING,
    blocks: [{ kind: "paragraph", text: `${">".repeat(levels - MAX_NESTING)} deep` }],
  });
  const list = blocks(`${"- ".repeat(levels)}x`);
  expect(innermost(list, "list")).toEqual({
    depth: MAX_NESTING,
    blocks: [{ kind: "paragraph", text: `${"- ".repeat(levels - MAX_NESTING)}x` }],
  });
});

test("raw HTML stays text", () => {
  expect(blocks('<div onclick="x()">\n<script>alert(1)</script>\n</div>')).toEqual([
    { kind: "paragraph", text: '<div onclick="x()">\n<script>alert(1)</script>\n</div>' },
  ]);
});

test("headings, quotes with a lazy line and rules interrupt a paragraph", () => {
  expect(blocks("text\n## Two ##\n> quoted\nlazy\n\n---")).toEqual([
    { kind: "paragraph", text: "text" },
    { kind: "heading", tag: "h2", text: "Two" },
    { kind: "quote", blocks: [{ kind: "paragraph", text: "quoted\nlazy" }] },
    { kind: "rule" },
  ]);
  expect(blocks("#hashtag\n####### seven")).toEqual([
    { kind: "paragraph", text: "#hashtag\n####### seven" },
  ]);
});

test("each block carries its source lines, so a streamed text keeps its earlier blocks", () => {
  expect(parseBlocks("# Title\n\nsome *text\n").map(({ source }) => source)).toEqual([
    "# Title",
    "some *text",
  ]);
});
