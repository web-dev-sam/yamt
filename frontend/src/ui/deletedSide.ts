import type { Side } from "../ipc";
import { otherSide, type Taken } from "./sides";
import type { MergeSummary } from "./useMergeController";

type Middle = "loaded" | "kept" | "deleted";

export type DeletedSideView = {
  readonly kept: Side;
  readonly keepIn: Side | null;
  readonly deleteIn: Side | null;
  readonly middle: Middle;
  readonly resettable: boolean;
};

function middle(deleted: Side, taken: Taken | null): Middle {
  if (taken === null || taken.by === "disk") {
    return "loaded";
  }
  return taken.side === deleted ? "deleted" : "kept";
}

export function deletedSideView(deleted: Side, taken: Taken | null): DeletedSideView {
  const kept = otherSide(deleted);
  const choosing = taken === null || taken.by === "disk";
  return {
    kept,
    keepIn: choosing ? kept : null,
    deleteIn: choosing ? deleted : null,
    middle: middle(deleted, taken),
    resettable: taken !== null,
  };
}

export function keptToApply(view: DeletedSideView, summary: MergeSummary | null): Side | null {
  const changesLeft = summary !== null && summary.changes > 0;
  return view.middle === "kept" && changesLeft ? view.kept : null;
}
