import { expect, test } from "vitest";

type TitleAttribute = { readonly file: string; readonly line: number };

const TITLE_ATTRIBUTE = /\s:?title=/u;

const PAGE_FILES: Readonly<Record<string, string>> = import.meta.glob(
  ["./MergeRequest*.vue", "./CiStatus*.vue"],
  { query: "?raw", import: "default", eager: true },
);

function titleAttributes(files: Readonly<Record<string, string>>): readonly TitleAttribute[] {
  return Object.entries(files).flatMap(([file, text]) =>
    text
      .split("\n")
      .flatMap((line, index) => (TITLE_ATTRIBUTE.test(line) ? [{ file, line: index + 1 }] : [])),
  );
}

test("the page's components are read from disk", () => {
  expect(Object.keys(PAGE_FILES)).toEqual(
    expect.arrayContaining([
      "./CiStatusBox.vue",
      "./MergeRequestFilter.vue",
      "./MergeRequestRow.vue",
      "./MergeRequestsButton.vue",
    ]),
  );
});

test("no page component has a title attribute: every hover text is v-tooltip", () => {
  expect(titleAttributes(PAGE_FILES)).toEqual([]);
});

test("a title attribute, bound or not, is reported with its file and line", () => {
  const sample = [
    "<template>",
    '  <span v-tooltip="x">a</span>',
    '  <span :title="x">b</span>',
    '  <span title="y">c</span>',
    '  <span data-title="z">d</span>',
    "</template>",
  ].join("\n");
  expect(titleAttributes({ "./Sample.vue": sample })).toEqual([
    { file: "./Sample.vue", line: 3 },
    { file: "./Sample.vue", line: 4 },
  ]);
});
