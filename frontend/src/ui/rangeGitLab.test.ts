import { afterEach, expect, test, vi } from "vitest";
import { nextTick, shallowRef } from "vue";

import {
  changedThreadLine,
  createFixtureRangeSource,
  log,
  onePlace,
  type GitLabCheck,
  type MergeRequestRow,
  type Message,
  type MessageId,
  type RangeSource,
  type RangeStart,
  type SendProgress,
  type SendReply,
  type SourceResult,
  type ThreadId,
} from "../ipc";
import { RECHECK_PAUSE_MS } from "./glab";
import type { Problem } from "./problem";
import { createGitLabCheck, linedUpRow, type GitLabState, type PostBody } from "./rangeGitLab";
import { createRangeThreads, type RangeThreads } from "./rangeThreads";

const TEXT: PostBody = { kind: "text", text: "Is this still used?" };
const UNSHOWN: PostBody = { kind: "none", why: "Loading the AI's answer…" };

type Edit = (fixture: RangeSource) => Partial<RangeSource>;

type Rig = {
  readonly gitlab: GitLabState;
  readonly threads: RangeThreads;
  readonly problems: Problem[];
  readonly checks: () => number;
  readonly answerChecks: () => Promise<void>;
};

const T0 = 1_767_225_600_000;
const LINED_UP: GitLabCheck = {
  kind: "linedUp",
  mergeRequest: {
    reference: "!12",
    title: "Reminders on cards",
    webUrl: "https://gitlab.example.com/team/taskboard/-/merge_requests/12",
  },
};
const NEWEST_PAGE = "https://gitlab.example/taskboard/taskboard/-/merge_requests/640";
const LINED_UP_NEWEST: GitLabCheck = {
  kind: "linedUp",
  mergeRequest: { reference: "!640", title: "Snooze a reminder", webUrl: NEWEST_PAGE },
};
const SEEDED = "?range=review&threads=seeded";
const MICROTASKS = 10;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function rig(search = SEEDED, edit: Edit = () => ({})): Promise<Rig> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  const fixture = createFixtureRangeSource(log, search);
  const opened = await fixture.openRange();
  if (!opened.ok) {
    throw new Error("the fixture did not open");
  }
  let checks = 0;
  let waiting: (() => void)[] = [];
  const source: RangeSource = {
    ...fixture,
    checkGitLab: async () => {
      checks += 1;
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
      return fixture.checkGitLab();
    },
    ...edit(fixture),
  };
  const problems: Problem[] = [];
  function report(problem: Problem): void {
    problems.push(problem);
  }
  const threads = createRangeThreads(source, report);
  await threads.load();
  const start = shallowRef<RangeStart | null>(opened.value);
  return {
    gitlab: createGitLabCheck(source, threads, report, start),
    threads,
    problems,
    checks: () => checks,
    answerChecks: async () => {
      const answering = waiting;
      waiting = [];
      for (const answer of answering) {
        answer();
      }
      await flush();
    },
  };
}

async function flush(): Promise<void> {
  for (let tick = 0; tick < MICROTASKS; tick += 1) {
    await nextTick();
  }
}

async function checked(live: Rig): Promise<void> {
  const checking = live.gitlab.checkNow();
  await live.answerChecks();
  await checking;
}

function messageAt(live: Rig, thread: number, index = 0): Message {
  const message = live.threads.list.value.threads[thread]?.messages[index];
  if (message === undefined) {
    throw new Error("no message");
  }
  return message;
}

async function sentWithTimers(live: Rig): Promise<void> {
  vi.useFakeTimers();
  const sending = live.gitlab.send();
  await vi.runAllTimersAsync();
  await sending;
}

test("checked once: the answer is kept and checking ends", async () => {
  const live = await rig();
  const checking = live.gitlab.checkNow();
  expect(live.gitlab.checking.value).toBe(true);

  await live.answerChecks();
  await checking;

  expect(live.checks()).toBe(1);
  expect(live.gitlab.checking.value).toBe(false);
  expect(live.gitlab.check.value).toEqual(LINED_UP);
});

test("focus within 30 s of the last check does not re-check; at 30 s it does", async () => {
  const live = await rig();
  live.gitlab.checkOnFocus();
  expect(live.checks()).toBe(0);

  await checked(live);
  vi.setSystemTime(T0 + RECHECK_PAUSE_MS - 1);
  live.gitlab.checkOnFocus();
  expect(live.checks()).toBe(1);

  vi.setSystemTime(T0 + RECHECK_PAUSE_MS);
  live.gitlab.checkOnFocus();
  expect(live.checks()).toBe(2);
});

