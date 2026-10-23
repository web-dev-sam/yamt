import * as v from "valibot";

import type * as Generated from "./bindings";
import {
  toColumnVersions,
  toCompareStart,
  toDifferences,
  toTabList,
  type Column,
  type ColumnWrite,
  type Comparison,
  type Difference,
  type TabLanguage,
  type TabList,
  type TabTexts,
} from "./compareDomain";
import type { CompareSource } from "./CompareSource";
import type { SourceResult } from "./domain";
import { LINE_RANGE, parsedFixture, SIDE_WORD_CHANGES } from "./fixture";
import { createFixtureSettings } from "./fixtureSettings";
import type { Log } from "./log";

type Case = {
  readonly left: string;
  readonly right: string;
  readonly differences: readonly Difference[];
};

type FixtureTab = {
  readonly id: number;
  readonly number: number;
  name: string;
  language: TabLanguage;
  readonly texts: Record<Column, string>;
  readonly versions: Record<Column, number>;
};

type Tabs = { readonly list: FixtureTab[]; shown: number; nextId: number };

type Context = {
  readonly log: Log;
  readonly cases: ReadonlyMap<string, Case>;
  readonly tabs: Tabs;
};

// Stryker disable all: Vite needs import.meta.glob arguments as literals
const CASE_FILES: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../fixtures/compare/*.json",
  { eager: true, import: "default" },
);
// Stryker restore all

const COLUMN_LIMIT_BYTES = 8_388_608;

const FIRST_TAB_ID = 1;

const CASE = v.object({
  differences: v.array(
    v.object({
      left: LINE_RANGE,
      right: LINE_RANGE,
      words: v.object({ left: SIDE_WORD_CHANGES, right: SIDE_WORD_CHANGES }),
    }),
  ),
  left: v.string(),
  right: v.string(),
});

function parseCases(files: Readonly<Record<string, unknown>>): Map<string, Case> {
  return new Map(
    Object.entries(files).map(([file, json]) => [
      file.replace(/^.*\//u, "").replace(/\.json$/u, ""),
      parsedFixture(CASE, `compare fixture ${file}`, json, ({ left, right, differences }) => ({
        left,
        right,
        differences: toDifferences(differences),
      })),
    ]),
  );
}

function addTab(tabs: Tabs): FixtureTab {
  const number = Math.max(0, ...tabs.list.map((tab) => tab.number)) + 1;
  const tab: FixtureTab = {
    id: tabs.nextId,
    number,
    name: `Compare ${number}`,
    language: { kind: "auto" },
    texts: { left: "", right: "" },
    versions: { left: 0, right: 0 },
  };
  tabs.nextId += 1;
  tabs.list.push(tab);
  tabs.shown = tab.id;
  return tab;
}

function firstTabs(
  caseName: string | null,
  cases: ReadonlyMap<string, Case>,
): { readonly tabs: Tabs; readonly first: FixtureTab } {
  const tabs: Tabs = { list: [], shown: FIRST_TAB_ID, nextId: FIRST_TAB_ID };
  const first = addTab(tabs);
  if (caseName === null || caseName === "") {
    return { tabs, first };
  }
  const shown = cases.get(caseName);
  if (shown === undefined) {
    throw new Error(`no compare fixture ${caseName}; known: ${[...cases.keys()].join(", ")}`);
  }
  first.texts.left = shown.left;
  first.texts.right = shown.right;
  return { tabs, first };
}

function tabListDto(tabs: Tabs): Generated.TabList {
  return {
    tabs: tabs.list.map(({ id, name, language, texts }) => ({
      id,
      name,
      language,
      holds_text: texts.left !== "" || texts.right !== "",
    })),
    shown: tabs.shown,
  };
}

function listed(tabs: Tabs): SourceResult<TabList> {
  return { ok: true, value: toTabList(tabListDto(tabs)) };
}

function withTab<T>(
  tabs: Tabs,
  tab: number,
  act: (found: FixtureTab) => SourceResult<T>,
): SourceResult<T> {
  const found = tabs.list.find((each) => each.id === tab);
  return found === undefined ? { ok: false, failure: { kind: "UnknownTab", tab } } : act(found);
}

function differencesOf(
  cases: ReadonlyMap<string, Case>,
  texts: Readonly<Record<Column, string>>,
): readonly Difference[] | undefined {
  return [...cases.values()].find((each) => each.left === texts.left && each.right === texts.right)
    ?.differences;
}

function tabTexts(cases: ReadonlyMap<string, Case>, { texts, versions }: FixtureTab): TabTexts {
  const differences = differencesOf(cases, texts) ?? [];
  const comparison = { versions: toColumnVersions(versions), differences };
  return { left: texts.left, right: texts.right, comparison };
}

function closeTab(tabs: Tabs, tab: number): SourceResult<TabList> {
  const position = tabs.list.findIndex((each) => each.id === tab);
  if (position === -1) {
    return { ok: false, failure: { kind: "UnknownTab", tab } };
  }
  tabs.list.splice(position, 1);
  const next = tabs.list[Math.min(position, tabs.list.length - 1)];
  if (next === undefined) {
    addTab(tabs);
  } else if (tabs.shown === tab) {
    tabs.shown = next.id;
  }
  return listed(tabs);
}

function setColumn({ log, cases, tabs }: Context, write: ColumnWrite): SourceResult<Comparison> {
  return withTab(tabs, write.tab, (found) => {
    const { column, text, version } = write;
    if (version > found.versions[column]) {
      if (new TextEncoder().encode(text).length > COLUMN_LIMIT_BYTES) {
        return { ok: false, failure: { kind: "ColumnTooLarge", limit: COLUMN_LIMIT_BYTES } };
      }
      found.texts[column] = text;
      found.versions[column] = version;
    }
    const differences = differencesOf(cases, found.texts);
    if (differences === undefined) {
      const { left, right } = found.texts;
      log.info("compare.fixture_miss", { tab: found.id, left: left.length, right: right.length });
    }
    const versions = toColumnVersions(found.versions);
    return { ok: true, value: { versions, differences: differences ?? [] } };
  });
}

function tabActions(
  tabs: Tabs,
): Pick<CompareSource, "addTab" | "closeTab" | "renameTab" | "setTabLanguage" | "showTab"> {
  return {
    async addTab() {
      addTab(tabs);
      return listed(tabs);
    },
    async closeTab(tab) {
      return closeTab(tabs, tab);
    },
    async renameTab(tab, name) {
      return withTab(tabs, tab, (found) => {
        const trimmed = name.trim();
        if (trimmed !== "") {
          found.name = trimmed;
        }
        return listed(tabs);
      });
    },
    async setTabLanguage(tab, language) {
      return withTab(tabs, tab, (found) => {
        found.language = language;
        return listed(tabs);
      });
    },
    async showTab(tab) {
      return withTab(tabs, tab, () => {
        tabs.shown = tab;
        return listed(tabs);
      });
    },
  };
}

export function createFixtureCompareSource(
  log: Log,
  search: string,
  files: Readonly<Record<string, unknown>> = CASE_FILES,
): CompareSource {
  const cases = parseCases(files);
  const { tabs } = firstTabs(new URLSearchParams(search).get("diff"), cases);
  return {
    async openCompare() {
      const start = { list: tabListDto(tabs), column_limit: COLUMN_LIMIT_BYTES };
      return { ok: true, value: toCompareStart(start) };
    },
    async loadTab(tab) {
      return withTab(tabs, tab, (found) => ({ ok: true, value: tabTexts(cases, found) }));
    },
    async setColumn(write) {
      return setColumn({ log, cases, tabs }, write);
    },
    ...tabActions(tabs),
    ...createFixtureSettings(),
  };
}

export async function loadCompareFixture(
  name: string,
  files: Readonly<Record<string, unknown>> = CASE_FILES,
): Promise<TabTexts> {
  const cases = parseCases(files);
  return tabTexts(cases, firstTabs(name, cases).first);
}
