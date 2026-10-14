import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  pressesKey,
  type ChunkSource,
  type DiskVersion,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type Side,
  type SideNames,
  type Theme,
} from "../ipc";
import type { LanguageServers } from "../lsp";
import { createAsking, type Asking } from "./asking";
import { createCloseGuard, type CloseGuard } from "./closeGuard";
import { createCollapsing, type Collapsing } from "./collapsing";
import { loadSideNames, refreshFiles } from "./listing";
import { nextUnresolved } from "./nextFile";
import type { Notice } from "./noticeText";
import { attempt, clearProblemAbout, logProblem, report } from "./problem";
import type { Problem } from "./problem";
import type { Question } from "./question";
import { afterWrite, createSaving, finish, whileWriting } from "./saving";
import type { FinishRequest, Saving, Writing } from "./saving";
import { createServers, type Screen, type Servers } from "./servers";
import { preferencesOf, settingsActions, startSettings } from "./settings";
import type { SettingsActions, SettingsInUse } from "./settings";
import type { Taken } from "./sides";
import { createHiddenButtons, type HiddenButtons, type ToolbarButtonId } from "./toolbarButtons";
import type { Preferences } from "./useMergeController";
import { fetchView, isShown, reload } from "./views";

type KeyPress = Parameters<typeof pressesKey>[0] &
  Pick<KeyboardEvent, "defaultPrevented" | "preventDefault">;

type Refs = {
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly choices: ShallowRef<readonly FileSides[]>;
  readonly taken: ShallowRef<ReadonlyMap<string, Taken>>;
  readonly notices: ShallowRef<readonly Notice[]>;
  readonly sideNames: ShallowRef<SideNames>;
  readonly active: ShallowRef<string | null>;
  readonly problem: ShallowRef<Problem | null>;
  readonly screen: ShallowRef<Screen>;
  readonly settings: ShallowRef<SettingsInUse>;
  readonly fileListShown: ShallowRef<boolean>;
};

type State = Refs &
  Writing & {
    readonly source: ChunkSource;
    readonly asking: Asking;
    readonly guard: CloseGuard;
    latestOpen: number;
    latestSettings: number;
  };

type Actions = CloseGuard &
  SettingsActions & {
    loadFiles(): Promise<void>;
    refreshFiles(): Promise<void>;
    loadSideNames(): Promise<void>;
    open(path: string): Promise<void>;
    pick(path: string): Promise<void>;
    finish(request: FinishRequest): Promise<void>;
    takeSide(path: string, side: Side, diskVersion: DiskVersion): Promise<void>;
    reset(path: string, diskVersion: DiskVersion): Promise<void>;
    dismissProblem(): void;
    dismissNotice(path: string): void;
    openSettings(): void;
    closeSettings(): void;
    answer(yes: boolean): void;
    toggleButton(id: ToolbarButtonId): void;
    fileListKey(event: KeyPress, platform: string): void;
  };

export type AppStore = { readonly [K in keyof Refs]: Readonly<Refs[K]> } & {
  readonly question: ComputedRef<Question | null>;
  readonly allResolved: ComputedRef<boolean>;
  readonly preferences: ComputedRef<Preferences>;
  readonly hiddenButtons: HiddenButtons["hidden"];
} & Actions &
  Collapsing &
  Saving &
  Servers;

let store: AppStore | null = null;

function createRefs(startTheme: Theme): Refs {
  return {
    files: shallowRef<readonly FileEntry[]>([]),
    opened: shallowRef<readonly FileMergeData[]>([]),
    choices: shallowRef<readonly FileSides[]>([]),
    taken: shallowRef<ReadonlyMap<string, Taken>>(new Map()),
    notices: shallowRef<readonly Notice[]>([]),
    sideNames: shallowRef<SideNames>({ local: null, remote: null }),
    active: shallowRef<string | null>(null),
    problem: shallowRef<Problem | null>(null),
    screen: shallowRef<Screen>({ kind: "files" }),
    settings: shallowRef(startSettings(startTheme)),
    fileListShown: shallowRef(true),
  };
}

export function createAppStore(
  source: ChunkSource,
  startTheme: Theme,
  servers: LanguageServers,
): AppStore {
  const refs = createRefs(startTheme);
  const asking = createAsking();
  const guard = createCloseGuard(asking, refs.opened);
  const buttons = createHiddenButtons();
  const state: State = {
    ...refs,
    source,
    asking,
    guard,
    writing: new Map(),
    latestOpen: 0,
    latestSettings: 0,
  };
  const { files, settings } = refs;
  store = {
    ...refs,
    question: asking.question,
    allResolved: computed(
      () => files.value.length > 0 && files.value.every((file) => file.status === "Resolved"),
    ),
    preferences: computed(() => preferencesOf(settings.value)),
    hiddenButtons: buttons.hidden,
    ...actions(state, buttons),
    ...createCollapsing(),
    ...createSaving(state),
    ...createServers(refs.screen, servers),
  };
  return store;
}

