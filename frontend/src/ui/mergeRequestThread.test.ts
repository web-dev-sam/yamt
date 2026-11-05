import { afterEach, expect, test, vi } from "vitest";
import { watch } from "vue";

import {
  createFixtureCompareSource,
  isDiscussionId,
  isMergeRequestIid,
  log,
  type Description,
  type DiscussionId,
  type DiscussionThread,
  type DiscussionThreadReply,
  type DiscussionWriteReply,
  type MarkdownPreviewReply,
  type MergeRequestIid,
  type MergeRequestSource,
  type OpenDiscussion,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import type { Preview } from "./mergeRequestPreview";
import {
  createThreads,
  isWritable,
  type Sending,
  type ShownThread,
  type Thread,
  type ThreadLoad,
  type Threads,
  type WriteFailure,
  type WriteKind,
} from "./mergeRequestThread";

type Ask<T> = {
  readonly args: readonly unknown[];
  readonly answer: (result: SourceResult<T>) => void;
  readonly fail: (error: unknown) => void;
};

type Rig = {
  readonly threads: Threads & { readonly refreshed: (iid: MergeRequestIid | null) => void };
  readonly reads: Ask<DiscussionThreadReply>[];
  readonly writes: Ask<DiscussionWriteReply>[];
  readonly previews: Ask<MarkdownPreviewReply>[];
  readonly boxReads: [MergeRequestIid, DiscussionId, boolean][];
  readonly reloads: MergeRequestIid[];
};

const MICROTASKS = 10;
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const LOADING: ThreadLoad = { kind: "loading" };
const WRITING: Preview = { kind: "writing" };
const IDLE: Sending = { kind: "idle" };
const SECRET = "the secret words of the reply";
const ASKED = `${SECRET} @anna`;
const PLAIN = "Looks **good**, see `code`.\n\n- one\n- two";
const RENDERED: Description = {
  blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: SECRET }] }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function discussionId(serial: string): DiscussionId {
  const id = serial.padStart(40, "0");
  if (!isDiscussionId(id)) {
    throw new Error(`${id} is not a discussion id`);
  }
  return id;
}

const MR = iid(637);
const D1 = discussionId("1");
const D2 = discussionId("2");
const SHOWN: ShownThread = { iid: MR, discussion: D1 };

function discussionOf(id: DiscussionId, text = "Rename this"): OpenDiscussion {
  return {
    id,
    place: { kind: "overview" },
    earlier: [],
    last: { author: null, createdAt: 0, text, page: null, mentions: [] },
  };
}

function threadOf(id: DiscussionId, changes: Partial<DiscussionThread> = {}): DiscussionThread {
  return {
    discussion: discussionOf(id),
    resolved: false,
    comments: [],
    drafts: [],
    pending: 0,
    commenting: "allowed",
    mayResolve: true,
    ...changes,
  };
}

function asked<T>(list: Ask<T>[], ...args: readonly unknown[]): Promise<SourceResult<T>> {
  return new Promise((resolve, reject) => {
    list.push({ args, answer: resolve, fail: reject });
  });
}

function rig(): Rig {
  const reads: Ask<DiscussionThreadReply>[] = [];
  const writes: Ask<DiscussionWriteReply>[] = [];
  const previews: Ask<MarkdownPreviewReply>[] = [];
  const boxReads: [MergeRequestIid, DiscussionId, boolean][] = [];
  const reloads: MergeRequestIid[] = [];
  const source: MergeRequestSource = {
    ...createFixtureCompareSource(log, "", {}),
    readDiscussionThread: (...args) => asked(reads, ...args),
    replyToDiscussion: (...args) => asked(writes, "reply", ...args),
    resolveDiscussion: (...args) => asked(writes, "resolve", ...args),
    submitReview: (...args) => asked(writes, "submit", ...args),
    previewMarkdown: (...args) => asked(previews, ...args),
  };
  const threads = createThreads({
    source,
    discussions: {
      threadRead: (row, discussion, resolved) => {
        boxReads.push([row, discussion.id, resolved]);
      },
      reloadDiscussions: (row) => {
        reloads.push(row);
      },
    },
  });
  return { threads, reads, writes, previews, boxReads, reloads };
}

