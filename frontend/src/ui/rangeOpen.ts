import { shallowRef, type ShallowRef } from "vue";

import type { RangeFileId, ShownThread, Thread, ThreadId, ThreadList } from "../ipc";

export type StoredBox = {
  readonly kind: "thread";
  readonly thread: Thread;
  readonly open: boolean;
};

/** Each stored thread's box: its key (a thread added from a draft keeps the draft's) and whether it is open. */
export type RangeOpen = {
  readonly open: Readonly<ShallowRef<ReadonlySet<ThreadId>>>;
  shownFor(list: ThreadList, file: RangeFileId): ShownThread[];
  boxOf(list: ThreadList, key: string): StoredBox | null;
  /** Opens the keys' threads when any of them is closed, else closes them; other threads keep theirs. */
  toggle(list: ThreadList, keys: readonly string[]): void;
  added(thread: ThreadId, draftKey: string): void;
  keepListed(list: ThreadList): void;
};

function toggled(open: ReadonlySet<ThreadId>, threads: readonly ThreadId[]): ReadonlySet<ThreadId> {
  const opening = threads.some((id) => !open.has(id));
  const next = new Set(open);
  for (const id of threads) {
    if (opening) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  return next;
}

export function createRangeOpen(): RangeOpen {
  const open = shallowRef<ReadonlySet<ThreadId>>(new Set());
  const keys = new Map<ThreadId, string>();
  function keyOf(thread: ThreadId): string {
    return keys.get(thread) ?? `thread-${thread}`;
  }
  return {
    open,
    shownFor: (list, file) =>
      list.threads
        .filter((thread) => thread.file === file)
        .map(({ id, place }) => ({
          key: keyOf(id),
          place,
          shown: open.value.has(id) ? "open" : "collapsed",
        })),
    boxOf: (list, key) => {
      const thread = list.threads.find(({ id }) => keyOf(id) === key);
      return thread === undefined
        ? null
        : { kind: "thread", thread, open: open.value.has(thread.id) };
    },
    toggle: (list, toggledKeys) => {
      const ids = list.threads.map(({ id }) => id).filter((id) => toggledKeys.includes(keyOf(id)));
      open.value = toggled(open.value, ids);
    },
    added: (thread, draftKey) => {
      keys.set(thread, draftKey);
      open.value = new Set([...open.value, thread]);
    },
    keepListed: (list) => {
      const kept = [...open.value].filter((id) => list.threads.some((each) => each.id === id));
      if (kept.length < open.value.size) {
        open.value = new Set(kept);
      }
    },
  };
}
