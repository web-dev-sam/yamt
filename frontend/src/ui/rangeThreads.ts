import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type { ShownThread } from "../editor";
import {
  shownLine,
  type MessageId,
  type RangeFileId,
  type ReviewSource,
  type SourceResult,
  type Thread,
  type ThreadId,
  type ThreadLine,
  type ThreadList,
} from "../ipc";
import { attempt, type Problem, type ThreadStep } from "./problem";

type Draft =
  | {
      readonly kind: "thread";
      readonly file: RangeFileId;
      readonly line: ThreadLine;
      readonly text: string;
      readonly focus: number;
    }
  | { readonly kind: "note"; readonly thread: ThreadId; readonly text: string };

type ThreadDraft = Extract<Draft, { readonly kind: "thread" }>;

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
  readonly drafts: ShallowRef<ReadonlyMap<string, Draft>>;
  readonly keys: Map<ThreadId, string>;
  readonly adding: Set<string>;
  nextDraft: number;
};

function isBlank(text: string): boolean {
  return text.trim() === "";
}

function keyOf(state: State, thread: ThreadId): string {
  return state.keys.get(thread) ?? `thread-${thread}`;
}

function noteKey(thread: ThreadId): string {
  return `note-${thread}`;
}

function setDraft(state: State, key: string, draft: Draft | null): void {
  const drafts = new Map(state.drafts.value);
  if (draft === null) {
    drafts.delete(key);
  } else {
    drafts.set(key, draft);
  }
  state.drafts.value = drafts;
}

function threadDraft(state: State, key: string): ThreadDraft | null {
  const draft = state.drafts.value.get(key);
  return draft?.kind === "thread" ? draft : null;
}

function sameLine(a: ThreadLine, b: ThreadLine): boolean {
  const [first, second] = [shownLine(a), shownLine(b)];
  return first.column === second.column && first.line === second.line;
}

function shownFor(state: State, file: RangeFileId): ShownThread[] {
  const stored = state.list.value.threads
    .filter((thread) => thread.file === file)
    .map(({ id, line }): ShownThread => {
      const shown = state.open.value.has(id) ? "open" : "collapsed";
      return { key: keyOf(state, id), line, shown };
    });
  const drafts = [...state.drafts.value].flatMap(([key, draft]): ShownThread[] =>
    draft.kind === "thread" && draft.file === file
      ? [{ key, line: draft.line, shown: "draft" }]
      : [],
  );
  return [...stored, ...drafts];
}

function boxOf(state: State, key: string): ThreadBox | null {
  const draft = threadDraft(state, key);
  if (draft !== null) {
    return { kind: "draft", draft };
  }
  const thread = state.list.value.threads.find(({ id }) => keyOf(state, id) === key);
  return thread === undefined
    ? null
    : { kind: "thread", thread, open: state.open.value.has(thread.id) };
}

function startThread(state: State, file: RangeFileId, line: ThreadLine): void {
  for (const [key, draft] of state.drafts.value) {
    if (draft.kind === "thread" && draft.file === file && sameLine(draft.line, line)) {
      setDraft(state, key, { ...draft, focus: draft.focus + 1 });
      return;
    }
  }
  const key = `draft-${state.nextDraft}`;
  state.nextDraft += 1;
  setDraft(state, key, { kind: "thread", file, line, text: "", focus: 0 });
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
  const draft = threadDraft(state, key);
  if (draft === null || isBlank(text) || state.adding.has(key)) {
    return;
  }
  state.adding.add(key);
  const outcome = await attempt(() => state.source.addThread(draft.file, draft.line, text));
  state.adding.delete(key);
  if (!outcome.ok) {
    const kept = threadDraft(state, key);
    if (kept !== null) {
      setDraft(state, key, { ...kept, text });
    }
    state.report({ action: "threads", step: "add", cause: outcome.cause });
    return;
  }
  const { thread, list } = outcome.value;
  state.keys.set(thread, key);
  state.open.value = new Set([...state.open.value, thread]);
  setDraft(state, key, null);
  state.list.value = list;
}

async function addNote(state: State, thread: ThreadId, text: string): Promise<void> {
  if (isBlank(text)) {
    return;
  }
  if (await changed(state, "note", () => state.source.addNote(thread, text))) {
    setDraft(state, noteKey(thread), null);
  } else {
    setDraft(state, noteKey(thread), { kind: "note", thread, text });
  }
}

function writing(
  state: State,
): Pick<RangeThreads, "writeDraft" | "dropDraft" | "noteText" | "writeNote"> {
  return {
    writeDraft: (key, text) => {
      const draft = threadDraft(state, key);
      if (draft !== null) {
        setDraft(state, key, { ...draft, text });
      }
    },
    dropDraft: (key) => {
      setDraft(state, key, null);
    },
    noteText: (thread) => {
      const draft = state.drafts.value.get(noteKey(thread));
      return draft?.kind === "note" ? draft.text : "";
    },
    writeNote: (thread, text) => {
      setDraft(state, noteKey(thread), isBlank(text) ? null : { kind: "note", thread, text });
    },
  };
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
          .filter(({ posting }) => posting.kind === "queued" || posting.kind === "refused").length,
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
    drafts: shallowRef<ReadonlyMap<string, Draft>>(new Map()),
    keys: new Map(),
    adding: new Set(),
    nextDraft: 0,
  };
  return {
    list: state.list,
    open: state.open,
    drafts: state.drafts,
    ...counted(state),
    ...replies(state),
    shownFor: (file) => shownFor(state, file),
    boxOf: (key) => boxOf(state, key),
    startThread: (file, line) => {
      startThread(state, file, line);
    },
    ...writing(state),
    toggle: (keys) => {
      toggle(state, keys);
    },
    addThread: (key, text) => addThread(state, key, text),
    addNote: (thread, text) => addNote(state, thread, text),
  };
}
