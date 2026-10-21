import { computed, type ComputedRef, type ShallowRef } from "vue";

import type { ChunkSource, OperationView } from "../ipc";
import type { Asking } from "./asking";
import type { Stop } from "./currentStop";
import type { GitRun } from "./gitRun";
import { reportFailure, type EndsStop, type Problem } from "./problem";

type AbortState =
  | { readonly kind: "none" }
  | { readonly kind: "ready" | "running"; readonly operation: OperationView };

type AbortTarget = EndsStop & {
  readonly stop: Stop;
  readonly source: Pick<ChunkSource, "abortOperation">;
  readonly asking: Pick<Asking, "ask">;
  readonly operation: Readonly<ShallowRef<OperationView | null>>;
  readonly problem: ShallowRef<Problem | null>;
  readonly gitRun: GitRun;
};

export type Aborting = {
  readonly abortState: ComputedRef<AbortState>;
  readonly abortOperation: () => Promise<void>;
};

export function createAborting(target: AbortTarget): Aborting {
  const { running } = target.gitRun;
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
    await target.gitRun.run(stop, {
      call: () => target.source.abortOperation(),
      endsApp: () => true,
      landing: async (outcome) => {
        if (!outcome.ok) {
          await reportFailure(target, {
            action: "abort",
            operation: operation.kind,
            cause: outcome.cause,
          });
        }
      },
    });
  }

  return { abortState, abortOperation };
}
