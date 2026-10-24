import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type { RangeEntry, RangeFile, RangeFileId, RangeSource, RangeStart, Theme } from "../ipc";
import { createAsking, type Asking } from "./asking";
import { fileListKey, type KeyPress } from "./fileListKey";
import { attempt, report, type Problem } from "./problem";
import type { Question } from "./question";
import type { Screen } from "./screen";
import { preferencesOf, settingsActions, startSettings } from "./settings";
import type { SettingsActions, SettingsInUse } from "./settings";
import { registerSettingsStore, type SettingsStore } from "./settingsStore";
import type { Preferences } from "./useMergeController";

export type RangeStore = SettingsStore & {
  readonly start: Readonly<ShallowRef<RangeStart | null>>;
  readonly shown: Readonly<ShallowRef<RangeFileId | null>>;
  readonly shownPath: ComputedRef<string | null>;
  readonly visited: Readonly<ShallowRef<readonly RangeEntry[]>>;
  readonly problem: Readonly<ShallowRef<Problem | null>>;
  readonly question: ComputedRef<Question | null>;
  readonly screen: Readonly<ShallowRef<Screen>>;
  readonly fileListShown: ShallowRef<boolean>;
  readonly preferences: ComputedRef<Preferences>;
  startUp(): Promise<void>;
  loadSettings(): Promise<void>;
  showFile(path: string): void;
  loadFile(file: RangeFileId): Promise<RangeFile | null>;
  fileListKey(event: KeyPress, platform: string): void;
  dismissProblem(): void;
  answer(yes: boolean): void;
  dismissQuestion(): void;
};

type Refs = {
  readonly start: ShallowRef<RangeStart | null>;
  readonly shown: ShallowRef<RangeFileId | null>;
  readonly visited: ShallowRef<readonly RangeEntry[]>;
  readonly problem: ShallowRef<Problem | null>;
  readonly screen: ShallowRef<Screen>;
  readonly settings: ShallowRef<SettingsInUse>;
  readonly fileListShown: ShallowRef<boolean>;
};

type State = Refs & {
  readonly source: RangeSource;
  readonly asking: Asking;
  recent: readonly RangeFileId[];
  latestSettings: number;
};

export const MOUNTED_FILES = 16;

const RANGE_WORD = "the range";

let store: RangeStore | null = null;

function createRefs(startTheme: Theme): Refs {
  return {
    start: shallowRef<RangeStart | null>(null),
    shown: shallowRef<RangeFileId | null>(null),
    visited: shallowRef<readonly RangeEntry[]>([]),
    problem: shallowRef<Problem | null>(null),
    screen: shallowRef<Screen>({ kind: "files" }),
    settings: shallowRef(startSettings(startTheme)),
    fileListShown: shallowRef(true),
  };
}

export function createRangeStore(source: RangeSource, startTheme: Theme): RangeStore {
  const refs = createRefs(startTheme);
  const state: State = { ...refs, source, asking: createAsking(), recent: [], latestSettings: 0 };
  const settings = settingsActions(state);
  const created: RangeStore = {
    ...refs,
    shownPath: computed(() => entryOf(state, refs.shown.value)?.path ?? null),
    question: state.asking.question,
    preferences: computed(() => preferencesOf(refs.settings.value)),
    ...settings,
    startUp: () => startUp(state, settings),
    showFile: (path) => {
      const entry = state.start.value?.files.find((file) => file.path === path);
      if (entry !== undefined) {
        show(state, entry);
      }
    },
    loadFile: (file) => loadFile(state, file),
    ...chromeActions(state),
  };
  store = created;
  registerSettingsStore(created);
  return created;
}

function chromeActions(
  state: State,
): Pick<
  RangeStore,
  "fileListKey" | "dismissProblem" | "answer" | "dismissQuestion" | "openSettings" | "closeSettings"
> {
  return {
    fileListKey: (event, platform) => {
      fileListKey(state, event, platform);
    },
    dismissProblem: () => {
      state.problem.value = null;
    },
    answer: state.asking.answer,
    dismissQuestion: state.asking.dismiss,
    openSettings: () => {
      state.screen.value = { kind: "settings" };
    },
    closeSettings: () => {
      state.screen.value = { kind: "files" };
    },
  };
}

function entryOf(state: State, file: RangeFileId | null): RangeEntry | undefined {
  return state.start.value?.files.find((entry) => entry.id === file);
}

function show(state: State, entry: RangeEntry): void {
  const { id } = entry;
  state.screen.value = { kind: "files" };
  state.shown.value = id;
  state.recent = [...state.recent.filter((each) => each !== id), id];
  if (state.visited.value.some((each) => each.id === id)) {
    return;
  }
  const [oldest, ...kept] = state.recent;
  const visited = [...state.visited.value, entry];
  if (visited.length > MOUNTED_FILES) {
    state.recent = kept;
    state.visited.value = visited.filter((each) => each.id !== oldest);
  } else {
    state.visited.value = visited;
  }
}

function forget(state: State, file: RangeFileId): void {
  state.recent = state.recent.filter((each) => each !== file);
  state.visited.value = state.visited.value.filter((each) => each.id !== file);
}

async function startUp(state: State, settings: SettingsActions): Promise<void> {
  const [outcome] = await Promise.all([
    attempt(() => state.source.openRange()),
    settings.loadSettings(),
  ]);
  if (!outcome.ok) {
    report(state, { action: "open", path: RANGE_WORD, cause: outcome.cause });
    return;
  }
  state.start.value = outcome.value;
  const [first] = outcome.value.files;
  if (first !== undefined) {
    show(state, first);
  }
}

async function loadFile(state: State, file: RangeFileId): Promise<RangeFile | null> {
  const path = entryOf(state, file)?.path ?? `file ${file}`;
  const outcome = await attempt(() => state.source.loadRangeFile(file));
  if (!outcome.ok) {
    forget(state, file);
    report(state, { action: "open", path, cause: outcome.cause });
    return null;
  }
  const problem = state.problem.value;
  if (problem?.action === "open" && problem.path === path) {
    state.problem.value = null;
  }
  return outcome.value;
}

export function useRangeStore(): RangeStore {
  if (store === null) {
    throw new Error("useRangeStore() called before createRangeStore()");
  }
  return store;
}
