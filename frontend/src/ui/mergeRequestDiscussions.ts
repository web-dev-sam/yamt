import { computed, shallowRef, watch, type ShallowRef } from "vue";

import {
  log,
  type DiscussionDetails,
  type MergeRequestIid,
  type MergeRequestRow,
  type MergeRequestSource,
  type RowDiscussions,
} from "../ipc";
import { setRow } from "./mergeRequestActions";
import {
  answerKind,
  boxClosed,
  loadOf,
  loggedFields,
  threadRead,
  type Answered,
  type DiscussionLoad,
  type Discussions,
  type Reload,
} from "./mergeRequestDiscussionRows";
import { attempt, type Outcome } from "./problem";

export type {
  DiscussionFailure,
  DiscussionLoad,
  Discussions,
  Reload,
} from "./mergeRequestDiscussionRows";
export { useRowDiscussions } from "./mergeRequestDiscussionRows";
export type DiscussionQueue = Discussions & {
  /** Rows the list now shows: with "full", queues each with `openDiscussions > 0` and no entry. */
  listed(rows: readonly MergeRequestRow[]): void;
  /** A refresh replaced the rows: every entry, the queue and any answer in flight dropped; then `listed(rows)`. */
  replaced(rows: readonly MergeRequestRow[]): void;
  /** D1: reads `iid` again alone, first in the queue; the entry stays as it is until the answer. The row is marked
   *  at once; `askFirst` (a button press) runs before the read, and a row already marked asks nothing. */
  reloadDiscussions(iid: MergeRequestIid, askFirst?: () => Promise<void>): void;
};

type Call = { readonly generation: number; readonly iids: readonly MergeRequestIid[] };
type Queue = {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly counted: (iid: MergeRequestIid, count: number) => void;
  readonly entries: ShallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>;
  readonly reloads: ShallowRef<ReadonlyMap<MergeRequestIid, Reload>>;
  /** Each `loading` entry's and `running` reload's iid in send order, a pressed reload's once its ask is answered;
   *  the running call's stay until answered. */
  queued: readonly MergeRequestIid[];
  /** The running call's iids at a switch to "lazy" not hovered since: dropped unless its answer has them. */
  unhovered: Set<MergeRequestIid>;
  running: Call | null;
  generation: number;
};

const LOADING: DiscussionLoad = { kind: "loading" };

function isReloading(queue: Queue, iid: MergeRequestIid): boolean {
  return queue.reloads.value.get(iid)?.kind === "running";
}

function settle(
  queue: Queue,
  asked: readonly MergeRequestIid[],
  outcome: Outcome<readonly RowDiscussions[]>,
  ms: number,
): void {
  const next = new Map(queue.entries.value);
  const reloads = new Map(queue.reloads.value);
  const answers: readonly (readonly [MergeRequestIid, Answered])[] = outcome.ok
    ? outcome.value.map(({ iid, answer }) => [iid, loadOf(answer)])
    : asked.map((iid) => [iid, { kind: "failed", cause: outcome.cause }]);
  for (const [iid, load] of answers) {
    if (reloads.get(iid)?.kind !== "running") {
      next.set(iid, load);
      continue;
    }
    log.info("mergeRequests.discussions_reloaded", { iid, kind: answerKind(load), ms });
    if (load.kind === "read") {
      next.set(iid, load);
      reloads.delete(iid);
      queue.counted(iid, load.discussions.length);
    } else {
      reloads.set(iid, load);
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
  queue.reloads.value = reloads;
  queue.queued = queue.queued.filter(
    (iid) => next.get(iid)?.kind === "loading" || isReloading(queue, iid),
  );
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
    settle(queue, call.iids, outcome, ms);
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
  queue.reloads.value = new Map();
  queue.queued = [];
  queue.unhovered = new Set();
}

function becameLazy(queue: Queue): void {
  const { running, generation } = queue;
  const sent = new Set(running?.generation === generation ? running.iids : []);
  function kept(iid: MergeRequestIid): boolean {
    return sent.has(iid) || isReloading(queue, iid);
  }
  const next = new Map(queue.entries.value);
  for (const iid of queue.queued.filter((each) => !kept(each))) {
    next.delete(iid);
  }
  queue.entries.value = next;
  queue.queued = queue.queued.filter(kept);
  queue.unhovered = new Set([...sent].filter((iid) => !isReloading(queue, iid)));
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

function sentFirst(queue: Queue, iid: MergeRequestIid): void {
  queue.queued = [iid, ...queue.queued.filter((each) => each !== iid)];
  void send(queue);
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
  sentFirst(queue, iid);
}

function reload(queue: Queue, iid: MergeRequestIid, askFirst?: () => Promise<void>): void {
  const entry = queue.entries.value.get(iid);
  const pressedAgain = askFirst !== undefined && entry?.kind === "loading";
  if (queue.mode() === "off" || isReloading(queue, iid) || pressedAgain) {
    return;
  }
  if (entry === undefined) {
    setRow(queue.entries, iid, LOADING);
  } else if (entry.kind === "loading") {
    queue.unhovered.delete(iid);
  } else {
    setRow(queue.reloads, iid, { kind: "running" });
  }
  if (askFirst === undefined) {
    sentFirst(queue, iid);
    return;
  }
  const { generation } = queue;
  void askFirst().then(() => {
    if (queue.generation === generation) {
      sentFirst(queue, iid);
    }
  });
}

export function discussionsOf(queue: DiscussionQueue): Discussions {
  const { discussions, discussionDetails, reloads } = queue;
  return {
    discussions,
    discussionDetails,
    reloads,
    askDiscussions: (iid) => {
      queue.askDiscussions(iid);
    },
    threadRead: (iid, discussion, resolved) => {
      queue.threadRead(iid, discussion, resolved);
    },
    boxClosed: (iid) => {
      queue.boxClosed(iid);
    },
  };
}

function membersOf(queue: Queue): Discussions & Pick<DiscussionQueue, "reloadDiscussions"> {
  return {
    discussions: queue.entries,
    discussionDetails: computed(queue.mode),
    reloads: queue.reloads,
    askDiscussions: (iid) => {
      asked(queue, iid);
    },
    reloadDiscussions: (iid, askFirst) => {
      reload(queue, iid, askFirst);
    },
    threadRead: (iid, discussion, resolved) => {
      threadRead(queue.entries, iid, discussion, resolved);
    },
    boxClosed: (iid) => {
      boxClosed(queue.entries, iid, queue.counted);
    },
  };
}

export function createDiscussions(deps: {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly rows: () => readonly MergeRequestRow[];
  /** The row's open-discussions count as a reload or a box close found it (D2, C10). */
  readonly counted: (iid: MergeRequestIid, count: number) => void;
}): DiscussionQueue {
  const queue: Queue = {
    source: deps.source,
    mode: deps.mode,
    counted: deps.counted,
    entries: shallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>(new Map()),
    reloads: shallowRef<ReadonlyMap<MergeRequestIid, Reload>>(new Map()),
    queued: [],
    unhovered: new Set(),
    running: null,
    generation: 0,
  };
  watch(deps.mode, (mode) => {
    switched(queue, mode, deps.rows());
  });
  return {
    ...membersOf(queue),
    listed: (rows) => {
      listed(queue, rows);
    },
    replaced: (rows) => {
      dropped(queue);
      listed(queue, rows);
    },
  };
}
