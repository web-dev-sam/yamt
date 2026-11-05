import {
  turnCounts,
  viewerAddressed,
  viewerPossessive,
  type OpenDiscussion,
  type TurnCounts,
  type Viewer,
} from "./discussions";
import type { CalendarDay } from "./dueDate";
import { byDueDate, dueFirst } from "./order";

/** A row's discussion details as the review order reads them (rule 6). */
export type ReviewDetails<F> =
  | { readonly kind: "none" }
  | { readonly kind: "loading" }
  | { readonly kind: "read"; readonly discussions: readonly OpenDiscussion[] }
  | { readonly kind: "failed"; readonly failure: F };
export type ReviewOrder<R, F> =
  | { readonly kind: "sorted"; readonly rows: readonly R[]; readonly loading: number }
  | { readonly kind: "failed"; readonly rows: readonly R[]; readonly row: R; readonly failure: F };

type Ranked<R> = { readonly row: R; readonly due: CalendarDay | null; readonly counts: TurnCounts };

const NO_TURNS: TurnCounts = { viewersTurn: 0, viewerWrote: 0, total: 0 };

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

/** D1 the due day as the normal order (plan §2 row 156); D2 most waiting for the reviewer; D3 fewest written in; 0 for
 *  a tie (D4: the stable sort keeps the normal order). */
function reviewFirst<R>(a: Ranked<R>, b: Ranked<R>): number {
  const days = dueFirst(a.due, b.due);
  if (days !== 0) {
    return days;
  }
  const waiting = b.counts.viewersTurn - a.counts.viewersTurn;
  return waiting === 0 ? a.counts.viewerWrote - b.counts.viewerWrote : waiting;
}

/** D1–D4 for `reviewer` (a username; null: nobody). `rows` in the list's order (newest first). */
export function reviewOrdered<
  R extends {
    readonly iid: number;
    readonly createdAt: number;
    readonly author: { readonly username: string } | null;
  },
  F,
>(
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
    const counts =
      details.kind === "read"
        ? turnCounts(details.discussions, reviewer, row.author?.username ?? null)
        : NO_TURNS;
    return { row, due: dueOf(row.iid), counts };
  });
  const sorted = ranked.toSorted(reviewFirst);
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
  const whom = viewerAddressed(viewer);
  return `Sorted for ${viewerPossessive(viewer, "inside")} review: soonest due date first, then most discussions waiting for ${whom}, then fewest discussions ${whom} wrote in${loadingText(loading)}`;
}

export function reviewFailedText(viewer: Viewer, iid: number, reason: string): string {
  return `Not sorted for ${viewerPossessive(viewer, "inside")} review: the discussions of !${iid} could not be read. ${reason}`;
}
