import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  log,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type RemoteName,
  type Side,
} from "../ipc";
import { createAsking, type Asking } from "./asking";
import { createCloseGuard, type CloseGuard } from "./closeGuard";
import { nextUnresolved } from "./nextFile";
import { attempt, logProblem, unexpected, type Outcome, type Problem } from "./problem";
import { finishMustAsk, type Question } from "./question";
import type { MergeSummary } from "./useMergeController";

type FinishRequest = {
  readonly path: string;
  readonly text: string;
  readonly summary: MergeSummary;
};

type Refs = {
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly choices: ShallowRef<readonly FileSides[]>;
  readonly taken: ShallowRef<ReadonlyMap<string, Side>>;
  readonly remoteName: ShallowRef<RemoteName | null>;
  readonly active: ShallowRef<string | null>;
  readonly problem: ShallowRef<Problem | null>;
};

type State = Refs & {
  readonly source: ChunkSource;
  readonly asking: Asking;
  readonly guard: CloseGuard;
  latestOpen: number;
};

type Actions = Omit<CloseGuard, "markSaved"> & {
  loadFiles(): Promise<void>;
  refreshFiles(): Promise<void>;
  loadRemoteName(): Promise<void>;
  open(path: string): Promise<void>;
  finish(request: FinishRequest): Promise<void>;
  takeSide(path: string, side: Side): Promise<void>;
  reset(path: string): Promise<void>;
  dismissProblem(): void;
  answer(yes: boolean): void;
};

export type AppStore = { readonly [K in keyof Refs]: Readonly<Refs[K]> } & {
  readonly question: ComputedRef<Question | null>;
  readonly allResolved: ComputedRef<boolean>;
} & Actions;

let store: AppStore | null = null;

export function createAppStore(source: ChunkSource): AppStore {
  const refs: Refs = {
    files: shallowRef<readonly FileEntry[]>([]),
    opened: shallowRef<readonly FileMergeData[]>([]),
    choices: shallowRef<readonly FileSides[]>([]),
    taken: shallowRef<ReadonlyMap<string, Side>>(new Map()),
    remoteName: shallowRef<RemoteName | null>(null),
    active: shallowRef<string | null>(null),
    problem: shallowRef<Problem | null>(null),
  };
  const asking = createAsking();
  const guard = createCloseGuard(asking, refs.opened);
  const state: State = { ...refs, source, asking, guard, latestOpen: 0 };
  const { files } = refs;
  store = {
    ...refs,
    question: asking.question,
    allResolved: computed(
      () => files.value.length > 0 && files.value.every((file) => file.status === "Resolved"),
    ),
    ...actions(state),
  };
  return store;
}

function actions(state: State): Actions {
  return {
    loadFiles: () => loadFiles(state),
    refreshFiles: async () => {
      await refreshFiles(state);
    },
    loadRemoteName: () => loadRemoteName(state),
    open: (path) => open(state, path),
    finish: (request) => finish(state, request),
    takeSide: (path, side) => takeSide(state, path, side),
    reset: (path) => reset(state, path),
    dismissProblem: () => {
      state.problem.value = null;
    },
    answer: state.asking.answer,
    track: state.guard.track,
    untrack: state.guard.untrack,
    unsavedFiles: state.guard.unsavedFiles,
    mayClose: state.guard.mayClose,
    watchWindowClose: state.guard.watchWindowClose,
  };
}

function report(state: State, failure: Problem): void {
  logProblem(failure);
  state.problem.value = failure;
}

function clearProblemAbout(state: State, path: string): void {
  const problem = state.problem.value;
  if (problem !== null && problem.action !== "list" && problem.path === path) {
    state.problem.value = null;
  }
}

async function loadFiles(state: State): Promise<void> {
  const listed = await refreshFiles(state);
  const first = listed?.find((file) => file.unsupported === null) ?? listed?.[0];
  if (first !== undefined) {
    await open(state, first.path);
  }
}

