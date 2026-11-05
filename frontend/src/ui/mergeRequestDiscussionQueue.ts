import { shallowRef, type ShallowRef } from "vue";

import {
  log,
  type DiscussionDetails,
  type MergeRequestIid,
  type MergeRequestSource,
  type RowDiscussions,
} from "../ipc";
import { setRow } from "./mergeRequestActions";
import {
  answerKind,
  loadOf,
  loggedFields,
  type Answered,
  type DiscussionLoad,
  type Reload,
} from "./mergeRequestDiscussionRows";
import { attempt, type Outcome } from "./problem";

type Call = { readonly generation: number; readonly iids: readonly MergeRequestIid[] };
export type Queue = {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly counted: (iid: MergeRequestIid, count: number) => void;
  readonly entries: ShallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>;
  readonly reloads: ShallowRef<ReadonlyMap<MergeRequestIid, Reload>>;
  /** Each `loading` entry's and `running` reload's iid in send order, a pressed reload's once its ask is answered;
   *  the running call's stay until answered. */
  queued: readonly MergeRequestIid[];
  /** The running call's iids at a switch to "lazy" or a Back from the person view, not wanted since: dropped unless
   *  its answer has them. */
  unhovered: Set<MergeRequestIid>;
  running: Call | null;
  generation: number;
};

const LOADING: DiscussionLoad = { kind: "loading" };
const RUNNING: Reload = { kind: "running" };

export function createQueue({
  source,
  mode,
  counted,
}: Pick<Queue, "source" | "mode" | "counted">): Queue {
  return {
    source,
    mode,
    counted,
    entries: shallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>(new Map()),
    reloads: shallowRef<ReadonlyMap<MergeRequestIid, Reload>>(new Map()),
    queued: [],
    unhovered: new Set(),
    running: null,
    generation: 0,
  };
}

function isReloading(queue: Queue, iid: MergeRequestIid): boolean {
  return queue.reloads.value.get(iid)?.kind === "running";
}

/** The iid still needs an answer: its entry is `loading` or its reload runs (what `queued` may hold). */
function isWaiting(queue: Queue, iid: MergeRequestIid): boolean {
  return queue.entries.value.get(iid)?.kind === "loading" || isReloading(queue, iid);
}