test("no overlapping checks: a second check while one runs asks nothing", async () => {
  const live = await rig();
  const first = live.gitlab.checkNow();

  await live.gitlab.checkNow();
  vi.setSystemTime(T0 + RECHECK_PAUSE_MS * 2);
  live.gitlab.checkOnFocus();
  expect(live.checks()).toBe(1);

  await live.answerChecks();
  await first;
  expect(live.gitlab.checking.value).toBe(false);
});

test("Send and Post are disabled with Checking GitLab… until the first answer", async () => {
  const live = await rig();
  const note = messageAt(live, 3);
  expect(live.gitlab.sendButton.value).toEqual({
    label: "Send to GitLab (2)",
    title: "Checking GitLab…",
    disabled: true,
  });
  expect(live.gitlab.postButton(note, TEXT)).toEqual({
    label: "Post",
    title: "Checking GitLab…",
    action: null,
  });

  await checked(live);

  expect(live.gitlab.sendButton.value).toEqual({
    label: "Send to GitLab (2)",
    title: "Send the 2 queued comments to your pending review on !12",
    disabled: false,
  });
  expect(live.gitlab.postButton(note, TEXT)).toEqual({
    label: "Post",
    title: "Queue this message as its own comment on !12",
    action: "queue",
  });
});

test("the last answer stays in force during a re-check", async () => {
  const live = await rig();
  await checked(live);
  vi.setSystemTime(T0 + RECHECK_PAUSE_MS);

  live.gitlab.checkOnFocus();

  expect(live.gitlab.checking.value).toBe(true);
  expect(live.gitlab.check.value).toEqual(LINED_UP);
  expect(live.gitlab.sendButton.value.disabled).toBe(false);
});

test("a not lined-up answer disables both with its sentence; Unqueue stays enabled", async () => {
  const live = await rig(`${SEEDED}&gitlab=noMergeRequest`);
  await checked(live);
  const sentence = "no open merge request from feature";

  expect(live.gitlab.sendButton.value).toEqual({
    label: "Send to GitLab (2)",
    title: sentence,
    disabled: true,
  });
  expect(live.gitlab.postButton(messageAt(live, 3), TEXT)).toEqual({
    label: "Post",
    title: sentence,
    action: null,
  });
  expect(live.gitlab.postButton(messageAt(live, 0), UNSHOWN)).toEqual({
    label: "Unqueue",
    title: "Take this message out of the queue",
    action: "unqueue",
  });
  expect(live.gitlab.postButton(messageAt(live, 1), TEXT)).toMatchObject({
    label: "Unqueue",
    action: "unqueue",
  });
});

test("a pending message cannot be posted; a message without shown text says why", async () => {
  const live = await rig();
  await checked(live);

  expect(live.gitlab.postButton(messageAt(live, 2), TEXT)).toEqual({
    label: "Post",
    title: "Pending on GitLab",
    action: null,
  });
  expect(live.gitlab.postButton(messageAt(live, 3, 1), UNSHOWN)).toEqual({
    label: "Post",
    title: "Loading the AI's answer…",
    action: null,
  });
  expect(live.gitlab.postButton(messageAt(live, 3, 1), TEXT)).toEqual({
    label: "Post",
    title: "Queue this message as its own comment on !12",
    action: "write",
  });
});

test("Send is disabled with Nothing queued when no message waits", async () => {
  const live = await rig("?range=review");
  await checked(live);

  expect(live.gitlab.sendButton.value).toEqual({
    label: "Send to GitLab (0)",
    title: "Nothing queued",
    disabled: true,
  });
});

test("Send's notLinedUp replaces the check and records no result", async () => {
  const live = await rig(`${SEEDED}&gitlab=moved`, () => ({
    checkGitLab: async () => ({ ok: true, value: LINED_UP }),
  }));
  await live.gitlab.checkNow();
  expect(live.gitlab.check.value).toEqual(LINED_UP);

  await live.gitlab.send();

  expect(live.gitlab.check.value?.kind).toBe("notLinedUp");
  expect(live.gitlab.sendButton.value.title).toMatch(/^the merge request !12 is at 7d6c5b4/);
  expect(live.gitlab.result.value).toBeNull();
  expect(live.gitlab.sending.value).toBeNull();
});

