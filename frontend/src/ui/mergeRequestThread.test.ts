import { afterEach, expect, test, vi } from "vitest";

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
const SECRET = "the secret words of the reply";
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
  live.threads.retryThread();
  expect(live.reads).toEqual([]);

  live.threads.showThread(MR, D1);
  at(live.reads, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(loadOf(live)).toEqual({ kind: "failed", cause: STOPPED });

  live.threads.retryThread();
  expect(loadOf(live)).toEqual(LOADING);
  at(live.reads, 1).answer({ ok: true, value: { kind: "notFound" } });
  await settled();
  expect(loadOf(live)).toEqual({ kind: "refused", reply: { kind: "notFound" } });
  expect(live.boxReads).toEqual([]);

  live.threads.retryThread();
  at(live.reads, 2).fail(new Error("unreadable answer"));
  await settled();
  expect(loadOf(live)).toEqual({
    kind: "failed",
    cause: { kind: "Unexpected", message: "unreadable answer" },
  });
  live.threads.retryThread();
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

  void live.threads.sendReply("comment");
  expect(at(live.writes, 0).args).toEqual(["reply", MR, D1, "comment", "first"]);
  await writeAt(live, 0, { kind: "sent" });
  expect(live.threads.replyTexts.value.has(D1)).toBe(false);
  expect(textOf(live, D2)).toBe(SECRET);

  await readAt(live, 2, threadOf(D1));
  live.threads.setReplyText(D1, "second");
  void live.threads.sendReply("draft");
  live.threads.setReplyText(D1, "second, longer");
  await writeAt(live, 1, { kind: "sent" });
  expect(at(live.writes, 1).args).toEqual(["reply", MR, D1, "draft", "second"]);
  expect(textOf(live, D1)).toBe("second, longer");
  live.threads.setReplyText(D2, "");
  expect([...live.threads.replyTexts.value.keys()]).toEqual([D1]);
});

test("a_thread_shown_during_another_threads_write_reports_it", async () => {
  const live = rig();
  await shownAndRead(live, D1);
  live.threads.setReplyText(D1, "first");
  void live.threads.sendReply("comment");
  live.threads.showThread(MR, D2);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });
  await readAt(live, 1, threadOf(D2));
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });

  live.threads.retryThread();
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });
  live.threads.showThread(MR, D1);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });
  await writeAt(live, 0, { kind: "refused", reason: "403 Forbidden" });
  expect(shownOf(live)?.sending).toEqual(
    failed("comment", { kind: "refused", reason: "403 Forbidden" }),
  );
  live.threads.showThread(MR, D2);
  expect(shownOf(live)?.sending).toEqual({ kind: "idle" });
});

test("a_failed_write_answered_after_a_switch_leaves_the_shown_thread_idle", async () => {
  const live = rig();
  await shownAndRead(live, D1);
  void live.threads.setResolved(true);
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
  const drafting = live.threads.sendReply("draft");
  expect(at(live.writes, 1).args).toEqual(["reply", MR, D2, "draft", "other"]);

  live.threads.closeThread();
  await writeAt(live, 1, { kind: "failed", message: "glab timed out" });
  await drafting;
  expect(shownOf(live)).toBeNull();
});

test("a_second_send_while_one_runs_sends_nothing", async () => {
  const live = rig();
  await live.threads.sendReply("comment");
  await live.threads.setResolved(true);
  await live.threads.submitReview();
  live.threads.showThread(MR, D1);
  live.threads.setReplyText(D1, "first");
  await live.threads.sendReply("comment");
  expect(live.writes).toEqual([]);

  await readAt(live, 0, threadOf(D1));
  live.threads.showThread(MR, D2);
  await readAt(live, 1, threadOf(D2));
  await live.threads.sendReply("comment");
  expect(live.writes).toEqual([]);
  live.threads.showThread(MR, D1);
  await readAt(live, 2, threadOf(D1));
  live.threads.setReplyText(D1, "  \n ");
  await live.threads.sendReply("comment");
  expect(live.writes).toEqual([]);

  live.threads.setReplyText(D1, "first");
  void live.threads.sendReply("comment");
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });
  void live.threads.sendReply("comment");
  void live.threads.setResolved(true);
  void live.threads.submitReview();
  live.threads.showThread(MR, D2);
  await readAt(live, 3, threadOf(D2));
  live.threads.setReplyText(D2, "other");
  void live.threads.sendReply("draft");
  expect(live.writes).toHaveLength(1);

  await writeAt(live, 0, { kind: "sent" });
  void live.threads.sendReply("draft");
  expect(live.writes).toHaveLength(2);
});

test("a_refused_send_keeps_the_text_and_reads_nothing", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "first");
  void live.threads.sendReply("comment");
  await writeAt(live, 0, { kind: "refused", reason: "403 Forbidden" });

  expect(shownOf(live)?.sending).toEqual(
    failed("comment", { kind: "refused", reason: "403 Forbidden" }),
  );
  expect(textOf(live, D1)).toBe("first");
  expect(live.reads).toHaveLength(1);
  expect(loadOf(live)).toEqual(read(threadOf(D1)));

  void live.threads.sendReply("comment");
  expect(live.writes).toHaveLength(2);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "comment" });
});