async function settled(): Promise<void> {
  for (let turn = 0; turn < MICROTASKS; turn += 1) {
    await Promise.resolve();
  }
}

function at<T>(list: readonly Ask<T>[], index: number): Ask<T> {
  const ask = list[index];
  if (ask === undefined) {
    throw new Error(`no ask ${index}; ${list.length} made`);
  }
  return ask;
}

function shownOf(live: Rig): Thread | null {
  return live.threads.thread.value;
}

function loadOf(live: Rig): ThreadLoad | undefined {
  return shownOf(live)?.load;
}

function textOf(live: Rig, id: DiscussionId): string | undefined {
  return live.threads.replyTexts.value.get(id);
}

function recordAt(live: Rig, id: DiscussionId): Thread | undefined {
  return live.threads.threads.value.get(id);
}

function writableAt(live: Rig, id: DiscussionId): boolean {
  const record = recordAt(live, id);
  return record !== undefined && isWritable(record, live.threads.writing.value);
}

async function readAt(live: Rig, index: number, thread: DiscussionThread): Promise<void> {
  at(live.reads, index).answer({ ok: true, value: { kind: "read", thread } });
  await settled();
}

async function writeAt(live: Rig, index: number, reply: DiscussionWriteReply): Promise<void> {
  at(live.writes, index).answer({ ok: true, value: reply });
  await settled();
}

async function shownAndRead(live: Rig, id: DiscussionId = D1): Promise<void> {
  live.threads.showThread(MR, id);
  await readAt(live, live.reads.length - 1, threadOf(id));
}

function read(thread: DiscussionThread, refreshing = false): ThreadLoad {
  return { kind: "read", thread, refreshing };
}

function failed(what: WriteKind, failure: WriteFailure): Sending {
  return { kind: "failed", what, failure };
}

test("each_open_reads_the_thread_afresh", async () => {
  const live = rig();
  live.threads.showThread(MR, D1);
  expect(shownOf(live)).toEqual({
    shown: SHOWN,
    load: LOADING,
    sending: { kind: "idle" },
    preview: WRITING,
  });
  expect(at(live.reads, 0).args).toEqual([MR, D1]);

  live.threads.showThread(MR, D1);
  expect(live.reads).toHaveLength(1);
  await readAt(live, 0, threadOf(D1));
  expect(loadOf(live)).toEqual(read(threadOf(D1)));
  expect(live.boxReads).toEqual([[MR, D1, false]]);

  live.threads.closeThread();
  expect(shownOf(live)).toBeNull();
  live.threads.showThread(MR, D1);
  expect(loadOf(live)).toEqual(LOADING);
  expect(live.reads).toHaveLength(2);
  live.threads.showThread(iid(636), D1);
  expect(at(live.reads, 2).args).toEqual([636, D1]);
});

