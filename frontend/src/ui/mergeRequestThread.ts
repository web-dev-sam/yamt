import { shallowRef, type ShallowRef } from "vue";

import {
  log,
  type DiscussionId,
  type DiscussionThread,
  type DiscussionThreadReply,
  type DiscussionWriteReply,
  type MergeRequestIid,
  type MergeRequestSource,
  type ReplyKind,
  type SourceResult,
} from "../ipc";
import type { Discussions } from "./mergeRequestDiscussionRows";
import { readPreview, type Preview } from "./mergeRequestPreview";
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
  readonly sending: Sending;
  readonly preview: Preview;
};
export type Threads = {
  /** The window's one thread panel; null when none is shown. */
  readonly thread: Readonly<ShallowRef<Thread | null>>;
  /** C6: each discussion's unsent text for the window's life (absent: none); cleared only by a `sent` reply or draft. */
  readonly replyTexts: Readonly<ShallowRef<ReadonlyMap<DiscussionId, string>>>;
  setReplyText(discussion: DiscussionId, text: string): void;
  /** C1, C5: shows `discussion` and reads it afresh (loading first); the one already shown: nothing. */
  showThread(iid: MergeRequestIid, discussion: DiscussionId): void;
  closeThread(): void;
  retryThread(): void;
  /** C8: one send at a time; a blank text or a send under way → nothing. */
  sendReply(kind: ReplyKind): Promise<void>;
  /** C10: resolve (true) or reopen (false); never sends the text. */
  setResolved(resolve: boolean): Promise<void>;
  /** C9: publishes every pending draft of the merge request. */
  submitReview(): Promise<void>;
  showPreview(): void;
  showWrite(): void;
};

type State = {
  readonly source: MergeRequestSource;
  readonly discussions: Pick<Discussions, "threadRead" | "reloadDiscussions">;
  readonly thread: ShallowRef<Thread | null>;
  readonly replyTexts: ShallowRef<ReadonlyMap<DiscussionId, string>>;
  /** Bumped by every show, close and re-read: an older read's answer reaches only the box. */
  generation: number;
  /** The write under way, one at a time in the window: every thread shown meanwhile reports it as `sending`. */
  writing: WriteKind | null;
};

const LOADING: ThreadLoad = { kind: "loading" };
const IDLE: Sending = { kind: "idle" };
const WRITING: Preview = { kind: "writing" };

function isShown(state: State, shown: ShownThread): boolean {
  const current = state.thread.value?.shown;
  return current?.iid === shown.iid && current.discussion === shown.discussion;
}

function patch(state: State, shown: ShownThread, change: Partial<Omit<Thread, "shown">>): void {
  const current = state.thread.value;
  if (current !== null && isShown(state, shown)) {
    state.thread.value = { ...current, ...change };
  }
}

