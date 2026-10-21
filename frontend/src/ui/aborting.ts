import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type { ChunkSource, OperationView } from "../ipc";
import type { Asking } from "./asking";
import { attempt, reportFailure, type Problem, type Relist } from "./problem";
import { landed, type Writing } from "./saving";

export type AbortState =
  | { readonly kind: "none" }
  | { readonly kind: "ready" | "running"; readonly operation: OperationView };

type AbortTarget = Relist &
  Pick<Writing, "stop"> & {
    readonly source: Pick<ChunkSource, "abortOperation">;
    readonly asking: Pick<Asking, "ask">;
    readonly operation: Readonly<ShallowRef<OperationView | null>>;
    readonly problem: ShallowRef<Problem | null>;
  };

export type Aborting = {
  readonly abortState: ComputedRef<AbortState>;
  readonly abortOperation: () => Promise<void>;
};

export function createAborting(target: AbortTarget): Aborting {
  const running = shallowRef(false);
  const abortState = computed((): AbortState => {
    const operation = target.operation.value;
    if (operation === null) {
      return { kind: "none" };
    }
    return { kind: running.value ? "running" : "ready", operation };
  });

  async function abortOperation(): Promise<void> {
    const state = abortState.value;
    if (state.kind !== "ready") {
      return;
    }
    const { operation } = state;
    const { stop } = target;
    if ((await target.asking.ask({ kind: "abort", operation })) !== "yes") {
      return;
    }
    running.value = true;
    const outcome = await landed(stop, () => attempt(() => target.source.abortOperation()));
    if (outcome?.ok === true) {
      return;
    }
    running.value = false;
    if (outcome !== null) {
      await reportFailure(target, {
        action: "abort",
        operation: operation.kind,
        cause: outcome.cause,
      });
    }
  }

  return { abortState, abortOperation };
}