function actions(state: State, buttons: HiddenButtons): Actions {
  return {
    loadFiles: () => loadFiles(state),
    refreshFiles: async () => {
      await refreshFiles(state, "running");
    },
    loadSideNames: () => loadSideNames(state),
    open: (path) => open(state, path),
    pick: async (path) => {
      state.screen.value = { kind: "files" };
      await open(state, path);
    },
    finish: (request) => finishThenMoveOn(state, request),
    takeSide: (path, side, diskVersion) => takeSide(state, path, side, diskVersion),
    reset: (path, diskVersion) => reset(state, path, diskVersion),
    dismissProblem: () => {
      state.problem.value = null;
    },
    dismissNotice: (path) => {
      state.notices.value = state.notices.value.filter((notice) => notice.path !== path);
    },
    openSettings: () => {
      state.screen.value = { kind: "settings" };
    },
    closeSettings: () => {
      state.screen.value = { kind: "files" };
    },
    answer: state.asking.answer,
    toggleButton: buttons.toggle,
    fileListKey: (event, platform) => {
      fileListKey(state, event, platform);
    },
    track: state.guard.track,
    untrack: state.guard.untrack,
    unsavedFiles: state.guard.unsavedFiles,
    mayClose: state.guard.mayClose,
    watchWindowClose: state.guard.watchWindowClose,
    ...settingsActions(state),
  };
}

async function loadFiles(state: State): Promise<void> {
  const listed = await refreshFiles(state, "start");
  const first = listed?.find((file) => file.unsupported === null) ?? listed?.[0];
  if (first !== undefined) {
    await open(state, first.path);
  }
}

async function finishThenMoveOn(state: State, request: FinishRequest): Promise<void> {
  const opensBefore = state.latestOpen;
  if (await finish(state, request)) {
    await moveOn(state, request.path, opensBefore);
  }
}

async function open(state: State, path: string): Promise<void> {
  if (!isShown(state, path)) {
    await load(state, path);
    return;
  }
  if (path === state.active.value) {
    return;
  }
  state.latestOpen += 1;
  state.active.value = path;
  state.problem.value = null;
}

async function load(state: State, path: string): Promise<void> {
  state.latestOpen += 1;
  const ticket = state.latestOpen;
  const view = await fetchView(state, path);
  const current = ticket === state.latestOpen;
  if (!view.ok) {
    const failure: Problem = { action: "open", path, cause: view.cause };
    logProblem(failure);
    if (current) {
      state.problem.value = failure;
    }
    return;
  }
  if (current) {
    view.value();
    state.active.value = path;
    state.problem.value = null;
  }
}

async function moveOn(state: State, path: string, opensBefore: number): Promise<void> {
  const untouched = state.active.value === path && state.latestOpen === opensBefore;
  const next = untouched ? nextUnresolved(state.files.value, path) : null;
  if (next !== null) {
    await open(state, next);
  }
}

async function takeSide(
  state: State,
  path: string,
  side: Side,
  diskVersion: DiskVersion,
): Promise<void> {
  const opensBefore = state.latestOpen;
  const outcome = await attempt(() => state.source.takeSide(path, side, diskVersion));
  if (!outcome.ok) {
    report(state, { action: "take", path, cause: outcome.cause });
    return;
  }
  if (!(await afterWrite(state, path, outcome.value))) {
    return;
  }
  state.taken.value = new Map([...state.taken.value, [path, { by: "side", side }]]);
  clearProblemAbout(state, path);
  if (state.opened.value.some((file) => file.path === path)) {
    await reload(state, path);
  }
  await moveOn(state, path, opensBefore);
}

async function reset(state: State, path: string, diskVersion: DiskVersion): Promise<void> {
  await whileWriting(state, path, async () => {
    const outcome = await attempt(() => state.source.resetFile(path, diskVersion));
    if (!outcome.ok) {
      report(state, { action: "reset", path, cause: outcome.cause });
      return;
    }
    if (!(await afterWrite(state, path, outcome.value))) {
      return;
    }
    state.choices.value = state.choices.value.filter((sides) => sides.path !== path);
    state.taken.value = new Map([...state.taken.value].filter(([taken]) => taken !== path));
    if (await reload(state, path)) {
      clearProblemAbout(state, path);
    }
  });
}

function fileListKey(state: State, event: KeyPress, platform: string): void {
  if (
    event.defaultPrevented ||
    state.asking.question.value !== null ||
    !pressesKey(event, state.settings.value.keys.bindings["toggle-file-list"], platform)
  ) {
    return;
  }
  event.preventDefault();
  state.fileListShown.value = !state.fileListShown.value;
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}
