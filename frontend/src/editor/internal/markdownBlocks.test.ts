import { expect, test } from "vitest";

import { parseBlocks, type Block } from "./markdownBlocks";

function blocks(text: string): Block[] {
  return parseBlocks(text).map(({ block }) => block);
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
  expect(blocks("| a | b |\n|:--|--:|\n| c \\| d | e |\nend")).toEqual([
    {
      kind: "table",
      align: ["left", "right"],
      header: ["a", "b"],
      rows: [["c \\| d", "e"]],
    },
    { kind: "paragraph", text: "end" },
  ]);
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
