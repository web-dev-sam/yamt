import type { StorageLike } from "@vueuse/core";
import { computed, shallowRef, type ComputedRef, type Ref, type ShallowRef } from "vue";

import type {
  GitLabProject,
  ListEnd,
  MergeRequestIid,
  MergeRequestPage,
  MergeRequestRow,
  MergeRequestSource,
  OpenReply,
  WebPage,
} from "../ipc";
import {
  cleared,
  filtered,
  labelChoices,
  merged,
  NO_FILTERS,
  personChoices,
  summaryText,
  toggled,
  withDraft,
  type Choice,
  type DraftFilter,
  type Filters,
  type LabelValue,
  type ListFilter,
  type PersonValue,
} from "../mergeRequests";
import { RECHECK_PAUSE_MS } from "./glab";
import { createRememberedFilters } from "./mergeRequestFilters";
import { listFailureText, pageProblemText, type PageKind } from "./mergeRequestsText";
import { attempt, type Problem } from "./problem";
import type { Screen } from "./screen";

export type ListLoad =
  | { readonly kind: "notLoaded" }
  | { readonly kind: "loading"; readonly first: boolean }
  | { readonly kind: "done"; readonly end: ListEnd; readonly at: number };

export type Opening =
  | { readonly kind: "fetching" }
  | { readonly kind: "opened" }
  | { readonly kind: "refused"; readonly reply: Exclude<OpenReply, { readonly kind: "opened" }> };

type Choices = Readonly<{
  assignee: readonly Choice<PersonValue>[];
  reviewer: readonly Choice<PersonValue>[];
  label: readonly Choice<LabelValue>[];
}>;

export type MergeRequests = {
  readonly project: Readonly<ShallowRef<GitLabProject>>;
  readonly me: Readonly<ShallowRef<string | null>>;
  readonly rows: Readonly<ShallowRef<readonly MergeRequestRow[]>>;
  readonly listing: Readonly<ShallowRef<ListLoad>>;
  readonly failure: ComputedRef<string | null>;
  readonly filters: Readonly<Ref<Filters>>;
  readonly shownRows: ComputedRef<readonly MergeRequestRow[]>;
  readonly choices: ComputedRef<Choices>;
  readonly summary: ComputedRef<string>;
  readonly openings: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>>;
  readonly pageProblem: Readonly<ShallowRef<string | null>>;
  findProject(): Promise<void>;
  show(): void;
  close(): void;
  refresh(): Promise<void>;
  toggle(filter: ListFilter, value: PersonValue | LabelValue): void;
  setDraft(draft: DraftFilter): void;
  clear(filter: ListFilter): void;
  clearAll(): void;
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
  readonly me: ShallowRef<string | null>;
  readonly rows: ShallowRef<readonly MergeRequestRow[]>;
  readonly cut: ShallowRef<boolean>;
  readonly listing: ShallowRef<ListLoad>;
  readonly openings: ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>;
  readonly pageProblem: ShallowRef<string | null>;
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
  }
  state.listing.value = { kind: "done", end, at: Date.now() };
}

async function load(state: State): Promise<void> {
  const before = state.listing.value;
  if (before.kind === "loading") {
    return;
  }
  const first = state.rows.value.length === 0;
  const running: Load = { buffered: !first, buffer: [], me: null };
  state.listing.value = { kind: "loading", first };
  const outcome = await attempt(() =>
    state.source.listMergeRequests((page) => {
      received(state, running, page);
    }),
  );
  if (outcome.ok) {
    ended(state, running, outcome.value);
    return;
  }
  state.listing.value = before;
  if (first) {
    state.rows.value = [];
  }
  state.report({ action: "mergeRequests", step: "list", cause: outcome.cause });
}

function show(state: State): void {
  state.screen.value = { kind: "mergeRequests" };
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

function setOpening(state: State, iid: MergeRequestIid, opening: Opening | null): void {
  const openings = new Map(state.openings.value);
  if (opening === null) {
    openings.delete(iid);
  } else {
    openings.set(iid, opening);
  }
  state.openings.value = openings;
}

async function openChanges(state: State, iid: MergeRequestIid): Promise<void> {
  if (state.openings.value.get(iid)?.kind === "fetching") {
    return;
  }
  setOpening(state, iid, { kind: "fetching" });
  const outcome = await attempt(() => state.source.openMergeRequest(iid));
  if (!outcome.ok) {
    setOpening(state, iid, null);
    state.report({ action: "mergeRequests", step: "open", cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  setOpening(state, iid, reply.kind === "opened" ? { kind: "opened" } : { kind: "refused", reply });
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
  return {
    ...deps,
    project: shallowRef<GitLabProject>({ kind: "none" }),
    me: shallowRef<string | null>(null),
    rows: shallowRef<readonly MergeRequestRow[]>([]),
    cut: shallowRef(false),
    listing: shallowRef<ListLoad>({ kind: "notLoaded" }),
    openings: shallowRef<ReadonlyMap<MergeRequestIid, Opening>>(new Map()),
    pageProblem: shallowRef<string | null>(null),
  };
}

function choicesOf(rows: readonly MergeRequestRow[], filters: Filters, me: string | null): Choices {
  return {
    assignee: personChoices(rows, "assignees", me, filters.assignee),
    reviewer: personChoices(rows, "reviewers", me, filters.reviewer),
    label: labelChoices(rows, filters.label),
  };
}

type RememberedFilters = ReturnType<typeof createRememberedFilters>;

function filterActions(
  remembered: RememberedFilters,
): Pick<MergeRequests, "toggle" | "setDraft" | "clear" | "clearAll"> {
  const { filters } = remembered;
  return {
    toggle: (filter, value) => {
      remembered.set(toggled(filters.value, filter, value));
    },
    setDraft: (draft) => {
      remembered.set(withDraft(filters.value, draft));
    },
    clear: (filter) => {
      remembered.set(cleared(filters.value, filter));
    },
    clearAll: () => {
      remembered.set(NO_FILTERS);
    },
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

export function createMergeRequests(deps: Deps): MergeRequests {
  const state = createState(deps);
  const { project, me, rows } = state;
  const remembered = createRememberedFilters(
    computed(() => (project.value.kind === "found" ? project.value.repository : null)),
    deps.storage,
  );
  const { filters } = remembered;
  const shownRows = computed(() => filtered(rows.value, filters.value, me.value));
  return {
    project,
    me,
    rows,
    ...listingOf(state),
    filters,
    shownRows,
    choices: computed(() => choicesOf(rows.value, filters.value, me.value)),
    summary: computed(() =>
      summaryText(shownRows.value.length, rows.value.length, state.cut.value),
    ),
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
    ...filterActions(remembered),
    openChanges: (iid) => openChanges(state, iid),
    openPage: (clicked, page) => openPage(state, clicked, page),
    dismissPageProblem: () => {
      state.pageProblem.value = null;
    },
  };
}
