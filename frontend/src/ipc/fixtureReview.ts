import type * as Generated from "./bindings";
import type { SourceResult } from "./domain";
import {
  gitLabCheck,
  postOutcome,
  shownGitLabScript,
  TIMED_OUT,
  type GitLabScript,
  type PostOutcome,
  pendingPosting,
  REFUSAL,
} from "./fixtureGitLab";
import { SEEDED_DRAFT_NOTE, startThreads } from "./fixtureThreads";
import type { Log } from "./log";
import type { RangeStart } from "./rangeDomain";
import {
  toGitLabCheck,
  toSendReply,
  toThreadAdded,
  toThreadList,
  type SendProgress,
  type SendReply,
  type ThreadAdded,
  type ThreadList,
} from "./reviewDomain";
import type { ReviewSource } from "./ReviewSource";
import { fromThreadLine, type ThreadLine } from "./threadLine";

type Store = {
  readonly start: RangeStart;
  readonly script: GitLabScript;
  readonly threads: Generated.Thread[];
  readonly next: { thread: number; message: number; draftNote: number };
  sending: boolean;
};

type Tally = { sent: number; refused: number };

const CHECKING_MS = 3000;
const POST_PAUSE_MS = 300;
const MS_PER_SECOND = 1000;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function listed(store: Store): Generated.ThreadList {
  return { threads: store.threads };
}

function messagesOf(store: Store): Generated.Message[] {
  return store.threads.flatMap((thread) => thread.messages);
}

function isBlank(text: string): boolean {
  return text.trim() === "";
}

function newMessage(store: Store, body: Generated.MessageBody): Generated.Message {
  const id = store.next.message;
  store.next.message += 1;
  const written = Math.floor(Date.now() / MS_PER_SECOND);
  return { id, body, written, posting: { kind: "notQueued" } };
}

function addThread(
  store: Store,
  file: number,
  line: ThreadLine,
  text: string,
): SourceResult<ThreadAdded> {
  if (isBlank(text)) {
    return { ok: false, failure: { kind: "EmptyMessage" } };
  }
  if (!store.start.files.some((entry) => entry.id === file)) {
    return { ok: false, failure: { kind: "UnknownRangeFile", file } };
  }
  const id = store.next.thread;
  store.next.thread += 1;
  const messages = [newMessage(store, { kind: "note", text })];
  store.threads.push({ id, file, line: fromThreadLine(line), messages, session: null });
  return { ok: true, value: toThreadAdded({ thread: id, list: listed(store) }) };
}

function changeThread(
  store: Store,
  thread: number,
  change: (found: Generated.Thread) => void,
): SourceResult<ThreadList> {
  const found = store.threads.find((each) => each.id === thread);
  if (found === undefined) {
    return { ok: false, failure: { kind: "UnknownThread", thread } };
  }
  change(found);
  return { ok: true, value: toThreadList(listed(store)) };
}

function addNote(store: Store, thread: number, text: string): SourceResult<ThreadList> {
  return isBlank(text)
    ? { ok: false, failure: { kind: "EmptyMessage" } }
    : changeThread(store, thread, (found) => {
        found.messages.push(newMessage(store, { kind: "note", text }));
      });
}

function addAiAnswer(store: Store, thread: number, session: string): SourceResult<ThreadList> {
  return changeThread(store, thread, (found) => {
    const turn = found.messages.filter(
      ({ body }) => body.kind === "aiAnswer" && body.session === session,
    ).length;
    found.session = session;
    found.messages.push(newMessage(store, { kind: "aiAnswer", session, turn }));
  });
}

function changePosting(
  store: Store,
  message: number,
  posting: Generated.Posting,
): SourceResult<ThreadList> {
  const found = messagesOf(store).find((each) => each.id === message);
  if (found === undefined) {
    return { ok: false, failure: { kind: "UnknownMessage", message } };
  }
  if (found.posting.kind === "pending") {
    return { ok: false, failure: { kind: "MessagePending", message } };
  }
  found.posting = posting;
  return { ok: true, value: toThreadList(listed(store)) };
}

function waitingText(posting: Generated.Posting): string | null {
  return posting.kind === "queued" || posting.kind === "refused" ? posting.text : null;
}

function record(
  store: Store,
  message: Generated.Message,
  text: string,
  outcome: PostOutcome,
  tally: Tally,
): void {
  if (outcome === "refused") {
    message.posting = { kind: "refused", text, reason: REFUSAL };
    tally.refused += 1;
    return;
  }
  message.posting = pendingPosting(text, store.next.draftNote);
  store.next.draftNote += 1;
  tally.sent += 1;
}

async function postQueue(
  store: Store,
  onProgress: (progress: SendProgress) => void,
): Promise<Generated.SendReply> {
  const queued = messagesOf(store).filter((message) => waitingText(message.posting) !== null);
  const tally: Tally = { sent: 0, refused: 0 };
  for (const [index, message] of queued.entries()) {
    await pause(POST_PAUSE_MS);
    const text = waitingText(message.posting);
    if (text !== null) {
      const outcome = postOutcome(store.script, index);
      if (outcome === "stopped") {
        return { kind: "stopped", list: listed(store), ...tally, reason: TIMED_OUT };
      }
      record(store, message, text, outcome, tally);
    }
    onProgress({ done: index + 1, of: queued.length });
  }
  return { kind: "sent", list: listed(store), ...tally };
}

async function sendQueue(
  store: Store,
  onProgress: (progress: SendProgress) => void,
): Promise<SourceResult<SendReply>> {
  if (store.sending) {
    return { ok: false, failure: { kind: "SendRunning" } };
  }
  const check = gitLabCheck(store.script, store.start);
  if (check.kind === "notLinedUp") {
    return { ok: true, value: toSendReply({ kind: "notLinedUp", why: check.why }) };
  }
  store.sending = true;
  try {
    return { ok: true, value: toSendReply(await postQueue(store, onProgress)) };
  } finally {
    store.sending = false;
  }
}

function threadCalls(
  store: Store,
): Pick<ReviewSource, "addThread" | "addNote" | "setThreadSession" | "addAiAnswer"> {
  return {
    async addThread(file, line, text) {
      return addThread(store, file, line, text);
    },
    async addNote(thread, text) {
      return addNote(store, thread, text);
    },
    async setThreadSession(thread, session) {
      return changeThread(store, thread, (found) => {
        found.session = session;
      });
    },
    async addAiAnswer(thread, session) {
      return addAiAnswer(store, thread, session);
    },
  };
}

export function createFixtureReview(log: Log, search: string, start: RangeStart): ReviewSource {
  const threads = startThreads(search, start);
  const messages = threads.reduce((count, thread) => count + thread.messages.length, 0);
  const store: Store = {
    start,
    script: shownGitLabScript(log, search),
    threads,
    next: { thread: threads.length, message: messages, draftNote: SEEDED_DRAFT_NOTE + 1 },
    sending: false,
  };
  return {
    async listThreads() {
      return { ok: true, value: toThreadList(listed(store)) };
    },
    ...threadCalls(store),
    async queueMessage(message, text) {
      return isBlank(text)
        ? { ok: false, failure: { kind: "EmptyMessage" } }
        : changePosting(store, message, { kind: "queued", text });
    },
    async unqueueMessage(message) {
      return changePosting(store, message, { kind: "notQueued" });
    },
    async checkGitLab() {
      if (store.script === "checking") {
        await pause(CHECKING_MS);
      }
      return { ok: true, value: toGitLabCheck(gitLabCheck(store.script, store.start)) };
    },
    sendQueue: (onProgress) => sendQueue(store, onProgress),
  };
}
