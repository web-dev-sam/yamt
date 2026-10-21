import { computed, type ComputedRef, type ShallowReactive, type ShallowRef } from "vue";

import {
  log,
  type ChunkSource,
  type ContinueReply,
  type FileEntry,
  type OperationView,
} from "../ipc";
import type { Asking } from "./asking";
import type { CloseGuard } from "./closeGuard";
import type { Stop } from "./currentStop";
import type { GitRun } from "./gitRun";
import { CONTINUING_TEXT, filesLeftText, SAVING_TEXT } from "./operationText";
import { report, type Outcome, type Problem, type ProblemCause } from "./problem";
import type { Question } from "./question";
import type { StopEnd } from "./stops";

export type ContinueState = "noOperation" | "filesLeft" | "writing" | "ready" | "running";

type ContinueTarget = {
  readonly stop: Stop;
  readonly writing: ShallowReactive<ReadonlyMap<string, unknown>>;
  readonly gitRun: GitRun;
  readonly source: Pick<ChunkSource, "continueOperation">;
  readonly asking: Pick<Asking, "ask">;
  readonly guard: Pick<CloseGuard, "unsavedFiles">;
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly operation: Readonly<ShallowRef<OperationView | null>>;
  readonly problem: ShallowRef<Problem | null>;
  nextStop(end: StopEnd): Promise<void>;
  refreshFiles(): Promise<void>;
};

export type Continuing = {
  readonly continueState: ComputedRef<ContinueState>;
  readonly continueHover: ComputedRef<string | null>;
  readonly continueOperation: () => Promise<void>;
};

function hoverText(state: ContinueState, filesLeft: number): string | null {
  switch (state) {
    case "noOperation":
    case "ready":
      return null;
    case "filesLeft":
      return filesLeftText(filesLeft);
    case "writing":
      return SAVING_TEXT;
    case "running":
      return CONTINUING_TEXT;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

async function confirmed(target: ContinueTarget, operation: OperationView): Promise<boolean> {
  const files = target.guard.unsavedFiles();
  const unsaved = { kind: "continueUnsaved", operation: operation.kind, files } satisfies Question;
  if (files.length > 0 && (await target.asking.ask(unsaved)) !== "yes") {
    return false;
  }
  const rewords = operation.kind === "Rebase" && operation.editor_steps_ahead;
  return !rewords || (await target.asking.ask({ kind: "rewords" })) === "yes";
}

async function refused(
  target: ContinueTarget,
  operation: OperationView,
  cause: ProblemCause,
): Promise<void> {
  if (cause.kind === "StopMovedOn") {
    await target.nextStop({ kind: "outside" });
    return;
  }
  report(target, { action: "continue", operation: operation.kind, cause });
  if (cause.kind === "Git") {
    await target.refreshFiles();
  }
}

async function landing(
  target: ContinueTarget,
  operation: OperationView,
  outcome: Outcome<ContinueReply>,
): Promise<void> {
  if (!outcome.ok) {
    await refused(target, operation, outcome.cause);
  } else if (outcome.value.kind === "Stopped") {
    await target.nextStop({ kind: "continued", message: outcome.value.message });
  } else {
    log.info("continue.finished", { operation: operation.kind });
  }
}

export function createContinuing(target: ContinueTarget): Continuing {
  const filesLeft = computed(
    () => target.files.value.filter((file) => file.status !== "Resolved").length,
  );
  const continueState = computed((): ContinueState => {
    if (target.operation.value === null) {
      return "noOperation";
    }
    if (target.gitRun.running.value) {
      return "running";
    }
    if (filesLeft.value > 0) {
      return "filesLeft";
    }
    return target.writing.size > 0 ? "writing" : "ready";
  });

  async function continueOperation(): Promise<void> {
    const operation = target.operation.value;
    if (operation === null || continueState.value !== "ready") {
      return;
    }
    const { stop } = target;
    if (!(await confirmed(target, operation))) {
      return;
    }
    await target.gitRun.run(stop, {
      call: () => target.source.continueOperation(),
      endsApp: (reply) => reply.kind === "Finished",
      landing: (outcome) => landing(target, operation, outcome),
    });
  }

  return {
    continueState,
    continueHover: computed(() => hoverText(continueState.value, filesLeft.value)),
    continueOperation,
  };
}
