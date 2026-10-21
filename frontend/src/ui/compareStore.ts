import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  Column,
  ColumnVersion,
  CompareSource,
  Comparison,
  SourceResult,
  TabEntry,
  TabId,
  TabLanguage,
  TabList,
  TabTexts,
  Theme,
} from "../ipc";
import { createAsking, type Asking } from "./asking";
import { createCompareNotices, type CompareNotices, type ShownNotice } from "./compareNotices";
import { tabName } from "./compareText";
import { fileListKey, type KeyPress } from "./fileListKey";
import type { NoticeRow } from "./noticeText";
import { attempt, report, type Problem } from "./problem";
import type { Question } from "./question";
import type { Screen } from "./screen";
import { preferencesOf, settingsActions, startSettings } from "./settings";
import type { SettingsActions, SettingsInUse } from "./settings";
import { registerSettingsStore, type SettingsStore } from "./settingsStore";
import type { Preferences } from "./useMergeController";

export type ColumnSend = {
  readonly column: Column;
  readonly text: string;
  readonly version: ColumnVersion;
};

export type { ColumnFormatFailure } from "./compareNotices";

export type TrackedTab = {
  readonly unsent: () => readonly ColumnSend[];
  readonly holdsText: () => boolean;
};

export type CompareStore = SettingsStore &
  CompareNotices & {
    readonly tabs: Readonly<ShallowRef<readonly TabEntry[]>>;
    readonly shown: Readonly<ShallowRef<TabId | null>>;
    readonly columnLimit: Readonly<ShallowRef<number>>;
    readonly detected: Readonly<ShallowRef<ReadonlyMap<TabId, string | null>>>;
    readonly problem: Readonly<ShallowRef<Problem | null>>;
    readonly notices: Readonly<ShallowRef<readonly NoticeRow[]>>;
    readonly question: ComputedRef<Question | null>;
    readonly screen: Readonly<ShallowRef<Screen>>;
    readonly fileListShown: ShallowRef<boolean>;
    readonly preferences: ComputedRef<Preferences>;
    startUp(): Promise<void>;
    loadSettings(): Promise<void>;
    addTab(): Promise<void>;
    showTab(tab: TabId): Promise<void>;
    closeTab(tab: TabId): Promise<void>;
    renameTab(tab: TabId, name: string): Promise<void>;
    setLanguage(tab: TabId, language: TabLanguage): Promise<void>;
    loadTab(tab: TabId): Promise<TabTexts | null>;
    saveColumn(tab: TabId, send: ColumnSend): Promise<Comparison | null>;
    track(tab: TabId, handle: TrackedTab): () => void;
    flushAll(): Promise<void>;
    setDetected(tab: TabId, language: string | null): void;
    fileListKey(event: KeyPress, platform: string): void;
    dismissProblem(): void;
    answer(yes: boolean): void;
    dismissQuestion(): void;
  };

type Refs = {
  readonly tabs: ShallowRef<readonly TabEntry[]>;
  readonly shown: ShallowRef<TabId | null>;
  readonly columnLimit: ShallowRef<number>;
  readonly detected: ShallowRef<ReadonlyMap<TabId, string | null>>;
  readonly problem: ShallowRef<Problem | null>;
  readonly notices: ShallowRef<readonly ShownNotice[]>;
  readonly screen: ShallowRef<Screen>;
  readonly settings: ShallowRef<SettingsInUse>;
  readonly fileListShown: ShallowRef<boolean>;
};

type State = Refs & {
  readonly source: CompareSource;
  readonly asking: Asking;
  readonly tracked: Map<TabId, TrackedTab>;
  latestSettings: number;
};

let store: CompareStore | null = null;

function createRefs(startTheme: Theme): Refs {
  return {
    tabs: shallowRef<readonly TabEntry[]>([]),
    shown: shallowRef<TabId | null>(null),
    columnLimit: shallowRef(0),
    detected: shallowRef<ReadonlyMap<TabId, string | null>>(new Map()),
    problem: shallowRef<Problem | null>(null),
    notices: shallowRef<readonly ShownNotice[]>([]),
    screen: shallowRef<Screen>({ kind: "files" }),
    settings: shallowRef(startSettings(startTheme)),
    fileListShown: shallowRef(true),
  };
}

export function createCompareStore(source: CompareSource, startTheme: Theme): CompareStore {
  const refs = createRefs(startTheme);
  const state: State = {
    ...refs,
    source,
    asking: createAsking(),
    tracked: new Map(),
    latestSettings: 0,
  };
  const settings = settingsActions(state);
  const created: CompareStore = {
    ...refs,
    question: state.asking.question,
    preferences: computed(() => preferencesOf(refs.settings.value)),
    ...settings,
    startUp: () => startUp(state, settings),
    ...tabActions(state),
    ...columnActions(state),
    ...createCompareNotices(state),
    ...chromeActions(state),
    openSettings: () => {
      refs.screen.value = { kind: "settings" };
    },
    closeSettings: () => {
      refs.screen.value = { kind: "files" };
    },
  };
  store = created;
  registerSettingsStore(created);
  return created;
}

