import { shallowRef, type ShallowRef } from "vue";

import type { DiskVersion, FileEntry, WriteRequest } from "../ipc";
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

export type Writing = { readonly writing: Set<string> };

type SaveTarget = DiskChangeTarget &
  Writing & {
    readonly files: ShallowRef<readonly FileEntry[]>;
    readonly problem: ShallowRef<Problem | null>;
  };

type SaveRequest = {
  readonly path: string;
  readonly diskVersion: DiskVersion;
  readonly handle: Pick<MergeHandle, "format" | "snapshot">;
};

export type FinishRequest = Omit<WriteRequest, "text"> & {
  readonly summary: MergeSummary;
  readonly snapshot: Pick<ResultSnapshot, "asShown" | "markSaved">;
};

export type Saving = {
  readonly formatOutcomes: Readonly<ShallowRef<ReadonlyMap<string, FormatOutcome>>>;
  save(request: SaveRequest): Promise<void>;
};

export async function whileWriting<T>(
  target: Writing,
  path: string,
  write: () => Promise<T>,
): Promise<T> {
  const claimed = !target.writing.has(path);
  target.writing.add(path);
  try {
    return await write();
  } finally {
    if (claimed) {
      target.writing.delete(path);
    }
  }
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
  const reply = outcome.value;
  target.files.value = reply.files;
  if (reply.kind === "ChangedOnDisk") {
    await changedOnDisk(target, path, reply.change);
    return false;
  }
  snapshot.markSaved();
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
  const text = resolved ? snapshot.asShown() : snapshot.fileText();
  const outcome = await attempt(() => target.source.saveFile({ path, text, diskVersion }));
  if (!outcome.ok) {
    report(target, { action: "save", path, cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  target.files.value = reply.files;
  if (reply.kind === "ChangedOnDisk") {
    await changedOnDisk(target, path, reply.change);
    return;
  }
  snapshot.markSaved();
  clearProblemAbout(target, path);
}

export function createSaving(target: SaveTarget): Saving {
  const formatOutcomes = shallowRef<ReadonlyMap<string, FormatOutcome>>(new Map());
  return {
    formatOutcomes,
    save: async (request) => {
      const { path, handle } = request;
      if (target.writing.has(path)) {
        return;
      }
      target.writing.add(path);
      try {
        const formatted = await handle.format();
        if (formatted !== null) {
          formatOutcomes.value = new Map([...formatOutcomes.value, [path, formatted]]);
        }
        await written(target, request);
      } finally {
        target.writing.delete(path);
      }
    },
  };
}
