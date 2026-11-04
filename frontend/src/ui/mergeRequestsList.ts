import type { ShallowRef } from "vue";

import type {
  CheckedRow,
  ListEnd,
  MergeRequestPage,
  MergeRequestRow,
  MergeRequestSource,
} from "../ipc";
import { merged, rechecked } from "../mergeRequests";
import type { DiscussionQueue } from "./mergeRequestDiscussions";
import type { DueDates } from "./mergeRequestDueDates";
import { listFailureText } from "./mergeRequestsText";
import { attempt, type Problem } from "./problem";

export type ListLoad =
  | { readonly kind: "notLoaded" }
  | { readonly kind: "loading"; readonly first: boolean }
  | { readonly kind: "done"; readonly end: ListEnd; readonly at: number };

type Load = {
  readonly buffered: boolean;
  buffer: readonly MergeRequestRow[];
  me: string | null;
};

export type ListState = {
  readonly source: MergeRequestSource;
  readonly report: (problem: Problem) => void;
  readonly me: ShallowRef<string | null>;
  readonly rows: ShallowRef<readonly MergeRequestRow[]>;
  readonly cut: ShallowRef<boolean>;
  readonly listing: ShallowRef<ListLoad>;
  readonly listedAt: ShallowRef<number | null>;
  readonly dueDates: Pick<DueDates, "keepOnly">;
  readonly discussionQueue: Pick<DiscussionQueue, "listed">;
  readonly rowsReplaced: (rows: readonly MergeRequestRow[]) => void;
  shown: Load | null;
  running: Load | null;
};

function received(state: ListState, load: Load, { me, rows }: MergeRequestPage): void {
  if (load.buffered) {
    load.buffer = merged(load.buffer, rows);
    load.me = me;
    return;
  }
  state.rows.value = merged(state.rows.value, rows);
  state.me.value = me;
  state.discussionQueue.listed(rows);
}

function ended(state: ListState, load: Load, end: ListEnd): void {
  const at = Date.now();
  const listed = listFailureText(end) === null;
  if (listed) {
    state.cut.value = end.kind === "cut";
    state.listedAt.value = at;
  }
  if (load.buffered && listed) {
    state.rows.value = load.buffer;
    state.me.value = load.me;
    state.shown = load;
    state.rowsReplaced(state.rows.value);
  }
  if (end.kind === "loaded") {
    state.dueDates.keepOnly(new Set(state.rows.value.map((row) => row.iid)));
  }
  state.listing.value = { kind: "done", end, at };
}

function checked(state: ListState, load: Load, row: CheckedRow): void {
  if (state.shown === load) {
    state.rows.value = rechecked(state.rows.value, row);
  } else {
    load.buffer = rechecked(load.buffer, row);
  }
}

export async function loadList(state: ListState): Promise<void> {
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
    state.rowsReplaced([]);
  }
  state.report({ action: "mergeRequests", step: "list", cause: outcome.cause });
}