function chromeActions(
  state: State,
): Pick<
  CompareStore,
  "dismissProblem" | "setDetected" | "fileListKey" | "answer" | "dismissQuestion"
> {
  return {
    dismissProblem: () => {
      state.problem.value = null;
    },
    setDetected: (tab, language) => {
      state.detected.value = new Map(state.detected.value).set(tab, language);
    },
    fileListKey: (event, platform) => {
      fileListKey(state, event, platform);
    },
    answer: state.asking.answer,
    dismissQuestion: state.asking.dismiss,
  };
}

function adoptList(state: State, { tabs, shown }: TabList): void {
  state.tabs.value = tabs;
  state.shown.value = shown;
  if (state.problem.value?.action === "tabs") {
    state.problem.value = null;
  }
}

async function startUp(state: State, settings: SettingsActions): Promise<void> {
  const [outcome] = await Promise.all([
    attempt(() => state.source.openCompare()),
    settings.loadSettings(),
  ]);
  if (!outcome.ok) {
    report(state, { action: "tabs", cause: outcome.cause });
    return;
  }
  state.columnLimit.value = outcome.value.columnLimit;
  adoptList(state, outcome.value.list);
}

async function changeTabs(
  state: State,
  call: () => Promise<SourceResult<TabList>>,
): Promise<boolean> {
  const outcome = await attempt(call);
  if (!outcome.ok) {
    report(state, { action: "tabs", cause: outcome.cause });
    return false;
  }
  adoptList(state, outcome.value);
  return true;
}

async function closeTab(state: State, tab: TabId): Promise<void> {
  const entry = state.tabs.value.find((each) => each.id === tab);
  if (entry === undefined) {
    return;
  }
  const handle = state.tracked.get(tab);
  const holdsText = handle === undefined ? entry.holdsText : handle.holdsText();
  if (holdsText && (await state.asking.ask({ kind: "closeTab", name: entry.name })) !== "yes") {
    return;
  }
  if (await changeTabs(state, () => state.source.closeTab(tab))) {
    state.tracked.delete(tab);
  }
}

function tabActions(
  state: State,
): Pick<CompareStore, "addTab" | "showTab" | "closeTab" | "renameTab" | "setLanguage"> {
  const { source } = state;
  return {
    addTab: async () => {
      await changeTabs(state, () => source.addTab());
    },
    showTab: async (tab) => {
      await changeTabs(state, () => source.showTab(tab));
    },
    closeTab: (tab) => closeTab(state, tab),
    renameTab: async (tab, name) => {
      await changeTabs(state, () => source.renameTab(tab, name));
    },
    setLanguage: async (tab, language) => {
      await changeTabs(state, () => source.setTabLanguage(tab, language));
    },
  };
}

async function loadTab(state: State, tab: TabId): Promise<TabTexts | null> {
  const name = tabName(state.tabs.value, tab);
  const outcome = await attempt(() => state.source.loadTab(tab));
  if (!outcome.ok) {
    report(state, { action: "loadTab", name, cause: outcome.cause });
    return null;
  }
  return outcome.value;
}

async function saveColumn(state: State, tab: TabId, send: ColumnSend): Promise<Comparison | null> {
  const { column } = send;
  const name = tabName(state.tabs.value, tab);
  const outcome = await attempt(() => state.source.setColumn({ tab, ...send }));
  if (!outcome.ok) {
    report(state, { action: "saveTab", tab, column, name, cause: outcome.cause });
    return null;
  }
  const problem = state.problem.value;
  if (problem?.action === "saveTab" && problem.tab === tab && problem.column === column) {
    state.problem.value = null;
  }
  return outcome.value;
}

function columnActions(
  state: State,
): Pick<CompareStore, "loadTab" | "saveColumn" | "track" | "flushAll"> {
  return {
    loadTab: (tab) => loadTab(state, tab),
    saveColumn: (tab, send) => saveColumn(state, tab, send),
    track: (tab, handle) => {
      state.tracked.set(tab, handle);
      return () => {
        if (state.tracked.get(tab) === handle) {
          state.tracked.delete(tab);
        }
      };
    },
    flushAll: async () => {
      const sends = [...state.tracked].flatMap(([tab, handle]) =>
        handle.unsent().map((send) => saveColumn(state, tab, send)),
      );
      await Promise.all(sends);
    },
  };
}

export function useCompareStore(): CompareStore {
  if (store === null) {
    throw new Error("useCompareStore() called before createCompareStore()");
  }
  return store;
}
