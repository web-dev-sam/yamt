import { shallowRef, type ShallowRef } from "vue";

import {
  shownLine,
  type Message,
  type MessageId,
  type RangeFileId,
  type ThreadId,
  type ThreadLine,
  type ThreadList,
} from "../ipc";
import { isChangeable } from "./rangeNoteChange";

export type Draft =
  | {
      readonly kind: "thread";
      readonly file: RangeFileId;
      readonly line: ThreadLine;
      readonly text: string;
      readonly focus: number;
    }
  | { readonly kind: "note"; readonly thread: ThreadId; readonly text: string }
  | { readonly kind: "post"; readonly message: MessageId; readonly text: string }
  | { readonly kind: "edit"; readonly message: MessageId; readonly text: string };

export type ThreadDraft = Extract<Draft, { readonly kind: "thread" }>;

export type RangeDrafts = {
  readonly drafts: Readonly<ShallowRef<ReadonlyMap<string, Draft>>>;
  readonly threadDraft: (key: string) => ThreadDraft | null;
  readonly keepStored: (list: ThreadList) => void;
  startThread(file: RangeFileId, line: ThreadLine): void;
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
};

type State = {
  readonly drafts: ShallowRef<ReadonlyMap<string, Draft>>;
  nextDraft: number;
};

export function isBlank(text: string): boolean {
  return text.trim() === "";
}

function noteKey(thread: ThreadId): string {
  return `note-${thread}`;
}

function postKey(message: MessageId): string {
  return `post-${message}`;
}

function editKey(message: MessageId): string {
  return `edit-${message}`;
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

/** A message's Post and Edit boxes are never open at once (plan row 123). */
function openMessageBox(state: State, open: string, closed: string, draft: Draft): void {
  const drafts = new Map(state.drafts.value);
  drafts.delete(closed);
  drafts.set(open, draft);
  state.drafts.value = drafts;
}

function threadDraft(state: State, key: string): ThreadDraft | null {
  const draft = state.drafts.value.get(key);
  return draft?.kind === "thread" ? draft : null;
}

function storedMessage(list: ThreadList, message: MessageId): Message | undefined {
  return list.threads.flatMap(({ messages }) => messages).find(({ id }) => id === message);
}

function isStored(draft: Draft, list: ThreadList): boolean {
  switch (draft.kind) {
    case "thread":
      return true;
    case "note":
      return list.threads.some(({ id }) => id === draft.thread);
    case "post":
      return storedMessage(list, draft.message) !== undefined;
    case "edit": {
      const message = storedMessage(list, draft.message);
      return message !== undefined && isChangeable(message);
    }
    default: {
      const _exhaustive: never = draft;
      return _exhaustive;
    }
  }
}

/** Drops the drafts of threads and messages the list no longer holds, and Edit drafts of notes now pending. */
function keepStored(state: State, list: ThreadList): void {
  const kept = [...state.drafts.value].filter(([, draft]) => isStored(draft, list));
  if (kept.length < state.drafts.value.size) {
    state.drafts.value = new Map(kept);
  }
}

function sameLine(a: ThreadLine, b: ThreadLine): boolean {
  const [first, second] = [shownLine(a), shownLine(b)];
  return first.column === second.column && first.line === second.line;
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

function messageDrafts(
  state: State,
): Pick<
  RangeDrafts,
  "postDraft" | "writePost" | "dropPost" | "editDraft" | "writeEdit" | "dropEdit"
> {
  return {
    postDraft: (message) => {
      const draft = state.drafts.value.get(postKey(message));
      return draft?.kind === "post" ? draft.text : null;
    },
    writePost: (message, text) => {
      openMessageBox(state, postKey(message), editKey(message), { kind: "post", message, text });
    },
    dropPost: (message) => {
      setDraft(state, postKey(message), null);
    },
    editDraft: (message) => {
      const draft = state.drafts.value.get(editKey(message));
      return draft?.kind === "edit" ? draft.text : null;
    },
    writeEdit: (message, text) => {
      openMessageBox(state, editKey(message), postKey(message), { kind: "edit", message, text });
    },
    dropEdit: (message) => {
      setDraft(state, editKey(message), null);
    },
  };
}

export function createRangeDrafts(): RangeDrafts {
  const state: State = { drafts: shallowRef<ReadonlyMap<string, Draft>>(new Map()), nextDraft: 0 };
  return {
    drafts: state.drafts,
    threadDraft: (key) => threadDraft(state, key),
    keepStored: (list) => {
      keepStored(state, list);
    },
    startThread: (file, line) => {
      startThread(state, file, line);
    },
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
    ...messageDrafts(state),
  };
}