test("the progress label counts the message being sent, one send at a time", async () => {
  const progress: ((done: SendProgress) => void)[] = [];
  const finish: ((reply: SourceResult<SendReply>) => void)[] = [];
  const live = await rig(SEEDED, () => ({
    sendQueue: (onProgress) => {
      progress.push(onProgress);
      return new Promise((resolve) => {
        finish.push(resolve);
      });
    },
  }));
  await checked(live);

  const sending = live.gitlab.send();
  expect(live.gitlab.sendButton.value).toMatchObject({ label: "Sending 1 of 2…", disabled: true });
  for (const each of progress) {
    each({ done: 1, of: 2 });
  }
  expect(live.gitlab.sendButton.value.label).toBe("Sending 2 of 2…");
  await live.gitlab.send();
  expect(progress).toHaveLength(1);
  expect(live.problems).toEqual([
    { action: "threads", step: "send", cause: { kind: "SendRunning" } },
  ]);

  vi.setSystemTime(T0 + RECHECK_PAUSE_MS);
  live.gitlab.checkOnFocus();
  expect(live.checks()).toBe(1);

  for (const each of finish) {
    each({ ok: true, value: { kind: "sent", list: { threads: [] }, sent: 2, refused: 0 } });
  }
  await sending;

  expect(live.gitlab.sending.value).toBeNull();
  expect(live.gitlab.sendButton.value.label).toBe("Send to GitLab (0)");
  expect(live.threads.list.value.threads).toEqual([]);
});

test("a progress message arriving after the reply leaves Send usable", async () => {
  const progress: ((done: SendProgress) => void)[] = [];
  const live = await rig(SEEDED, () => ({
    sendQueue: async (onProgress) => {
      progress.push(onProgress);
      return { ok: true, value: { kind: "sent", list: { threads: [] }, sent: 2, refused: 0 } };
    },
  }));
  await checked(live);

  await live.gitlab.send();
  for (const each of progress) {
    each({ done: 1, of: 2 });
  }

  expect(progress).toHaveLength(1);
  expect(live.gitlab.sending.value).toBeNull();
  expect(live.gitlab.sendButton.value.label).toBe("Send to GitLab (0)");
});

test("the result notice counts sent and refused and replaces the list", async () => {
  const live = await rig(`${SEEDED}&gitlab=refusal`);
  await checked(live);

  await sentWithTimers(live);

  expect(live.gitlab.result.value).toMatchObject({ kind: "sent", sent: 1, refused: 1 });
  expect(messageAt(live, 0).posting.kind).toBe("pending");
  expect(messageAt(live, 1).posting.kind).toBe("refused");
  expect(live.threads.queued.value).toBe(1);

  live.gitlab.dismissResult();
  expect(live.gitlab.result.value).toBeNull();
});

test("a stopped send keeps its reason in the result", async () => {
  const live = await rig(`${SEEDED}&gitlab=stopped`);
  await checked(live);

  await sentWithTimers(live);

  expect(live.gitlab.result.value).toMatchObject({
    kind: "stopped",
    sent: 1,
    refused: 0,
    reason: "glab timed out",
  });
});

test("a send that ends not lined up clears the previous send's result", async () => {
  let sends = 0;
  const live = await rig(`${SEEDED}&gitlab=refusal`, (fixture) => ({
    sendQueue: async (onProgress) => {
      sends += 1;
      if (sends === 1) {
        return fixture.sendQueue(onProgress);
      }
      return { ok: true, value: { kind: "notLinedUp", why: { kind: "glabMissing" } } };
    },
  }));
  await checked(live);
  await sentWithTimers(live);
  expect(live.gitlab.result.value?.kind).toBe("sent");

  await sentWithTimers(live);

  expect(live.gitlab.check.value).toEqual({ kind: "notLinedUp", why: { kind: "glabMissing" } });
  expect(live.gitlab.result.value).toBeNull();
});

test("a failed check and a failed send report their step and keep the last answer", async () => {
  const live = await rig(SEEDED, () => ({
    checkGitLab: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
    sendQueue: async () => ({ ok: false, failure: { kind: "SendRunning" } }),
  }));

  await live.gitlab.checkNow();
  await live.gitlab.send();

  expect(live.gitlab.check.value).toBeNull();
  expect(live.gitlab.checking.value).toBe(false);
  expect(live.gitlab.sending.value).toBeNull();
  expect(live.problems).toEqual([
    { action: "threads", step: "check", cause: { kind: "WorkerStopped" } },
    { action: "threads", step: "send", cause: { kind: "SendRunning" } },
  ]);
});

