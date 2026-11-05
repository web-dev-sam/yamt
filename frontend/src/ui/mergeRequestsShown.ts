import type { StorageLike } from "@vueuse/core";
import { computed, shallowRef, type ComputedRef, type Ref, type ShallowRef } from "vue";

import type { DiscussionDetails, MergeRequestIid, MergeRequestRow } from "../ipc";
import {
  filtered,
  reviewOrdered,
  searched,
  summaryText,
  viewerOf,
  type Filters,
  type ReviewDetails,
  type Viewer,
} from "../mergeRequests";
import { unmarkedOf } from "./mergeRequestDiscussionRows";
import type { DiscussionFailure, DiscussionLoad, Discussions } from "./mergeRequestDiscussions";
import type { DueDates } from "./mergeRequestDueDates";
import {
  choicesOf,
  createRememberedFilters,
  filterActions,
  type Choices,
  type FilterActions,
} from "./mergeRequestFilters";
import type { Threads } from "./mergeRequestThread";

export type ReviewSort =
  | { readonly kind: "sorted"; readonly loading: number }
  | { readonly kind: "failed"; readonly iid: MergeRequestIid; readonly failure: DiscussionFailure };

export type Shown = FilterActions & {
  readonly filters: Readonly<Ref<Filters>>;
  readonly shownRows: ComputedRef<readonly MergeRequestRow[]>;
  readonly choices: ComputedRef<Choices>;
  readonly summary: ComputedRef<string>;
  /** Rule 5: viewerOf(filters.review, me, rows). */
  readonly viewer: ComputedRef<Viewer>;
  /** The review order's state for the sort icon; null while the order is off (no review, or details not "full"). */
  readonly reviewSort: ComputedRef<ReviewSort | null>;
  /** Board item 2476: the discussions box of row `iid` opened: the row is held (`shownRows`) until it closes. */
  discussionsBoxOpened(iid: MergeRequestIid): void;
  discussionsBoxClosed(iid: MergeRequestIid): void;
};

type Listed = {
  readonly repository: Readonly<Ref<string | null>>;
  readonly me: Readonly<Ref<string | null>>;
  readonly rows: Readonly<Ref<readonly MergeRequestRow[]>>;
  readonly cut: Readonly<Ref<boolean>>;
  readonly search: Readonly<Ref<string>>;
  readonly dueDates: DueDates;
  readonly discussionDetails: () => DiscussionDetails;
  readonly discussionQueue: Pick<Discussions, "discussions">;
  readonly threads: Pick<Threads, "thread">;
  readonly openPeopleBoxes: Readonly<Ref<ReadonlySet<MergeRequestIid>>>;
};

type Ordered = { readonly rows: readonly MergeRequestRow[]; readonly sort: ReviewSort | null };

function reviewDetails(load: DiscussionLoad | undefined): ReviewDetails<DiscussionFailure> {
  if (load === undefined) {
    return { kind: "none" };
  }
  switch (load.kind) {
    case "loading":
      return load;
    case "read":
      return { kind: "read", discussions: unmarkedOf(load) };
    case "refused":
    case "failed":
      return { kind: "failed", failure: load };
  }
}

function ordered(listed: Listed, passing: readonly MergeRequestRow[], viewer: Viewer): Ordered {
  const loads: ReadonlyMap<number, DiscussionLoad> = listed.discussionQueue.discussions.value;
  const order = reviewOrdered(passing, viewer.username, listed.dueDates.dueOf, (iid) =>
    reviewDetails(loads.get(iid)),
  );
  return order.kind === "sorted"
    ? { rows: order.rows, sort: { kind: "sorted", loading: order.loading } }
    : { rows: order.rows, sort: { kind: "failed", iid: order.row.iid, failure: order.failure } };
}

/** Rule 9 and board item 2476: the rows whose people box, discussions box or thread panel is open. */
function heldOf(
  listed: Listed,
  discussionBoxes: ReadonlySet<MergeRequestIid>,
  panelRow: MergeRequestIid | null,
): Set<MergeRequestIid> {
  const held = new Set([...listed.openPeopleBoxes.value, ...discussionBoxes]);
  if (panelRow !== null) {
    held.add(panelRow);
  }
  return held;
}

/** A held row stays at its index in the order shown before; the other rows fill the rest in `next`'s order. */
function keptInPlace(
  previous: readonly MergeRequestRow[],
  next: readonly MergeRequestRow[],
  held: ReadonlySet<MergeRequestIid>,
): readonly MergeRequestRow[] {
  const nextOf = new Map(next.map((row) => [row.iid, row]));
  const kept = previous.flatMap((row, at) => {
    const now = held.has(row.iid) ? nextOf.get(row.iid) : undefined;
    return now === undefined ? [] : [{ row: now, at }];
  });
  const keptRows = new Set(kept.map(({ row }) => row));
  const order = next.filter((row) => !keptRows.has(row));
  for (const { row, at } of kept) {
    order.splice(at, 0, row);
  }
  return order;
}

function boxesOf(
  boxes: ShallowRef<ReadonlySet<MergeRequestIid>>,
): Pick<Shown, "discussionsBoxOpened" | "discussionsBoxClosed"> {
  return {
    discussionsBoxOpened: (iid) => {
      boxes.value = new Set(boxes.value).add(iid);
    },
    discussionsBoxClosed: (iid) => {
      const left = new Set(boxes.value);
      left.delete(iid);
      boxes.value = left;
    },
  };
}

export function shownOf(listed: Listed, storage?: StorageLike): Shown {
  const { me, rows, search } = listed;
  const remembered = createRememberedFilters(
    listed.repository,
    () => listed.discussionDetails() === "full",
    storage,
  );
  const { filters } = remembered;
  const viewer = computed(() => viewerOf(filters.value.review, me.value, rows.value));
  const discussionBoxes = shallowRef<ReadonlySet<MergeRequestIid>>(new Set());
  const panelRow = computed(() => listed.threads.thread.value?.shown.iid ?? null);
  const shown = computed((previous?: Ordered): Ordered => {
    const matching = new Set(searched(filtered(rows.value, filters.value, me.value), search.value));
    const held = heldOf(listed, discussionBoxes.value, panelRow.value);
    const passing = rows.value.filter((row) => matching.has(row) || held.has(row.iid));
    const next =
      filters.value.review === null
        ? { rows: listed.dueDates.datedFirst(passing), sort: null }
        : ordered(listed, passing, viewer.value);
    return previous === undefined
      ? next
      : { ...next, rows: keptInPlace(previous.rows, next.rows, held) };
  });
  const shownRows = computed(() => shown.value.rows);
  return {
    filters,
    shownRows,
    choices: computed(() => choicesOf(rows.value, filters.value, me.value)),
    summary: computed(() =>
      summaryText(shownRows.value.length, rows.value.length, listed.cut.value),
    ),
    viewer,
    reviewSort: computed(() => shown.value.sort),
    ...boxesOf(discussionBoxes),
    ...filterActions(remembered),
  };
}
