import { computed, type Ref, type ShallowRef } from "vue";

import {
  log,
  type DiscussionId,
  type DiscussionWriteReply,
  type MergeRequestIid,
  type MergeRequestSource,
  type ReplyKind,
  type SourceResult,
} from "../ipc";
import type { DiscussionQueue } from "./mergeRequestDiscussions";
import { previewHere, readPreview, type Preview } from "./mergeRequestPreview";
import {
  backToWriting,
  dropUnlessShown,
  patch,
  readAfresh,
  recordOf,
  replyKind,
  reread,
  setText,
  shownRecord,
  stateOf,
  type Sending,
  type ShownThread,
  type State,
  type Thread,
  type WriteFailure,
  type WriteKind,
} from "./mergeRequestThreadRecords";
import { attempt, type Outcome } from "./problem";

export type {
  Sending,
  ShownThread,
  Thread,
  ThreadLoad,
  WriteFailure,
  WriteKind,
} from "./mergeRequestThreadRecords";

export type Threads = {
  /** Every thread shown, by discussion: the box's panel's and each expanded entry's (request E4). */
  readonly threads: Readonly<ShallowRef<ReadonlyMap<DiscussionId, Thread>>>;
  /** The box's panel's thread (`threads` at the panel's discussion); null when no panel shows. */
  readonly thread: Readonly<Ref<Thread | null>>;
  /** The person view's expanded entries, in expanding order. */
  readonly expanded: Readonly<ShallowRef<ReadonlySet<DiscussionId>>>;
  /** The write under way in the window, one at a time (C8, E4); null: none. */
  readonly writing: Readonly<ShallowRef<WriteKind | null>>;
  /** C6: each discussion's unsent text for the window's life (absent: none); cleared only by a `sent` reply or draft. */
  readonly replyTexts: Readonly<ShallowRef<ReadonlyMap<DiscussionId, string>>>;
  setReplyText(discussion: DiscussionId, text: string): void;
  /** C1, C5: the panel shows `discussion`, read afresh (loading first); the one already in the panel: nothing; a thread
   *  an entry shows is shared, not read again. The panel's previous thread is dropped unless an entry shows it. */
  showThread(iid: MergeRequestIid, discussion: DiscussionId): void;
  /** The panel closes; its thread is dropped unless an entry shows it. */
  closeThread(): void;
  /** E3: the entry expands, its thread read afresh (loading first); already expanded: nothing; one the panel shows is
   *  shared, not read again. */
  expandThread(iid: MergeRequestIid, discussion: DiscussionId): void;
  /** E2, E4: the entry collapses; its thread dropped unless the panel shows it; its text stays. Not expanded: nothing. */
  collapseThread(discussion: DiscussionId): void;
  retryThread(discussion: DiscussionId): void;
  /** C8: one send at a time in the window; a blank text, a send under way, or a thread not read → nothing. */
  sendReply(discussion: DiscussionId, kind: ReplyKind): Promise<void>;
  /** C10: resolve (true) or reopen (false); never sends the text. */
  setResolved(discussion: DiscussionId, resolve: boolean): Promise<void>;
  /** C9: publishes every pending draft of the discussion's merge request. */
  submitReview(discussion: DiscussionId): Promise<void>;
  showPreview(discussion: DiscussionId): void;
  showWrite(discussion: DiscussionId): void;
};

type Write = {
  readonly what: WriteKind;
  readonly call: (shown: ShownThread) => Promise<SourceResult<DiscussionWriteReply>>;
  readonly text: string | null;
};

/** The one rule both hosts use: read, not refreshing, and no write under way in the window. */
export function isWritable(thread: Thread, writing: WriteKind | null): boolean {
  return thread.load.kind === "read" && !thread.load.refreshing && writing === null;
}

/** Why a write did not land; null when GitLab took it. */
function failureOf(outcome: Outcome<DiscussionWriteReply>): WriteFailure | null {
  if (!outcome.ok) {
    return { kind: "ipc", cause: outcome.cause };
  }
  const reply = outcome.value;
  return reply.kind === "sent" ? null : reply;
}