test("a_failed_read_retries", async () => {
  const live = rig();
  live.threads.retryThread(D1);
  expect(live.reads).toEqual([]);

  live.threads.showThread(MR, D1);
  at(live.reads, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(loadOf(live)).toEqual({ kind: "failed", cause: STOPPED });

  live.threads.retryThread(D1);
  expect(loadOf(live)).toEqual(LOADING);
  at(live.reads, 1).answer({ ok: true, value: { kind: "notFound" } });
  await settled();
  expect(loadOf(live)).toEqual({ kind: "refused", reply: { kind: "notFound" } });
  expect(live.boxReads).toEqual([]);

  live.threads.retryThread(D1);
  at(live.reads, 2).fail(new Error("unreadable answer"));
  await settled();
  expect(loadOf(live)).toEqual({
    kind: "failed",
    cause: { kind: "Unexpected", message: "unreadable answer" },
  });
  live.threads.retryThread(D1);
  await readAt(live, 3, threadOf(D1));
  expect(loadOf(live)).toEqual(read(threadOf(D1)));
});

test("an_answer_for_a_thread_no_longer_shown_changes_only_the_box", async () => {
  const live = rig();
  live.threads.showThread(MR, D1);
  live.threads.showThread(MR, D2);
  await readAt(live, 0, threadOf(D1));
  expect(shownOf(live)?.shown.discussion).toBe(D2);
  expect(loadOf(live)).toEqual(LOADING);
  expect(live.boxReads).toEqual([[MR, D1, false]]);

  live.threads.closeThread();
  live.threads.showThread(MR, D2);
  await readAt(live, 1, threadOf(D2, { resolved: true }));
  expect(loadOf(live)).toEqual(LOADING);
  expect(live.boxReads).toEqual([
    [MR, D1, false],
    [MR, D2, true],
  ]);

  live.threads.closeThread();
  await readAt(live, 2, threadOf(D2));
  expect(shownOf(live)).toBeNull();
  expect(live.boxReads).toHaveLength(3);
});

test("texts_are_kept_per_discussion_until_sent", async () => {
  const live = rig();
  live.threads.setReplyText(D1, "first");
  live.threads.setReplyText(D2, SECRET);
  await shownAndRead(live, D2);
  live.threads.closeThread();
  await shownAndRead(live, D1);
  expect(textOf(live, D1)).toBe("first");
  expect(textOf(live, D2)).toBe(SECRET);

  void live.threads.sendReply(D1, "comment");
  expect(at(live.writes, 0).args).toEqual(["reply", MR, D1, "comment", "first"]);
  await writeAt(live, 0, { kind: "sent" });
  expect(live.threads.replyTexts.value.has(D1)).toBe(false);
  expect(textOf(live, D2)).toBe(SECRET);

  await readAt(live, 2, threadOf(D1));
  live.threads.setReplyText(D1, "second");
  void live.threads.sendReply(D1, "draft");
  live.threads.setReplyText(D1, "second, longer");
  await writeAt(live, 1, { kind: "sent" });
  expect(at(live.writes, 1).args).toEqual(["reply", MR, D1, "draft", "second"]);
  expect(textOf(live, D1)).toBe("second, longer");
  live.threads.setReplyText(D2, "");
  expect([...live.threads.replyTexts.value.keys()]).toEqual([D1]);
});

test("two_expanded_threads_read_and_write_apart", async () => {
  const live = rig();
  live.threads.expandThread(MR, D1);
  live.threads.expandThread(MR, D2);
  expect(live.reads.map((ask) => ask.args)).toEqual([
    [MR, D1],
    [MR, D2],
  ]);
  expect([...live.threads.expanded.value]).toEqual([D1, D2]);
  await readAt(live, 1, threadOf(D2, { pending: 2 }));
  await readAt(live, 0, threadOf(D1));
  expect(recordAt(live, D1)?.load).toEqual(read(threadOf(D1)));
  expect(recordAt(live, D2)?.load).toEqual(read(threadOf(D2, { pending: 2 })));
  expect(shownOf(live)).toBeNull();

  live.threads.setReplyText(D1, "first");
  live.threads.setReplyText(D2, "second");
  void live.threads.sendReply(D2, "comment");
  expect(at(live.writes, 0).args).toEqual(["reply", MR, D2, "comment", "second"]);
  expect(recordAt(live, D2)?.sending).toEqual({ kind: "sending", what: "comment" });
  expect(recordAt(live, D1)?.sending).toEqual(IDLE);
  await writeAt(live, 0, { kind: "sent" });
  expect(live.reads.map((ask) => ask.args)).toEqual([
    [MR, D1],
    [MR, D2],
    [MR, D2],
  ]);
  expect(recordAt(live, D2)?.load).toEqual(read(threadOf(D2, { pending: 2 }), true));
  expect(recordAt(live, D1)?.load).toEqual(read(threadOf(D1)));
  expect(textOf(live, D1)).toBe("first");
  expect(textOf(live, D2)).toBeUndefined();
});

test("one_write_at_a_time_across_threads", async () => {
  const live = rig();
  live.threads.expandThread(MR, D1);
  live.threads.expandThread(MR, D2);
  await readAt(live, 0, threadOf(D1));
  await readAt(live, 1, threadOf(D2));
  live.threads.setReplyText(D1, "first");
  live.threads.setReplyText(D2, "second");
  expect(live.threads.writing.value).toBeNull();

  void live.threads.sendReply(D1, "comment");
  expect(live.threads.writing.value).toBe("comment");
  await live.threads.sendReply(D2, "comment");
  await live.threads.setResolved(D2, true);
  await live.threads.submitReview(D2);
  expect(live.writes).toHaveLength(1);
  expect(recordAt(live, D2)?.sending).toEqual(IDLE);
  for (const id of [D1, D2]) {
    expect(writableAt(live, id)).toBe(false);
  }

  await writeAt(live, 0, { kind: "sent" });
  expect(live.threads.writing.value).toBeNull();
  expect(writableAt(live, D1)).toBe(false);
  expect(writableAt(live, D2)).toBe(true);
  void live.threads.sendReply(D2, "draft");
  expect(at(live.writes, 1).args).toEqual(["reply", MR, D2, "draft", "second"]);
});

test("a_collapsed_threads_late_answer_is_dropped", async () => {
  const live = rig();
  live.threads.collapseThread(D1);
  live.threads.expandThread(MR, D1);
  live.threads.collapseThread(D1);
  expect(live.threads.threads.value.size).toBe(0);
  expect(live.threads.expanded.value.size).toBe(0);

  await readAt(live, 0, threadOf(D1, { resolved: true }));
  expect(live.threads.threads.value.size).toBe(0);
  expect(live.boxReads).toEqual([[MR, D1, true]]);
});

test("re_expanding_reads_afresh", async () => {
  const live = rig();
  live.threads.expandThread(MR, D1);
  await readAt(live, 0, threadOf(D1));
  live.threads.collapseThread(D1);
  live.threads.expandThread(MR, D1);
  const expanded = live.threads.expanded.value;
  live.threads.expandThread(MR, D1);
  expect(live.threads.expanded.value).toBe(expanded);

  expect(recordAt(live, D1)?.load).toEqual(LOADING);
  expect(live.reads).toHaveLength(2);
  await readAt(live, 1, threadOf(D1, { pending: 1 }));
  expect(recordAt(live, D1)?.load).toEqual(read(threadOf(D1, { pending: 1 })));
});

test("an_expansion_leaves_the_panel_alone", async () => {
  const live = rig();
  await shownAndRead(live, D1);
  const panel = shownOf(live);
  live.threads.expandThread(MR, D2);
  expect(shownOf(live)).toBe(panel);
  await readAt(live, 1, threadOf(D2));
  live.threads.setReplyText(D2, "elsewhere");
  live.threads.collapseThread(D2);

  expect(shownOf(live)).toBe(panel);
  expect([...live.threads.threads.value.keys()]).toEqual([D1]);
});

test("the_panel_and_an_entry_share_one_thread", async () => {
  const live = rig();
  await shownAndRead(live, D1);
  const shared = shownOf(live);
  live.threads.expandThread(MR, D1);
  expect(live.reads).toHaveLength(1);
  expect(recordAt(live, D1)).toBe(shared);

  live.threads.closeThread();
  expect(shownOf(live)).toBeNull();
  expect(recordAt(live, D1)).toBe(shared);
  live.threads.showThread(MR, D1);
  expect(live.reads).toHaveLength(1);
  expect(shownOf(live)).toBe(shared);
  live.threads.collapseThread(D1);
  expect(shownOf(live)).toBe(shared);
  live.threads.expandThread(MR, D1);
  live.threads.showThread(MR, D2);
  expect(recordAt(live, D1)).toBe(shared);

  live.threads.collapseThread(D1);
  expect(recordAt(live, D1)).toBeUndefined();
  expect([...live.threads.threads.value.keys()]).toEqual([D2]);
});

test("the_text_outlives_a_collapse", async () => {
  const live = rig();
  live.threads.expandThread(MR, D1);
  await readAt(live, 0, threadOf(D1));
  live.threads.setReplyText(D1, "half a reply");
  live.threads.collapseThread(D1);
  expect(textOf(live, D1)).toBe("half a reply");

  live.threads.expandThread(MR, D1);
  await readAt(live, 1, threadOf(D1));
  expect(textOf(live, D1)).toBe("half a reply");
});

test("refreshed_rereads_every_shown_thread_of_the_row", async () => {
  const live = rig();
  const other = iid(636);
  const d3 = discussionId("3");
  await shownAndRead(live, D1);
  live.threads.expandThread(MR, D2);
  live.threads.expandThread(other, d3);
  await readAt(live, 1, threadOf(D2));
  await readAt(live, 2, threadOf(d3));

  live.threads.refreshed(MR);
  expect(live.reads.slice(3).map((ask) => ask.args)).toEqual([
    [MR, D1],
    [MR, D2],
  ]);
  expect(recordAt(live, D2)?.load).toEqual(read(threadOf(D2), true));
  expect(recordAt(live, d3)?.load).toEqual(read(threadOf(d3)));
  await readAt(live, 4, threadOf(D2, { pending: 3 }));
  expect(recordAt(live, D2)?.load).toEqual(read(threadOf(D2, { pending: 3 })));
  expect(loadOf(live)).toEqual(read(threadOf(D1), true));

  live.threads.refreshed(null);
  expect(live.reads).toHaveLength(8);
  expect(recordAt(live, d3)?.load).toEqual(read(threadOf(d3), true));
});

test("a_failed_write_answered_after_a_switch_leaves_the_shown_thread_idle", async () => {
  const live = rig();
  await shownAndRead(live, D1);
  void live.threads.setResolved(D1, true);
  live.threads.showThread(MR, D2);
  await readAt(live, 1, threadOf(D2));
  await writeAt(live, 0, { kind: "failed", message: "glab timed out" });

  expect(shownOf(live)).toMatchObject({
    shown: { iid: MR, discussion: D2 },
    load: read(threadOf(D2)),
    sending: { kind: "idle" },
  });
  expect(at(live.reads, 2).args).toEqual([MR, D1]);
  live.threads.setReplyText(D2, "other");
  const drafting = live.threads.sendReply(D2, "draft");
  expect(at(live.writes, 1).args).toEqual(["reply", MR, D2, "draft", "other"]);

  live.threads.closeThread();
  await writeAt(live, 1, { kind: "failed", message: "glab timed out" });
  await drafting;
  expect(shownOf(live)).toBeNull();
});

test("a_second_send_while_one_runs_sends_nothing", async () => {
  const live = rig();
  await live.threads.sendReply(D1, "comment");
  await live.threads.setResolved(D1, true);
  await live.threads.submitReview(D1);
  live.threads.showThread(MR, D1);
  live.threads.setReplyText(D1, "first");
  await live.threads.sendReply(D1, "comment");
  expect(live.writes).toEqual([]);

  await readAt(live, 0, threadOf(D1));
  live.threads.showThread(MR, D2);
  await readAt(live, 1, threadOf(D2));
  await live.threads.sendReply(D2, "comment");
  expect(live.writes).toEqual([]);
  live.threads.showThread(MR, D1);
  await readAt(live, 2, threadOf(D1));
  live.threads.setReplyText(D1, "  \n ");
  await live.threads.sendReply(D1, "comment");
  expect(live.writes).toEqual([]);

  live.threads.setReplyText(D1, "first");
  void live.threads.sendReply(D1, "comment");
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });
  void live.threads.sendReply(D1, "comment");
  void live.threads.setResolved(D1, true);
  void live.threads.submitReview(D1);
  live.threads.showThread(MR, D2);
  await readAt(live, 3, threadOf(D2));
  live.threads.setReplyText(D2, "other");
  void live.threads.sendReply(D2, "draft");
  expect(live.writes).toHaveLength(1);

  await writeAt(live, 0, { kind: "sent" });
  void live.threads.sendReply(D2, "draft");
  expect(live.writes).toHaveLength(2);
});

