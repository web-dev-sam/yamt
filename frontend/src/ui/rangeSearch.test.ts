import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  createFixtureRangeSource,
  log,
  type RangeFileId,
  type RangeSource,
  type RangeStart,
  type SearchTexts,
  type SourceResult,
} from "../ipc";
import { RANGE_LAYOUT, rangePanes } from "./rangeSearch";
import { createRangeStore, type RangeStore } from "./rangeStore";

const SIDE = { label: { kind: "named", name: "main" }, short_id: "1b2cfed", subject: "Start" };
const FILE_COUNT = 3;

function rangeCase(count = FILE_COUNT): unknown {
  const paths = ["src/a.ts", "src/b.ts", "src/c.ts"].slice(0, count);
  return {
    start: {
      range: "main...feature",
      left: SIDE,
      right: { ...SIDE, label: { kind: "named", name: "feature" }, short_id: "2b3b4b5" },
      files: paths.map((path, id) => ({
        id,
        path,
        change: { kind: "modified" },
        lines: { kind: "counted", added: 1, removed: 1 },
      })),
    },
    files: paths.map((path) => ({
      kind: "texts",
      left: `old ${path}\n`,
      right: `new ${path}\n`,
      differences: [
        {
          left: { start: 0, len: 1 },
          right: { start: 0, len: 1 },
          words: { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } },
        },
      ],
      mode: { kind: "same" },
    })),
  };
}

type Paged = { readonly source: RangeSource; readonly calls: number[] };

type PageOptions = {
  readonly fail?: () => boolean;
  readonly emptyFirstPage?: boolean;
  readonly startLists?: number;
  readonly count?: number;
};

function pagedSource(options: PageOptions = {}): Paged {
  const fixture = createFixtureRangeSource(log, "?range=review", {
    "../../fixtures/range/review.json": rangeCase(options.count),
  });
  const calls: number[] = [];
  async function searchTexts(from: RangeFileId): Promise<SourceResult<SearchTexts>> {
    calls.push(from);
    if (options.fail?.() === true) {
      return { ok: false, failure: { kind: "Git", message: "cat-file died" } };
    }
    const all = await fixture.searchTexts(from);
    if (!all.ok) {
      return all;
    }
    const [first, second] = all.value.files;
    if (options.emptyFirstPage === true && calls.length === 1) {
      return { ok: true, value: { files: [], next: first?.file ?? null } };
    }
    return {
      ok: true,
      value: { files: first === undefined ? [] : [first], next: second?.file ?? null },
    };
  }
  async function openRange(): Promise<SourceResult<RangeStart>> {
    const opened = await fixture.openRange();
    if (!opened.ok || options.startLists === undefined) {
      return opened;
    }
    return {
      ok: true,
      value: { ...opened.value, files: opened.value.files.slice(0, options.startLists) },
    };
  }
  return { source: { ...fixture, searchTexts, openRange }, calls };
}

async function started(paged: Paged): Promise<RangeStore> {
  const store = createRangeStore(paged.source, "dark", null);
  await store.startUp();
  return store;
}

