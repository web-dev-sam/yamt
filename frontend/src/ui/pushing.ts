import type { ShallowRef } from "vue";

import type { ChunkSource, OperationKind, PushReply } from "../ipc";
import type { Asking } from "./asking";
import type { Stop } from "./currentStop";
import type { GitRun } from "./gitRun";
import { report, type Outcome, type Problem } from "./problem";
import type { Question } from "./question";

type PushTarget = {
  readonly stop: Stop;
  readonly source: Pick<ChunkSource, "pushMergedBranch" | "closeEndedMerge">;
  readonly asking: Pick<Asking, "ask">;
  readonly gitRun: GitRun;
  readonly problem: ShallowRef<Problem | null>;
};

export type Pushing = {
  readonly offerPush: (branch: string, operation: OperationKind) => Promise<void>;
};

function reported<T>(target: PushTarget, operation: OperationKind, outcome: Outcome<T>): void {
  if (!outcome.ok) {
    report(target, { action: "continue", operation, cause: outcome.cause });
  }
}

async function pushed(
  target: PushTarget,
  stop: Stop,
  operation: OperationKind,
): Promise<Outcome<PushReply> | null> {
  let replied: Outcome<PushReply> | null = null;
  await target.gitRun.run(stop, {
    call: () => target.source.pushMergedBranch(),
    endsApp: (reply) => reply.kind === "pushed",
    landing: async (outcome) => {
      replied = outcome;
      reported(target, operation, outcome);
    },
  });
  return replied;
}

async function offerPush(
  target: PushTarget,
  branch: string,
  operation: OperationKind,
): Promise<void> {
  const { stop } = target;
  let question: Question = { kind: "push", branch };
  while ((await target.asking.ask(question)) === "yes") {
    const outcome = await pushed(target, stop, operation);
    if (outcome === null) {
      return;
    }
    if (!outcome.ok) {
      break;
    }
    if (outcome.value.kind === "pushed") {
      return;
    }
    question = { kind: "pushFailed", branch, message: outcome.value.message };
  }
  await target.gitRun.run(stop, {
    call: () => target.source.closeEndedMerge(),
    endsApp: () => true,
    landing: async (outcome) => {
      reported(target, operation, outcome);
    },
  });
}

export function createPushing(target: PushTarget): Pushing {
  return { offerPush: (branch, operation) => offerPush(target, branch, operation) };
}
