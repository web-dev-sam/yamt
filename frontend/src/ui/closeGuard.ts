import type { ShallowRef } from "vue";

import { log, onWindowClose, type FileMergeData } from "../ipc";
import type { Asking } from "./asking";
import { report, unexpected, type Problem } from "./problem";
import { exitMustAsk } from "./question";

export type FileWork = { unsaved(): boolean };

export type CloseGuard = {
  readonly track: (path: string, work: FileWork) => void;
  readonly untrack: (path: string, work: FileWork) => void;
  readonly unsavedFiles: () => string[];
  readonly mayClose: () => Promise<boolean>;
  readonly watchWindowClose: () => Promise<void>;
};

type GuardTarget = {
  readonly asking: Asking;
  readonly opened: Readonly<ShallowRef<readonly FileMergeData[]>>;
  readonly problem: ShallowRef<Problem | null>;
  readonly running: Readonly<ShallowRef<boolean>>;
};

export function createCloseGuard(target: GuardTarget): CloseGuard {
  const { asking, opened } = target;
  const work = new Map<string, FileWork>();

  function unsavedFiles(): string[] {
    return opened.value
      .map((file) => file.path)
      .filter((path) => work.get(path)?.unsaved() ?? false);
  }

  async function mayClose(): Promise<boolean> {
    if (target.running.value) {
      report(target, { action: "close" });
      return false;
    }
    const files = unsavedFiles();
    return !exitMustAsk(files) || (await asking.ask({ kind: "exit", files })) === "yes";
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
