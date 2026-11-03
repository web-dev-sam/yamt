import { computed, shallowRef, watch, type ComputedRef, type ShallowRef } from "vue";

import {
  log,
  type DiscussionDetails,
  type DiscussionsAnswer,
  type MergeRequestIid,
  type MergeRequestRow,
  type MergeRequestSource,
  type OpenDiscussion,
  type RowDiscussions,
} from "../ipc";
import { setRow } from "./mergeRequestActions";
import { attempt, type Outcome, type ProblemCause } from "./problem";

export type DiscussionLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "read"; readonly discussions: readonly OpenDiscussion[] }
  | {
      readonly kind: "refused";
      readonly answer: Exclude<DiscussionsAnswer, { readonly kind: "open" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type Discussions = {
  /** Each asked row's discussions while this list stands; no entry: not asked, or (count 0) none open. */
  readonly discussions: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>>;
  /** Settings' "Discussion details" in use. */
  readonly discussionDetails: ComputedRef<DiscussionDetails>;
  /** A count's box opened: with "lazy", asks this row first unless it has an entry; else nothing. */
  askDiscussions(iid: MergeRequestIid): void;
};
export type DiscussionQueue = Discussions & {
  /** Rows the list now shows: with "full", queues each with `openDiscussions > 0` and no entry. */
  listed(rows: readonly MergeRequestRow[]): void;
  /** A refresh replaced the rows: every entry, the queue and any answer in flight dropped; then `listed(rows)`. */
  replaced(rows: readonly MergeRequestRow[]): void;
};

type Entries = ShallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>;
type Call = { readonly generation: number; readonly iids: readonly MergeRequestIid[] };
type Queue = {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly entries: Entries;
  /** Every `loading` entry's iid, in the order they are sent; the running call's stay until answered. */
  queued: readonly MergeRequestIid[];
  /** The running call's iids at a switch to "lazy" not hovered since: dropped unless its answer has them. */
  unhovered: Set<MergeRequestIid>;
  running: Call | null;
  generation: number;
};

const LOADING: DiscussionLoad = { kind: "loading" };

function loadOf(answer: DiscussionsAnswer): DiscussionLoad {
  return answer.kind === "open"
    ? { kind: "read", discussions: answer.discussions }
    : { kind: "refused", answer };
}

function loggedFields(
  asked: number,
  outcome: Outcome<readonly RowDiscussions[]>,
  ms: number,
): Record<string, string | number> {
  if (!outcome.ok) {
    return { asked, failed: outcome.cause.kind, ms };
  }
  const refused = outcome.value.filter((row) => row.answer.kind !== "open").length;
  return { asked, answered: outcome.value.length, refused, ms };
}

function settle(
  queue: Queue,
  asked: readonly MergeRequestIid[],
  outcome: Outcome<readonly RowDiscussions[]>,
): void {
  const next = new Map(queue.entries.value);
  if (outcome.ok) {
    for (const { iid, answer } of outcome.value) {
      next.set(iid, loadOf(answer));
    }
  } else {
    for (const iid of asked) {
      next.set(iid, { kind: "failed", cause: outcome.cause });
    }
  }
  const answered = new Set(outcome.ok ? outcome.value.map((row) => row.iid) : []);
  for (const iid of queue.unhovered) {
    if (!answered.has(iid)) {
      next.delete(iid);
    }
  }
  queue.unhovered = new Set();
  queue.entries.value = next;
  queue.queued = queue.queued.filter((iid) => next.get(iid)?.kind === "loading");
}

async function send(queue: Queue): Promise<void> {
  if (queue.running !== null || queue.queued.length === 0) {
    return;
  }
  const call: Call = { generation: queue.generation, iids: queue.queued };
  queue.running = call;
  const started = performance.now();
  const outcome = await attempt(() => queue.source.readDiscussions(call.iids));
  queue.running = null;
  const ms = Math.round(performance.now() - started);
  log.info("mergeRequests.discussions_read", loggedFields(call.iids.length, outcome, ms));
  if (call.generation === queue.generation) {
    settle(queue, call.iids, outcome);
  }
  await send(queue);
}

function listed(queue: Queue, rows: readonly MergeRequestRow[]): void {
  if (queue.mode() !== "full") {
    return;
  }
  const next = new Map(queue.entries.value);
  const missing: MergeRequestIid[] = [];
  for (const { iid, openDiscussions } of rows) {
    if (openDiscussions > 0 && !next.has(iid)) {
      next.set(iid, LOADING);
      missing.push(iid);
    }
  }
  if (missing.length === 0) {
    return;
  }
  queue.entries.value = next;
  queue.queued = [...queue.queued, ...missing];
  void send(queue);
}

function dropped(queue: Queue): void {
  queue.generation += 1;
  queue.entries.value = new Map();
  queue.queued = [];
  queue.unhovered = new Set();
}

function becameLazy(queue: Queue): void {
  const { running, generation } = queue;
  const sent = new Set(running?.generation === generation ? running.iids : []);
  const next = new Map(queue.entries.value);
  for (const iid of queue.queued.filter((each) => !sent.has(each))) {
    next.delete(iid);
  }
  queue.entries.value = next;
  queue.queued = queue.queued.filter((iid) => sent.has(iid));
  queue.unhovered = sent;
}

function switched(queue: Queue, mode: DiscussionDetails, rows: readonly MergeRequestRow[]): void {
  switch (mode) {
    case "full":
      queue.unhovered = new Set();
      listed(queue, rows);
      return;
    case "lazy":
      becameLazy(queue);
      return;
    case "off":
      dropped(queue);
      return;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function asked(queue: Queue, iid: MergeRequestIid): void {
  if (queue.mode() !== "lazy") {
    return;
  }
  if (queue.unhovered.has(iid)) {
    queue.unhovered.delete(iid);
    return;
  }
  if (queue.entries.value.has(iid)) {
    return;
  }
  setRow(queue.entries, iid, LOADING);
  queue.queued = [iid, ...queue.queued];
  void send(queue);
}

export function discussionsOf(queue: DiscussionQueue): Discussions {
  return {
    discussions: queue.discussions,
    discussionDetails: queue.discussionDetails,
    askDiscussions: (iid) => {
      queue.askDiscussions(iid);
    },
  };
}

export function createDiscussions(deps: {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly rows: () => readonly MergeRequestRow[];
}): DiscussionQueue {
  const queue: Queue = {
    source: deps.source,
    mode: deps.mode,
    entries: shallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>(new Map()),
    queued: [],
    unhovered: new Set(),
    running: null,
    generation: 0,
  };
  watch(deps.mode, (mode) => {
    switched(queue, mode, deps.rows());
  });
  return {
    discussions: queue.entries,
    discussionDetails: computed(deps.mode),
    askDiscussions: (iid) => {
      asked(queue, iid);
    },
    listed: (rows) => {
      listed(queue, rows);
    },
    replaced: (rows) => {
      dropped(queue);
      listed(queue, rows);
    },
  };
}
