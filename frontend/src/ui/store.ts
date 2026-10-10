import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  log,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
  type SourceFailure,
  type SourceResult,
} from "../ipc";

export type ProblemCause =
  | SourceFailure
  | { readonly kind: "Unexpected"; readonly message: string };

export type Problem =
  | { readonly action: "list"; readonly cause: ProblemCause }
  | {
      readonly action: "open" | "finish" | "reset";
      readonly path: string;
      readonly cause: ProblemCause;
    };

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly cause: ProblemCause };

export type AppStore = {
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly active: ComputedRef<string | null>;
  readonly data: Readonly<ShallowRef<FileMergeData | null>>;
  readonly problem: Readonly<ShallowRef<Problem | null>>;
  loadFiles(): Promise<void>;
  open(path: string): Promise<void>;
  finish(text: string): Promise<void>;
  reset(): Promise<void>;
  dismissProblem(): void;
};

let store: AppStore | null = null;

export function createAppStore(source: ChunkSource): AppStore {
  const files = shallowRef<readonly FileEntry[]>([]);
  const data = shallowRef<FileMergeData | null>(null);
  const problem = shallowRef<Problem | null>(null);
  const active = computed(() => data.value?.path ?? null);
  let latestLoad = 0;

  function report(failure: Problem): void {
    logFailure(failure);
    problem.value = failure;
  }

  async function open(path: string): Promise<void> {
    latestLoad += 1;
    const ticket = latestLoad;
    const outcome = await attempt(() => source.loadFile(path));
    const current = ticket === latestLoad;
    if (!outcome.ok) {
      const failure: Problem = { action: "open", path, cause: outcome.cause };
      if (current) {
        report(failure);
      } else {
        logFailure(failure);
      }
      return;
    }
    if (!current) {
      return;
    }
    // A new object, so the editor is rebuilt even when the source returns the record it cached.
    data.value = { ...outcome.value };
    problem.value = null;
    log.info("file.loaded", { path, chunks: outcome.value.chunks.length });
  }

  async function finish(text: string): Promise<void> {
    const path = active.value;
    if (path === null) {
      return;
    }
    const outcome = await attempt(() => source.finishFile(path, text));
    if (!outcome.ok) {
      report({ action: "finish", path, cause: outcome.cause });
      return;
    }
    files.value = outcome.value;
    problem.value = null;
  }

  async function reset(): Promise<void> {
    const path = active.value;
    if (path === null) {
      return;
    }
    latestLoad += 1;
    const ticket = latestLoad;
    const outcome = await attempt(() => source.resetFile(path));
    if (!outcome.ok) {
      report({ action: "reset", path, cause: outcome.cause });
      return;
    }
    files.value = outcome.value;
    if (ticket === latestLoad) {
      await open(path);
    }
  }

  async function loadFiles(): Promise<void> {
    const outcome = await attempt(async () => ({ ok: true, value: await source.listFiles() }));
    if (!outcome.ok) {
      report({ action: "list", cause: outcome.cause });
      return;
    }
    files.value = outcome.value;
    problem.value = null;
    const first = outcome.value.find((file) => file.unsupported === null);
    if (first !== undefined) {
      await open(first.path);
    }
  }

  function dismissProblem(): void {
    problem.value = null;
  }

  store = { files, active, data, problem, loadFiles, open, finish, reset, dismissProblem };
  return store;
}

async function attempt<T>(call: () => Promise<SourceResult<T>>): Promise<Outcome<T>> {
  try {
    const result = await call();
    return result.ok ? result : { ok: false, cause: result.failure };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, cause: { kind: "Unexpected", message } };
  }
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
