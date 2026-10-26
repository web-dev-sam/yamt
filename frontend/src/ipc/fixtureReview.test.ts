import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  isMessageId,
  isRangeFileId,
  isThreadId,
  type MessageId,
  type RangeFileId,
  type SourceResult,
  type ThreadId,
} from "./domain";
import { createFixtureReview } from "./fixtureReview";
import { createLog, type Log, type LogEntry } from "./log";
import type { RangeEntry, RangeStart } from "./rangeDomain";
import type { SendProgress, Thread } from "./reviewDomain";
import type { ReviewSource } from "./ReviewSource";
import { changedThreadLine } from "./threadLine";

const REFUSAL = `400 Bad request - Note {:line_code=>["can't be blank"]}`;
const MERGE_REQUEST = {
  reference: "!12",
  title: "Reminders on cards",
  webUrl: "https://gitlab.example.com/team/taskboard/-/merge_requests/12",
};
const LINK = `${MERGE_REQUEST.webUrl}/diffs`;
const NOW_MS = 1_800_000_000_500;

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

function entry(id: number, path: string): RangeEntry {
  return {
    id: fileId(id),
    path,
    change: { kind: "modified" },
    lines: { kind: "counted", added: 1, removed: 1 },
  };
}

const START: RangeStart = {
  range: "main...feature",
  left: {
    label: { kind: "mergeBase", left: "main", right: "feature" },
    shortId: "531ea52",
    subject: "Base",
  },
  right: { label: { kind: "named", name: "feature" }, shortId: "9c1ba3f", subject: "Tip" },
  files: [entry(0, "config"), entry(7, "src/board/board.ts")],
};

function quietLog(): { log: Log; entries: LogEntry[] } {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const entries: LogEntry[] = [];
  const log = createLog((each) => {
    entries.push(each);
  });
  return { log, entries };
}

function review(search: string, start: RangeStart = START): ReviewSource {
  return createFixtureReview(quietLog().log, search, start);
}

