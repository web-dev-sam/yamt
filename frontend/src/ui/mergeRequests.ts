import type { StorageLike } from "@vueuse/core";
import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  CheckedRow,
  GitLabProject,
  ListEnd,
  MergeRequestIid,
  MergeRequestPage,
  MergeRequestRow,
  MergeRequestSource,
  OpenReply,
  Reviewer,
  WebPage,
} from "../ipc";
import { merged, rechecked, type CalendarDay } from "../mergeRequests";
import { RECHECK_PAUSE_MS } from "./glab";
import { claimRow, createRowActions, setRow, type RowActions } from "./mergeRequestActions";
import { createDueDates, type DueDates } from "./mergeRequestDueDates";
import { createJobLogs, type JobLogs } from "./mergeRequestJobLogs";
import { createRerequests, type Rerequests } from "./mergeRequestRerequests";
import { shownOf, type Shown } from "./mergeRequestsShown";
import { listFailureText, pageProblemText, type PageKind } from "./mergeRequestsText";
import { attempt, type Problem } from "./problem";
import type { Screen } from "./screen";

export type { RerequestAsk } from "./mergeRequestRerequests";

export type ListLoad =
  | { readonly kind: "notLoaded" }
  | { readonly kind: "loading"; readonly first: boolean }
  | { readonly kind: "done"; readonly end: ListEnd; readonly at: number };

export type Opening =
  | { readonly kind: "fetching" }
  | { readonly kind: "refused"; readonly reply: Exclude<OpenReply, { readonly kind: "opened" }> };

export type MergeRequests = RowActions &
  Rerequests &
  JobLogs &
  Shown & {
    readonly project: Readonly<ShallowRef<GitLabProject>>;
    readonly me: Readonly<ShallowRef<string | null>>;
    readonly rows: Readonly<ShallowRef<readonly MergeRequestRow[]>>;
    readonly listing: Readonly<ShallowRef<ListLoad>>;
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
};

type Load = { readonly buffered: boolean; buffer: readonly MergeRequestRow[]; me: string | null };

type State = Deps & {
  readonly project: ShallowRef<GitLabProject>;
  readonly repository: ComputedRef<string | null>;
  readonly me: ShallowRef<string | null>;
  readonly rows: ShallowRef<readonly MergeRequestRow[]>;
  readonly cut: ShallowRef<boolean>;
  readonly listing: ShallowRef<ListLoad>;
  readonly openings: ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>;
  readonly search: ShallowRef<string>;
  readonly pageProblem: ShallowRef<string | null>;
  readonly dueDates: DueDates;
  readonly rowActions: RowActions;
  shown: Load | null;
  running: Load | null;
};

function received(state: State, load: Load, { me, rows }: MergeRequestPage): void {
  if (load.buffered) {
    load.buffer = merged(load.buffer, rows);
    load.me = me;
    return;
  }
  state.rows.value = merged(state.rows.value, rows);
  state.me.value = me;
}

function ended(state: State, load: Load, end: ListEnd): void {
  const listed = listFailureText(end) === null;
  if (listed) {
    state.cut.value = end.kind === "cut";
  }
  if (load.buffered && listed) {
    state.rows.value = load.buffer;
    state.me.value = load.me;
    state.shown = load;
  }
  if (end.kind === "loaded") {
    state.dueDates.keepOnly(new Set(state.rows.value.map((row) => row.iid)));
  }
  state.listing.value = { kind: "done", end, at: Date.now() };
}

function checked(state: State, load: Load, row: CheckedRow): void {
  if (state.shown === load) {
    state.rows.value = rechecked(state.rows.value, row);
  } else {
    load.buffer = rechecked(load.buffer, row);
  }
}

function rerequestsOf(state: State): Rerequests {
  function replaced(iid: MergeRequestIid, reviewers: readonly Reviewer[]): void {
    function withReviewers(rows: readonly MergeRequestRow[]): readonly MergeRequestRow[] {
      return rows.map((row) => (row.iid === iid ? { ...row, reviewers } : row));
    }
    state.rows.value = withReviewers(state.rows.value);
    if (state.running?.buffered === true) {
      state.running.buffer = withReviewers(state.running.buffer);
    }
  }
  return createRerequests({ source: state.source, report: state.report, replaced });
}

async function load(state: State): Promise<void> {
  const before = state.listing.value;
  if (before.kind === "loading") {
    return;
  }
  const first = state.rows.value.length === 0;
  const running: Load = { buffered: !first, buffer: [], me: null };
  if (first) {
    state.shown = running;
  }
  state.listing.value = { kind: "loading", first };
  state.running = running;
  const outcome = await attempt(() =>
    state.source.listMergeRequests(
      (page) => received(state, running, page),
      (row) => checked(state, running, row),
    ),
  );
  state.running = null;
  if (outcome.ok) {
    ended(state, running, outcome.value);
    return;
  }
  state.listing.value = before;
  if (first) {
    state.rows.value = [];
    state.shown = null;
  }
  state.report({ action: "mergeRequests", step: "list", cause: outcome.cause });
}

function show(state: State): void {
  state.screen.value = { kind: "mergeRequests" };
  state.search.value = "";
  void state.rowActions.checkLocalMerge();
  const listing = state.listing.value;
  const stale = listing.kind === "done" && Date.now() - listing.at >= RECHECK_PAUSE_MS;
  if (listing.kind === "notLoaded" || stale) {
    void load(state);
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
  return {
    ...deps,
    project,
    repository,
    me: shallowRef<string | null>(null),
    rows: shallowRef<readonly MergeRequestRow[]>([]),
    cut: shallowRef(false),
    search: shallowRef(""),
    listing: shallowRef<ListLoad>({ kind: "notLoaded" }),
    openings: shallowRef<ReadonlyMap<MergeRequestIid, Opening>>(new Map()),
    pageProblem: shallowRef<string | null>(null),
    dueDates: createDueDates(repository, deps.storage),
    rowActions: createRowActions(deps),
    shown: null,
    running: null,
  };
}

function listingOf(state: State): Pick<MergeRequests, "listing" | "failure"> {
  const { listing } = state;
  return {
    listing,
    failure: computed(() =>
      listing.value.kind === "done" ? listFailureText(listing.value.end) : null,
    ),
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
  return {
    project: state.project,
    me,
    rows,
    ...listingOf(state),
    ...shownOf(state, deps.storage),
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
    refresh: () => load(state),
    openChanges: (iid) => openChanges(state, iid),
    openPage: (clicked, page) => openPage(state, clicked, page),
    dismissPageProblem: () => {
      state.pageProblem.value = null;
    },
    ...state.rowActions,
    ...rerequestsOf(state),
    ...createJobLogs(deps),
  };
}