function replyKind<T extends { readonly kind: string }>(outcome: Outcome<T>): string {
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

/** Reads `shown`; the panel takes the answer only while `generation` is the latest (null: the box alone). */
async function read(state: State, shown: ShownThread, generation: number | null): Promise<void> {
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
  if (generation === state.generation) {
    patch(state, shown, { load });
  }
}

function reread(state: State, shown: ShownThread): void {
  const current = state.thread.value;
  if (current === null || !isShown(state, shown)) {
    void read(state, shown, null);
    return;
  }
  const { load } = current;
  state.generation += 1;
  state.thread.value = {
    ...current,
    load: load.kind === "read" ? { ...load, refreshing: true } : LOADING,
  };
  void read(state, shown, state.generation);
}

function show(state: State, shown: ShownThread): void {
  state.generation += 1;
  const sending: Sending = state.writing === null ? IDLE : { kind: "sending", what: state.writing };
  state.thread.value = { shown, load: LOADING, sending, preview: WRITING };
  void read(state, shown, state.generation);
}

function setText(state: State, discussion: DiscussionId, text: string): void {
  const texts = new Map(state.replyTexts.value);
  texts.delete(discussion);
  state.replyTexts.value = text === "" ? texts : texts.set(discussion, text);
  const current = state.thread.value;
  if (current?.shown.discussion === discussion) {
    state.thread.value = { ...current, preview: WRITING };
  }
}

/** Why a write did not land; null when GitLab took it. */
function failureOf(outcome: Outcome<DiscussionWriteReply>): WriteFailure | null {
  if (!outcome.ok) {
    return { kind: "ipc", cause: outcome.cause };
  }
  const reply = outcome.value;
  return reply.kind === "sent" ? null : reply;
}

async function write(
  state: State,
  what: WriteKind,
  call: (shown: ShownThread) => Promise<SourceResult<DiscussionWriteReply>>,
  text: string | null,
): Promise<void> {
  const current = state.thread.value;
  if (current?.load.kind !== "read" || current.load.refreshing || state.writing !== null) {
    return;
  }
  const { shown } = current;
  state.writing = what;
  patch(state, shown, { sending: { kind: "sending", what } });
  const started = performance.now();
  const outcome = await attempt(() => call(shown));
  const ms = Math.round(performance.now() - started);
  log.info("mergeRequests.thread_write", { iid: shown.iid, what, kind: replyKind(outcome), ms });
  const failure = failureOf(outcome);
  state.writing = null;
  patch(state, shown, { sending: failure === null ? IDLE : { kind: "failed", what, failure } });
  const after = state.thread.value;
  if (after?.sending.kind === "sending") {
    state.thread.value = { ...after, sending: IDLE };
  }
  if (failure === null && state.replyTexts.value.get(shown.discussion) === text) {
    setText(state, shown.discussion, "");
  }
  if (failure?.kind !== "refused") {
    reread(state, shown);
  }
  if (failure === null && what === "submit") {
    state.discussions.reloadDiscussions(shown.iid);
  }
}

async function preview(state: State): Promise<void> {
  const current = state.thread.value;
  if (current === null) {
    return;
  }
  const { shown } = current;
  const text = state.replyTexts.value.get(shown.discussion) ?? "";
  if (text.trim() === "") {
    patch(state, shown, { preview: { kind: "empty" } });
    return;
  }
  const loading: Preview = { kind: "loading" };
  patch(state, shown, { preview: loading });
  const answer = await readPreview(state.source, shown.iid, text);
  if (state.thread.value?.preview === loading) {
    patch(state, shown, { preview: answer });
  }
}

function writesOf(state: State): Pick<Threads, "sendReply" | "setResolved" | "submitReview"> {
  return {
    sendReply: async (kind) => {
      const discussion = state.thread.value?.shown.discussion;
      const text = discussion === undefined ? "" : (state.replyTexts.value.get(discussion) ?? "");
      if (text.trim() !== "") {
        await write(
          state,
          kind,
          (shown) => state.source.replyToDiscussion(shown.iid, shown.discussion, kind, text),
          text,
        );
      }
    },
    setResolved: (resolve) =>
      write(
        state,
        resolve ? "resolve" : "unresolve",
        (shown) => state.source.resolveDiscussion(shown.iid, shown.discussion, resolve),
        null,
      ),
    submitReview: () =>
      write(state, "submit", (shown) => state.source.submitReview(shown.iid), null),
  };
}

function panelOf(state: State): Omit<Threads, "sendReply" | "setResolved" | "submitReview"> {
  return {
    thread: state.thread,
    replyTexts: state.replyTexts,
    setReplyText: (discussion, text) => {
      setText(state, discussion, text);
    },
    showThread: (iid, discussion) => {
      if (!isShown(state, { iid, discussion })) {
        show(state, { iid, discussion });
      }
    },
    closeThread: () => {
      state.generation += 1;
      state.thread.value = null;
    },
    retryThread: () => {
      const current = state.thread.value;
      if (current !== null) {
        show(state, current.shown);
      }
    },
    showPreview: () => {
      void preview(state);
    },
    showWrite: () => {
      const current = state.thread.value;
      if (current !== null) {
        state.thread.value = { ...current, preview: WRITING };
      }
    },
  };
}

export function createThreads(deps: {
  readonly source: MergeRequestSource;
  readonly discussions: Pick<Discussions, "threadRead" | "reloadDiscussions">;
}): Threads & { readonly refreshed: (iid: MergeRequestIid | null) => void } {
  const state: State = {
    ...deps,
    thread: shallowRef<Thread | null>(null),
    replyTexts: shallowRef<ReadonlyMap<DiscussionId, string>>(new Map()),
    generation: 0,
    writing: null,
  };
  return {
    ...panelOf(state),
    ...writesOf(state),
    refreshed: (iid) => {
      const shown = state.thread.value?.shown;
      if (shown !== undefined && (iid === null || iid === shown.iid)) {
        reread(state, shown);
      }
    },
  };
}
