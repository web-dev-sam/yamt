import { computed, type ComputedRef, type ShallowRef } from "vue";

import { log, type ChunkSource, type FileEntry, type OperationView } from "../ipc";
import type { Asking } from "./asking";
import type { CloseGuard } from "./closeGuard";
import { landed, type Stop } from "./currentStop";
import { attempt, report, type Problem, type ProblemCause, type Relist } from "./problem";
import type { Question } from "./question";
import type { StopEnd } from "./stops";

export type ContinueState = "noOperation" | "filesLeft" | "writing" | "ready" | "running";

type ContinueTarget = Relist & {
  readonly stop: Stop;
  readonly writing: ReadonlyMap<string, unknown>;
  readonly running: ShallowRef<boolean>;
  readonly source: Pick<ChunkSource, "continueOperation">;
  readonly asking: Pick<Asking, "ask">;
  readonly guard: Pick<CloseGuard, "unsavedFiles">;
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly operation: Readonly<ShallowRef<OperationView | null>>;
  readonly problem: ShallowRef<Problem | null>;
  nextStop(end: StopEnd): Promise<void>;
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
      return filesLeft === 1
        ? "1 file is not resolved yet"
        : `${filesLeft} files are not resolved yet`;
    case "writing":
      return "Saving…";
    case "running":
      return "Continuing… (if nothing happens, git may be asking for something in the terminal that started yamt)";
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

async function continued(
  target: ContinueTarget,
  operation: OperationView,
  stop: Readonly<Stop>,
): Promise<void> {
  target.running.value = true;
  const outcome = await landed(stop, () => attempt(() => target.source.continueOperation()));
  if (outcome === null) {
    target.running.value = false;
    return;
  }
  if (!outcome.ok) {
    await refused(target, operation, outcome.cause);
  } else if (outcome.value.kind === "Stopped") {
    await target.nextStop({ kind: "continued", message: outcome.value.message });
  } else {
    log.info("continue.finished", { operation: operation.kind });
    return;
  }
  target.running.value = false;
}

export function createContinuing(target: ContinueTarget): Continuing {
  const filesLeft = computed(
    () => target.files.value.filter((file) => file.status !== "Resolved").length,
  );
  const continueState = computed((): ContinueState => {
    if (target.operation.value === null) {
      return "noOperation";
    }
    if (target.running.value) {
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
    await continued(target, operation, stop);
  }

  return {
    continueState,
    continueHover: computed(() => hoverText(continueState.value, filesLeft.value)),
    continueOperation,
  };
}
