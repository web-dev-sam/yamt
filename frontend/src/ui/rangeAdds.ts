import { shallowRef, type ShallowRef } from "vue";

import type { ThreadId } from "../ipc";

type Add =
  | { readonly kind: "thread"; readonly draftKey: string }
  | { readonly kind: "note"; readonly thread: ThreadId };

/** What a box reads of the one record of adds in flight (plan row 124). */
export type AddsInFlight = {
  /** Whether the add of this line's new thread (its draft key) still runs. */
  addingThread(draftKey: string): boolean;
  /** Whether an add of a note to this thread still runs. */
  addingNote(thread: ThreadId): boolean;
};

export type RangeAdds = {
  readonly inFlight: AddsInFlight;
  /** Runs the add recorded as in flight until it settles. */
  whileAdding<T>(add: Add, run: () => Promise<T>): Promise<T>;
};

function isAdding(running: ShallowRef<ReadonlySet<Add>>, matches: (add: Add) => boolean): boolean {
  return [...running.value].some(matches);
}

export function createRangeAdds(): RangeAdds {
  const running = shallowRef<ReadonlySet<Add>>(new Set());
  return {
    inFlight: {
      addingThread: (draftKey) =>
        isAdding(running, (add) => add.kind === "thread" && add.draftKey === draftKey),
      addingNote: (thread) =>
        isAdding(running, (add) => add.kind === "note" && add.thread === thread),
    },
    whileAdding: async (add, run) => {
      running.value = new Set([...running.value, add]);
      const done = await run();
      running.value = new Set([...running.value].filter((each) => each !== add));
      return done;
    },
  };
}
