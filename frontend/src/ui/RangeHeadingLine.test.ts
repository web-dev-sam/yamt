import { expect, test } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

import { isMergeRequestIid, type MergeRequestIid, type RangeSide, type RangeStart } from "../ipc";
import RangeHeadingLine from "./RangeHeadingLine.vue";

const BASE: RangeSide = {
  label: { kind: "mergeBase", left: "main", right: "feature" },
  shortId: "531ea52",
  subject: "Base",
};
const HEAD: RangeSide = {
  label: { kind: "named", name: "feature" },
  shortId: "9c1ba3f",
  subject: "Head",
};
const START: RangeStart = {
  range: "main...feature",
  heading: { kind: "typed" },
  totals: { added: 40, removed: 7 },
  left: BASE,
  right: HEAD,
  files: [],
};

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is no merge-request iid`);
  }
  return value;
}

async function parts(start: RangeStart): Promise<string[]> {
  const html = await renderToString(createSSRApp({ render: () => h(RangeHeadingLine, { start }) }));
  return html
    .split(/<[^>]*>/u)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

test("a merge request's line is its reference, title, source → target and the totals, no separator between", async () => {
  const start: RangeStart = {
    ...START,
    heading: {
      kind: "mergeRequest",
      iid: iid(12),
      names: { title: "Reminders before a card is due", source: "sam:feature", target: "main" },
    },
  };

  expect(await parts(start)).toEqual([
    "!12",
    "Reminders before a card is due",
    "sam:feature",
    "→",
    "main",
    "+40",
    "−7",
  ]);
});

test("a merge request without names shows its two short ids, the head's first", async () => {
  const start: RangeStart = { ...START, heading: { kind: "unnamedMergeRequest", iid: iid(12) } };

  expect(await parts(start)).toEqual(["!12", "9c1ba3f", "→", "531ea52", "+40", "−7"]);
});

test("a typed range shows its two names around its own dots, then the totals", async () => {
  expect(await parts(START)).toEqual(["main", "...", "feature", "+40", "−7"]);
});

test("the line is a labelled group and each chip carries its full name as its title", async () => {
  const html = await renderToString(
    createSSRApp({ render: () => h(RangeHeadingLine, { start: START }) }),
  );

  expect(html).toContain('role="group" aria-label="What this window compares"');
  expect(html).toContain('title="main"');
  expect(html).toContain('title="feature"');
});