async function listedRows(): Promise<readonly MergeRequestRow[]> {
  const rows: MergeRequestRow[] = [];
  await createFixtureRangeSource(log, "?mr=list").listMergeRequests(
    (page) => {
      rows.push(...page.rows);
    },
    () => undefined,
  );
  return rows;
}

test("the_lined_up_row_is_the_loaded_row_at_the_merge_requests_page", async () => {
  const rows = await listedRows();

  expect(rows.map((row) => row.iid).slice(0, 2)).toEqual([640, 639]);
  expect(linedUpRow(LINED_UP_NEWEST, [...rows].reverse())).toBe(rows[0]);
});

test("no_loaded_row_or_no_lined_up_merge_request_gives_none", async () => {
  const rows = await listedRows();

  expect(rows.length).toBeGreaterThan(1);
  expect(linedUpRow(LINED_UP_NEWEST, [])).toBeNull();
  expect(linedUpRow(LINED_UP, rows)).toBeNull();
  expect(linedUpRow({ kind: "notLinedUp", why: { kind: "glabMissing" } }, rows)).toBeNull();
  expect(linedUpRow(null, rows)).toBeNull();
});

const QUEUE_TITLE = "Queue this comment as a draft on !12; Send to GitLab sends the queue";
const SEND_ONE_TITLE = "Send only this comment to !12 as a draft now";

function threadId(live: Rig, index: number): ThreadId {
  const thread = live.threads.list.value.threads[index];
  if (thread === undefined) {
    throw new Error("no thread");
  }
  return thread.id;
}

function lastOf(live: Rig, index: number): Message {
  const message = live.threads.list.value.threads[index]?.messages.at(-1);
  if (message === undefined) {
    throw new Error("no message");
  }
  return message;
}

async function withTimers(run: () => Promise<void>): Promise<void> {
  vi.useFakeTimers();
  const running = run();
  await vi.runAllTimersAsync();
  await running;
}

function sendsTo(sent: MessageId[]): Edit {
  return (fixture) => ({
    sendMessage: (message, onProgress) => {
      sent.push(message);
      return fixture.sendMessage(message, onProgress);
    },
  });
}

test("Queue and Send are off with Checking GitLab… until the first answer, then off only for a blank text", async () => {
  const live = await rig();

  expect(live.gitlab.queueButton("Why?", false)).toEqual({
    label: "Queue",
    title: "Checking GitLab…",
    disabled: true,
  });
  expect(live.gitlab.queueButton("Why?", true)).toEqual({
    label: "Send",
    title: "Checking GitLab…",
    disabled: true,
  });
  await checked(live);

  expect(live.gitlab.queueButton("Why?", false)).toEqual({
    label: "Queue",
    title: QUEUE_TITLE,
    disabled: false,
  });
  expect(live.gitlab.queueButton(" \n", false)).toEqual({
    label: "Queue",
    title: QUEUE_TITLE,
    disabled: true,
  });
  expect(live.gitlab.queueButton("Why?", true)).toEqual({
    label: "Send",
    title: SEND_ONE_TITLE,
    disabled: false,
  });
  expect(live.gitlab.queueButton("", true).disabled).toBe(true);
});

test("a not lined-up answer turns Queue and Send off with its sentence", async () => {
  const live = await rig(`${SEEDED}&gitlab=noMergeRequest`);
  await checked(live);
  const sentence = "no open merge request from feature";

  expect(live.gitlab.queueButton("Why?", false)).toEqual({
    label: "Queue",
    title: sentence,
    disabled: true,
  });
  expect(live.gitlab.queueButton("Why?", true)).toEqual({
    label: "Send",
    title: sentence,
    disabled: true,
  });
});

test("while a send runs Send is off and says so; Queue stays on", async () => {
  const live = await rig(SEEDED, () => ({ sendQueue: () => new Promise(() => undefined) }));
  await checked(live);

  void live.gitlab.send();

  expect(live.gitlab.queueButton("Why?", true)).toEqual({
    label: "Send",
    title: "A send to GitLab is running; Send is off until it ends",
    disabled: true,
  });
  expect(live.gitlab.queueButton("Why?", false)).toEqual({
    label: "Queue",
    title: QUEUE_TITLE,
    disabled: false,
  });
});