async function refreshFiles(state: State): Promise<readonly FileEntry[] | null> {
  const listed = await attempt(() => state.source.listFiles());
  if (!listed.ok) {
    report(state, { action: "list", cause: listed.cause });
    return null;
  }
  state.files.value = listed.value;
  if (state.problem.value?.action === "list") {
    state.problem.value = null;
  }
  return listed.value;
}

async function loadRemoteName(state: State): Promise<void> {
  try {
    state.remoteName.value = await state.source.remoteName();
  } catch (error) {
    log.warn("store.remote_name_failed", { ...unexpected(error) });
  }
}

async function open(state: State, path: string): Promise<void> {
  const shown =
    state.opened.value.some((file) => file.path === path) ||
    state.choices.value.some((sides) => sides.path === path);
  if (!shown) {
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

async function fetchView(state: State, path: string): Promise<Outcome<() => void>> {
  const listed = state.files.value.find((file) => file.path === path);
  if ((listed?.unsupported ?? null) !== null) {
    const sides = await attempt(() => state.source.describeFile(path));
    return sides.ok ? { ok: true, value: () => putChoice(state, sides.value) } : sides;
  }
  const data = await attempt(() => state.source.loadFile(path));
  return data.ok ? { ok: true, value: () => putOpened(state, data.value) } : data;
}

function putOpened(state: State, data: FileMergeData): void {
  // A new object, so a kept view rebuilds its editor even when the source returns the record it cached.
  const loaded = { ...data };
  const opened = state.opened.value;
  state.opened.value = opened.some((file) => file.path === data.path)
    ? opened.map((file) => (file.path === data.path ? loaded : file))
    : [...opened, loaded];
  log.info("file.loaded", { path: data.path, chunks: loaded.chunks.length });
}

function putChoice(state: State, sides: FileSides): void {
  const others = state.choices.value.filter((shown) => shown.path !== sides.path);
  state.choices.value = [...others, sides];
}

async function moveOn(state: State, path: string, opensBefore: number): Promise<void> {
  const untouched = state.active.value === path && state.latestOpen === opensBefore;
  const next = untouched ? nextUnresolved(state.files.value, path) : null;
  if (next !== null) {
    await open(state, next);
  }
}

async function finish(state: State, { path, text, summary }: FinishRequest): Promise<void> {
  const opensBefore = state.latestOpen;
  const unprocessed: Question = { kind: "unprocessed", summary };
  if (finishMustAsk(summary) && !(await state.asking.ask(unprocessed))) {
    return;
  }
  const outcome = await attempt(() => state.source.finishFile(path, text));
  if (!outcome.ok) {
    report(state, { action: "finish", path, cause: outcome.cause });
    return;
  }
  state.files.value = outcome.value;
  state.guard.markSaved(path, text);
  state.problem.value = null;
  await moveOn(state, path, opensBefore);
}

async function takeSide(state: State, path: string, side: Side): Promise<void> {
  const opensBefore = state.latestOpen;
  const outcome = await attempt(() => state.source.takeSide(path, side));
  if (!outcome.ok) {
    report(state, { action: "take", path, cause: outcome.cause });
    return;
  }
  state.files.value = outcome.value;
  state.taken.value = new Map([...state.taken.value, [path, side]]);
  clearProblemAbout(state, path);
  await moveOn(state, path, opensBefore);
}

async function reset(state: State, path: string): Promise<void> {
  const files = await attempt(() => state.source.resetFile(path));
  if (!files.ok) {
    report(state, { action: "reset", path, cause: files.cause });
    return;
  }
  state.files.value = files.value;
  state.choices.value = state.choices.value.filter((sides) => sides.path !== path);
  state.taken.value = new Map([...state.taken.value].filter(([takenPath]) => takenPath !== path));
  const view = await fetchView(state, path);
  if (!view.ok) {
    report(state, { action: "open", path, cause: view.cause });
    return;
  }
  view.value();
  clearProblemAbout(state, path);
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}
