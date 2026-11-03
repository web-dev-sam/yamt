import {
  turnCounts,
  viewerPossessive,
  type OpenDiscussion,
  type TurnCounts,
  type Viewer,
} from "./discussions";
import type { CalendarDay } from "./dueDate";
import { byDueDate } from "./order";

/** A row's discussion details as the review order reads them (rule 6). */
export type ReviewDetails<F> =
  | { readonly kind: "none" }
  | { readonly kind: "loading" }
  | { readonly kind: "read"; readonly discussions: readonly OpenDiscussion[] }
  | { readonly kind: "failed"; readonly failure: F };
export type ReviewOrder<R, F> =
  | { readonly kind: "sorted"; readonly rows: readonly R[]; readonly loading: number }
  | { readonly kind: "failed"; readonly rows: readonly R[]; readonly row: R; readonly failure: F };

type Ranked<R> = { readonly row: R; readonly first: boolean; readonly waiting: number };

const NO_TURNS: TurnCounts = { viewersTurn: 0, waiting: 0 };

function firstFailed<R extends { readonly iid: number }, F>(
  rows: readonly R[],
  detailsOf: (iid: number) => ReviewDetails<F>,
): { readonly row: R; readonly failure: F } | null {
  for (const row of rows) {
    const details = detailsOf(row.iid);
    if (details.kind === "failed") {
      return { row, failure: details.failure };
    }
  }
  return null;
}

/** Rule 3 for `reviewer` (a username; null: nobody). `rows` in the list's order (newest first). */
export function reviewOrdered<R extends { readonly iid: number; readonly createdAt: number }, F>(
  rows: readonly R[],
  reviewer: string | null,
  dueOf: (iid: number) => CalendarDay | null,
  detailsOf: (iid: number) => ReviewDetails<F>,
): ReviewOrder<R, F> {
  const normal = byDueDate(rows, dueOf);
  const failed = firstFailed(normal, detailsOf);
  if (failed !== null) {
    return { kind: "failed", rows: normal, ...failed };
  }
  const ranked = normal.map((row): Ranked<R> => {
    const details = detailsOf(row.iid);
    const counts = details.kind === "read" ? turnCounts(details.discussions, reviewer) : NO_TURNS;
    const first = dueOf(row.iid) !== null && counts.viewersTurn > 0;
    return { row, first, waiting: counts.waiting };
  });
  const sorted = ranked.toSorted((a, b) => {
    if (a.first !== b.first) {
      return a.first ? -1 : 1;
    }
    return a.first ? 0 : a.waiting - b.waiting;
  });
  const loading = normal.filter((row) => detailsOf(row.iid).kind === "loading").length;
  return { kind: "sorted", rows: sorted.map(({ row }) => row), loading };
}

function loadingText(loading: number): string {
  if (loading === 0) {
    return "";
  }
  return loading === 1
    ? " (the discussions of 1 merge request are still loading; it moves when they arrive)"
    : ` (the discussions of ${loading} merge requests are still loading; they move when they arrive)`;
}

export function reviewSortedText(viewer: Viewer, loading: number): string {
  const whose = viewer.kind === "me" ? "your" : "their";
  return `Sorted for ${viewerPossessive(viewer, "inside")} review: due with ${whose} turn first, then fewest waiting on the author${loadingText(loading)}`;
}

export function reviewFailedText(viewer: Viewer, iid: number, reason: string): string {
  return `Not sorted for ${viewerPossessive(viewer, "inside")} review: the discussions of !${iid} could not be read. ${reason}`;
}
