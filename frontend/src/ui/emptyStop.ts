import type { ShallowRef } from "vue";

import type { FileEntry, OperationView } from "../ipc";
import type { Problem } from "./problem";
import type { Screen } from "./screen";

export type StopFacts = {
  readonly operation: OperationView | null;
  readonly files: readonly FileEntry[];
  readonly screen: Screen;
  readonly problem: Problem | null;
  readonly stopMessage: string | null;
};

export type EmptyStop = {
  readonly stopView: { readonly message: string | null } | null;
  readonly barProblem: Problem | null;
};

type MessageTarget = {
  readonly problem: Readonly<ShallowRef<Problem | null>>;
  readonly stopMessage: ShallowRef<string | null>;
};

export async function keepStopMessage(
  target: MessageTarget,
  nextStop: () => Promise<void>,
): Promise<void> {
  target.stopMessage.value = null;
  await nextStop();
  const problem = target.problem.value;
  target.stopMessage.value = problem?.action === "stopped" ? problem.message : null;
}

export function emptyStop(facts: StopFacts): EmptyStop {
  const empty = facts.operation !== null && facts.files.length === 0;
  const message = facts.stopMessage?.trim() ?? "";
  return {
    stopView:
      empty && facts.screen.kind === "files" ? { message: message === "" ? null : message } : null,
    barProblem: empty && facts.problem?.action === "stopped" ? null : facts.problem,
  };
}
