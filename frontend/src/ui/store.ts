import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  log,
  onWindowClose,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import { exitMustAsk, finishMustAsk, type Question } from "./question";
import type { MergeSummary } from "./useMergeController";

type Unexpected = { readonly kind: "Unexpected"; readonly message: string };

export type ProblemCause = SourceFailure | Unexpected;

export type Problem =
  | { readonly action: "list"; readonly cause: Unexpected }
  | {
      readonly action: "open" | "finish" | "reset";
      readonly path: string;
      readonly cause: ProblemCause;
    };

export type FileWork = { resultText(): string | null; loadedText(): string | null };

export type FinishRequest = {
  readonly path: string;
  readonly text: string;
  readonly summary: MergeSummary;
};

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly cause: ProblemCause };

type Asking = { readonly question: Question; readonly answer: (yes: boolean) => void };

type State = {
  readonly source: ChunkSource;
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly active: ShallowRef<string | null>;
  readonly problem: ShallowRef<Problem | null>;
  readonly asking: ShallowRef<Asking | null>;
  readonly work: Map<string, FileWork>;
  readonly finished: Map<string, string>;
  latestLoad: number;
};

export type AppStore = {
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly opened: Readonly<ShallowRef<readonly FileMergeData[]>>;
  readonly active: Readonly<ShallowRef<string | null>>;
  readonly problem: Readonly<ShallowRef<Problem | null>>;
  readonly question: ComputedRef<Question | null>;
  readonly allResolved: ComputedRef<boolean>;
  loadFiles(): Promise<void>;
  open(path: string): Promise<void>;
  finish(request: FinishRequest): Promise<void>;
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
    active: shallowRef<string | null>(null),
    problem: shallowRef<Problem | null>(null),
    asking: shallowRef<Asking | null>(null),
    work: new Map(),
    finished: new Map(),
    latestLoad: 0,
  };
  const { files, opened, active, problem } = state;
  store = {
    files,
    opened,
    active,
    problem,
    question: computed(() => state.asking.value?.question ?? null),
    allResolved: computed(
      () => files.value.length > 0 && files.value.every((file) => file.status === "Resolved"),
    ),
    loadFiles: () => loadFiles(state),
    open: (path) => open(state, path),
    finish: (request) => finish(state, request),
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
  logFailure(failure);
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
  const first = listed.find((file) => file.unsupported === null);
  if (first !== undefined) {
    await open(state, first.path);
  }
}

async function open(state: State, path: string): Promise<void> {
  if (path === state.active.value) {
    return;
  }
  if (state.opened.value.some((file) => file.path === path)) {
    state.latestLoad += 1;
    state.active.value = path;
    state.problem.value = null;
    return;
  }
  await load(state, path);
}

async function load(state: State, path: string): Promise<void> {
  state.latestLoad += 1;
  const ticket = state.latestLoad;
  const outcome = await attempt(() => state.source.loadFile(path));
  const current = ticket === state.latestLoad;
  if (!outcome.ok) {
    const failure: Problem = { action: "open", path, cause: outcome.cause };
    if (current) {
      report(state, failure);
    } else {
      logFailure(failure);
    }
    return;
  }
  if (!current) {
    return;
  }
  // A new object, so a kept view rebuilds its editor even when the source returns the record it cached.
  const loaded = { ...outcome.value };
  const opened = state.opened.value;
  state.opened.value = opened.some((file) => file.path === path)
    ? opened.map((file) => (file.path === path ? loaded : file))
    : [...opened, loaded];
  state.active.value = path;
  state.problem.value = null;
  log.info("file.loaded", { path, chunks: loaded.chunks.length });
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
  state.finished.set(path, text);
  state.problem.value = null;
}

async function reset(state: State, path: string): Promise<void> {
  state.latestLoad += 1;
  const ticket = state.latestLoad;
  const outcome = await attempt(() => state.source.resetFile(path));
  if (!outcome.ok) {
    report(state, { action: "reset", path, cause: outcome.cause });
    return;
  }
  state.files.value = outcome.value;
  state.opened.value = state.opened.value.filter((file) => file.path !== path);
  state.finished.delete(path);
  if (ticket === state.latestLoad) {
    await load(state, path);
  }
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
    .filter((path) => {
      const work = state.work.get(path);
      const text = work?.resultText() ?? null;
      return text !== null && text !== (state.finished.get(path) ?? work?.loadedText());
    });
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

async function attempt<T>(call: () => Promise<SourceResult<T>>): Promise<Outcome<T>> {
  try {
    const result = await call();
    return result.ok ? result : { ok: false, cause: result.failure };
  } catch (error) {
    return { ok: false, cause: unexpected(error) };
  }
}

function unexpected(error: unknown): Unexpected {
  return { kind: "Unexpected", message: error instanceof Error ? error.message : String(error) };
}

function logFailure(failure: Problem): void {
  const where = failure.action === "list" ? {} : { path: failure.path };
  log.error(`store.${failure.action}_failed`, { ...where, ...failure.cause });
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}