test("a_refused_send_keeps_the_text_and_reads_nothing", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "first");
  void live.threads.sendReply(D1, "comment");
  await writeAt(live, 0, { kind: "refused", reason: "403 Forbidden" });

  expect(shownOf(live)?.sending).toEqual(
    failed("comment", { kind: "refused", reason: "403 Forbidden" }),
  );
  expect(textOf(live, D1)).toBe("first");
  expect(live.reads).toHaveLength(1);
  expect(loadOf(live)).toEqual(read(threadOf(D1)));

  void live.threads.sendReply(D1, "comment");
  expect(live.writes).toHaveLength(2);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });
});

test("a_failed_send_reads_the_thread_again_before_another_send", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "first");
  void live.threads.sendReply(D1, "comment");
  await writeAt(live, 0, { kind: "failed", message: "glab timed out" });

  expect(shownOf(live)?.sending).toEqual(
    failed("comment", { kind: "failed", message: "glab timed out" }),
  );
  expect(textOf(live, D1)).toBe("first");
  expect(loadOf(live)).toEqual(read(threadOf(D1), true));
  expect(live.reads).toHaveLength(2);
  await live.threads.sendReply(D1, "comment");
  expect(live.writes).toHaveLength(1);

  await readAt(live, 1, threadOf(D1, { pending: 1 }));
  expect(loadOf(live)).toEqual(read(threadOf(D1, { pending: 1 })));
  void live.threads.sendReply(D1, "comment");
  at(live.writes, 1).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(shownOf(live)?.sending).toEqual(failed("comment", { kind: "ipc", cause: STOPPED }));
  expect(live.reads).toHaveLength(3);
  await readAt(live, 2, threadOf(D1));
  void live.threads.sendReply(D1, "comment");
  await writeAt(live, 2, { kind: "notLoggedIn", detail: "gitlab.example: no token" });
  expect(live.reads).toHaveLength(4);
});

