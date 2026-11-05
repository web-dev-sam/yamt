import type { StorageLike } from "@vueuse/core";
import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  DiscussionDetails,
  GitLabProject,
  MergeRequestIid,
  MergeRequestRow,
  MergeRequestSource,
} from "../ipc";
import type { CalendarDay } from "../mergeRequests";
import { RECHECK_PAUSE_MS } from "./glab";
import { createRowActions, type RowActions } from "./mergeRequestActions";
import { createDescriptions, type Descriptions } from "./mergeRequestDescriptions";
import {
  createDiscussions,
  discussionsOf,
  type DiscussionQueue,
  type Discussions,
} from "./mergeRequestDiscussions";
import { createDueDates, type DueDates } from "./mergeRequestDueDates";
import { createJobLogs, type JobLogs } from "./mergeRequestJobLogs";
import { createLinks, linksOf, type LinkQueue, type Links } from "./mergeRequestLinks";
import {
  createPeopleChanges,
  createPeopleSearch,
  type PeopleChanges,
  type PeopleSearcher,
} from "./mergeRequestPeople";
import { createPersonView, type PersonView } from "./mergeRequestPersonView";
import { createRerequests, type Rerequests } from "./mergeRequestRerequests";
import { loadList, type ListLoad, type ListState } from "./mergeRequestsList";
import { pagesOf, type Opening, type Pages } from "./mergeRequestsPages";
import { createRefreshes, type Refreshes } from "./mergeRequestsRefresh";
import { shownOf, type Shown } from "./mergeRequestsShown";
import { listFailureText } from "./mergeRequestsText";
import { createThreads, type Threads } from "./mergeRequestThread";
import type { Problem } from "./problem";
import type { Screen } from "./screen";

export type {
  NotDone,
  PeopleChangeFailure,
  PeopleSearch,
  RowPeopleAsks,
} from "./mergeRequestPeople";
export { rowPeopleAsks } from "./mergeRequestPeople";
export type { RerequestAsk } from "./mergeRequestRerequests";
export type { ListLoad } from "./mergeRequestsList";

export type { Opening } from "./mergeRequestsPages";

export type MergeRequests = RowActions &
  Rerequests &
  JobLogs &
  Descriptions &
  Discussions &
  Threads &
  Links &
  Shown &
  Refreshes &
  PersonView &
  Pages &
  PeopleChanges & {
    /** The mention list's own search (request rule 6): a second instance, never the people box's. */
    readonly mentionSearch: PeopleSearcher;
    readonly project: Readonly<ShallowRef<GitLabProject>>;
    readonly me: Readonly<ShallowRef<string | null>>;
    readonly rows: Readonly<ShallowRef<readonly MergeRequestRow[]>>;
    readonly listing: Readonly<ShallowRef<ListLoad>>;
    readonly listedAt: Readonly<ShallowRef<number | null>>;
    readonly failure: ComputedRef<string | null>;
    readonly search: Readonly<ShallowRef<string>>;
    readonly dueDates: ComputedRef<ReadonlyMap<MergeRequestIid, CalendarDay>>;
    readonly openings: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>>;
    show(): void;
    close(): void;
    setSearch(text: string): void;
    setDueDate(iid: MergeRequestIid, day: CalendarDay | null): void;
  };

type Deps = {
  readonly source: MergeRequestSource;
  readonly screen: ShallowRef<Screen>;
  readonly report: (problem: Problem) => void;
  readonly storage?: StorageLike;
  readonly discussionDetails: () => DiscussionDetails;
};

type State = Deps &
  ListState & {
    readonly project: ShallowRef<GitLabProject>;
    readonly repository: ComputedRef<string | null>;
    readonly openings: ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>;
    readonly search: ShallowRef<string>;
    readonly pageProblem: ShallowRef<string | null>;
    readonly dueDates: DueDates;
    readonly rowActions: RowActions;
    readonly discussionQueue: DiscussionQueue;
    readonly linkQueue: LinkQueue;
    readonly threads: Threads;
    readonly threadsRefreshed: (iid: MergeRequestIid | null, asked?: Promise<void>) => void;
  };

type RowPatch = Partial<Pick<MergeRequestRow, "assignees" | "reviewers" | "openDiscussions">>;

function withRow(state: State, iid: MergeRequestIid, partial: RowPatch): void {
  function changed(rows: readonly MergeRequestRow[]): readonly MergeRequestRow[] {
    return rows.map((row) => (row.iid === iid ? { ...row, ...partial } : row));
  }
  state.rows.value = changed(state.rows.value);
  if (state.running?.buffered === true) {
    state.running.buffer = changed(state.running.buffer);
  }
}

