import { computed, type ComputedRef, type ShallowRef } from "vue";

import type { ChunkSource, Leftover, MergeView, OperationView } from "../ipc";
import type { Asking } from "./asking";
import type { Stop } from "./currentStop";
import type { GitRun } from "./gitRun";
import { report, reportFailure, type EndsStop, type Problem } from "./problem";

type AbortState =
  | { readonly kind: "none" }
  | { readonly kind: "ready" | "running"; readonly operation: OperationView };

type AbortTarget = EndsStop & {
  readonly stop: Stop;
  readonly source: Pick<ChunkSource, "abortOperation" | "closeEndedMerge">;
  readonly asking: Pick<Asking, "ask">;
  readonly operation: Readonly<ShallowRef<OperationView | null>>;
  readonly mergeRequest: Readonly<ShallowRef<MergeView | null>>;
  readonly problem: ShallowRef<Problem | null>;
  readonly gitRun: GitRun;
};

export type Aborting = {
  readonly abortState: ComputedRef<AbortState>;
  readonly abortOperation: () => Promise<void>;
};

type Pressed = {
  readonly stop: Stop;
  readonly operation: OperationView;
  readonly mergeRequest: MergeView | null;
};

async function leftBehind(target: AbortTarget, pressed: Pressed): Promise<readonly Leftover[]> {
  const { stop, operation } = pressed;
  let leftovers: readonly Leftover[] = [];
  await target.gitRun.run(stop, {
    call: () => target.source.abortOperation(),
    endsApp: (reply) => reply.leftovers.length === 0,
    landing: async (outcome) => {
      if (!outcome.ok) {
        await reportFailure(target, {
          action: "abort",
          operation: operation.kind,
          cause: outcome.cause,
        });
        return;
      }
      leftovers = outcome.value.leftovers;
    },
  });
  return leftovers;
}

async function closeAborted(
  target: AbortTarget,
  pressed: Pressed,
  leftovers: readonly Leftover[],
): Promise<void> {
  const { stop, operation, mergeRequest } = pressed;
  if (mergeRequest !== null) {
    await target.asking.ask({ kind: "abortLeftovers", mergeRequest, leftovers });
  }
  await target.gitRun.run(stop, {
    call: () => target.source.closeEndedMerge(),
    endsApp: () => true,
    landing: async (outcome) => {
      if (!outcome.ok) {
        report(target, { action: "abort", operation: operation.kind, cause: outcome.cause });
      }
    },
  });
}

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
    const pressed = {
      stop: target.stop,
      operation: state.operation,
      mergeRequest: target.mergeRequest.value,
    };
    const { operation, mergeRequest } = pressed;
    if ((await target.asking.ask({ kind: "abort", operation, mergeRequest })) !== "yes") {
      return;
    }
    const leftovers = await leftBehind(target, pressed);
    if (leftovers.length > 0) {
      await closeAborted(target, pressed, leftovers);
    }
  }

  return { abortState, abortOperation };
}
