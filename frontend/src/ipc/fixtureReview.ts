import type * as Generated from "./bindings";
import type { SourceResult } from "./domain";
import {
  gitLabCheck,
  pendingPosting,
  postOutcome,
  REFUSAL,
  shownGitLabScript,
  TIMED_OUT,
  type GitLabScript,
  type PostOutcome,
} from "./fixtureGitLab";
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

type Seed = Pick<Generated.Thread, "line" | "session"> & {
  readonly messages: readonly Omit<Generated.Message, "id" | "written">[];
};

const CHECKING_MS = 3000;
const POST_PAUSE_MS = 300;
const MS_PER_SECOND = 1000;

const SEEDED_PATH = "src/board/board.ts";
const SEEDED_WRITTEN = 1_767_225_600;
const SEEDED_DRAFT_NOTE = 101;
const SEEDED_SESSION = "fixture-session";

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function note(text: string, posting: Generated.Posting): Seed["messages"][number] {
  return { body: { kind: "note", text }, posting };
}

function seededThreads(file: number): Generated.Thread[] {
  const queued = "Why does the overdue check go?";
  const refused = "This needs a test.";
  const pending = "Rename this to `cardsOf`?";
  const seeds: readonly Seed[] = [
    {
      line: { kind: "removed", left: 19 },
      messages: [note(queued, { kind: "queued", text: queued })],
      session: null,
    },
    {
      line: { kind: "added", right: 20 },
      messages: [note(refused, { kind: "refused", text: refused, reason: REFUSAL })],
      session: null,
    },
    {
      line: { kind: "unchangedOnLeft", left: 5, right: 5 },
      messages: [note(pending, pendingPosting(pending, SEEDED_DRAFT_NOTE))],
      session: null,
    },
    {
      line: { kind: "unchangedOnRight", left: 100, right: 101 },
      messages: [
        note("Is this still used?", { kind: "notQueued" }),
        { body: { kind: "aiAnswer", turn: 0 }, posting: { kind: "notQueued" } },
      ],
      session: SEEDED_SESSION,
    },
  ];
  let nextMessage = 0;
  return seeds.map((seed, id) => {
    const messages = seed.messages.map((each) => {
      const message = { ...each, id: nextMessage, written: SEEDED_WRITTEN };
      nextMessage += 1;
      return message;
    });
    return { ...seed, id, file, messages };
  });
}

function startThreads(search: string, start: RangeStart): Generated.Thread[] {
  const seeded = start.files.find((entry) => entry.path === SEEDED_PATH);
  const asked = new URLSearchParams(search).get("threads");
  return asked === "seeded" && seeded !== undefined ? seededThreads(seeded.id) : [];
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

function newNote(store: Store, text: string): Generated.Message {
  const id = store.next.message;
  store.next.message += 1;
  return {
    id,
    body: { kind: "note", text },
    written: Math.floor(Date.now() / MS_PER_SECOND),
    posting: { kind: "notQueued" },
  };
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
  const messages = [newNote(store, text)];
  store.threads.push({ id, file, line: fromThreadLine(line), messages, session: null });
  return { ok: true, value: toThreadAdded({ thread: id, list: listed(store) }) };
}

function addNote(store: Store, thread: number, text: string): SourceResult<ThreadList> {
  if (isBlank(text)) {
    return { ok: false, failure: { kind: "EmptyMessage" } };
  }
  const found = store.threads.find((each) => each.id === thread);
  if (found === undefined) {
    return { ok: false, failure: { kind: "UnknownThread", thread } };
  }
  found.messages.push(newNote(store, text));
  return { ok: true, value: toThreadList(listed(store)) };
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
  outcome: PostOutcome,
  tally: Tally,
): void {
  const text = waitingText(message.posting);
  if (text === null) {
    return;
  }
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
    const outcome = postOutcome(store.script, index);
    if (outcome === "stopped") {
      return { kind: "stopped", list: listed(store), ...tally, reason: TIMED_OUT };
    }
    record(store, message, outcome, tally);
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
    async addThread(file, line, text) {
      return addThread(store, file, line, text);
    },
    async addNote(thread, text) {
      return addNote(store, thread, text);
    },
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