test("submit_publishes_then_reloads_the_thread_and_the_row", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "unsent");
  void live.threads.submitReview(D1);
  expect(at(live.writes, 0).args).toEqual(["submit", MR]);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "submit" });
  expect(live.reloads).toEqual([]);

  await writeAt(live, 0, { kind: "sent" });
  expect(live.reloads).toEqual([MR]);
  expect(shownOf(live)?.sending).toEqual({ kind: "idle" });
  expect(loadOf(live)).toEqual(read(threadOf(D1), true));
  expect(textOf(live, D1)).toBe("unsent");
  await readAt(live, 1, threadOf(D1, { pending: 0 }));
  expect(loadOf(live)).toEqual(read(threadOf(D1)));
});

test("a_failed_submit_keeps_the_drafts_pending", async () => {
  const live = rig();
  live.threads.showThread(MR, D1);
  const drafted = threadOf(D1, { drafts: [{ text: "a draft" }], pending: 3 });
  await readAt(live, 0, drafted);
  void live.threads.submitReview(D1);
  await writeAt(live, 0, { kind: "glabMissing" });

  expect(shownOf(live)?.sending).toEqual(failed("submit", { kind: "glabMissing" }));
  expect(live.reloads).toEqual([]);
  expect(loadOf(live)).toEqual(read(drafted, true));
  await readAt(live, 1, drafted);
  expect(loadOf(live)).toEqual(read(drafted));

  void live.threads.submitReview(D1);
  await writeAt(live, 1, { kind: "refused", reason: "404 Not Found" });
  expect(live.reloads).toEqual([]);
  expect(live.reads).toHaveLength(2);
});

