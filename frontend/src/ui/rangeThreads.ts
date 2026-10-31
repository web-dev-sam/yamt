import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  AgentSessionId,
  MessageId,
  Posting,
  RangeFileId,
  ReviewSource,
  ShownThread,
  SourceResult,
  ThreadId,
  ThreadList,
  ThreadPlace,
} from "../ipc";
import { attempt, type Problem, type ThreadStep } from "./problem";
import { createRangeAdds, type AddsInFlight, type RangeAdds } from "./rangeAdds";
import {
  createRangeDrafts,
  isBlank,
  type Draft,
  type RangeDrafts,
  type ThreadDraft,
} from "./rangeDrafts";
import { createRangeOpen, type RangeOpen, type StoredBox } from "./rangeOpen";

type ThreadBox = { readonly kind: "draft"; readonly draft: ThreadDraft } | StoredBox;

export type RangeThreads = AddsInFlight & {
  readonly list: Readonly<ShallowRef<ThreadList>>;
  readonly listed: Readonly<ShallowRef<boolean>>;
  readonly open: Readonly<ShallowRef<ReadonlySet<ThreadId>>>;
  readonly drafts: Readonly<ShallowRef<ReadonlyMap<string, Draft>>>;
  readonly counts: ComputedRef<ReadonlyMap<RangeFileId, number>>;
  readonly queued: ComputedRef<number>;
  load(): Promise<void>;
  shownFor(file: RangeFileId): readonly ShownThread[];
  boxOf(key: string): ThreadBox | null;
  startThread(file: RangeFileId, place: ThreadPlace): void;
  writeDraft(key: string, text: string): void;
  dropDraft(key: string): void;
  noteText(thread: ThreadId): string;
  writeNote(thread: ThreadId, text: string): void;
  postDraft(message: MessageId): string | null;
  writePost(message: MessageId, text: string): void;
  dropPost(message: MessageId): void;
  editDraft(message: MessageId): string | null;
  writeEdit(message: MessageId, text: string): void;
  dropEdit(message: MessageId): void;
  toggle(keys: readonly string[]): void;
  /** The added thread; null when nothing was added (no such draft, blank text, an add of it running, a refusal). */
  addThread(draftKey: string, text: string): Promise<ThreadId | null>;
  /** Whether the note was stored; a blank text is not sent. */
  addNote(thread: ThreadId, text: string): Promise<boolean>;
  queue(message: MessageId, text: string): Promise<void>;
  unqueue(message: MessageId): Promise<void>;
  /** Whether the edit was stored; a blank text is not sent. */
  editNote(message: MessageId, text: string): Promise<boolean>;
  deleteMessage(message: MessageId): Promise<void>;
  replace(list: ThreadList): void;
  setSession(thread: ThreadId, session: AgentSessionId): Promise<boolean>;
  /** The turn the store numbered the appended answer (plan row 121); null when the write failed. */
  addAiAnswer(thread: ThreadId, session: AgentSessionId): Promise<number | null>;
};

type State = {
  readonly source: ReviewSource;
  readonly report: (problem: Problem) => void;
  readonly list: ShallowRef<ThreadList>;
  readonly listed: ShallowRef<boolean>;
  readonly open: RangeOpen;
  readonly drafts: RangeDrafts;
  readonly adds: RangeAdds;
};

export function isQueued(posting: Posting): boolean {
  switch (posting.kind) {
    case "queued":
    case "refused":
      return true;
    case "notQueued":
    case "pending":
      return false;
    default: {
      const _exhaustive: never = posting;
      return _exhaustive;
    }
  }
}

function setList(state: State, list: ThreadList): void {
  state.list.value = list;
  state.open.keepListed(list);
  state.drafts.keepStored(list);
}

function shownFor(state: State, file: RangeFileId): ShownThread[] {
  const drafts = [...state.drafts.drafts.value].flatMap(([key, draft]): ShownThread[] =>
    draft.kind === "thread" && draft.file === file
      ? [{ key, place: draft.place, shown: "draft" }]
      : [],
  );
  return [...state.open.shownFor(state.list.value, file), ...drafts];
}

function boxOf(state: State, key: string): ThreadBox | null {
  const draft = state.drafts.threadDraft(key);
  return draft === null ? state.open.boxOf(state.list.value, key) : { kind: "draft", draft };
}

async function changed(
  state: State,
  step: ThreadStep,
  call: () => Promise<SourceResult<ThreadList>>,
): Promise<ThreadList | null> {
  const outcome = await attempt(call);
  if (!outcome.ok) {
    state.report({ action: "threads", step, cause: outcome.cause });
    return null;
  }
  setList(state, outcome.value);
  return outcome.value;
}

