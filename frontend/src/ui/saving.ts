import { shallowRef, type ShallowRef } from "vue";

import type { DiskVersion, FileEntry, WriteReply, WriteRequest } from "../ipc";
import type { Asking } from "./asking";
import { changedOnDisk, type DiskChangeTarget } from "./diskChanges";
import { attempt, clearProblemAbout, report, type Problem } from "./problem";
import { finishMustAsk, type Question } from "./question";
import type {
  FormatOutcome,
  MergeHandle,
  MergeSummary,
  ResultSnapshot,
} from "./useMergeController";

type Claim = { writes: number; overtaken: boolean };

export type Writing = { readonly writing: Map<string, Claim> };

type WriteTarget = DiskChangeTarget & {
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

export type Saving = {
  readonly formatOutcomes: Readonly<ShallowRef<ReadonlyMap<string, FormatOutcome>>>;
  save(request: SaveRequest): Promise<void>;
};

export async function afterWrite(
  target: WriteTarget,
  path: string,
  reply: WriteReply,
): Promise<boolean> {
  target.files.value = reply.files;
  if (reply.kind === "ChangedOnDisk") {
    await changedOnDisk(target, path, reply.change);
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
    if (claim.writes === 0) {
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
  write: () => Promise<T>,
): Promise<T> {
  const claim = target.writing.get(path) ?? freeClaim();
  claim.overtaken = true;
  return holding(target, path, claim, write);
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
  const unprocessed: Question = { kind: "unprocessed", summary };
  if (finishMustAsk(summary) && !(await target.asking.ask(unprocessed))) {
    return false;
  }
  const text = snapshot.asShown();
  const outcome = await whileWriting(target, path, () =>
    attempt(() => target.source.finishFile({ path, text, diskVersion })),
  );
  if (!outcome.ok) {
    report(target, { action: "finish", path, cause: outcome.cause });
    return false;
  }
  if (!(await afterWrite(target, path, outcome.value))) {
    return false;
  }
  snapshot.markSaved("asShown");
  target.problem.value = null;
  return true;
}

async function written(
  target: SaveTarget,
  { path, diskVersion, handle }: SaveRequest,
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
  const outcome = await attempt(() => target.source.saveFile({ path, text, diskVersion }));
  if (!outcome.ok) {
    report(target, { action: "save", path, cause: outcome.cause });
    return;
  }
  if (await afterWrite(target, path, outcome.value)) {
    snapshot.markSaved(sent);
    clearProblemAbout(target, path);
  }
}

export function createSaving(target: SaveTarget): Saving {
  const formatOutcomes = shallowRef<ReadonlyMap<string, FormatOutcome>>(new Map());
  return {
    formatOutcomes,
    save: (request) =>
      claimWrite(target, request.path, async (claim) => {
        const formatted = await request.handle.format();
        if (formatted !== null) {
          formatOutcomes.value = new Map([...formatOutcomes.value, [request.path, formatted]]);
        }
        if (!claim.overtaken) {
          await written(target, request);
        }
      }),
  };
}
