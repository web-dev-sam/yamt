import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import { log, type ChunkSource, type FileEntry, type FileMergeData } from "../ipc";

type AppStore = {
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly active: ComputedRef<string | null>;
  readonly data: Readonly<ShallowRef<FileMergeData | null>>;
  loadFiles(): Promise<void>;
  open(path: string): Promise<void>;
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
      const reason = error instanceof Error ? error.message : String(error);
      log.error("store.load_failed", { path, reason });
    }
  }

  async function loadFiles(): Promise<void> {
    try {
      files.value = await source.listFiles();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log.error("store.list_failed", { reason });
      return;
    }
    const first = files.value[0];
    if (first !== undefined) {
      await open(first.path);
    }
  }

  store = { files, active, data, loadFiles, open };
  return store;
}

export function useAppStore(): AppStore {
  if (store === null) {
    throw new Error("useAppStore() called before createAppStore()");
  }
  return store;
}
