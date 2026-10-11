import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  log,
  onWindowClose,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type Side,
  type SourceResult,
} from "../ipc";
import { attempt, logProblem, unexpected, type Outcome, type Problem } from "./problem";
import { exitMustAsk, finishMustAsk, type Question } from "./question";
import type { MergeSummary } from "./useMergeController";

export type FileWork = { unsaved(): boolean; markSaved(text: string): void };

export type Choice = { readonly sides: FileSides; readonly taken: Side | null };

type FinishRequest = {
  readonly path: string;
  readonly text: string;
  readonly summary: MergeSummary;
};

type Asking = { readonly question: Question; readonly answer: (yes: boolean) => void };

type State = {
  readonly source: ChunkSource;
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly choices: ShallowRef<readonly Choice[]>;
  readonly active: ShallowRef<string | null>;
  readonly problem: ShallowRef<Problem | null>;
  readonly asking: ShallowRef<Asking | null>;
  readonly work: Map<string, FileWork>;
  latestLoad: number;
};

type Shared = "files" | "opened" | "choices" | "active" | "problem";

export type AppStore = { readonly [K in Shared]: Readonly<State[K]> } & {
  readonly question: ComputedRef<Question | null>;
  readonly allResolved: ComputedRef<boolean>;
  loadFiles(): Promise<void>;
  open(path: string): Promise<void>;
  finish(request: FinishRequest): Promise<void>;
  takeSide(path: string, side: Side): Promise<void>;
  reset(path: string): Promise<void>;
  dismissProblem(): void;
  answer(yes: boolean): void;
  track(path: string, work: FileWork): void;
  untrack(path: string, work: FileWork): void;
  unsavedFiles(): string[];
  mayClose(): Promise<boolean>;
  watchWindowClose(): Promise<void>;
};

let store: AppStore | null = null;

export function createAppStore(source: ChunkSource): AppStore {
  const state: State = {
    source,
    files: shallowRef<readonly FileEntry[]>([]),
    opened: shallowRef<readonly FileMergeData[]>([]),
    choices: shallowRef<readonly Choice[]>([]),
    active: shallowRef<string | null>(null),
    problem: shallowRef<Problem | null>(null),
    asking: shallowRef<Asking | null>(null),
    work: new Map(),
    latestLoad: 0,
  };
  const { files, opened, choices, active, problem } = state;
  store = {
    files,
    opened,
    choices,
    active,
    problem,
    question: computed(() => state.asking.value?.question ?? null),
    allResolved: computed(
      () => files.value.length > 0 && files.value.every((file) => file.status === "Resolved"),
    ),
    loadFiles: () => loadFiles(state),
    open: (path) => open(state, path),
    finish: (request) => finish(state, request),
    takeSide: (path, side) => takeSide(state, path, side),
    reset: (path) => reset(state, path),
    dismissProblem: () => dismissProblem(state),
    answer: (yes) => answer(state, yes),
    track: (path, work) => track(state, path, work),
    untrack: (path, work) => untrack(state, path, work),
    unsavedFiles: () => unsavedFiles(state),
    mayClose: () => mayClose(state),
    watchWindowClose: () => watchWindowClose(state),
  };
  return store;
}

function report(state: State, failure: Problem): void {
  logProblem(failure);
  state.problem.value = failure;
}

function dismissProblem(state: State): void {
  state.problem.value = null;
}

function track(state: State, path: string, work: FileWork): void {
  state.work.set(path, work);
}

function untrack(state: State, path: string, work: FileWork): void {
  if (state.work.get(path) === work) {
    state.work.delete(path);
  }
}

async function loadFiles(state: State): Promise<void> {
  let listed: FileEntry[];
  try {
    listed = await state.source.listFiles();
  } catch (error) {
    report(state, { action: "list", cause: unexpected(error) });
    return;
  }
  state.files.value = listed;
  state.problem.value = null;
  const first = listed.find((file) => file.unsupported === null) ?? listed[0];
  if (first !== undefined) {
    await open(state, first.path);
  }
}

function isUnsupported(state: State, path: string): boolean {
  return (state.files.value.find((file) => file.path === path)?.unsupported ?? null) !== null;
}

