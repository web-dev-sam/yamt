import type { ShallowReactive, ShallowRef } from "vue";

import type { DiskVersion, FileEntry, Side, WriteReply, WriteRequest } from "../ipc";
import type { Asking } from "./asking";
import { landed, type Stop } from "./currentStop";
import { applyDiskChanges, type DiskChangeTarget } from "./diskChanges";
import { attempt, clearProblemAbout, reportFailure, type Problem, type Relist } from "./problem";
import { finishMustAsk, type Question } from "./question";
import type {
  FormatOutcome,
  MergeHandle,
  MergeSummary,
  ResultSnapshot,
} from "./useMergeController";
import { reload } from "./views";

type Claim = { writes: number; overtaken: boolean };

export type Writing = { readonly writing: ShallowReactive<Map<string, Claim>>; stop: Stop };

type WriteTarget = DiskChangeTarget &
  Relist & {
    readonly files: ShallowRef<readonly FileEntry[]>;
    readonly problem: ShallowRef<Problem | null>;
  };

type SaveTarget = WriteTarget & Writing;

type SaveRequest = {
  readonly path: string;
  readonly diskVersion: DiskVersion;
  readonly handle: Pick<MergeHandle, "format" | "snapshot">;
};

type WrittenText = Parameters<ResultSnapshot["markSaved"]>[0];

export type FinishRequest = Omit<WriteRequest, "text"> & {
  readonly summary: MergeSummary;
  readonly snapshot: Pick<ResultSnapshot, "asShown" | "markSaved">;
};

export type FormatOutcomes = ShallowRef<ReadonlyMap<string, FormatOutcome>>;

export type Saving = { save(request: SaveRequest): Promise<void> };

export async function afterWrite(
  target: WriteTarget,
  path: string,
  reply: WriteReply,
  stop: Readonly<Stop>,
): Promise<boolean> {
  target.files.value = reply.files;
  if (reply.kind === "ChangedOnDisk") {
    clearProblemAbout(target, path);
    await applyDiskChanges(target, [reply.change], "running", stop);
    return false;
  }
  return true;
}

async function holding<T>(
  target: Writing,
  path: string,
  claim: Claim,
  write: (claim: Readonly<Claim>) => Promise<T>,
): Promise<T> {
  claim.writes += 1;
  target.writing.set(path, claim);
  try {
    return await write(claim);
  } finally {
    claim.writes -= 1;
    if (claim.writes === 0 && target.writing.get(path) === claim) {
      target.writing.delete(path);
    }
  }
}

function freeClaim(): Claim {
  return { writes: 0, overtaken: false };
}

export async function whileWriting<T>(
  target: Writing,
  path: string,
  write: (claim: Readonly<Claim>) => Promise<T>,
): Promise<T> {
  const claim = target.writing.get(path) ?? freeClaim();
  claim.overtaken = true;
  return holding(target, path, claim, write);
}

export function dropStop(target: Writing): void {
  target.stop.dropped = true;
  target.stop = { dropped: false };
  for (const claim of target.writing.values()) {
    claim.overtaken = true;
  }
  target.writing.clear();
}

export async function claimWrite(
  target: Writing,
  path: string,
  write: (claim: Readonly<Claim>) => Promise<void>,
): Promise<void> {
  if (target.writing.has(path)) {
    return;
  }
  await holding(target, path, freeClaim(), write);
}

export async function finish(
  target: SaveTarget & { readonly asking: Pick<Asking, "ask"> },
  { path, snapshot, summary, diskVersion }: FinishRequest,
): Promise<boolean> {
  const { stop } = target;
  const unprocessed: Question = { kind: "unprocessed", summary };
  if (finishMustAsk(summary) && (await target.asking.ask(unprocessed)) !== "yes") {
    return false;
  }
  const text = snapshot.asShown();
  const outcome = await whileWriting(target, path, () =>
    landed(stop, () => attempt(() => target.source.finishFile({ path, text, diskVersion }))),
  );
  if (outcome === null) {
    return false;
  }
  if (!outcome.ok) {
    await reportFailure(target, { action: "finish", path, cause: outcome.cause });
    return false;
  }
  if (!(await afterWrite(target, path, outcome.value, stop))) {
    return false;
  }
  snapshot.markSaved("asShown");
  target.problem.value = null;
  return true;
}

export async function take(
  target: SaveTarget,
  path: string,
  side: Side,
  diskVersion: DiskVersion,
): Promise<boolean> {
  const { stop } = target;
  return whileWriting(target, path, async () => {
    const outcome = await landed(stop, () =>
      attempt(() => target.source.takeSide(path, side, diskVersion)),
    );
    if (outcome === null) {
      return false;
    }
    if (!outcome.ok) {
      await reportFailure(target, { action: "take", path, cause: outcome.cause });
      return false;
    }
    if (!(await afterWrite(target, path, outcome.value, stop))) {
      return false;
    }
    target.taken.value = new Map([...target.taken.value, [path, { by: "side", side }]]);
    clearProblemAbout(target, path);
    if (target.opened.value.some((file) => file.path === path)) {
      await reload(target, path, stop);
    }
    return true;
  });
}

export async function reset(
  target: SaveTarget,
  path: string,
  diskVersion: DiskVersion,
): Promise<void> {
  const { stop } = target;
  await whileWriting(target, path, async () => {
    const outcome = await landed(stop, () =>
      attempt(() => target.source.resetFile(path, diskVersion)),
    );
    if (outcome === null) {
      return;
    }
    if (!outcome.ok) {
      await reportFailure(target, { action: "reset", path, cause: outcome.cause });
      return;
    }
    if (!(await afterWrite(target, path, outcome.value, stop))) {
      return;
    }
    target.choices.value = target.choices.value.filter((sides) => sides.path !== path);
    target.taken.value = new Map([...target.taken.value].filter(([taken]) => taken !== path));
    if (await reload(target, path, stop)) {
      clearProblemAbout(target, path);
    }
  });
}

async function written(
  target: SaveTarget,
  { path, diskVersion, handle }: SaveRequest,
  stop: Readonly<Stop>,
): Promise<void> {
  const snapshot = handle.snapshot();
  if (snapshot === null || !snapshot.unsaved) {
    return;
  }
  const resolved = target.files.value.some(
    (file) => file.path === path && file.status === "Resolved",
  );
  const sent: WrittenText = resolved ? "asShown" : "fileText";
  const text = snapshot[sent]();
  const outcome = await landed(stop, () =>
    attempt(() => target.source.saveFile({ path, text, diskVersion })),
  );
  if (outcome === null) {
    return;
  }
  if (!outcome.ok) {
    await reportFailure(target, { action: "save", path, cause: outcome.cause });
    return;
  }
  if (await afterWrite(target, path, outcome.value, stop)) {
    snapshot.markSaved(sent);
    clearProblemAbout(target, path);
  }
}

export function createSaving(
  target: SaveTarget & { readonly formatOutcomes: FormatOutcomes },
): Saving {
  return {
    save: (request) => {
      const { stop } = target;
      return claimWrite(target, request.path, async (claim) => {
        const formatted = await landed(stop, () => request.handle.format());
        if (formatted !== null) {
          target.formatOutcomes.value = new Map([
            ...target.formatOutcomes.value,
            [request.path, formatted],
          ]);
        }
        if (!claim.overtaken) {
          await written(target, request, stop);
        }
      });
    },
  };
}