function previews(store: RangeStore): string[] {
  return store.search.rows.value.flatMap((row) =>
    row.kind === "group"
      ? [row.path]
      : [
          `${row.place.preview.match}${row.place.preview.after} [${row.shown.map(({ pane }) => pane).join(" ")}]`,
        ],
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("the first run pages from the first file until next is null; later runs ask Rust nothing", async () => {
  const paged = pagedSource();
  const store = await started(paged);

  store.search.type("src/");
  store.search.enter();
  await vi.runAllTimersAsync();
  expect(paged.calls).toEqual([0, 1, 2]);
  expect(previews(store)).toEqual([
    "src/a.ts",
    "src/a.ts [left]",
    "src/a.ts [right]",
    "src/b.ts",
    "src/b.ts [left]",
    "src/b.ts [right]",
    "src/c.ts",
    "src/c.ts [left]",
    "src/c.ts [right]",
  ]);

  store.search.type("new");
  store.search.enter();
  await vi.runAllTimersAsync();
  expect(paged.calls).toHaveLength(FILE_COUNT);
  expect(store.search.summary.value).toEqual({ kind: "results", rows: 3, files: 3, cut: false });
});

test("a failed page is reported once, stops the run, and the next run asks from the same file", async () => {
  let failing = true;
  const paged = pagedSource({ fail: () => failing });
  const store = await started(paged);
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  store.search.type("src/");
  store.search.enter();
  await vi.runAllTimersAsync();
  expect(paged.calls).toEqual([0]);
  expect(store.problem.value).toEqual({
    action: "search",
    cause: { kind: "Git", message: "cat-file died" },
  });
  expect(store.search.running.value).toBe(false);

  failing = false;
  store.search.enter();
  await vi.runAllTimersAsync();
  expect(paged.calls).toEqual([0, 0, 1, 2]);
});

test("two runs at once share one page request", async () => {
  const paged = pagedSource();
  const store = await started(paged);

  store.search.type("src/");
  store.search.enter();
  store.search.enter();
  await vi.runAllTimersAsync();

  expect(paged.calls).toEqual([0, 1, 2]);
});

test("a row click shows its file in the window, with the new side asked when it is on", async () => {
  const store = await started(pagedSource());
  store.search.type("new src/b");
  store.search.enter();
  await vi.runAllTimersAsync();
  const row = store.search.rows.value.find((each) => each.kind === "place");
  if (row?.kind !== "place") {
    throw new Error("no place row");
  }

  store.search.go(row.path, row.place, null);

  expect(store.shownPath.value).toBe("src/b.ts");
  expect(store.search.goTo.value).toMatchObject({ path: "src/b.ts", pane: "right" });
});

test("the range's panes are the old side then the new one, titled with their commits", async () => {
  const store = await started(pagedSource());

  expect(RANGE_LAYOUT).toEqual({ panes: ["left", "right"], lead: "right" });
  expect(rangePanes(null)).toEqual([]);
  expect(store.search.panes.value).toEqual([
    { pane: "left", icon: "panel-left", title: "main (1b2cfed)" },
    { pane: "right", icon: "panel-right", title: "feature (2b3b4b5)" },
  ]);
});

test("an empty range asks Rust nothing and finds nothing", async () => {
  const paged = pagedSource({ count: 0 });
  const store = await started(paged);

  store.search.type("src/");
  store.search.enter();
  await vi.runAllTimersAsync();

  expect(paged.calls).toEqual([]);
  expect(store.search.summary.value).toEqual({ kind: "noResults" });
});

test("a search before the range opened reads nothing and remembers no page", async () => {
  const paged = pagedSource();
  const store = createRangeStore(paged.source, "dark", null);

  store.search.type("src/");
  store.search.enter();
  await vi.runAllTimersAsync();
  expect(paged.calls).toEqual([]);

  await store.startUp();
  store.search.enter();
  await vi.runAllTimersAsync();
  expect(paged.calls).toEqual([0, 1, 2]);
});

test("a page without files moves on to its next id", async () => {
  const paged = pagedSource({ emptyFirstPage: true });
  const store = await started(paged);

  store.search.type("new");
  store.search.enter();
  await vi.runAllTimersAsync();

  expect(paged.calls).toEqual([0, 0, 1, 2]);
  expect(store.search.summary.value).toEqual({ kind: "results", rows: 3, files: 3, cut: false });
});

test("a page's file the range does not list is left out", async () => {
  const store = await started(pagedSource({ startLists: 2 }));

  store.search.type("new");
  store.search.enter();
  await vi.runAllTimersAsync();

  expect(previews(store)).toEqual([
    "src/a.ts",
    "new src/a.ts [right]",
    "src/b.ts",
    "new src/b.ts [right]",
  ]);
});

test("a file searched again reads its kept texts and keeps its rows", async () => {
  const paged = pagedSource();
  const store = await started(paged);
  store.search.type("new");
  store.search.enter();
  await vi.runAllTimersAsync();

  store.search.changed("src/b.ts");
  await vi.runAllTimersAsync();

  expect(paged.calls).toEqual([0, 1, 2]);
  expect(previews(store)).toEqual([
    "src/a.ts",
    "new src/a.ts [right]",
    "src/b.ts",
    "new src/b.ts [right]",
    "src/c.ts",
    "new src/c.ts [right]",
  ]);
  expect(store.search.summary.value).toEqual({ kind: "results", rows: 3, files: 3, cut: false });
});
