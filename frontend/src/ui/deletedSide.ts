import type { Side } from "../ipc";
import { otherSide } from "./sides";
import type { MergeSummary } from "./useMergeController";

type Middle = "base" | "kept" | "deleted";

export type DeletedSideView = {
  readonly kept: Side;
  readonly keepIn: Side | null;
  readonly deleteIn: Side | null;
  readonly middle: Middle;
  readonly resettable: boolean;
};

function middle(deleted: Side, taken: Side | null): Middle {
  if (taken === null) {
    return "base";
  }
  return taken === deleted ? "deleted" : "kept";
}

export function deletedSideView(deleted: Side, taken: Side | null): DeletedSideView {
  const kept = otherSide(deleted);
  const choosing = taken === null;
  return {
    kept,
    keepIn: choosing ? kept : null,
    deleteIn: choosing ? deleted : null,
    middle: middle(deleted, taken),
    resettable: !choosing,
  };
}

export function keptToApply(view: DeletedSideView, summary: MergeSummary | null): Side | null {
  const changesLeft = summary !== null && summary.changes > 0;
  return view.middle === "kept" && changesLeft ? view.kept : null;
}
