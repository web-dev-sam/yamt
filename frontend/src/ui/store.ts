import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import { log, type ChunkSource, type FileEntry, type FileMergeData } from "../ipc";

export type AppStore = {
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly active: ComputedRef<string | null>;
  readonly data: Readonly<ShallowRef<FileMergeData | null>>;
  loadFiles(): Promise<void>;
  open(path: string): Promise<void>;
  finish(text: string): Promise<void>;
  reset(): Promise<void>;
};

let store: AppStore | null = null;

export function createAppStore(source: ChunkSource): AppStore {
  const files = shallowRef<readonly FileEntry[]>([]);
  const data = shallowRef<FileMergeData | null>(null);
  const active = computed(() => data.value?.path ?? null);
  let latestOpen = 0;

  async function open(path: string): Promise<void> {
    latestOpen += 1;
    const ticket = latestOpen;
    try {
      const loaded = await source.loadFile(path);
      if (ticket !== latestOpen) {
        return;
      }
      data.value = loaded;
      log.info("file.loaded", { path, chunks: loaded.chunks.length });
    } catch (error) {
      log.error("store.load_failed", { path, reason: reasonOf(error) });
    }
  }

  async function finish(text: string): Promise<void> {
    const path = active.value;
    if (path === null) {
      return;
    }
    try {
      files.value = await source.finishFile(path, text);
    } catch (error) {
      log.error("store.finish_failed", { path, reason: reasonOf(error) });
    }
  }

  async function reset(): Promise<void> {
    const path = active.value;
    if (path === null) {
      return;
    }
    latestOpen += 1;
    const ticket = latestOpen;
    try {
      const original = await source.resetFile(path);
      if (ticket !== latestOpen) {
        return;
      }
      // A new object, so the editor is rebuilt even when the source returns the record it cached.
      data.value = { ...original };
      files.value = await source.listFiles();
    } catch (error) {
      log.error("store.reset_failed", { path, reason: reasonOf(error) });
    }
  }

  async function loadFiles(): Promise<void> {
    try {
      files.value = await source.listFiles();
    } catch (error) {
      log.error("store.list_failed", { reason: reasonOf(error) });
      return;
    }
    const first = files.value[0];
    if (first !== undefined) {
      await open(first.path);
    }
  }

  store = { files, active, data, loadFiles, open, finish, reset };
  return store;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}
