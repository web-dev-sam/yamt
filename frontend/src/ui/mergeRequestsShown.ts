import type { StorageLike } from "@vueuse/core";
import { computed, type ComputedRef, type Ref } from "vue";

import type { DiscussionDetails, MergeRequestIid, MergeRequestRow } from "../ipc";
import {
  filtered,
  reviewOrdered,
  searched,
  summaryText,
  viewerOf,
  type CalendarDay,
  type Filters,
  type ReviewDetails,
  type Viewer,
} from "../mergeRequests";
import type { DiscussionFailure, DiscussionLoad, Discussions } from "./mergeRequestDiscussions";
import type { DueDates } from "./mergeRequestDueDates";
import {
  choicesOf,
  createRememberedFilters,
  filterActions,
  type Choices,
  type FilterActions,
} from "./mergeRequestFilters";

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
};

type Ordered = { readonly rows: readonly MergeRequestRow[]; readonly sort: ReviewSort | null };

function reviewDetails(load: DiscussionLoad | undefined): ReviewDetails<DiscussionFailure> {
  if (load === undefined) {
    return { kind: "none" };
  }
  return load.kind === "refused" || load.kind === "failed"
    ? { kind: "failed", failure: load }
    : load;
}

function ordered(listed: Listed, passing: readonly MergeRequestRow[], viewer: Viewer): Ordered {
  const due: ReadonlyMap<number, CalendarDay> = listed.dueDates.dates.value;
  const loads: ReadonlyMap<number, DiscussionLoad> = listed.discussionQueue.discussions.value;
  const order = reviewOrdered(
    passing,
    viewer.username,
    (iid) => due.get(iid) ?? null,
    (iid) => reviewDetails(loads.get(iid)),
  );
  return order.kind === "sorted"
    ? { rows: order.rows, sort: { kind: "sorted", loading: order.loading } }
    : { rows: order.rows, sort: { kind: "failed", iid: order.row.iid, failure: order.failure } };
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
  const shown = computed((): Ordered => {
    const passing = searched(filtered(rows.value, filters.value, me.value), search.value);
    return filters.value.review === null
      ? { rows: listed.dueDates.datedFirst(passing), sort: null }
      : ordered(listed, passing, viewer.value);
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
    ...filterActions(remembered),
  };
}