test("resolve_sends_no_text_and_rereads", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "kept");
  void live.threads.setResolved(D1, true);
  expect(at(live.writes, 0).args).toEqual(["resolve", MR, D1, true]);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "resolve" });
  await writeAt(live, 0, { kind: "sent" });
  expect(textOf(live, D1)).toBe("kept");
  expect(live.reloads).toEqual([]);
  await readAt(live, 1, threadOf(D1, { resolved: true }));
  expect(live.boxReads.at(-1)).toEqual([MR, D1, true]);

  void live.threads.setResolved(D1, false);
  expect(at(live.writes, 1).args).toEqual(["resolve", MR, D1, false]);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "unresolve" });
});

test("a_blank_preview_is_empty_without_a_call", async () => {
  const live = rig();
  live.threads.showPreview(D1);
  live.threads.showWrite(D1);
  expect(shownOf(live)).toBeNull();

  await shownAndRead(live);
  live.threads.showPreview(D1);
  expect(shownOf(live)?.preview).toEqual({ kind: "empty" });
  live.threads.setReplyText(D1, " \n\t");
  live.threads.showPreview(D1);
  expect(shownOf(live)?.preview).toEqual({ kind: "empty" });
  expect(live.previews).toEqual([]);
  live.threads.showWrite(D1);
  expect(shownOf(live)?.preview).toEqual(WRITING);
});

