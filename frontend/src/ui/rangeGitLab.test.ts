import { afterEach, expect, test, vi } from "vitest";
import { nextTick, shallowRef } from "vue";

import {
  createFixtureRangeSource,
  log,
  type GitLabCheck,
  type Message,
  type RangeSource,
  type RangeStart,
  type SendProgress,
  type SendReply,
  type SourceResult,
} from "../ipc";
import type { Problem } from "./problem";
import {
  createGitLabCheck,
  RECHECK_PAUSE_MS,
  type GitLabState,
  type PostBody,
} from "./rangeGitLab";
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
    action: "write",
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