test("Queue on a reply adds the note and queues it in one press; nothing is sent", async () => {
  const sent: MessageId[] = [];
  const live = await rig(SEEDED, sendsTo(sent));
  await checked(live);
  const thread = threadId(live, 3);
  live.threads.writeNote(thread, "Needs a test");

  await live.gitlab.queueTyped({ kind: "thread", thread }, "Needs a test", false);

  expect(lastOf(live, 3)).toMatchObject({
    body: { kind: "note", text: "Needs a test" },
    posting: { kind: "queued", text: "Needs a test" },
  });
  expect(live.threads.noteText(thread)).toBe("");
  expect(live.threads.queued.value).toBe(3);
  expect(live.gitlab.sendButton.value.label).toBe("Send to GitLab (3)");
  expect(sent).toEqual([]);
  expect(live.gitlab.result.value).toBeNull();
});

test("Queue on a new thread adds the thread and queues its first message", async () => {
  const live = await rig();
  await checked(live);
  const file = live.threads.list.value.threads[0]?.file;
  if (file === undefined) {
    throw new Error("no file");
  }
  const before = live.threads.list.value.threads.length;
  live.threads.startThread(file, onePlace(changedThreadLine("left", 1)));

  await live.gitlab.queueTyped({ kind: "draft", key: "draft-0" }, "Why 300?", false);

  expect(live.threads.list.value.threads).toHaveLength(before + 1);
  expect(lastOf(live, before)).toMatchObject({
    body: { kind: "note", text: "Why 300?" },
    posting: { kind: "queued", text: "Why 300?" },
  });
  expect(live.threads.drafts.value.has("draft-0")).toBe(false);
});

test("Send adds, queues and sends only that message; the other queued ones stay queued", async () => {
  const sent: MessageId[] = [];
  const live = await rig(SEEDED, sendsTo(sent));
  await checked(live);

  await withTimers(() =>
    live.gitlab.queueTyped({ kind: "thread", thread: threadId(live, 3) }, "Ship it", true),
  );

  const added = lastOf(live, 3);
  expect(sent).toEqual([added.id]);
  expect(added.posting).toMatchObject({ kind: "pending", text: "Ship it", mergeRequest: "!12" });
  expect(messageAt(live, 0).posting.kind).toBe("queued");
  expect(messageAt(live, 1).posting.kind).toBe("refused");
  expect(live.gitlab.result.value).toMatchObject({ kind: "sent", sent: 1, refused: 0 });
  expect(live.gitlab.sending.value).toBeNull();
});

test("Send shows its progress on Send to GitLab and a notLinedUp reply replaces the check", async () => {
  const finish: ((reply: SourceResult<SendReply>) => void)[] = [];
  const live = await rig(SEEDED, () => ({
    sendMessage: () =>
      new Promise((resolve) => {
        finish.push(resolve);
      }),
  }));
  await checked(live);

  const sending = live.gitlab.queueTyped({ kind: "thread", thread: threadId(live, 3) }, "x", true);
  await flush();
  expect(live.gitlab.sendButton.value).toMatchObject({ label: "Sending 1 of 1…", disabled: true });
  for (const each of finish) {
    each({ ok: true, value: { kind: "notLinedUp", why: { kind: "glabMissing" } } });
  }
  await sending;

  expect(finish).toHaveLength(1);
  expect(live.gitlab.check.value).toEqual({ kind: "notLinedUp", why: { kind: "glabMissing" } });
  expect(live.gitlab.result.value).toBeNull();
  expect(lastOf(live, 3).posting).toEqual({ kind: "queued", text: "x" });
});

test("a failed queue after the add keeps the note, reports the queue step and sends nothing", async () => {
  const sent: MessageId[] = [];
  const live = await rig(SEEDED, (fixture) => ({
    ...sendsTo(sent)(fixture),
    queueMessage: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
  }));
  await checked(live);

  await live.gitlab.queueTyped({ kind: "thread", thread: threadId(live, 3) }, "Kept", true);

  expect(lastOf(live, 3)).toMatchObject({
    body: { kind: "note", text: "Kept" },
    posting: { kind: "notQueued" },
  });
  expect(live.problems).toEqual([
    { action: "threads", step: "queue", cause: { kind: "WorkerStopped" } },
  ]);
  expect(sent).toEqual([]);
});

