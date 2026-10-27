import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import {
  agentSessionId,
  isMessageId,
  isRangeFileId,
  isThreadId,
  type AgentSessionId,
  type MessageId,
  type RangeFileId,
  type ThreadId,
} from "./domain";
import { createTauriReview } from "./tauriReview";
import { changedThreadLine } from "./threadLine";

const commands = vi.hoisted(() => ({
  listThreads: vi.fn(),
  addThread: vi.fn(),
  addNote: vi.fn(),
  queueMessage: vi.fn(),
  unqueueMessage: vi.fn(),
  setThreadSession: vi.fn(),
  addAiAnswer: vi.fn(),
  checkGitlab: vi.fn(),
  sendQueue: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    constructor(readonly onmessage: (message: unknown) => void) {}
  },
}));

const PENDING_LIST: Generated.ThreadList = {
  threads: [
    {
      id: 2,
      file: 7,
      line: { kind: "unchangedOnLeft", left: 5, right: 6 },
      messages: [
        {
          id: 4,
          body: { kind: "note", text: "Rename?" },
          written: 1700,
          posting: {
            kind: "pending",
            text: "Rename?",
            draft_note: 88,
            merge_request: "!12",
            link: "l",
          },
        },
      ],
      session: "s",
    },
  ],
};

const CAMEL_LIST = {
  threads: [
    {
      id: 2,
      file: 7,
      line: { kind: "unchangedOnLeft", left: 5, right: 6 },
      messages: [
        {
          id: 4,
          body: { kind: "note", text: "Rename?" },
          written: 1700,
          posting: {
            kind: "pending",
            text: "Rename?",
            draftNote: 88,
            mergeRequest: "!12",
            link: "l",
          },
        },
      ],
      session: "s",
    },
  ],
};

const MERGE_REQUEST: Generated.MergeRequestRef = { reference: "!12", title: "T", web_url: "u" };

function fileId(n: number): RangeFileId {
  if (!isRangeFileId(n)) {
    throw new Error(`${n} is no file id`);
  }
  return n;
}

function threadId(n: number): ThreadId {
  if (!isThreadId(n)) {
    throw new Error(`${n} is no thread id`);
  }
  return n;
}

function messageId(n: number): MessageId {
  if (!isMessageId(n)) {
    throw new Error(`${n} is no message id`);
  }
  return n;
}

function session(text: string): AgentSessionId {
  const id = agentSessionId(text);
  if (id === null) {
    throw new Error(`${text} is no session`);
  }
  return id;
}

function ok<T>(data: T): { status: "ok"; data: T } {
  return { status: "ok", data };
}

beforeEach(() => {
  vi.resetAllMocks();
});

test("each thread command passes its arguments and camelCases the list", async () => {
  for (const command of [
    commands.listThreads,
    commands.addNote,
    commands.queueMessage,
    commands.unqueueMessage,
    commands.setThreadSession,
    commands.addAiAnswer,
  ]) {
    command.mockResolvedValue(ok(PENDING_LIST));
  }
  const review = createTauriReview();

  expect(await review.listThreads()).toEqual({ ok: true, value: CAMEL_LIST });
  expect(await review.addNote(threadId(2), "More")).toEqual({ ok: true, value: CAMEL_LIST });
  expect(await review.queueMessage(messageId(4), "Edited")).toEqual({
    ok: true,
    value: CAMEL_LIST,
  });
  expect(await review.unqueueMessage(messageId(4))).toEqual({ ok: true, value: CAMEL_LIST });
  expect(await review.setThreadSession(threadId(2), session("s2"))).toEqual({
    ok: true,
    value: CAMEL_LIST,
  });
  expect(await review.addAiAnswer(threadId(2), session("s3"))).toEqual({
    ok: true,
    value: CAMEL_LIST,
  });
  expect(commands.addNote).toHaveBeenCalledWith(2, "More");
  expect(commands.queueMessage).toHaveBeenCalledWith(4, "Edited");
  expect(commands.unqueueMessage).toHaveBeenCalledWith(4);
  expect(commands.setThreadSession).toHaveBeenCalledWith(2, "s2");
  expect(commands.addAiAnswer).toHaveBeenCalledWith(2, "s3");
});

