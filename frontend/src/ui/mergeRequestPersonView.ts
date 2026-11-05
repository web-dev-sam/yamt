import { computed, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from "vue";

import type {
  DiscussionId,
  MergeRequestIid,
  MergeRequestRow,
  MergeRequestSource,
  OpenDiscussion,
  Person,
} from "../ipc";
import {
  keptInPlace,
  personEntries,
  personLines,
  turnCounts,
  type PersonEntry,
  type PersonLine,
  type TurnCounts,
  type Viewer,
} from "../mergeRequests";
import { unmarkedOf } from "./mergeRequestDiscussionRows";
import type {
  DiscussionFailure,
  DiscussionLoad,
  DiscussionQueue,
  Reload,
} from "./mergeRequestDiscussions";
import { askAgain } from "./mergeRequestsRefresh";
import type { Threads } from "./mergeRequestThread";

export type PersonEntryShown = PersonEntry<OpenDiscussion, MergeRequestRow> & {
  /** Resolved from the view (the entry's mark, C3): shown "Resolved" until Back or a reload. */
  readonly resolved: boolean;
};
export type PersonFailure = { readonly row: MergeRequestRow; readonly failure: DiscussionFailure };
export type PersonViewShown = {
  readonly person: Viewer;
  readonly entries: readonly PersonEntryShown[];
  /** F1 over the shown rows with `openDiscussions > 0`; null once every one has an answered entry. */
  readonly loading: { readonly answered: number; readonly asked: number } | null;
  /** F2: each shown row whose entry is refused/failed, or whose reload failed, in the list's order. */
  readonly failures: readonly PersonFailure[];
  /** B2: personLines over the shown rows and every writer of their read discussions. */
  readonly people: readonly PersonLine<Person>[];
  /** For turnSummaryText: turnCounts of each row's unresolved discussions for the person, summed. */
  readonly counts: TurnCounts;
  /** A reload of a shown row is running (the header's icon spins). */
  readonly reloading: boolean;
};
export type PersonView = {
  /** null: the page shows its row list. */
  readonly personView: ComputedRef<PersonViewShown | null>;
  /** A1, B1: the person is the slice's `viewer` (Me, or review mode's reviewer); held empty. */
  openPersonView(): void;
  /** A1 Back: every expanded entry collapses, `boxClosed(iid)` for each row with resolved marks, `viewLeft()`, null. */
  leavePersonView(): void;
  /** B2: re-sorts everything (held becomes the expanded entries; the previous order is not kept). */
  pickPerson(person: Viewer): void;
  /** E1, E2: `expandThread` + held; already expanded: nothing. */
  expandEntry(iid: MergeRequestIid, discussion: DiscussionId): void;
  /** E2: `collapseThread`; the entry stays held. */
  collapseEntry(discussion: DiscussionId): void;
  /** F2. */
  retryRow(iid: MergeRequestIid): void;
  /** C4: one askGitLabAgain, `reloadRows` of every shown row with a count or an entry, then `threadsRefreshed(null)`;
   *  held becomes the expanded entries once the reloads are queued. */
  refreshPersonView(): void;
};

type Deps = {
  readonly source: MergeRequestSource;
  readonly me: Readonly<Ref<string | null>>;
  readonly viewer: Readonly<Ref<Viewer>>;
  readonly shownRows: Readonly<Ref<readonly MergeRequestRow[]>>;
  readonly queue: Pick<
    DiscussionQueue,
    "discussions" | "reloads" | "wantRows" | "retryRows" | "reloadRows" | "viewLeft" | "boxClosed"
  >;
  readonly threads: Pick<Threads, "expanded" | "expandThread" | "collapseThread">;
  readonly threadsRefreshed: (iid: MergeRequestIid | null, asked?: Promise<void>) => void;
};

/** C3: the entries expanded since `order` was raised (opening, a pick, a refresh) keep their places under it. */
type Open = {
  readonly person: Viewer;
  readonly held: ReadonlySet<DiscussionId>;
  readonly order: number;
};
/** The entries in their shown order, made under `open`. */
type Ordered = { readonly entries: readonly PersonEntryShown[]; readonly open: Open };
type Read = { readonly row: MergeRequestRow; readonly entry: ReadLoad };
type ReadLoad = Extract<DiscussionLoad, { kind: "read" }>;
type View = { readonly state: ShallowRef<Open | null>; readonly reordered: () => number };

function readRows(deps: Deps): readonly Read[] {
  const loads = deps.queue.discussions.value;
  return deps.shownRows.value.flatMap((row) => {
    const entry = loads.get(row.iid);
    return entry?.kind === "read" ? [{ row, entry }] : [];
  });
}

function entriesOf(read: readonly Read[], person: Viewer): readonly PersonEntryShown[] {
  const resolved = new Set(read.flatMap(({ entry }) => [...entry.resolved]));
  const listed = read.map(({ row, entry }) => ({ row, discussions: entry.discussions }));
  return personEntries(listed, person.username).map((shown) => ({
    ...shown,
    resolved: resolved.has(shown.discussion.id),
  }));
}

function loadingOf(deps: Deps): PersonViewShown["loading"] {
  const loads = deps.queue.discussions.value;
  const asked = deps.shownRows.value.filter((row) => row.openDiscussions > 0);
  const answered = asked.filter((row) => {
    const kind = loads.get(row.iid)?.kind;
    return kind !== undefined && kind !== "loading";
  }).length;
  return answered === asked.length ? null : { answered, asked: asked.length };
}

function failureOf(
  entry: DiscussionLoad | undefined,
  reload: Reload | undefined,
): DiscussionFailure | null {
  if (entry?.kind === "refused" || entry?.kind === "failed") {
    return entry;
  }
  return reload === undefined || reload.kind === "running" ? null : reload;
}

function failuresOf(deps: Deps): readonly PersonFailure[] {
  const loads = deps.queue.discussions.value;
  const reloads = deps.queue.reloads.value;
  return deps.shownRows.value.flatMap((row) => {
    const failure = failureOf(loads.get(row.iid), reloads.get(row.iid));
    return failure === null ? [] : [{ row, failure }];
  });
}

function countsOf(read: readonly Read[], person: Viewer): TurnCounts {
  const each = read.map(({ row, entry }) =>
    turnCounts(unmarkedOf(entry), person.username, row.author?.username ?? null),
  );
  function sum(key: keyof TurnCounts): number {
    return each.reduce((total, counts) => total + counts[key], 0);
  }
  return { viewersTurn: sum("viewersTurn"), viewerWrote: sum("viewerWrote"), total: sum("total") };
}

function shownOf(deps: Deps, { open, entries }: Ordered): PersonViewShown {
  const read = readRows(deps);
  const writers = read.flatMap(({ entry }) =>
    entry.discussions.flatMap((discussion) =>
      [...discussion.earlier, discussion.last].map((comment) => comment.author),
    ),
  );
  const reloads = deps.queue.reloads.value;
  return {
    person: open.person,
    entries,
    loading: loadingOf(deps),
    failures: failuresOf(deps),
    people: personLines(deps.shownRows.value, writers, deps.me.value, open.person),
    counts: countsOf(read, open.person),
    reloading: deps.shownRows.value.some((row) => reloads.get(row.iid)?.kind === "running"),
  };
}

function orderedOf(deps: Deps, state: ShallowRef<Open | null>): ComputedRef<Ordered | null> {
  return computed((previous?: Ordered | null): Ordered | null => {
    const open = state.value;
    if (open === null) {
      return null;
    }
    const next = entriesOf(readRows(deps), open.person);
    const entries =
      previous?.open.order === open.order
        ? keptInPlace(previous.entries, next, open.held, (shown) => shown.discussion.id)
        : next;
    return { entries, open };
  });
}

/** F1, RK61: while the view is open, every shown row with open discussions and no entry is wanted. */
function demand(deps: Deps, state: ShallowRef<Open | null>): void {
  watch([state, deps.shownRows, deps.queue.discussions], () => {
    if (state.value === null) {
      return;
    }
    const loads = deps.queue.discussions.value;
    const missing = deps.shownRows.value
      .filter((row) => row.openDiscussions > 0 && !loads.has(row.iid))
      .map((row) => row.iid);
    deps.queue.wantRows(missing);
  });
}

/** The view re-sorted: held becomes the expanded entries. */
function resorted(deps: Deps, view: View, person?: Viewer): void {
  const open = view.state.value;
  if (open !== null) {
    view.state.value = {
      person: person ?? open.person,
      held: new Set(deps.threads.expanded.value),
      order: view.reordered(),
    };
  }
}

function leave(deps: Deps, state: ShallowRef<Open | null>): void {
  if (state.value === null) {
    return;
  }
  for (const discussion of deps.threads.expanded.value) {
    deps.threads.collapseThread(discussion);
  }
  for (const iid of deps.queue.discussions.value.keys()) {
    deps.queue.boxClosed(iid);
  }
  deps.queue.viewLeft();
  state.value = null;
}

function refresh(deps: Deps, view: View): void {
  if (view.state.value === null) {
    return;
  }
  const loads = deps.queue.discussions.value;
  const iids = deps.shownRows.value
    .filter((row) => row.openDiscussions > 0 || loads.has(row.iid))
    .map((row) => row.iid);
  const asked = askAgain(deps.source);
  deps.queue.reloadRows(iids, () => asked);
  deps.threadsRefreshed(null, asked);
  resorted(deps, view);
}

function actionsOf(deps: Deps, view: View): Omit<PersonView, "personView"> {
  const { state } = view;
  return {
    openPersonView: () => {
      state.value = { person: deps.viewer.value, held: new Set(), order: view.reordered() };
    },
    leavePersonView: () => {
      leave(deps, state);
    },
    pickPerson: (person) => {
      resorted(deps, view, person);
    },
    expandEntry: (iid, discussion) => {
      const open = state.value;
      if (open !== null) {
        deps.threads.expandThread(iid, discussion);
        state.value = { ...open, held: new Set(open.held).add(discussion) };
      }
    },
    collapseEntry: (discussion) => {
      deps.threads.collapseThread(discussion);
    },
    retryRow: (iid) => {
      deps.queue.retryRows([iid]);
    },
    refreshPersonView: () => {
      refresh(deps, view);
    },
  };
}

export function createPersonView(deps: Deps): PersonView & {
  /** The list was refreshed (rows replaced): held becomes the expanded entries. */
  readonly rowsReplaced: () => void;
} {
  const state = shallowRef<Open | null>(null);
  let orders = 0;
  const view: View = {
    state,
    reordered: () => {
      orders += 1;
      return orders;
    },
  };
  const ordered = orderedOf(deps, state);
  demand(deps, state);
  return {
    personView: computed(() => {
      const shown = ordered.value;
      return shown === null ? null : shownOf(deps, shown);
    }),
    ...actionsOf(deps, view),
    rowsReplaced: () => {
      resorted(deps, view);
    },
  };
}