function settle(
  queue: Queue,
  sent: readonly MergeRequestIid[],
  outcome: Outcome<readonly RowDiscussions[]>,
  ms: number,
): void {
  const next = new Map(queue.entries.value);
  const reloads = new Map(queue.reloads.value);
  const answers: readonly (readonly [MergeRequestIid, Answered])[] = outcome.ok
    ? outcome.value.map(({ iid, answer }) => [iid, loadOf(answer)])
    : sent.map((iid) => [iid, { kind: "failed", cause: outcome.cause }]);
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
  queue.queued = queue.queued.filter((iid) => isWaiting(queue, iid));
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

/** Each iid without an entry gets `loading` and is queued last; one in `unhovered` leaves it instead. */
export function queuedLast(queue: Queue, iids: readonly MergeRequestIid[]): void {
  const next = new Map(queue.entries.value);
  const missing: MergeRequestIid[] = [];
  for (const iid of iids) {
    if (!queue.unhovered.delete(iid) && !next.has(iid)) {
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

function sentFirst(queue: Queue, iids: readonly MergeRequestIid[]): void {
  const first = new Set(iids);
  queue.queued = [...first, ...queue.queued.filter((each) => !first.has(each))];
  void send(queue);
}

export function dropped(queue: Queue): void {
  queue.generation += 1;
  queue.entries.value = new Map();
  queue.reloads.value = new Map();
  queue.queued = [];
  queue.unhovered = new Set();
}

export function becameFull(queue: Queue): void {
  queue.unhovered = new Set();
}

/** Each of `waiting` not in the running call and not reloading loses its entry and leaves the queue; the running call's
 *  iids not reloading go to `unhovered`. */
function unsentDropped(queue: Queue, waiting: readonly MergeRequestIid[]): void {
  const { running, generation } = queue;
  const sent = new Set(running?.generation === generation ? running.iids : []);
  function kept(iid: MergeRequestIid): boolean {
    return sent.has(iid) || isReloading(queue, iid);
  }
  const next = new Map(queue.entries.value);
  for (const iid of waiting.filter((each) => !kept(each))) {
    next.delete(iid);
  }
  queue.entries.value = next;
  queue.queued = queue.queued.filter(kept);
  queue.unhovered = new Set([...sent].filter((iid) => !isReloading(queue, iid)));
}

export function becameLazy(queue: Queue): void {
  unsentDropped(queue, queue.queued);
}

/** As `becameLazy`, and every `loading` entry a pending ask holds goes too. */
export function leftView(queue: Queue): void {
  const entries = [...queue.entries.value];
  unsentDropped(
    queue,
    entries.filter(([, load]) => load.kind === "loading").map(([iid]) => iid),
  );
}

/** A hover, only under "lazy": a row without an entry is asked first; one in `unhovered` leaves it instead. */
export function asked(queue: Queue, iid: MergeRequestIid): void {
  if (queue.mode() !== "lazy" || queue.unhovered.delete(iid) || queue.entries.value.has(iid)) {
    return;
  }
  setRow(queue.entries, iid, LOADING);
  sentFirst(queue, [iid]);
}

export function reload(queue: Queue, iid: MergeRequestIid, askFirst?: () => Promise<void>): void {
  const entry = queue.entries.value.get(iid);
  const pressedAgain = askFirst !== undefined && entry?.kind === "loading";
  const offWithout = queue.mode() === "off" && entry === undefined;
  if (offWithout || isReloading(queue, iid) || pressedAgain) {
    return;
  }
  if (entry === undefined) {
    setRow(queue.entries, iid, LOADING);
  } else if (entry.kind === "loading") {
    queue.unhovered.delete(iid);
  } else {
    setRow(queue.reloads, iid, RUNNING);
  }
  if (askFirst === undefined) {
    sentFirst(queue, [iid]);
  } else {
    afterAsk(queue, [iid], askFirst);
  }
}

/** F2's Retry: each `refused`/`failed` entry or reload is marked and sent first. */
export function retried(queue: Queue, iids: readonly MergeRequestIid[]): void {
  const failed = iids.filter((iid) =>
    [queue.entries.value.get(iid)?.kind, queue.reloads.value.get(iid)?.kind].some(
      (kind) => kind === "refused" || kind === "failed",
    ),
  );
  if (failed.length > 0) {
    marked(queue, failed);
    sentFirst(queue, failed);
  }
}

/** Retry's and `reloadRows`' marks: a read entry reloading, a loading one kept asked, none or a failed one `loading`. */
function marked(queue: Queue, iids: readonly MergeRequestIid[]): void {
  const entries = new Map(queue.entries.value);
  const reloads = new Map(queue.reloads.value);
  for (const iid of iids) {
    const entry = entries.get(iid);
    if (entry?.kind === "read") {
      reloads.set(iid, RUNNING);
    } else if (entry?.kind === "loading") {
      queue.unhovered.delete(iid);
    } else {
      entries.set(iid, LOADING);
      reloads.delete(iid);
    }
  }
  queue.entries.value = entries;
  queue.reloads.value = reloads;
}

/** `reloadRows`: the iids not reloading are marked; once `askFirst` is answered, and only in the generation it started in,
 *  those still waiting go first. */
export function rowsReloaded(
  queue: Queue,
  iids: readonly MergeRequestIid[],
  askFirst: () => Promise<void>,
): void {
  const marking = iids.filter((iid) => !isReloading(queue, iid));
  marked(queue, marking);
  afterAsk(queue, marking, askFirst);
}

/** Once `askFirst` is answered, and only in the generation it started in, the iids still waiting go first. */
function afterAsk(
  queue: Queue,
  iids: readonly MergeRequestIid[],
  askFirst: () => Promise<void>,
): void {
  const { generation } = queue;
  void askFirst().then(() => {
    if (queue.generation === generation) {
      sentFirst(
        queue,
        iids.filter((iid) => isWaiting(queue, iid)),
      );
    }
  });
}
