import { shallowRef, type ShallowRef } from "vue";

import {
  log,
  type DiscussionId,
  type DiscussionThread,
  type DiscussionThreadReply,
  type DiscussionWriteReply,
  type MergeRequestIid,
  type MergeRequestSource,
} from "../ipc";
import type { DiscussionQueue } from "./mergeRequestDiscussions";
import type { Preview } from "./mergeRequestPreview";
import { attempt, type Outcome, type ProblemCause } from "./problem";

export type ShownThread = { readonly iid: MergeRequestIid; readonly discussion: DiscussionId };
export type ThreadLoad =
  | { readonly kind: "loading" }
  /** `refreshing`: read again (after a write, a reload, a refresh); the old thread stays shown meanwhile. */
  | { readonly kind: "read"; readonly thread: DiscussionThread; readonly refreshing: boolean }
  | {
      readonly kind: "refused";
      readonly reply: Exclude<DiscussionThreadReply, { readonly kind: "read" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type WriteKind = "comment" | "draft" | "resolve" | "unresolve" | "submit";
export type WriteFailure =
  | Exclude<DiscussionWriteReply, { readonly kind: "sent" }>
  | { readonly kind: "ipc"; readonly cause: ProblemCause };
export type Sending =
  | { readonly kind: "idle" }
  | { readonly kind: "sending"; readonly what: WriteKind }
  | { readonly kind: "failed"; readonly what: WriteKind; readonly failure: WriteFailure };
export type Thread = {
  readonly shown: ShownThread;
  readonly load: ThreadLoad;
  /** This thread's own write. */
  readonly sending: Sending;
  readonly preview: Preview;
};
type ThreadDeps = {
  readonly source: MergeRequestSource;
  readonly discussions: Pick<DiscussionQueue, "threadRead" | "reloadDiscussions">;
};

/** A record exists in `threads` exactly while `panel` or `expanded` names it. */
export type State = ThreadDeps & {
  readonly threads: ShallowRef<ReadonlyMap<DiscussionId, Thread>>;
  readonly panel: ShallowRef<DiscussionId | null>;
  readonly expanded: ShallowRef<ReadonlySet<DiscussionId>>;
  readonly writing: ShallowRef<WriteKind | null>;
  readonly replyTexts: ShallowRef<ReadonlyMap<DiscussionId, string>>;
  /** Each discussion's latest read: an older read's answer reaches only the box. */
  readonly tokens: Map<DiscussionId, number>;
  lastToken: number;
};

const LOADING: ThreadLoad = { kind: "loading" };
const WRITING: Preview = { kind: "writing" };

export function stateOf(deps: ThreadDeps): State {
  return {
    ...deps,
    threads: shallowRef<ReadonlyMap<DiscussionId, Thread>>(new Map()),
    panel: shallowRef<DiscussionId | null>(null),
    expanded: shallowRef<ReadonlySet<DiscussionId>>(new Set()),
    writing: shallowRef<WriteKind | null>(null),
    replyTexts: shallowRef<ReadonlyMap<DiscussionId, string>>(new Map()),
    tokens: new Map(),
    lastToken: 0,
  };
}

export function recordOf(state: State, shown: ShownThread): Thread | null {
  const record = state.threads.value.get(shown.discussion);
  return record?.shown.iid === shown.iid ? record : null;
}

function put(state: State, record: Thread): void {
  state.threads.value = new Map(state.threads.value).set(record.shown.discussion, record);
}

export function patch(
  state: State,
  shown: ShownThread,
  change: Partial<Omit<Thread, "shown">>,
): void {
  const record = recordOf(state, shown);
  if (record !== null) {
    put(state, { ...record, ...change });
  }
}

export function dropUnlessShown(state: State, discussion: DiscussionId): void {
  if (state.panel.value === discussion || state.expanded.value.has(discussion)) {
    return;
  }
  const threads = new Map(state.threads.value);
  threads.delete(discussion);
  state.threads.value = threads;
}

function tokenFor(state: State, discussion: DiscussionId): number {
  state.lastToken += 1;
  state.tokens.set(discussion, state.lastToken);
  return state.lastToken;
}

export function replyKind<T extends { readonly kind: string }>(outcome: Outcome<T>): string {
  return outcome.ok ? outcome.value.kind : outcome.cause.kind;
}

function threadLoadOf(outcome: Outcome<DiscussionThreadReply>): ThreadLoad {
  if (!outcome.ok) {
    return { kind: "failed", cause: outcome.cause };
  }
  const reply = outcome.value;
  return reply.kind === "read"
    ? { kind: "read", thread: reply.thread, refreshing: false }
    : { kind: "refused", reply };
}

/** Reads `shown`; its record, if any, takes the answer only while `token` is the discussion's latest. */
async function read(state: State, shown: ShownThread, token: number): Promise<void> {
  const started = performance.now();
  const outcome = await attempt(() =>
    state.source.readDiscussionThread(shown.iid, shown.discussion),
  );
  const load = threadLoadOf(outcome);
  const comments = load.kind === "read" ? load.thread.comments.length : 0;
  const ms = Math.round(performance.now() - started);
  log.info("mergeRequests.thread_read", { iid: shown.iid, kind: replyKind(outcome), comments, ms });
  if (load.kind === "read") {
    state.discussions.threadRead(shown.iid, load.thread.discussion, load.thread.resolved);
  }
  if (token === state.tokens.get(shown.discussion)) {
    patch(state, shown, { load });
  }
}

/** Reads `shown` again; its record, if any, keeps a read thread shown meanwhile. */
export async function reread(
  state: State,
  shown: ShownThread,
  asked?: Promise<void>,
): Promise<void> {
  const token = tokenFor(state, shown.discussion);
  const record = recordOf(state, shown);
  if (record !== null) {
    const load = record.load.kind === "read" ? { ...record.load, refreshing: true } : LOADING;
    put(state, { ...record, load });
  }
  if (asked !== undefined) {
    await asked;
  }
  await read(state, shown, token);
}

/** The record of `shown`, shared when one exists, else created loading and read afresh. */
export function shownRecord(state: State, shown: ShownThread): void {
  if (recordOf(state, shown) === null) {
    put(state, { shown, load: LOADING, sending: { kind: "idle" }, preview: WRITING });
    void read(state, shown, tokenFor(state, shown.discussion));
  }
}

export function readAfresh(state: State, discussion: DiscussionId): void {
  const record = state.threads.value.get(discussion);
  if (record !== undefined) {
    put(state, { ...record, load: LOADING });
    void read(state, record.shown, tokenFor(state, discussion));
  }
}

export function backToWriting(state: State, discussion: DiscussionId): void {
  const record = state.threads.value.get(discussion);
  if (record !== undefined) {
    put(state, { ...record, preview: WRITING });
  }
}

export function setText(state: State, discussion: DiscussionId, text: string): void {
  const texts = new Map(state.replyTexts.value);
  texts.delete(discussion);
  state.replyTexts.value = text === "" ? texts : texts.set(discussion, text);
  backToWriting(state, discussion);
}