async function addThread(state: State, key: string, text: string): Promise<ThreadId | null> {
  const draft = state.drafts.threadDraft(key);
  if (draft === null || isBlank(text) || state.adds.inFlight.addingThread(key)) {
    return null;
  }
  const outcome = await state.adds.whileAdding({ kind: "thread", draftKey: key }, () =>
    attempt(() => state.source.addThread(draft.file, draft.place, text)),
  );
  if (!outcome.ok) {
    state.drafts.writeDraft(key, text);
    state.report({ action: "threads", step: "add", cause: outcome.cause });
    return null;
  }
  const { thread, list } = outcome.value;
  state.open.added(thread, key);
  state.drafts.dropDraft(key);
  setList(state, list);
  return thread;
}

async function addNote(state: State, thread: ThreadId, text: string): Promise<boolean> {
  if (isBlank(text)) {
    return false;
  }
  const added = await state.adds.whileAdding({ kind: "note", thread }, () =>
    changed(state, "note", () => state.source.addNote(thread, text)),
  );
  state.drafts.writeNote(thread, added === null ? text : "");
  return added !== null;
}

function counted(state: State): Pick<RangeThreads, "counts" | "queued"> {
  return {
    counts: computed(() => {
      const counts = new Map<RangeFileId, number>();
      for (const { file } of state.list.value.threads) {
        counts.set(file, (counts.get(file) ?? 0) + 1);
      }
      return counts;
    }),
    queued: computed(
      () =>
        state.list.value.threads
          .flatMap(({ messages }) => messages)
          .filter(({ posting }) => isQueued(posting)).length,
    ),
  };
}

function replies(state: State): Pick<RangeThreads, "load" | "queue" | "unqueue" | "replace"> {
  const { source } = state;
  return {
    load: async () => {
      await changed(state, "list", () => source.listThreads());
      state.listed.value = true;
    },
    queue: async (message, text) => {
      if (
        !isBlank(text) &&
        (await changed(state, "queue", () => source.queueMessage(message, text))) !== null
      ) {
        state.drafts.dropPost(message);
      }
    },
    unqueue: async (message) => {
      await changed(state, "unqueue", () => source.unqueueMessage(message));
    },
    replace: (list) => {
      setList(state, list);
    },
  };
}

function noteChanges(state: State): Pick<RangeThreads, "editNote" | "deleteMessage"> {
  const { source } = state;
  return {
    editNote: async (message, text) => {
      if (isBlank(text)) {
        return false;
      }
      const edited = await changed(state, "edit", () => source.editNote(message, text));
      if (edited !== null) {
        state.drafts.dropEdit(message);
      }
      return edited !== null;
    },
    deleteMessage: async (message) => {
      await changed(state, "delete", () => source.deleteMessage(message));
    },
  };
}

function addedTurn(list: ThreadList, id: ThreadId): number | null {
  const body = list.threads.find((thread) => thread.id === id)?.messages.at(-1)?.body;
  return body?.kind === "aiAnswer" ? body.turn : null;
}

function aiRecords(state: State): Pick<RangeThreads, "setSession" | "addAiAnswer"> {
  const { source } = state;
  return {
    setSession: async (thread, session) =>
      (await changed(state, "session", () => source.setThreadSession(thread, session))) !== null,
    addAiAnswer: async (thread, session) => {
      const list = await changed(state, "answer", () => source.addAiAnswer(thread, session));
      return list === null ? null : addedTurn(list, thread);
    },
  };
}

export function createRangeThreads(
  source: ReviewSource,
  report: (problem: Problem) => void,
): RangeThreads {
  const state: State = {
    source,
    report,
    list: shallowRef<ThreadList>({ threads: [] }),
    listed: shallowRef(false),
    open: createRangeOpen(),
    drafts: createRangeDrafts(),
    adds: createRangeAdds(),
  };
  const { threadDraft: _threadDraft, keepStored: _keepStored, ...drafts } = state.drafts;
  return {
    list: state.list,
    listed: state.listed,
    open: state.open.open,
    ...drafts,
    ...counted(state),
    ...replies(state),
    ...noteChanges(state),
    ...aiRecords(state),
    shownFor: (file) => shownFor(state, file),
    boxOf: (key) => boxOf(state, key),
    toggle: (keys) => {
      state.open.toggle(state.list.value, keys);
    },
    addThread: (key, text) => addThread(state, key, text),
    addNote: (thread, text) => addNote(state, thread, text),
    ...state.adds.inFlight,
  };
}
