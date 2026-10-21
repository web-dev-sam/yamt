import * as v from "valibot";
import { afterEach, expect, test, vi } from "vitest";

import type { TabId, TabList } from "./compareDomain";
import type { CompareSource } from "./CompareSource";
import { nextColumnVersion, type SourceResult } from "./domain";
import { createFixtureCompareSource } from "./fixtureCompare";
import { createLog, type Log, type LogEntry } from "./log";

const COMMITTED: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../fixtures/compare/*.json",
  { eager: true, import: "default" },
);

const CASE_TEXTS = v.object({ left: v.string(), right: v.string(), differences: v.unknown() });

const NO_QUERY = "";

const LIMIT = 8_388_608;

const EURO_BYTES = 3;

function quietLog(): { log: Log; entries: LogEntry[] } {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const entries: LogEntry[] = [];
  const log = createLog((entry) => {
    entries.push(entry);
  });
  return { log, entries };
}

function valueOf<T>(result: SourceResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected a value, got ${JSON.stringify(result.failure)}`);
  }
  return result.value;
}

function committedCase(name: string): v.InferOutput<typeof CASE_TEXTS> {
  return v.parse(CASE_TEXTS, COMMITTED[`../../fixtures/compare/${name}.json`]);
}

function names(list: TabList): string[] {
  return list.tabs.map((tab) => tab.name);
}

function idOf(list: TabList, name: string): TabId {
  const tab = list.tabs.find((each) => each.name === name);
  if (tab === undefined) {
    throw new Error(`no tab ${name} in ${names(list).join(", ")}`);
  }
  return tab.id;
}

async function firstTab(source: CompareSource): Promise<TabId> {
  return valueOf(await source.openCompare()).list.shown;
}

async function withThree(source: CompareSource): Promise<TabList> {
  await source.addTab();
  return valueOf(await source.addTab());
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("the first start shows one empty Compare 1 and the limit (catches a start without a tab)", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);

  const start = valueOf(await source.openCompare());

  expect(start).toEqual({
    list: {
      tabs: [{ id: 1, name: "Compare 1", language: { kind: "auto" }, holdsText: false }],
      shown: 1,
    },
    columnLimit: LIMIT,
  });
  expect(valueOf(await source.loadTab(start.list.shown))).toEqual({
    left: "",
    right: "",
    comparison: { versions: { left: 0, right: 0 }, differences: [] },
  });
});

test("?raw=json-payload puts the case into tab 1 and loadTab returns its differences (catches an ignored ?raw)", async () => {
  const payload = committedCase("json-payload");
  const source = createFixtureCompareSource(quietLog().log, "?raw=json-payload");

  const start = valueOf(await source.openCompare());
  const texts = valueOf(await source.loadTab(start.list.shown));

  expect(start.list.tabs).toEqual([
    { id: 1, name: "Compare 1", language: { kind: "auto" }, holdsText: true },
  ]);
  expect(texts.left).toBe(payload.left);
  expect(texts.right).toBe(payload.right);
  expect(texts.comparison.differences).toEqual(payload.differences);
  expect(texts.comparison.differences).toHaveLength(4);
});

test("an unknown ?raw case fails the start naming it and the known ones", () => {
  expect(() => createFixtureCompareSource(quietLog().log, "?raw=nope")).toThrow(
    "no compare fixture nope; known: json-payload, typescript, words",
  );
});

test("a new tab's number is above every open tab's, and ids never repeat (catches counting tabs)", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const three = await withThree(source);

  await source.closeTab(idOf(three, "Compare 2"));
  const afterMiddle = valueOf(await source.addTab());

  expect(names(afterMiddle)).toEqual(["Compare 1", "Compare 3", "Compare 4"]);
  expect(afterMiddle.tabs.map((tab) => tab.id)).toEqual([1, 3, 4]);
  expect(afterMiddle.shown).toBe(4);

  await source.closeTab(idOf(afterMiddle, "Compare 4"));
  const afterLast = valueOf(await source.addTab());

  expect(names(afterLast)).toEqual(["Compare 1", "Compare 3", "Compare 4"]);
  expect(afterLast.tabs.map((tab) => tab.id)).toEqual([1, 3, 5]);
});

test("closing the shown tab shows the next, the last shown the previous, the last tab leaves a fresh Compare 1", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const three = await withThree(source);
  await source.showTab(idOf(three, "Compare 2"));

  const next = valueOf(await source.closeTab(idOf(three, "Compare 2")));
  expect(next.shown).toBe(idOf(three, "Compare 3"));

  const previous = valueOf(await source.closeTab(idOf(three, "Compare 3")));
  expect(previous.shown).toBe(idOf(three, "Compare 1"));

  const fresh = valueOf(await source.closeTab(idOf(three, "Compare 1")));
  expect(fresh).toEqual({
    tabs: [{ id: 4, name: "Compare 1", language: { kind: "auto" }, holdsText: false }],
    shown: 4,
  });
});

test("closing a tab that is not shown keeps the shown one", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const three = await withThree(source);

  const closed = valueOf(await source.closeTab(idOf(three, "Compare 1")));

  expect(names(closed)).toEqual(["Compare 2", "Compare 3"]);
  expect(closed.shown).toBe(idOf(three, "Compare 3"));
});

test("a rename is trimmed and spaces only keep the old name (catches an untrimmed or emptied name)", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const tab = await firstTab(source);

  expect(names(valueOf(await source.renameTab(tab, "  payload  ")))).toEqual(["payload"]);
  expect(names(valueOf(await source.renameTab(tab, "   ")))).toEqual(["payload"]);
});

test("a picked language and a shown tab are kept", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const first = await firstTab(source);
  await source.addTab();

  const picked = valueOf(await source.setTabLanguage(first, { kind: "picked", name: "JSON" }));
  const shown = valueOf(await source.showTab(first));

  expect(picked.tabs[0]?.language).toEqual({ kind: "picked", name: "JSON" });
  expect(picked.tabs[1]?.language).toEqual({ kind: "auto" });
  expect(shown.shown).toBe(first);
});

test("setColumn with a version not above the stored one stores nothing and replies with the stored versions", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const tab = await firstTab(source);
  const { versions } = valueOf(await source.loadTab(tab)).comparison;
  const one = nextColumnVersion(versions.left);

  const stored = valueOf(await source.setColumn({ tab, column: "left", text: "x", version: one }));
  const sameVersion = valueOf(
    await source.setColumn({ tab, column: "left", text: "y", version: one }),
  );
  const older = valueOf(
    await source.setColumn({ tab, column: "left", text: "z", version: versions.left }),
  );

  expect(stored.versions).toEqual({ left: 1, right: 0 });
  expect(sameVersion.versions).toEqual({ left: 1, right: 0 });
  expect(older.versions).toEqual({ left: 1, right: 0 });
  expect(valueOf(await source.loadTab(tab)).left).toBe("x");
  expect(valueOf(await source.openCompare()).list.tabs[0]?.holdsText).toBe(true);
});

test("a column over the limit in UTF-8 bytes is ColumnTooLarge and stores nothing, though its UTF-16 length is under it", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const tab = await firstTab(source);
  const { versions } = valueOf(await source.loadTab(tab)).comparison;
  const text = "€".repeat(Math.floor(LIMIT / EURO_BYTES) + 1);
  expect(text.length).toBeLessThan(LIMIT);

  const refused = await source.setColumn({
    tab,
    column: "right",
    text,
    version: nextColumnVersion(versions.right),
  });

  expect(refused).toEqual({ ok: false, failure: { kind: "ColumnTooLarge", limit: LIMIT } });
  expect(valueOf(await source.loadTab(tab)).comparison.versions).toEqual({ left: 0, right: 0 });
});

test("a column of exactly the limit is stored", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const tab = await firstTab(source);
  const { versions } = valueOf(await source.loadTab(tab)).comparison;

  const stored = await source.setColumn({
    tab,
    column: "right",
    text: "a".repeat(LIMIT),
    version: nextColumnVersion(versions.right),
  });

  expect(valueOf(stored).versions).toEqual({ left: 0, right: 1 });
});

test("texts matching no case log compare.fixture_miss once and answer no differences; a match answers the case's", async () => {
  const { log, entries } = quietLog();
  const words = committedCase("words");
  const source = createFixtureCompareSource(log, NO_QUERY);
  const tab = await firstTab(source);
  const { versions } = valueOf(await source.loadTab(tab)).comparison;

  const miss = valueOf(
    await source.setColumn({
      tab,
      column: "left",
      text: words.left,
      version: nextColumnVersion(versions.left),
    }),
  );

  expect(miss.differences).toEqual([]);
  expect(entries).toEqual([
    {
      level: "info",
      event: "compare.fixture_miss",
      fields: { tab, left: words.left.length, right: 0 },
    },
  ]);

  const hit = valueOf(
    await source.setColumn({
      tab,
      column: "right",
      text: words.right,
      version: nextColumnVersion(versions.right),
    }),
  );

  expect(hit.differences).toEqual(words.differences);
  expect(entries).toHaveLength(1);
});

test("every tab command answers UnknownTab for an id that is not listed", async () => {
  const source = createFixtureCompareSource(quietLog().log, NO_QUERY);
  const tab = await firstTab(source);
  const { versions } = valueOf(await source.loadTab(tab)).comparison;
  const fresh = valueOf(await source.addTab()).shown;
  await source.closeTab(fresh);
  const unknown = { ok: false, failure: { kind: "UnknownTab", tab: fresh } };
  const version = nextColumnVersion(versions.left);

  expect(await source.loadTab(fresh)).toEqual(unknown);
  expect(await source.setColumn({ tab: fresh, column: "left", text: "x", version })).toEqual(
    unknown,
  );
  expect(await source.closeTab(fresh)).toEqual(unknown);
  expect(await source.renameTab(fresh, "x")).toEqual(unknown);
  expect(await source.setTabLanguage(fresh, { kind: "auto" })).toEqual(unknown);
  expect(await source.showTab(fresh)).toEqual(unknown);
});

test.each([
  ["a missing right", { left: "a\n", differences: [] }, 'Invalid key: Expected "right"'],
  ["a text that is not a string", { left: 1, right: "", differences: [] }, "left"],
  [
    "a negative left line",
    {
      left: "a\n",
      right: "b\n",
      differences: [
        {
          left: { start: -1, len: 1 },
          right: { start: 0, len: 1 },
          words: { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } },
        },
      ],
    },
    "differences[0].left.start must be a non-negative safe integer, got -1",
  ],
])("a case file with %s fails the parse, naming the file", (_case, json, detail) => {
  const files = { "bad.json": json };

  expect(() => createFixtureCompareSource(quietLog().log, NO_QUERY, files)).toThrow(
    /^compare fixture bad\.json: /,
  );
  expect(() => createFixtureCompareSource(quietLog().log, NO_QUERY, files)).toThrow(detail);
});
