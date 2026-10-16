import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type { ChunkSource } from "../ipc";
import type { Asking } from "./asking";
import { attempt, report, type Problem } from "./problem";

export type AbortButton = "hidden" | "ready" | "running";

type AbortTarget = {
  readonly source: ChunkSource;
  readonly asking: Asking;
  readonly merging: Readonly<ShallowRef<boolean>>;
  readonly problem: ShallowRef<Problem | null>;
};

export type Aborting = {
  readonly abortButton: ComputedRef<AbortButton>;
  readonly abortMerge: () => Promise<void>;
};

export function createAborting(target: AbortTarget): Aborting {
  const running = shallowRef(false);
  const abortButton = computed((): AbortButton => {
    if (!target.merging.value) {
      return "hidden";
    }
    return running.value ? "running" : "ready";
  });

  async function abortMerge(): Promise<void> {
    if (abortButton.value !== "ready" || (await target.asking.ask({ kind: "abort" })) !== "yes") {
      return;
    }
    running.value = true;
    const outcome = await attempt(() => target.source.abortMerge());
    if (!outcome.ok) {
      running.value = false;
      report(target, { action: "abort", cause: outcome.cause });
    }
  }

  return { abortButton, abortMerge };
}