async function open(state: State, path: string): Promise<void> {
  const shown =
    state.opened.value.some((file) => file.path === path) ||
    state.choices.value.some((choice) => choice.sides.path === path);
  if (!shown) {
    await (isUnsupported(state, path)
      ? load(state, path, () => state.source.describeFile(path), putChoice)
      : load(state, path, () => state.source.loadFile(path), putOpened));
    return;
  }
  if (path === state.active.value) {
    return;
  }
  state.latestLoad += 1;
  state.active.value = path;
  state.problem.value = null;
}

async function load<T>(
  state: State,
  path: string,
  fetch: () => Promise<SourceResult<T>>,
  put: (state: State, value: T) => void,
): Promise<void> {
  state.latestLoad += 1;
  const ticket = state.latestLoad;
  const outcome = await attempt(fetch);
  const current = ticket === state.latestLoad;
  if (!outcome.ok) {
    const failure: Problem = { action: "open", path, cause: outcome.cause };
    logProblem(failure);
    if (current) {
      state.problem.value = failure;
    }
    return;
  }
  if (current) {
    put(state, outcome.value);
    state.active.value = path;
    state.problem.value = null;
  }
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
  const others = state.choices.value.filter((choice) => choice.sides.path !== sides.path);
  state.choices.value = [...others, { sides, taken: null }];
}

async function finish(state: State, { path, text, summary }: FinishRequest): Promise<void> {
  if (finishMustAsk(summary) && !(await ask(state, { kind: "unprocessed", summary }))) {
    return;
  }
  const outcome = await attempt(() => state.source.finishFile(path, text));
  if (!outcome.ok) {
    report(state, { action: "finish", path, cause: outcome.cause });
    return;
  }
  state.files.value = outcome.value;
  state.work.get(path)?.markSaved(text);
  state.problem.value = null;
}

async function takeSide(state: State, path: string, side: Side): Promise<void> {
  const outcome = await attempt(() => state.source.takeSide(path, side));
  if (!outcome.ok) {
    report(state, { action: "take", path, cause: outcome.cause });
    return;
  }
  state.files.value = outcome.value;
  state.choices.value = state.choices.value.map((choice) =>
    choice.sides.path === path ? { ...choice, taken: side } : choice,
  );
  state.problem.value = null;
}

async function reset(state: State, path: string): Promise<void> {
  const files = await attempt(() => state.source.resetFile(path));
  if (!files.ok) {
    report(state, { action: "reset", path, cause: files.cause });
    return;
  }
  state.files.value = files.value;
  const fresh = await reopen(state, path);
  if (!fresh.ok) {
    report(state, { action: "open", path, cause: fresh.cause });
    return;
  }
  const problem = state.problem.value;
  if (problem !== null && problem.action !== "list" && problem.path === path) {
    state.problem.value = null;
  }
}

async function reopen(state: State, path: string): Promise<Outcome<unknown>> {
  if (!isUnsupported(state, path)) {
    const data = await attempt(() => state.source.loadFile(path));
    if (data.ok) {
      putOpened(state, data.value);
    }
    return data;
  }
  state.choices.value = state.choices.value.filter((choice) => choice.sides.path !== path);
  const sides = await attempt(() => state.source.describeFile(path));
  if (sides.ok) {
    putChoice(state, sides.value);
  }
  return sides;
}

function ask(state: State, question: Question): Promise<boolean> {
  if (state.asking.value !== null) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    state.asking.value = { question, answer: resolve };
  });
}

function answer(state: State, yes: boolean): void {
  const asking = state.asking.value;
  state.asking.value = null;
  asking?.answer(yes);
}

function unsavedFiles(state: State): string[] {
  return state.opened.value
    .map((file) => file.path)
    .filter((path) => state.work.get(path)?.unsaved() ?? false);
}

async function mayClose(state: State): Promise<boolean> {
  const files = unsavedFiles(state);
  return exitMustAsk(files) ? ask(state, { kind: "exit", files }) : true;
}

async function watchWindowClose(state: State): Promise<void> {
  try {
    await onWindowClose(() => mayClose(state));
  } catch (error) {
    log.error("store.close_guard_failed", { ...unexpected(error) });
  }
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}