test("a_preview_shows_gitlabs_rendering_of_the_text", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, ASKED);
  live.threads.showPreview(D1);
  expect(shownOf(live)?.preview).toEqual({ kind: "loading" });
  expect(at(live.previews, 0).args).toEqual([MR, ASKED]);
  at(live.previews, 0).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();
  expect(shownOf(live)?.preview).toEqual({ kind: "read", preview: RENDERED });

  live.threads.showPreview(D1);
  at(live.previews, 1).answer({ ok: true, value: { kind: "glabMissing" } });
  await settled();
  expect(shownOf(live)?.preview).toEqual({ kind: "refused", reply: { kind: "glabMissing" } });
});

test("a_preview_failure_keeps_the_text", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, ASKED);
  live.threads.showPreview(D1);
  at(live.previews, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(shownOf(live)?.preview).toEqual({ kind: "failed", cause: STOPPED });
  expect(textOf(live, D1)).toBe(ASKED);
});

test("typing_while_a_preview_loads_drops_its_answer", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "first @anna");
  live.threads.showPreview(D1);
  live.threads.setReplyText(D1, "first @anna, longer");
  expect(shownOf(live)?.preview).toEqual(WRITING);
  at(live.previews, 0).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();
  expect(shownOf(live)?.preview).toEqual(WRITING);

  live.threads.setReplyText(D2, "elsewhere");
  live.threads.showPreview(D1);
  live.threads.setReplyText(D2, "elsewhere, longer");
  expect(shownOf(live)?.preview).toEqual({ kind: "loading" });
});

test("refreshed_rereads_only_the_shown_merge_request", async () => {
  const live = rig();
  live.threads.refreshed(null);
  expect(live.reads).toEqual([]);

  live.threads.showThread(MR, D1);
  live.threads.refreshed(MR);
  expect(loadOf(live)).toEqual(LOADING);
  expect(live.reads).toHaveLength(2);
  await readAt(live, 0, threadOf(D1));
  expect(loadOf(live)).toEqual(LOADING);
  await readAt(live, 1, threadOf(D1));

  live.threads.refreshed(iid(636));
  expect(live.reads).toHaveLength(2);
  live.threads.refreshed(null);
  expect(loadOf(live)).toEqual(read(threadOf(D1), true));
  expect(live.reads).toHaveLength(3);
});