async function write(state: State, discussion: DiscussionId, how: Write): Promise<void> {
  const record = state.threads.value.get(discussion);
  if (record === undefined || !isWritable(record, state.writing.value)) {
    return;
  }
  const { shown } = record;
  const { what } = how;
  state.writing.value = what;
  patch(state, shown, { sending: { kind: "sending", what } });
  const started = performance.now();
  const outcome = await attempt(() => how.call(shown));
  const ms = Math.round(performance.now() - started);
  log.info("mergeRequests.thread_write", { iid: shown.iid, what, kind: replyKind(outcome), ms });
  const failure = failureOf(outcome);
  state.writing.value = null;
  const sending: Sending = failure === null ? { kind: "idle" } : { kind: "failed", what, failure };
  patch(state, shown, { sending });
  if (failure === null && state.replyTexts.value.get(discussion) === how.text) {
    setText(state, discussion, "");
  }
  if (failure?.kind !== "refused") {
    void reread(state, shown);
  }
  if (failure === null && what === "submit") {
    state.discussions.reloadDiscussions(shown.iid);
  }
}

async function preview(state: State, discussion: DiscussionId): Promise<void> {
  const record = state.threads.value.get(discussion);
  if (record === undefined) {
    return;
  }
  const { shown } = record;
  const text = state.replyTexts.value.get(discussion) ?? "";
  const atOnce = previewHere(shown.iid, text);
  if (atOnce !== null) {
    patch(state, shown, { preview: atOnce });
    return;
  }
  const loading: Preview = { kind: "loading" };
  patch(state, shown, { preview: loading });
  const answer = await readPreview(state.source, shown.iid, text);
  if (recordOf(state, shown)?.preview === loading) {
    patch(state, shown, { preview: answer });
  }
}

function writesOf(state: State): Pick<Threads, "sendReply" | "setResolved" | "submitReview"> {
  return {
    sendReply: async (discussion, kind) => {
      const text = state.replyTexts.value.get(discussion) ?? "";
      if (text.trim() !== "") {
        await write(state, discussion, {
          what: kind,
          call: (shown) => state.source.replyToDiscussion(shown.iid, shown.discussion, kind, text),
          text,
        });
      }
    },
    setResolved: (discussion, resolve) =>
      write(state, discussion, {
        what: resolve ? "resolve" : "unresolve",
        call: (shown) => state.source.resolveDiscussion(shown.iid, shown.discussion, resolve),
        text: null,
      }),
    submitReview: (discussion) =>
      write(state, discussion, {
        what: "submit",
        call: (shown) => state.source.submitReview(shown.iid),
        text: null,
      }),
  };
}

function panelOf(state: State): Pick<Threads, "thread" | "showThread" | "closeThread"> {
  const { panel, threads } = state;
  return {
    thread: computed(() =>
      panel.value === null ? null : (threads.value.get(panel.value) ?? null),
    ),
    showThread: (iid, discussion) => {
      const previous = panel.value;
      panel.value = discussion;
      if (previous !== null) {
        dropUnlessShown(state, previous);
      }
      shownRecord(state, { iid, discussion });
    },
    closeThread: () => {
      const previous = panel.value;
      panel.value = null;
      if (previous !== null) {
        dropUnlessShown(state, previous);
      }
    },
  };
}

function entriesOf(state: State): Pick<Threads, "expandThread" | "collapseThread"> {
  return {
    expandThread: (iid, discussion) => {
      if (!state.expanded.value.has(discussion)) {
        state.expanded.value = new Set(state.expanded.value).add(discussion);
        shownRecord(state, { iid, discussion });
      }
    },
    collapseThread: (discussion) => {
      const expanded = new Set(state.expanded.value);
      if (expanded.delete(discussion)) {
        state.expanded.value = expanded;
        dropUnlessShown(state, discussion);
      }
    },
  };
}

export function createThreads(deps: {
  readonly source: MergeRequestSource;
  readonly discussions: Pick<DiscussionQueue, "threadRead" | "reloadDiscussions">;
}): Threads & { readonly refreshed: (iid: MergeRequestIid | null, asked?: Promise<void>) => void } {
  const state = stateOf(deps);
  return {
    threads: state.threads,
    expanded: state.expanded,
    writing: state.writing,
    replyTexts: state.replyTexts,
    setReplyText: (discussion, text) => {
      setText(state, discussion, text);
    },
    ...panelOf(state),
    ...entriesOf(state),
    ...writesOf(state),
    retryThread: (discussion) => {
      readAfresh(state, discussion);
    },
    showPreview: (discussion) => {
      void preview(state, discussion);
    },
    showWrite: (discussion) => {
      backToWriting(state, discussion);
    },
    refreshed: (iid, asked) => {
      for (const { shown } of state.threads.value.values()) {
        if (iid === null || iid === shown.iid) {
          void reread(state, shown, asked);
        }
      }
    },
  };
}
