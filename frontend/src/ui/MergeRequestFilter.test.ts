import { beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

import { NARROW_FROM, type Choice, type ReviewFor } from "../mergeRequests";
import MergeRequestFilter from "./MergeRequestFilter.vue";
import MergeRequestReviewMode from "./MergeRequestReviewMode.vue";

type Menu = {
  readonly choices: readonly Choice<ReviewFor>[];
  readonly open: boolean;
  readonly above: boolean;
};

const MENU_SOURCES: Readonly<Record<string, string>> = import.meta.glob(
  ["./MergeRequestFilter.vue", "./MergeRequestReviewMode.vue"],
  { query: "?raw", import: "default", eager: true },
);

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  return () => vi.unstubAllGlobals();
});

function people(count: number): readonly Choice<ReviewFor>[] {
  return Array.from({ length: count }, (_, index) => ({
    value: { kind: "person", username: `user${index}` },
    label: `Person ${index}`,
    count: 1,
    state: "off",
  }));
}

function filterMenu(menu: Menu): Promise<string> {
  const props = { ...menu, filter: "reviewer", label: "Reviewer", set: false } as const;
  return renderToString(createSSRApp({ render: () => h(MergeRequestFilter, props) }));
}

function pickerMenu(menu: Menu): Promise<string> {
  const props = { ...menu, active: false };
  return renderToString(createSSRApp({ render: () => h(MergeRequestReviewMode, props) }));
}

function narrowingBox(html: string): string | null {
  const start = html.indexOf('<div class="absolute');
  return start === -1 ? null : html.slice(start, html.indexOf("<ul", start));
}

function labels(html: string): readonly string[] {
  return [...html.matchAll(/Person \d+/gu)].map((found) => found[0]);
}

test.each([false, true])(
  "above NARROW_FROM choices both menus open the same narrowing box (above: %s)",
  async (above) => {
    const menu = { choices: people(NARROW_FROM + 1), open: true, above };

    const filterBox = narrowingBox(await filterMenu(menu));

    expect(filterBox).toContain('type="search"');
    expect(filterBox).toContain('aria-label="Narrow the Reviewer list"');
    expect(filterBox).toContain(above ? "bottom-full" : "top-full");
    expect(narrowingBox(await pickerMenu(menu))).toBe(filterBox);
  },
);

test("at NARROW_FROM choices neither menu has a narrowing box, and both list every choice", async () => {
  const menu = { choices: people(NARROW_FROM), open: true, above: false };
  const filter = await filterMenu(menu);
  const picker = await pickerMenu(menu);

  expect(narrowingBox(filter)).not.toContain("<input");
  expect(narrowingBox(picker)).toBe(narrowingBox(filter));
  expect(labels(filter)).toEqual(menu.choices.map((choice) => choice.label));
  expect(labels(picker)).toEqual(labels(filter));
});

test("closed, neither menu renders its box or its choices", async () => {
  const menu = { choices: people(NARROW_FROM + 1), open: false, above: false };

  for (const html of [await filterMenu(menu), await pickerMenu(menu)]) {
    expect(narrowingBox(html)).toBeNull();
    expect(labels(html)).toEqual([]);
  }
});

test("both menus leave typing, narrowing and its reset on opening to MenuNarrowing", () => {
  expect(Object.keys(MENU_SOURCES)).toHaveLength(2);
  for (const source of Object.values(MENU_SOURCES)) {
    expect(source).toMatch(/<MenuNarrowing[^>]*:open="open"/u);
    expect(source).not.toMatch(/typed|narrowed\(|NARROW_FROM|type="search"/u);
  }
});