test("addThread sends the file, the line and the text, and brands the new id", async () => {
  commands.addThread.mockResolvedValue(ok({ thread: 2, list: PENDING_LIST }));

  const added = await createTauriReview().addThread(fileId(7), changedThreadLine("right", 3), "Hm");

  expect(added).toEqual({ ok: true, value: { thread: 2, list: CAMEL_LIST } });
  expect(commands.addThread).toHaveBeenCalledWith(7, { kind: "added", right: 3 }, "Hm");
});

test("checkGitLab camelCases the merge request", async () => {
  commands.checkGitlab.mockResolvedValue(ok({ kind: "linedUp", merge_request: MERGE_REQUEST }));

  expect(await createTauriReview().checkGitLab()).toEqual({
    ok: true,
    value: { kind: "linedUp", mergeRequest: { reference: "!12", title: "T", webUrl: "u" } },
  });
});

test("sendQueue hands each progress from the channel to the callback and camelCases the reply", async () => {
  const seen: unknown[] = [];
  commands.sendQueue.mockImplementation(
    async (channel: { onmessage: (progress: Generated.SendProgress) => void }) => {
      channel.onmessage({ done: 1, of: 2 });
      channel.onmessage({ done: 2, of: 2 });
      return ok({ kind: "sent", list: PENDING_LIST, sent: 2, refused: 0 });
    },
  );

  const reply = await createTauriReview().sendQueue((progress) => seen.push(progress));

  expect(seen).toEqual([
    { done: 1, of: 2 },
    { done: 2, of: 2 },
  ]);
  expect(reply).toEqual({
    ok: true,
    value: { kind: "sent", list: CAMEL_LIST, sent: 2, refused: 0 },
  });
});

test.each<[keyof typeof commands, Generated.IpcError]>([
  ["listThreads", { kind: "WriteFailed", path: "/p/threads.json", message: "full" }],
  ["addThread", { kind: "EmptyMessage" }],
  ["addNote", { kind: "UnknownThread", thread: 9 }],
  ["queueMessage", { kind: "MessagePending", message: 4 }],
  ["unqueueMessage", { kind: "UnknownMessage", message: 5 }],
  ["setThreadSession", { kind: "UnknownThread", thread: 6 }],
  ["addAiAnswer", { kind: "WriteFailed", path: "/p/threads.json", message: "full" }],
  ["checkGitlab", { kind: "WorkerStopped" }],
  ["sendQueue", { kind: "SendRunning" }],
])("a %s failure comes back unchanged", async (name, failure) => {
  commands[name].mockResolvedValue({ status: "error", error: failure });
  const review = createTauriReview();
  const calls = {
    listThreads: () => review.listThreads(),
    addThread: () => review.addThread(fileId(0), changedThreadLine("left", 0), "x"),
    addNote: () => review.addNote(threadId(9), "x"),
    queueMessage: () => review.queueMessage(messageId(4), "x"),
    unqueueMessage: () => review.unqueueMessage(messageId(5)),
    setThreadSession: () => review.setThreadSession(threadId(6), session("s")),
    addAiAnswer: () => review.addAiAnswer(threadId(6), session("s")),
    checkGitlab: () => review.checkGitLab(),
    sendQueue: () => review.sendQueue(() => undefined),
  };

  expect(await calls[name]()).toEqual({ ok: false, failure });
});

test("a reply with a bad message id is refused, naming the field", async () => {
  const [first] = PENDING_LIST.threads;
  if (first === undefined) {
    throw new Error("no thread");
  }
  commands.listThreads.mockResolvedValue(
    ok({ threads: [{ ...first, messages: first.messages.map((each) => ({ ...each, id: -1 })) }] }),
  );

  await expect(createTauriReview().listThreads()).rejects.toThrow(
    "threads[0].messages[0].id must be a non-negative safe integer, got -1",
  );
});