test("a_failed_send_reads_the_thread_again_before_another_send", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "first");
  void live.threads.sendReply("comment");
  await writeAt(live, 0, { kind: "failed", message: "glab timed out" });

  expect(shownOf(live)?.sending).toEqual(
    failed("comment", { kind: "failed", message: "glab timed out" }),
  );
  expect(textOf(live, D1)).toBe("first");
  expect(loadOf(live)).toEqual(read(threadOf(D1), true));
  expect(live.reads).toHaveLength(2);
  await live.threads.sendReply("comment");
  expect(live.writes).toHaveLength(1);

  await readAt(live, 1, threadOf(D1, { pending: 1 }));
  expect(loadOf(live)).toEqual(read(threadOf(D1, { pending: 1 })));
  void live.threads.sendReply("comment");
  at(live.writes, 1).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(shownOf(live)?.sending).toEqual(failed("comment", { kind: "ipc", cause: STOPPED }));
  expect(live.reads).toHaveLength(3);
  await readAt(live, 2, threadOf(D1));
  void live.threads.sendReply("comment");
  await writeAt(live, 2, { kind: "notLoggedIn", detail: "gitlab.example: no token" });
  expect(live.reads).toHaveLength(4);
});

test("submit_publishes_then_reloads_the_thread_and_the_row", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "unsent");
  void live.threads.submitReview();
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
  void live.threads.submitReview();
  await writeAt(live, 0, { kind: "glabMissing" });

  expect(shownOf(live)?.sending).toEqual(failed("submit", { kind: "glabMissing" }));
  expect(live.reloads).toEqual([]);
  expect(loadOf(live)).toEqual(read(drafted, true));
  await readAt(live, 1, drafted);
  expect(loadOf(live)).toEqual(read(drafted));

  void live.threads.submitReview();
  await writeAt(live, 1, { kind: "refused", reason: "404 Not Found" });
  expect(live.reloads).toEqual([]);
  expect(live.reads).toHaveLength(2);
});

test("resolve_sends_no_text_and_rereads", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "kept");
  void live.threads.setResolved(true);
  expect(at(live.writes, 0).args).toEqual(["resolve", MR, D1, true]);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "resolve" });
  await writeAt(live, 0, { kind: "sent" });
  expect(textOf(live, D1)).toBe("kept");
  expect(live.reloads).toEqual([]);
  await readAt(live, 1, threadOf(D1, { resolved: true }));
  expect(live.boxReads.at(-1)).toEqual([MR, D1, true]);

  void live.threads.setResolved(false);
  expect(at(live.writes, 1).args).toEqual(["resolve", MR, D1, false]);
  expect(shownOf(live)?.sending).toEqual({ kind: "sending", what: "unresolve" });
});

test("a_blank_preview_is_empty_without_a_call", async () => {
  const live = rig();
  live.threads.showPreview();
  live.threads.showWrite();
  expect(shownOf(live)).toBeNull();

  await shownAndRead(live);
  live.threads.showPreview();
  expect(shownOf(live)?.preview).toEqual({ kind: "empty" });
  live.threads.setReplyText(D1, " \n\t");
  live.threads.showPreview();
  expect(shownOf(live)?.preview).toEqual({ kind: "empty" });
  expect(live.previews).toEqual([]);
  live.threads.showWrite();
  expect(shownOf(live)?.preview).toEqual(WRITING);
});

test("a_preview_shows_gitlabs_rendering_of_the_text", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, SECRET);
  live.threads.showPreview();
  expect(shownOf(live)?.preview).toEqual({ kind: "loading" });
  expect(at(live.previews, 0).args).toEqual([MR, SECRET]);
  at(live.previews, 0).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();
  expect(shownOf(live)?.preview).toEqual({ kind: "read", preview: RENDERED });

  live.threads.showPreview();
  at(live.previews, 1).answer({ ok: true, value: { kind: "glabMissing" } });
  await settled();
  expect(shownOf(live)?.preview).toEqual({ kind: "refused", reply: { kind: "glabMissing" } });
});

test("a_preview_failure_keeps_the_text", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, SECRET);
  live.threads.showPreview();
  at(live.previews, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(shownOf(live)?.preview).toEqual({ kind: "failed", cause: STOPPED });
  expect(textOf(live, D1)).toBe(SECRET);
});

test("typing_while_a_preview_loads_drops_its_answer", async () => {
  const live = rig();
  await shownAndRead(live);
  live.threads.setReplyText(D1, "first");
  live.threads.showPreview();
  live.threads.setReplyText(D1, "first, longer");
  expect(shownOf(live)?.preview).toEqual(WRITING);
  at(live.previews, 0).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();
  expect(shownOf(live)?.preview).toEqual(WRITING);

  live.threads.setReplyText(D2, "elsewhere");
  live.threads.showPreview();
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
  live.threads.setReplyText(D1, SECRET);
  void live.threads.sendReply("comment");
  await writeAt(live, 0, { kind: "refused", reason: "403 Forbidden" });
  live.threads.showPreview();
  at(live.previews, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  live.threads.showPreview();
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
  live.threads.setReplyText(D1, SECRET);
  live.threads.showPreview();
  live.threads.closeThread();
  at(live.previews, 0).answer({ ok: true, value: { kind: "read", preview: RENDERED } });
  await settled();
  expect(shownOf(live)).toBeNull();
});