function valueOf<T>(result: SourceResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected a value, got ${JSON.stringify(result.failure)}`);
  }
  return result.value;
}

async function threadsOf(source: ReviewSource): Promise<readonly Thread[]> {
  return valueOf(await source.listThreads()).threads;
}

function postings(threads: readonly Thread[]): unknown[] {
  return threads.flatMap((thread) => thread.messages.map((message) => message.posting));
}

async function settled<T>(pending: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return pending;
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW_MS });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test.each(["", "?threads", "?threads=", "?threads=other"])(
  "'%s' starts without threads",
  async (search) => {
    expect(await threadsOf(review(search))).toEqual([]);
  },
);

test("?threads=seeded puts one thread of each line kind on board.ts with every posting kind", async () => {
  const threads = await threadsOf(review("?threads=seeded"));

  expect(threads.map(({ id, file, line, session }) => ({ id, file, line, session }))).toEqual([
    { id: 0, file: 7, line: { kind: "removed", left: 19 }, session: null },
    { id: 1, file: 7, line: { kind: "added", right: 20 }, session: null },
    { id: 2, file: 7, line: { kind: "unchangedOnLeft", left: 5, right: 5 }, session: null },
    {
      id: 3,
      file: 7,
      line: { kind: "unchangedOnRight", left: 100, right: 101 },
      session: "fixture-session",
    },
  ]);
  expect(threads.flatMap((thread) => thread.messages.map((message) => message.id))).toEqual([
    0, 1, 2, 3, 4,
  ]);
  expect(postings(threads)).toEqual([
    { kind: "queued", text: "Why does the overdue check go?" },
    { kind: "refused", text: "This needs a test.", reason: REFUSAL },
    {
      kind: "pending",
      text: "Rename this to `cardsOf`?",
      draftNote: 101,
      mergeRequest: "!12",
      link: LINK,
    },
    { kind: "notQueued" },
    { kind: "notQueued" },
  ]);
  expect(threads[3]?.messages.map((message) => message.body)).toEqual([
    { kind: "note", text: "Is this still used?" },
    { kind: "aiAnswer", session: "fixture-session", turn: 0 },
  ]);
  expect(threads[0]?.messages[0]?.written).toBe(1_767_225_600);
});

test("?threads=seeded on a range without board.ts starts without threads", async () => {
  expect(
    await threadsOf(review("?threads=seeded", { ...START, files: [entry(0, "config")] })),
  ).toEqual([]);
});

test("addThread stores the first note with new ids after the seeded ones and the time in seconds", async () => {
  const source = review("?threads=seeded");

  const added = valueOf(await source.addThread(fileId(0), changedThreadLine("left", 2), "Typo"));

  expect(added.thread).toBe(4);
  expect(added.list.threads.at(-1)).toEqual({
    id: 4,
    file: 0,
    line: { kind: "removed", left: 2 },
    messages: [
      {
        id: 5,
        body: { kind: "note", text: "Typo" },
        written: 1_800_000_000,
        posting: { kind: "notQueued" },
      },
    ],
    session: null,
  });
  expect(await threadsOf(source)).toEqual(added.list.threads);
  const next = valueOf(await source.addThread(fileId(7), changedThreadLine("right", 1), "Two"));
  expect(next.thread).toBe(5);
  expect(next.list.threads.at(-1)?.messages[0]?.id).toBe(6);
});

test.each(["", "  \n\t"])(
  "addThread with blank text %j answers EmptyMessage and stores nothing",
  async (text) => {
    const source = review("");

    expect(await source.addThread(fileId(0), changedThreadLine("left", 0), text)).toEqual({
      ok: false,
      failure: { kind: "EmptyMessage" },
    });
    expect(await threadsOf(source)).toEqual([]);
  },
);

test("addThread on a file the range does not list answers UnknownRangeFile", async () => {
  const source = review("");

  expect(await source.addThread(fileId(3), changedThreadLine("left", 0), "x")).toEqual({
    ok: false,
    failure: { kind: "UnknownRangeFile", file: 3 },
  });
  expect(await threadsOf(source)).toEqual([]);
});

test("addNote appends a note; blank text and unknown threads are refused", async () => {
  const source = review("?threads=seeded");

  const list = valueOf(await source.addNote(threadId(1), "Still?"));

  expect(list.threads[1]?.messages.map((message) => message.body)).toEqual([
    { kind: "note", text: "This needs a test." },
    { kind: "note", text: "Still?" },
  ]);
  expect(list.threads[1]?.messages[1]?.id).toBe(5);
  expect(await source.addNote(threadId(1), " ")).toEqual({
    ok: false,
    failure: { kind: "EmptyMessage" },
  });
  expect(await source.addNote(threadId(9), "x")).toEqual({
    ok: false,
    failure: { kind: "UnknownThread", thread: 9 },
  });
  expect((await threadsOf(source))[1]?.messages).toHaveLength(2);
});

test("queueMessage keeps the edited text and unqueueMessage takes it back", async () => {
  const source = review("?threads=seeded");

  const queued = valueOf(await source.queueMessage(messageId(3), "Is `oldBoard` still used?"));
  expect(queued.threads[3]?.messages[0]?.posting).toEqual({
    kind: "queued",
    text: "Is `oldBoard` still used?",
  });

  const unqueued = valueOf(await source.unqueueMessage(messageId(1)));
  expect(unqueued.threads[1]?.messages[0]?.posting).toEqual({ kind: "notQueued" });
});

test("queue and unqueue refuse a pending, an unknown or a blank message and change nothing", async () => {
  const source = review("?threads=seeded");
  const before = await threadsOf(source);

  expect(await source.queueMessage(messageId(2), "x")).toEqual({
    ok: false,
    failure: { kind: "MessagePending", message: 2 },
  });
  expect(await source.unqueueMessage(messageId(2))).toEqual({
    ok: false,
    failure: { kind: "MessagePending", message: 2 },
  });
  expect(await source.unqueueMessage(messageId(40))).toEqual({
    ok: false,
    failure: { kind: "UnknownMessage", message: 40 },
  });
  expect(await source.queueMessage(messageId(0), "")).toEqual({
    ok: false,
    failure: { kind: "EmptyMessage" },
  });
  expect(await threadsOf(source)).toEqual(before);
});

test.each<[string, unknown]>([
  ["", { kind: "linedUp", mergeRequest: MERGE_REQUEST }],
  ["?gitlab=linedUp", { kind: "linedUp", mergeRequest: MERGE_REQUEST }],
  ["?gitlab=refusal", { kind: "linedUp", mergeRequest: MERGE_REQUEST }],
  ["?gitlab=stopped", { kind: "linedUp", mergeRequest: MERGE_REQUEST }],
  ["?gitlab=noGlab", { kind: "notLinedUp", why: { kind: "glabMissing" } }],
  [
    "?gitlab=loggedOut",
    {
      kind: "notLinedUp",
      why: {
        kind: "notLoggedIn",
        detail:
          "gitlab.example.com: No token found (checked config file, keyring, and environment variables).",
      },
    },
  ],
  [
    "?gitlab=noMergeRequest",
    {
      kind: "notLinedUp",
      why: { kind: "noMergeRequest", lookedAt: { kind: "branch", name: "feature" } },
    },
  ],
  [
    "?gitlab=noBranch",
    {
      kind: "notLinedUp",
      why: { kind: "noMergeRequest", lookedAt: { kind: "commit", shortId: "9c1ba3f" } },
    },
  ],
  [
    "?gitlab=moved",
    {
      kind: "notLinedUp",
      why: {
        kind: "moved",
        mergeRequest: MERGE_REQUEST,
        gitlabHead: "7d6c5b4",
        shownHead: "9c1ba3f",
      },
    },
  ],
  [
    "?gitlab=otherBase",
    {
      kind: "notLinedUp",
      why: {
        kind: "otherBase",
        mergeRequest: MERGE_REQUEST,
        gitlabBase: "3e2f1a0",
        shownBase: "531ea52",
      },
    },
  ],
  [
    "?gitlab=several",
    {
      kind: "notLinedUp",
      why: {
        kind: "several",
        lookedAt: { kind: "branch", name: "feature" },
        references: ["!12", "!14"],
      },
    },
  ],
  [
    "?gitlab=preparing",
    { kind: "notLinedUp", why: { kind: "preparing", mergeRequest: MERGE_REQUEST } },
  ],
  [
    "?gitlab=failed",
    {
      kind: "notLinedUp",
      why: {
        kind: "failed",
        message: "glab api projects/:fullpath/merge_requests: 502 Bad Gateway",
      },
    },
  ],
])("checkGitLab with '%s' answers at once", async (search, expected) => {
  const answer = vi.fn();
  void review(search).checkGitLab().then(answer);

  await vi.advanceTimersByTimeAsync(0);

  expect(answer).toHaveBeenCalledWith({ ok: true, value: expected });
});

test("?gitlab=checking answers lined up only after 3 s", async () => {
  const answer = vi.fn();
  void review("?gitlab=checking").checkGitLab().then(answer);

  await vi.advanceTimersByTimeAsync(2999);
  expect(answer).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(answer).toHaveBeenCalledWith({
    ok: true,
    value: { kind: "linedUp", mergeRequest: MERGE_REQUEST },
  });
});

test("an unknown ?gitlab script logs review.fixture_miss naming the scripts and lines up", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureReview(log, "?gitlab=nope", START);

  expect(entries).toEqual([
    {
      level: "info",
      event: "review.fixture_miss",
      fields: {
        gitlab: "nope",
        known:
          "linedUp, checking, noGlab, loggedOut, noMergeRequest, noBranch, moved, otherBase, several, preparing, failed, refusal, stopped",
      },
    },
  ]);
  expect(await settled(source.checkGitLab())).toEqual({
    ok: true,
    value: { kind: "linedUp", mergeRequest: MERGE_REQUEST },
  });
});

test.each(["", "?gitlab", "?gitlab="])("'%s' lines up without logging a miss", async (search) => {
  const { log, entries } = quietLog();

  const check = await settled(createFixtureReview(log, search, START).checkGitLab());

  expect(check).toEqual({ ok: true, value: { kind: "linedUp", mergeRequest: MERGE_REQUEST } });
  expect(entries).toEqual([]);
});

test("a send posts each waiting message after a 300 ms pause, reporting progress per message", async () => {
  const source = review("?threads=seeded");
  const seen: SendProgress[] = [];
  const reply = source.sendQueue((progress) => seen.push(progress));

  await vi.advanceTimersByTimeAsync(299);
  expect(seen).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(seen).toEqual([{ done: 1, of: 2 }]);
  await vi.advanceTimersByTimeAsync(300);
  expect(seen).toEqual([
    { done: 1, of: 2 },
    { done: 2, of: 2 },
  ]);

  const sent = valueOf(await reply);
  expect(sent).toMatchObject({ kind: "sent", sent: 2, refused: 0 });
  const posted = [
    {
      kind: "pending",
      text: "Why does the overdue check go?",
      draftNote: 102,
      mergeRequest: "!12",
      link: LINK,
    },
    {
      kind: "pending",
      text: "This needs a test.",
      draftNote: 103,
      mergeRequest: "!12",
      link: LINK,
    },
  ];
  expect(sent.kind === "notLinedUp" ? [] : postings(sent.list.threads).slice(0, 2)).toEqual(posted);
  expect(postings(await threadsOf(source)).slice(0, 2)).toEqual(posted);
});

test("?gitlab=refusal refuses the second queued message with GitLab's words", async () => {
  const source = review("?threads=seeded&gitlab=refusal");
  await source.queueMessage(messageId(3), "Third");

  const reply = valueOf(await settled(source.sendQueue(() => undefined)));

  expect(reply).toMatchObject({ kind: "sent", sent: 2, refused: 1 });
  expect(postings(await threadsOf(source))).toEqual([
    expect.objectContaining({ kind: "pending", draftNote: 102 }),
    { kind: "refused", text: "This needs a test.", reason: REFUSAL },
    expect.objectContaining({ kind: "pending", draftNote: 101 }),
    expect.objectContaining({ kind: "pending", text: "Third", draftNote: 103 }),
    { kind: "notQueued" },
  ]);
});

test("?gitlab=stopped times out after the first post and leaves the rest waiting", async () => {
  const source = review("?threads=seeded&gitlab=stopped");
  const seen: SendProgress[] = [];

  const reply = valueOf(await settled(source.sendQueue((progress) => seen.push(progress))));

  expect(reply).toMatchObject({ kind: "stopped", sent: 1, refused: 0, reason: "glab timed out" });
  expect(seen).toEqual([{ done: 1, of: 2 }]);
  expect(postings(await threadsOf(source)).slice(0, 2)).toEqual([
    expect.objectContaining({ kind: "pending" }),
    { kind: "refused", text: "This needs a test.", reason: REFUSAL },
  ]);
});

test.each(["noGlab", "moved", "preparing"])(
  "?gitlab=%s sends nothing and answers why",
  async (script) => {
    const source = review(`?threads=seeded&gitlab=${script}`);
    const before = await threadsOf(source);
    const progress = vi.fn();

    const reply = valueOf(await settled(source.sendQueue(progress)));

    const check = valueOf(await settled(source.checkGitLab()));
    expect(check.kind).toBe("notLinedUp");
    expect(reply).toEqual(check);
    expect(progress).not.toHaveBeenCalled();
    expect(await threadsOf(source)).toEqual(before);
  },
);

test("a second send while one runs answers SendRunning; after it ends another may start", async () => {
  const source = review("?threads=seeded");
  const first = source.sendQueue(() => undefined);

  expect(await source.sendQueue(() => undefined)).toEqual({
    ok: false,
    failure: { kind: "SendRunning" },
  });
  await settled(first);
  expect(valueOf(await settled(source.sendQueue(() => undefined)))).toMatchObject({
    kind: "sent",
    sent: 0,
    refused: 0,
  });
});

test("a message unqueued while the send runs is not posted, and still counts as done", async () => {
  const source = review("?threads=seeded");
  const seen: SendProgress[] = [];
  const reply = source.sendQueue((progress) => seen.push(progress));

  await source.unqueueMessage(messageId(1));
  const sent = valueOf(await settled(reply));

  expect(sent).toMatchObject({ kind: "sent", sent: 1, refused: 0 });
  expect(seen).toEqual([
    { done: 1, of: 2 },
    { done: 2, of: 2 },
  ]);
  expect(postings(await threadsOf(source))[1]).toEqual({ kind: "notQueued" });
});

test("?gitlab=stopped skips a message unqueued before its post instead of stopping on it", async () => {
  const source = review("?threads=seeded&gitlab=stopped");
  const seen: SendProgress[] = [];
  const reply = source.sendQueue((progress) => seen.push(progress));

  await source.unqueueMessage(messageId(1));
  const sent = valueOf(await settled(reply));

  expect(sent).toMatchObject({ kind: "sent", sent: 1, refused: 0 });
  expect(seen).toEqual([
    { done: 1, of: 2 },
    { done: 2, of: 2 },
  ]);
  expect(postings(await threadsOf(source)).slice(0, 2)).toEqual([
    expect.objectContaining({ kind: "pending" }),
    { kind: "notQueued" },
  ]);
});