test("a failed send after the queue keeps the message queued and reports the send step", async () => {
  const live = await rig(SEEDED, () => ({
    sendMessage: async () => ({ ok: false, failure: { kind: "SendRunning" } }),
  }));
  await checked(live);

  await live.gitlab.queueTyped({ kind: "thread", thread: threadId(live, 3) }, "Kept", true);

  expect(lastOf(live, 3).posting).toEqual({ kind: "queued", text: "Kept" });
  expect(live.problems).toEqual([
    { action: "threads", step: "send", cause: { kind: "SendRunning" } },
  ]);
  expect(live.gitlab.sending.value).toBeNull();
});

test("Send to GitLab starting between the queue and Send's one-message send reports SendRunning; the message stays queued", async () => {
  const sent: MessageId[] = [];
  const afterQueue: (() => void)[] = [];
  const live = await rig(SEEDED, (fixture) => ({
    ...sendsTo(sent)(fixture),
    sendQueue: () => new Promise(() => undefined),
    queueMessage: async (message, text) => {
      const queued = await fixture.queueMessage(message, text);
      for (const each of afterQueue) {
        each();
      }
      return queued;
    },
  }));
  await checked(live);
  afterQueue.push(() => {
    void live.gitlab.send();
  });

  await live.gitlab.queueTyped({ kind: "thread", thread: threadId(live, 3) }, "Raced", true);

  expect(lastOf(live, 3).posting).toEqual({ kind: "queued", text: "Raced" });
  expect(sent).toEqual([]);
  expect(live.problems).toEqual([
    { action: "threads", step: "send", cause: { kind: "SendRunning" } },
  ]);
});

test("a failed add stops the chain and keeps the typed text", async () => {
  const live = await rig(SEEDED, () => ({
    addNote: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
  }));
  await checked(live);
  const thread = threadId(live, 3);
  const before = live.threads.list.value;

  await live.gitlab.queueTyped({ kind: "thread", thread }, "Kept", false);

  expect(live.threads.list.value).toBe(before);
  expect(live.threads.noteText(thread)).toBe("Kept");
  expect(live.problems).toEqual([
    { action: "threads", step: "note", cause: { kind: "WorkerStopped" } },
  ]);
});

test("Queue and Post's Queue do nothing while not lined up or blank, and Send nothing while a send runs", async () => {
  const sent: MessageId[] = [];
  const live = await rig(`${SEEDED}&gitlab=noMergeRequest`, sendsTo(sent));
  await checked(live);
  const before = live.threads.list.value;

  await live.gitlab.queueTyped({ kind: "thread", thread: threadId(live, 3) }, "No", false);
  await live.gitlab.queuePost(messageAt(live, 3, 1).id, "No", false);

  expect(live.threads.list.value).toBe(before);

  const lined = await rig(SEEDED, (fixture) => ({
    ...sendsTo(sent)(fixture),
    sendQueue: () => new Promise(() => undefined),
  }));
  await checked(lined);
  const listed = lined.threads.list.value;
  await lined.gitlab.queueTyped({ kind: "thread", thread: threadId(lined, 3) }, " ", false);
  void lined.gitlab.send();
  await lined.gitlab.queueTyped({ kind: "thread", thread: threadId(lined, 3) }, "Now", true);

  expect(lined.threads.list.value).toBe(listed);
  expect(sent).toEqual([]);
});

test("Post's Queue on an AI answer queues it; with Shift it sends only that message", async () => {
  const sent: MessageId[] = [];
  const live = await rig(SEEDED, sendsTo(sent));
  await checked(live);
  const answer = messageAt(live, 3, 1).id;
  live.threads.writePost(answer, "The answer");

  await live.gitlab.queuePost(answer, "The answer", false);

  expect(messageAt(live, 3, 1).posting).toEqual({ kind: "queued", text: "The answer" });
  expect(live.threads.postDraft(answer)).toBeNull();
  expect(sent).toEqual([]);

  await withTimers(() => live.gitlab.queuePost(answer, "The answer, edited", true));

  expect(sent).toEqual([answer]);
  expect(messageAt(live, 3, 1).posting).toMatchObject({
    kind: "pending",
    text: "The answer, edited",
  });
  expect(messageAt(live, 0).posting.kind).toBe("queued");
});
