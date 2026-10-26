import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  MessageId,
  Posting,
  RangeFileId,
  ReviewSource,
  ShownThread,
  SourceResult,
  Thread,
  ThreadId,
  ThreadLine,
  ThreadList,
} from "../ipc";
import { attempt, type Problem, type ThreadStep } from "./problem";
import {
  createRangeDrafts,
  isBlank,
  type Draft,
  type RangeDrafts,
  type ThreadDraft,
} from "./rangeDrafts";

type ThreadBox =
  | { readonly kind: "draft"; readonly draft: ThreadDraft }
  | { readonly kind: "thread"; readonly thread: Thread; readonly open: boolean };

export type RangeThreads = {
  readonly list: Readonly<ShallowRef<ThreadList>>;
  readonly open: Readonly<ShallowRef<ReadonlySet<ThreadId>>>;
  readonly drafts: Readonly<ShallowRef<ReadonlyMap<string, Draft>>>;
  readonly counts: ComputedRef<ReadonlyMap<RangeFileId, number>>;
  readonly queued: ComputedRef<number>;
  load(): Promise<void>;
  shownFor(file: RangeFileId): readonly ShownThread[];
  boxOf(key: string): ThreadBox | null;
  startThread(file: RangeFileId, line: ThreadLine): void;
  writeDraft(key: string, text: string): void;
  dropDraft(key: string): void;
  noteText(thread: ThreadId): string;
  writeNote(thread: ThreadId, text: string): void;
  toggle(keys: readonly string[]): void;
  addThread(draftKey: string, text: string): Promise<void>;
  addNote(thread: ThreadId, text: string): Promise<void>;
  queue(message: MessageId, text: string): Promise<void>;
  unqueue(message: MessageId): Promise<void>;
  replace(list: ThreadList): void;
};

type State = {
  readonly source: ReviewSource;
  readonly report: (problem: Problem) => void;
  readonly list: ShallowRef<ThreadList>;
  readonly open: ShallowRef<ReadonlySet<ThreadId>>;
  readonly drafts: RangeDrafts;
  readonly keys: Map<ThreadId, string>;
  readonly adding: Set<string>;
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

function keyOf(state: State, thread: ThreadId): string {
  return state.keys.get(thread) ?? `thread-${thread}`;
}

function shownFor(state: State, file: RangeFileId): ShownThread[] {
  const stored = state.list.value.threads
    .filter((thread) => thread.file === file)
    .map(({ id, line }): ShownThread => {
      const shown = state.open.value.has(id) ? "open" : "collapsed";
      return { key: keyOf(state, id), line, shown };
    });
  const drafts = [...state.drafts.drafts.value].flatMap(([key, draft]): ShownThread[] =>
    draft.kind === "thread" && draft.file === file
      ? [{ key, line: draft.line, shown: "draft" }]
      : [],
  );
  return [...stored, ...drafts];
}

function boxOf(state: State, key: string): ThreadBox | null {
  const draft = state.drafts.threadDraft(key);
  if (draft !== null) {
    return { kind: "draft", draft };
  }
  const thread = state.list.value.threads.find(({ id }) => keyOf(state, id) === key);
  return thread === undefined
    ? null
    : { kind: "thread", thread, open: state.open.value.has(thread.id) };
}

function toggle(state: State, keys: readonly string[]): void {
  const ids = state.list.value.threads
    .map(({ id }) => id)
    .filter((id) => keys.includes(keyOf(state, id)));
  const opening = ids.some((id) => !state.open.value.has(id));
  const open = new Set(state.open.value);
  for (const id of ids) {
    if (opening) {
      open.add(id);
    } else {
      open.delete(id);
    }
  }
  state.open.value = open;
}

async function changed(
  state: State,
  step: ThreadStep,
  call: () => Promise<SourceResult<ThreadList>>,
): Promise<boolean> {
  const outcome = await attempt(call);
  if (!outcome.ok) {
    state.report({ action: "threads", step, cause: outcome.cause });
    return false;
  }
  state.list.value = outcome.value;
  return true;
}

async function addThread(state: State, key: string, text: string): Promise<void> {
  const draft = state.drafts.threadDraft(key);
  if (draft === null || isBlank(text) || state.adding.has(key)) {
    return;
  }
  state.adding.add(key);
  const outcome = await attempt(() => state.source.addThread(draft.file, draft.line, text));
  state.adding.delete(key);
  if (!outcome.ok) {
    state.drafts.writeDraft(key, text);
    state.report({ action: "threads", step: "add", cause: outcome.cause });
    return;
  }
  const { thread, list } = outcome.value;
  state.keys.set(thread, key);
  state.open.value = new Set([...state.open.value, thread]);
  state.drafts.dropDraft(key);
  state.list.value = list;
}

async function addNote(state: State, thread: ThreadId, text: string): Promise<void> {
  if (isBlank(text)) {
    return;
  }
  const added = await changed(state, "note", () => state.source.addNote(thread, text));
  state.drafts.writeNote(thread, added ? "" : text);
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
    },
    queue: async (message, text) => {
      if (!isBlank(text)) {
        await changed(state, "queue", () => source.queueMessage(message, text));
      }
    },
    unqueue: async (message) => {
      await changed(state, "unqueue", () => source.unqueueMessage(message));
    },
    replace: (list) => {
      state.list.value = list;
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
    open: shallowRef<ReadonlySet<ThreadId>>(new Set()),
    drafts: createRangeDrafts(),
    keys: new Map(),
    adding: new Set(),
  };
  const { threadDraft: _threadDraft, ...drafts } = state.drafts;
  return {
    list: state.list,
    open: state.open,
    ...drafts,
    ...counted(state),
    ...replies(state),
    shownFor: (file) => shownFor(state, file),
    boxOf: (key) => boxOf(state, key),
    toggle: (keys) => {
      toggle(state, keys);
    },
    addThread: (key, text) => addThread(state, key, text),
    addNote: (thread, text) => addNote(state, thread, text),
  };
}
