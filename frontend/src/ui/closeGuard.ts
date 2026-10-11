import type { ShallowRef } from "vue";

import { log, onWindowClose, type FileMergeData } from "../ipc";
import type { Asking } from "./asking";
import { unexpected } from "./problem";
import { exitMustAsk } from "./question";

export type FileWork = { unsaved(): boolean; markSaved(text: string): void };

export type CloseGuard = {
  readonly track: (path: string, work: FileWork) => void;
  readonly untrack: (path: string, work: FileWork) => void;
  readonly markSaved: (path: string, text: string) => void;
  readonly unsavedFiles: () => string[];
  readonly mayClose: () => Promise<boolean>;
  readonly watchWindowClose: () => Promise<void>;
};

export function createCloseGuard(
  asking: Asking,
  opened: Readonly<ShallowRef<readonly FileMergeData[]>>,
): CloseGuard {
  const work = new Map<string, FileWork>();

  function unsavedFiles(): string[] {
    return opened.value
      .map((file) => file.path)
      .filter((path) => work.get(path)?.unsaved() ?? false);
  }

  async function mayClose(): Promise<boolean> {
    const files = unsavedFiles();
    return exitMustAsk(files) ? asking.ask({ kind: "exit", files }) : true;
  }

  return {
    track: (path, tracked) => {
      work.set(path, tracked);
    },
    untrack: (path, tracked) => {
      if (work.get(path) === tracked) {
        work.delete(path);
      }
    },
    markSaved: (path, text) => {
      work.get(path)?.markSaved(text);
    },
    unsavedFiles,
    mayClose,
    watchWindowClose: async () => {
      try {
        await onWindowClose(mayClose);
      } catch (error) {
        log.error("store.close_guard_failed", { ...unexpected(error) });
      }
    },
  };
}
