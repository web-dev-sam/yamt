import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  log,
  type ChunkSource,
  type DiskChange,
  type DiskVersion,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type RemoteName,
  type Side,
  type Theme,
} from "../ipc";
import { createAsking, type Asking } from "./asking";
import { createCloseGuard, type CloseGuard } from "./closeGuard";
import { applyDiskChanges } from "./diskChanges";
import { nextUnresolved } from "./nextFile";
import type { Notice } from "./noticeText";
import { attempt, clearProblemAbout, logProblem, report, unexpected } from "./problem";
import type { Problem } from "./problem";
import { finishMustAsk, type Question } from "./question";
import { preferencesOf, settingsActions, startSettings } from "./settings";
import type { SettingsActions, SettingsInUse } from "./settings";
import type { Taken } from "./sides";
import type { MergeSummary, Preferences } from "./useMergeController";
import { fetchView, isShown, reload } from "./views";

type FinishRequest = Parameters<ChunkSource["finishFile"]>[0] & {
  readonly summary: MergeSummary;
};

type Refs = {
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly choices: ShallowRef<readonly FileSides[]>;
  readonly taken: ShallowRef<ReadonlyMap<string, Taken>>;
  readonly notices: ShallowRef<readonly Notice[]>;
  readonly remoteName: ShallowRef<RemoteName | null>;
  readonly active: ShallowRef<string | null>;
  readonly problem: ShallowRef<Problem | null>;
  readonly settingsOpen: ShallowRef<boolean>;
  readonly settings: ShallowRef<SettingsInUse>;
};

type State = Refs & {
  readonly source: ChunkSource;
  readonly asking: Asking;
  readonly guard: CloseGuard;
  latestOpen: number;
  latestSettings: number;
};

type Actions = Omit<CloseGuard, "markSaved"> &
  SettingsActions & {
    loadFiles(): Promise<void>;
    refreshFiles(): Promise<void>;
    loadRemoteName(): Promise<void>;
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
  };

export type AppStore = { readonly [K in keyof Refs]: Readonly<Refs[K]> } & {
  readonly question: ComputedRef<Question | null>;
  readonly allResolved: ComputedRef<boolean>;
  readonly preferences: ComputedRef<Preferences>;
} & Actions;

let store: AppStore | null = null;

export function createAppStore(source: ChunkSource, startTheme: Theme): AppStore {
  const refs: Refs = {
    files: shallowRef<readonly FileEntry[]>([]),
    opened: shallowRef<readonly FileMergeData[]>([]),
    choices: shallowRef<readonly FileSides[]>([]),
    taken: shallowRef<ReadonlyMap<string, Taken>>(new Map()),
    notices: shallowRef<readonly Notice[]>([]),
    remoteName: shallowRef<RemoteName | null>(null),
    active: shallowRef<string | null>(null),
    problem: shallowRef<Problem | null>(null),
    settingsOpen: shallowRef(false),
    settings: shallowRef(startSettings(startTheme)),
  };
  const asking = createAsking();
  const guard = createCloseGuard(asking, refs.opened);
  const state: State = { ...refs, source, asking, guard, latestOpen: 0, latestSettings: 0 };
  const { files, settings } = refs;
  store = {
    ...refs,
    question: asking.question,
    allResolved: computed(
      () => files.value.length > 0 && files.value.every((file) => file.status === "Resolved"),
    ),
    preferences: computed(() => preferencesOf(settings.value)),
    ...actions(state),
  };
  return store;
}

function actions(state: State): Actions {
  return {
    loadFiles: () => loadFiles(state),
    refreshFiles: async () => {
      await refreshFiles(state, "running");
    },
    loadRemoteName: () => loadRemoteName(state),
    open: (path) => open(state, path),
    pick: async (path) => {
      state.settingsOpen.value = false;
      await open(state, path);
    },
    finish: (request) => finish(state, request),
    takeSide: (path, side, diskVersion) => takeSide(state, path, side, diskVersion),
    reset: (path, diskVersion) => reset(state, path, diskVersion),
    dismissProblem: () => {
      state.problem.value = null;
    },
    dismissNotice: (path) => {
      state.notices.value = state.notices.value.filter((notice) => notice.path !== path);
    },
    openSettings: () => {
      state.settingsOpen.value = true;
    },
    closeSettings: () => {
      state.settingsOpen.value = false;
    },
    answer: state.asking.answer,
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

async function refreshFiles(
  state: State,
  when: Notice["when"],
): Promise<readonly FileEntry[] | null> {
  const listed = await attempt(() => state.source.listFiles());
  if (!listed.ok) {
    report(state, { action: "list", cause: listed.cause });
    return null;
  }
  const { files, diskChanges } = listed.value;
  state.files.value = files;
  if (state.problem.value?.action === "list") {
    state.problem.value = null;
  }
  await applyDiskChanges(state, diskChanges, when);
  return files;
}

async function loadRemoteName(state: State): Promise<void> {
  try {
    state.remoteName.value = await state.source.remoteName();
  } catch (error) {
    log.warn("store.remote_name_failed", { ...unexpected(error) });
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

async function changedOnDisk(state: State, path: string, change: DiskChange): Promise<void> {
  clearProblemAbout(state, path);
  await applyDiskChanges(state, [change], "running");
}

async function finish(
  state: State,
  { path, text, summary, diskVersion }: FinishRequest,
): Promise<void> {
  const opensBefore = state.latestOpen;
  const unprocessed: Question = { kind: "unprocessed", summary };
  if (finishMustAsk(summary) && !(await state.asking.ask(unprocessed))) {
    return;
  }
  const outcome = await attempt(() => state.source.finishFile({ path, text, diskVersion }));
  if (!outcome.ok) {
    report(state, { action: "finish", path, cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  state.files.value = reply.files;
  if (reply.kind === "ChangedOnDisk") {
    await changedOnDisk(state, path, reply.change);
    return;
  }
  state.guard.markSaved(path, text);
  state.problem.value = null;
  await moveOn(state, path, opensBefore);
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
  const reply = outcome.value;
  state.files.value = reply.files;
  if (reply.kind === "ChangedOnDisk") {
    await changedOnDisk(state, path, reply.change);
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
  const outcome = await attempt(() => state.source.resetFile(path, diskVersion));
  if (!outcome.ok) {
    report(state, { action: "reset", path, cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  state.files.value = reply.files;
  if (reply.kind === "ChangedOnDisk") {
    await changedOnDisk(state, path, reply.change);
    return;
  }
  state.choices.value = state.choices.value.filter((sides) => sides.path !== path);
  state.taken.value = new Map([...state.taken.value].filter(([takenPath]) => takenPath !== path));
  if (await reload(state, path)) {
    clearProblemAbout(state, path);
  }
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}