function peopleOf(state: State): Rerequests & PeopleChanges {
  const { source, report } = state;
  return {
    ...createRerequests({
      source,
      report,
      replaced: (iid, reviewers) => {
        withRow(state, iid, { reviewers });
      },
    }),
    ...createPeopleChanges({
      source,
      replaced: (iid, people) => {
        withRow(state, iid, people);
      },
    }),
  };
}

function show(state: State): void {
  state.screen.value = { kind: "mergeRequests" };
  state.search.value = "";
  void state.rowActions.checkLocalMerge();
  const listing = state.listing.value;
  const stale = listing.kind === "done" && Date.now() - listing.at >= RECHECK_PAUSE_MS;
  if (listing.kind === "notLoaded" || stale) {
    void loadList(state);
  }
}

function discussingOf(
  deps: Deps,
  rows: () => readonly MergeRequestRow[],
  counted: (iid: MergeRequestIid, count: number) => void,
): Pick<State, "discussionQueue" | "threads" | "threadsRefreshed"> {
  const { source, discussionDetails: mode } = deps;
  const discussionQueue = createDiscussions({ source, mode, rows, counted });
  const { refreshed, ...threads } = createThreads({ source, discussions: discussionQueue });
  return { discussionQueue, threads, threadsRefreshed: refreshed };
}

function createState(deps: Deps, viewReplaced: () => void): State {
  const project = shallowRef<GitLabProject>({ kind: "none" });
  const repository = computed(() =>
    project.value.kind === "found" ? project.value.repository : null,
  );
  const rows = shallowRef<readonly MergeRequestRow[]>([]);
  const state: State = {
    ...deps,
    project,
    repository,
    me: shallowRef<string | null>(null),
    rows,
    cut: shallowRef(false),
    search: shallowRef(""),
    listing: shallowRef<ListLoad>({ kind: "notLoaded" }),
    listedAt: shallowRef<number | null>(null),
    openings: shallowRef<ReadonlyMap<MergeRequestIid, Opening>>(new Map()),
    pageProblem: shallowRef<string | null>(null),
    dueDates: createDueDates(repository, deps.storage),
    rowActions: createRowActions(deps),
    ...discussingOf(
      deps,
      () => rows.value,
      (iid, openDiscussions) => {
        withRow(state, iid, { openDiscussions });
      },
    ),
    linkQueue: createLinks(deps),
    rowsReplaced: (replaced) => {
      state.discussionQueue.replaced(replaced);
      state.linkQueue.dropped();
      state.threadsRefreshed(null);
      viewReplaced();
    },
    shown: null,
    running: null,
  };
  return state;
}

function dueDatesOf({ dueDates }: State): Pick<MergeRequests, "dueDates" | "setDueDate"> {
  return {
    dueDates: dueDates.dates,
    setDueDate: (iid, day) => {
      dueDates.set(iid, day);
    },
  };
}

/** The list's shown rows and the person view over them; `rowsReplaced` is the view's. */
function shownAndViewOf(
  state: State,
  people: PeopleChanges,
): Shown & PersonView & { readonly rowsReplaced: () => void } {
  const shown = shownOf({ ...state, openPeopleBoxes: people.openPeopleBoxes }, state.storage);
  return { ...shown, ...createPersonView({ ...state, ...shown, queue: state.discussionQueue }) };
}

function screensOf(state: State, view: PersonView): Pick<MergeRequests, "show" | "close"> {
  return {
    show: () => {
      show(state);
    },
    close: () => {
      view.leavePersonView();
      state.screen.value = { kind: "files" };
    },
  };
}

export function createMergeRequests(deps: Deps): MergeRequests {
  const state = createState(deps, () => {
    replaced();
  });
  const { me, rows, search } = state;
  const people = peopleOf(state);
  const { rowsReplaced: replaced, ...shown } = shownAndViewOf(state, people);
  return {
    project: state.project,
    me,
    rows,
    listing: state.listing,
    listedAt: state.listedAt,
    failure: computed(() =>
      state.listing.value.kind === "done" ? listFailureText(state.listing.value.end) : null,
    ),
    ...shown,
    search,
    setSearch: (text) => {
      search.value = text;
    },
    ...dueDatesOf(state),
    openings: state.openings,
    ...pagesOf(state),
    ...screensOf(state, shown),
    ...createRefreshes(state),
    ...state.rowActions,
    ...people,
    mentionSearch: createPeopleSearch(deps.source),
    ...createJobLogs(deps),
    ...createDescriptions(deps),
    ...discussionsOf(state.discussionQueue),
    ...state.threads,
    ...linksOf(state.linkQueue),
  };
}
