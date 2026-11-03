import type { StorageLike } from "@vueuse/core";
import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  DiscussionDetails,
  GitLabProject,
  MergeRequestIid,
  MergeRequestPeople,
  MergeRequestRow,
  MergeRequestSource,
  OpenReply,
  WebPage,
} from "../ipc";
import type { CalendarDay } from "../mergeRequests";
import { RECHECK_PAUSE_MS } from "./glab";
import { claimRow, createRowActions, setRow, type RowActions } from "./mergeRequestActions";
import {
  createDiscussions,
  discussionsOf,
  type DiscussionQueue,
  type Discussions,
} from "./mergeRequestDiscussions";
import { createDueDates, type DueDates } from "./mergeRequestDueDates";
import { createJobLogs, type JobLogs } from "./mergeRequestJobLogs";
import { createPeopleChanges, type PeopleChanges } from "./mergeRequestPeople";
import { createRerequests, type Rerequests } from "./mergeRequestRerequests";
import { loadList, type ListLoad, type ListState } from "./mergeRequestsList";
import { shownOf, type Shown } from "./mergeRequestsShown";
import { listFailureText, pageProblemText, type PageKind } from "./mergeRequestsText";
import { attempt, type Problem } from "./problem";
import type { Screen } from "./screen";

export type {
  NotDone,
  PeopleChangeFailure,
  PeopleSearch,
  RowPeopleAsks,
} from "./mergeRequestPeople";
export type { RerequestAsk } from "./mergeRequestRerequests";
export type { ListLoad } from "./mergeRequestsList";

export type Opening =
  | { readonly kind: "fetching" }
  | { readonly kind: "refused"; readonly reply: Exclude<OpenReply, { readonly kind: "opened" }> };

export type MergeRequests = RowActions &
  Rerequests &
  JobLogs &
  Discussions &
  Shown &
  PeopleChanges & {
    readonly project: Readonly<ShallowRef<GitLabProject>>;
    readonly me: Readonly<ShallowRef<string | null>>;
    readonly rows: Readonly<ShallowRef<readonly MergeRequestRow[]>>;
    readonly listing: Readonly<ShallowRef<ListLoad>>;
    readonly listedAt: Readonly<ShallowRef<number | null>>;
    readonly failure: ComputedRef<string | null>;
    readonly search: Readonly<ShallowRef<string>>;
    readonly dueDates: ComputedRef<ReadonlyMap<MergeRequestIid, CalendarDay>>;
    readonly openings: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>>;
    readonly pageProblem: Readonly<ShallowRef<string | null>>;
    findProject(): Promise<void>;
    show(): void;
    close(): void;
    refresh(): Promise<void>;
    setSearch(text: string): void;
    setDueDate(iid: MergeRequestIid, day: CalendarDay | null): void;
    openChanges(iid: MergeRequestIid): Promise<void>;
    openPage(clicked: PageKind, page: WebPage): Promise<void>;
    dismissPageProblem(): void;
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
  };

function withPeople(state: State, iid: MergeRequestIid, people: Partial<MergeRequestPeople>): void {
  function changed(rows: readonly MergeRequestRow[]): readonly MergeRequestRow[] {
    return rows.map((row) => (row.iid === iid ? { ...row, ...people } : row));
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
        withPeople(state, iid, { reviewers });
      },
    }),
    ...createPeopleChanges({
      source,
      replaced: (iid, people) => {
        withPeople(state, iid, people);
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

async function findProject(state: State): Promise<void> {
  const outcome = await attempt(() => state.source.findGitLabProject());
  if (outcome.ok) {
    state.project.value = outcome.value;
  } else {
    state.report({ action: "mergeRequests", step: "find", cause: outcome.cause });
  }
}

async function openChanges(state: State, iid: MergeRequestIid): Promise<void> {
  if (!claimRow(state.openings, iid, { kind: "fetching" })) {
    return;
  }
  const outcome = await attempt(() => state.source.openMergeRequest(iid));
  if (!outcome.ok) {
    setRow(state.openings, iid, null);
    state.report({ action: "mergeRequests", step: "open", cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  setRow(state.openings, iid, reply.kind === "opened" ? null : { kind: "refused", reply });
}

async function openPage(state: State, clicked: PageKind, page: WebPage): Promise<void> {
  const outcome = await attempt(() => state.source.openPage(page));
  if (!outcome.ok) {
    state.report({ action: "mergeRequests", step: clicked, cause: outcome.cause });
    return;
  }
  state.pageProblem.value = pageProblemText(outcome.value, clicked);
}

function createState(deps: Deps): State {
  const project = shallowRef<GitLabProject>({ kind: "none" });
  const repository = computed(() =>
    project.value.kind === "found" ? project.value.repository : null,
  );
  const rows = shallowRef<readonly MergeRequestRow[]>([]);
  const mode = deps.discussionDetails;
  return {
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
    discussionQueue: createDiscussions({ ...deps, mode, rows: () => rows.value }),
    shown: null,
    running: null,
  };
}

function dueDatesOf({ dueDates }: State): Pick<MergeRequests, "dueDates" | "setDueDate"> {
  return {
    dueDates: dueDates.dates,
    setDueDate: (iid, day) => {
      dueDates.set(iid, day);
    },
  };
}

export function createMergeRequests(deps: Deps): MergeRequests {
  const state = createState(deps);
  const { me, rows, search } = state;
  const people = peopleOf(state);
  return {
    project: state.project,
    me,
    rows,
    listing: state.listing,
    listedAt: state.listedAt,
    failure: computed(() =>
      state.listing.value.kind === "done" ? listFailureText(state.listing.value.end) : null,
    ),
    ...shownOf({ ...state, openPeopleBoxes: people.openPeopleBoxes }, deps.storage),
    search,
    setSearch: (text) => {
      search.value = text;
    },
    ...dueDatesOf(state),
    openings: state.openings,
    pageProblem: state.pageProblem,
    findProject: () => findProject(state),
    show: () => {
      show(state);
    },
    close: () => {
      state.screen.value = { kind: "files" };
    },
    refresh: () => loadList(state),
    openChanges: (iid) => openChanges(state, iid),
    openPage: (clicked, page) => openPage(state, clicked, page),
    dismissPageProblem: () => {
      state.pageProblem.value = null;
    },
    ...state.rowActions,
    ...people,
    ...createJobLogs(deps),
    ...discussionsOf(state.discussionQueue),
  };
}