test("the_thread_logs_carry_no_text_names_or_ids", async () => {
  const info = vi.spyOn(log, "info");
  const times = [1000, 1250, 2000, 2008, 3000, 3100, 4000, 4030];
  vi.spyOn(performance, "now").mockImplementation(() => times.shift() ?? 0);
  const live = rig();
  const comment = { author: null, createdAt: 0, edited: null, body: RENDERED, page: null };
  live.threads.showThread(MR, D1);
  await readAt(live, 0, threadOf(D1, { comments: [comment, comment] }));
  live.threads.setReplyText(D1, ASKED);
  void live.threads.sendReply(D1, "comment");
  await writeAt(live, 0, { kind: "refused", reason: "403 Forbidden" });
  live.threads.showPreview(D1);
  at(live.previews, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  live.threads.showPreview(D1);
  at(live.previews, 1).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();

  expect(info.mock.calls).toEqual([
    ["mergeRequests.thread_read", { iid: MR, kind: "read", comments: 2, ms: 250 }],
    ["mergeRequests.thread_write", { iid: MR, what: "comment", kind: "refused", ms: 8 }],
    ["mergeRequests.preview_read", { iid: MR, kind: "WorkerStopped", ms: 100 }],
    ["mergeRequests.preview_read", { iid: MR, kind: "read", ms: 30 }],
  ]);
  const logged = JSON.stringify(info.mock.calls);
  for (const secret of [SECRET, D1, "Rename this", "403 Forbidden"]) {
    expect(logged).not.toContain(secret);
  }
});

test("an_old_read_of_the_same_thread_never_reaches_the_panel", async () => {
  const live = rig();
  live.threads.showThread(MR, D1);
  live.threads.closeThread();
  live.threads.showThread(MR, D1);
  live.threads.refreshed(null);
  live.threads.refreshed(MR);
  await readAt(live, 0, threadOf(D1, { pending: 5 }));
  expect(loadOf(live)).toEqual(LOADING);
  await readAt(live, 3, threadOf(D1));
  expect(loadOf(live)).toEqual(read(threadOf(D1)));
});

test("a_preview_answered_after_the_panel_closed_changes_nothing", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, ASKED);
  live.threads.showPreview(D1);
  live.threads.closeThread();
  at(live.previews, 0).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();
  expect(shownOf(live)).toBeNull();
});

function previewKinds(live: Rig): string[] {
  const seen: string[] = [];
  watch(
    live.threads.thread,
    (thread) => {
      seen.push(thread?.preview.kind ?? "closed");
    },
    { flush: "sync" },
  );
  return seen;
}

function blockKinds(preview: Preview | undefined): string[] {
  return preview?.kind === "read" ? preview.preview.blocks.map((block) => block.kind) : [];
}

test("a_plain_preview_is_read_at_once_without_a_call", async () => {
  const info = vi.spyOn(log, "info");
  const live = rig();
  await shownAndRead(live);
  const seen = previewKinds(live);
  live.threads.setReplyText(D1, PLAIN);
  live.threads.showPreview(D1);

  expect(shownOf(live)?.preview.kind).toBe("read");
  expect(blockKinds(shownOf(live)?.preview)).toEqual(["paragraph", "list"]);
  expect(live.previews).toEqual([]);
  expect(seen).toEqual(["writing", "read"]);
  expect(info).toHaveBeenLastCalledWith("mergeRequests.preview_local", { iid: MR, blocks: 2 });
  expect(JSON.stringify(info.mock.calls)).not.toContain("good");
});

test("a_preview_with_a_reference_goes_to_gitlab", async () => {
  const live = rig();
  await shownAndRead(live);
  for (const [index, text] of ["see #12", "thanks @anna"].entries()) {
    live.threads.setReplyText(D1, text);
    live.threads.showPreview(D1);
    expect(shownOf(live)?.preview).toEqual({ kind: "loading" });
    expect(live.previews).toHaveLength(index + 1);
    expect(at(live.previews, index).args).toEqual([MR, text]);
    at(live.previews, index).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
    await settled();
    expect(shownOf(live)?.preview).toEqual({ kind: "read", preview: RENDERED });
  }
});

test("a_late_gitlab_answer_never_replaces_a_local_read", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "thanks @anna");
  live.threads.showPreview(D1);
  expect(shownOf(live)?.preview).toEqual({ kind: "loading" });
  live.threads.showWrite(D1);
  live.threads.setReplyText(D1, PLAIN);
  live.threads.showPreview(D1);
  const local = shownOf(live)?.preview;
  expect(blockKinds(local)).toEqual(["paragraph", "list"]);

  at(live.previews, 0).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();
  expect(shownOf(live)?.preview).toBe(local);
  expect(live.previews).toHaveLength(1);
});
