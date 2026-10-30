import type { ShallowRef } from "vue";

import type { ChunkSource, MergeView, PushReply } from "../ipc";
import type { Asking } from "./asking";
import type { Stop } from "./currentStop";
import type { GitRun } from "./gitRun";
import { report, type Outcome, type Problem } from "./problem";
import type { Question } from "./question";

type PushTarget = {
  readonly stop: Stop;
  readonly source: Pick<ChunkSource, "pushMergedBranch" | "closeEndedMerge">;
  readonly mergeRequest: Readonly<ShallowRef<MergeView | null>>;
  readonly asking: Pick<Asking, "ask">;
  readonly gitRun: GitRun;
  readonly problem: ShallowRef<Problem | null>;
};

type CloseTarget = {
  readonly source: Pick<ChunkSource, "closeEndedMerge">;
  readonly gitRun: GitRun;
  readonly problem: ShallowRef<Problem | null>;
};

export type Pushing = {
  readonly offerPush: (branch: string) => Promise<void>;
};

export async function closeEnded(
  target: CloseTarget,
  stop: Stop,
  merge: MergeView | null,
): Promise<void> {
  await target.gitRun.run(stop, {
    call: () => target.source.closeEndedMerge(),
    endsApp: () => true,
    landing: async (outcome) => {
      if (!outcome.ok) {
        report(target, { action: "closeMerge", merge, cause: outcome.cause });
      }
    },
  });
}

async function pushed(
  target: PushTarget,
  stop: Stop,
  branch: string,
): Promise<Outcome<PushReply> | null> {
  let replied: Outcome<PushReply> | null = null;
  await target.gitRun.run(stop, {
    call: () => target.source.pushMergedBranch(),
    endsApp: () => true,
    landing: async (outcome) => {
      replied = outcome;
      if (!outcome.ok) {
        report(target, { action: "push", branch, cause: outcome.cause });
      }
    },
  });
  return replied;
}

async function offerPush(target: PushTarget, branch: string): Promise<void> {
  const { stop } = target;
  const merge = target.mergeRequest.value;
  let question: Question = { kind: "push", branch };
  while ((await target.asking.ask(question)) === "yes") {
    const outcome = await pushed(target, stop, branch);
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
  await closeEnded(target, stop, merge);
}

export function createPushing(target: PushTarget): Pushing {
  return { offerPush: (branch) => offerPush(target, branch) };
}
