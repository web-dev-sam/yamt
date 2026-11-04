import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type DiscussionId,
  type ListEnd,
  type MergeRequestIid,
  type MergeRequestPage,
  type MergeRequestRow,
  type MergeRequestSource,
  type SourceResult,
} from "../ipc";
import { createMergeRequests, type MergeRequests } from "./mergeRequests";
import type { Screen } from "./screen";

type Rig = {
  readonly slice: MergeRequests;
  readonly source: MergeRequestSource;
  readonly threadReads: MergeRequestIid[];
  /** Every ask-again and discussions read, in call order. */
  readonly calls: string[];
  /** While `hold` is set, each ask-again waits in `held` for the test's answer. */
  readonly asks: Asks;
  /** The second and later list loads: their page is sent; the end waits for the test. */
  readonly held: ((end: SourceResult<ListEnd>) => void)[];
};

type Asks = { hold: boolean; readonly held: ((result: SourceResult<null>) => void)[] };

const PAUSE_MS = 400;
const WRITE_MS = 300;
const THREADS = 637;
const QUIET = 636;
const TEXT = "my unsent answer";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(log, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function rig(askedAgain: SourceResult<null> = { ok: true, value: null }): Rig {
  const fixture = createFixtureCompareSource(log, "?mr=list", {});
  const threadReads: MergeRequestIid[] = [];
  const calls: string[] = [];
  const asks: Asks = { hold: false, held: [] };
  const held: ((end: SourceResult<ListEnd>) => void)[] = [];
  let first: MergeRequestPage | null = null;
  const source: MergeRequestSource = {
    ...fixture,
    askGitLabAgain: async () => {
      calls.push("askGitLabAgain");
      if (!asks.hold) {
        return askedAgain;
      }
      return new Promise((resolve) => {
        asks.held.push(resolve);
      });
    },
    readDiscussions: (asked) => {
      calls.push("readDiscussions");
      return fixture.readDiscussions(asked);
    },
    listMergeRequests: async (onPage, onChecked) => {
      if (first !== null) {
        onPage(first);
        return new Promise((resolve) => {
          held.push(resolve);
        });
      }
      return fixture.listMergeRequests((page) => {
        first ??= page;
        onPage(page);
      }, onChecked);
    },
    readDiscussionThread: (asked, discussion) => {
      threadReads.push(asked);
      return fixture.readDiscussionThread(asked, discussion);
    },
  };
  const slice = createMergeRequests({
    source,
    screen: shallowRef<Screen>({ kind: "files" }),
    report: () => undefined,
    discussionDetails: () => "lazy",
  });
  return { slice, source, threadReads, calls, asks, held };
}

function rowOf(live: Rig, value: number): MergeRequestRow {
  const found = live.slice.rows.value.find((row) => row.iid === value);
  if (found === undefined) {
    throw new Error(`no row !${value}`);
  }
  return found;
}

function readIds(live: Rig, value: number): DiscussionId[] {
  const entry = live.slice.discussions.value.get(iid(value));
  if (entry?.kind !== "read") {
    throw new Error(`!${value} is ${entry?.kind ?? "not asked"}`);
  }
  return entry.discussions.map((discussion) => discussion.id);
}

/** The list read, !637's discussions read, and its first discussion's thread shown and read. */
async function threadShown(live: Rig): Promise<DiscussionId> {
  await live.slice.refresh();
  live.slice.askDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const [shown] = readIds(live, THREADS);
  if (shown === undefined) {
    throw new Error(`!${THREADS} has no discussion`);
  }
  live.slice.showThread(iid(THREADS), shown);
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(live.slice.thread.value?.load.kind).toBe("read");
  return shown;
}

async function resolvedElsewhere(live: Rig, discussion: DiscussionId): Promise<void> {
  const resolving = live.source.resolveDiscussion(iid(THREADS), discussion, true);
  await vi.advanceTimersByTimeAsync(WRITE_MS);
  expect(await resolving).toEqual({ ok: true, value: { kind: "sent" } });
}

test("a_reload_reads_the_shown_thread_again", async () => {
  const live = rig();
  await threadShown(live);
  expect(live.threadReads).toEqual([THREADS]);

  live.slice.refreshDiscussions(iid(QUIET));
  await vi.advanceTimersByTimeAsync(0);
  expect(live.threadReads).toEqual([THREADS]);
  live.slice.refreshDiscussions(iid(THREADS));
  expect(live.slice.reloads.value.get(iid(THREADS))).toEqual({ kind: "running" });
  await vi.advanceTimersByTimeAsync(0);
  expect(live.threadReads).toEqual([THREADS, THREADS]);
  expect(live.slice.thread.value?.load).toMatchObject({ kind: "read", refreshing: true });

  await vi.advanceTimersByTimeAsync(PAUSE_MS * 2);
  expect(live.slice.thread.value?.load).toMatchObject({ kind: "read", refreshing: false });
  expect(live.slice.reloads.value.size).toBe(0);
  expect(rowOf(live, THREADS).openDiscussions).toBe(readIds(live, THREADS).length);
});

test("a_thread_resolved_elsewhere_reads_resolved_and_keeps_its_text", async () => {
  const live = rig();
  const shown = await threadShown(live);
  const before = readIds(live, THREADS).length;
  live.slice.setReplyText(shown, TEXT);
  await resolvedElsewhere(live, shown);

  live.slice.refreshDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const load = live.slice.thread.value?.load;
  expect(load?.kind === "read" && load.thread.resolved).toBe(true);
  expect(live.slice.thread.value?.shown.discussion).toBe(shown);
  expect(live.slice.replyTexts.value.get(shown)).toBe(TEXT);
  expect(readIds(live, THREADS)).not.toContain(shown);
  expect(rowOf(live, THREADS).openDiscussions).toBe(before - 1);
});

test("a_list_refresh_rereads_the_shown_thread", async () => {
  const live = rig();
  const shown = await threadShown(live);
  const refreshing = live.slice.refresh();
  await vi.advanceTimersByTimeAsync(0);
  expect(live.threadReads).toHaveLength(1);

  live.held[0]?.({ ok: true, value: { kind: "loaded" } });
  await refreshing;
  expect(live.threadReads).toEqual([THREADS, THREADS]);
  expect(live.slice.thread.value?.shown.discussion).toBe(shown);
  expect(live.slice.thread.value?.load).toMatchObject({ kind: "read", refreshing: true });
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(live.slice.thread.value?.load).toMatchObject({ kind: "read", refreshing: false });
});

test("withRow_patches_the_buffer_of_a_buffering_refresh", async () => {
  const live = rig();
  const shown = await threadShown(live);
  const listed = rowOf(live, THREADS).openDiscussions;
  await resolvedElsewhere(live, shown);
  const refreshing = live.slice.refresh();

  live.slice.refreshDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(rowOf(live, THREADS).openDiscussions).toBe(listed - 1);

  live.held[0]?.({ ok: true, value: { kind: "loaded" } });
  await refreshing;
  expect(rowOf(live, THREADS).openDiscussions).toBe(listed - 1);
});

test("a_resolve_in_the_panel_marks_the_row_until_the_box_closes", async () => {
  const live = rig();
  const shown = await threadShown(live);
  const listed = rowOf(live, THREADS).openDiscussions;
  const resolving = live.slice.setResolved(true);
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await resolving;

  const entry = live.slice.discussions.value.get(iid(THREADS));
  expect(entry?.kind === "read" && [...entry.resolved]).toEqual([shown]);
  expect(readIds(live, THREADS)).toContain(shown);
  expect(rowOf(live, THREADS).openDiscussions).toBe(listed);

  live.slice.boxClosed(iid(THREADS));
  expect(readIds(live, THREADS)).not.toContain(shown);
  expect(rowOf(live, THREADS).openDiscussions).toBe(listed - 1);
});

test("a_box_thread_answer_through_the_slice_marks_its_row", async () => {
  const live = rig();
  await threadShown(live);
  const entry = live.slice.discussions.value.get(iid(THREADS));
  const second = entry?.kind === "read" ? entry.discussions[1] : undefined;
  if (second === undefined) {
    throw new Error(`!${THREADS} has no second discussion`);
  }
  live.slice.threadRead(iid(THREADS), second, true);
  const marked = live.slice.discussions.value.get(iid(THREADS));
  expect(marked?.kind === "read" && [...marked.resolved]).toEqual([second.id]);
});

test("the_discussions_reload_button_asks_gitlab_again", async () => {
  const live = rig();
  await threadShown(live);
  expect(live.calls).toEqual(["askGitLabAgain", "readDiscussions"]);

  const submitting = live.slice.submitReview();
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS * 2);
  await submitting;
  expect(live.calls).toEqual(["askGitLabAgain", "readDiscussions", "readDiscussions"]);
  const threadReads = live.threadReads.length;

  live.asks.hold = true;
  live.slice.refreshDiscussions(iid(THREADS));
  expect(live.slice.reloads.value.get(iid(THREADS))).toEqual({ kind: "running" });
  live.slice.refreshDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(live.calls.slice(3)).toEqual(["askGitLabAgain"]);
  expect(live.threadReads).toHaveLength(threadReads);
  expect(live.slice.reloads.value.get(iid(THREADS))).toEqual({ kind: "running" });

  live.asks.held[0]?.({ ok: true, value: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(live.calls.slice(3)).toEqual(["askGitLabAgain", "readDiscussions"]);
  expect(live.threadReads).toHaveLength(threadReads + 1);
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(live.slice.reloads.value.size).toBe(0);
});

test("a_failed_ask_still_reloads_the_discussions", async () => {
  const live = rig({ ok: false, failure: { kind: "WorkerStopped" } });
  await threadShown(live);
  live.slice.refreshDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(0);
  expect(live.calls).toEqual([
    "askGitLabAgain",
    "readDiscussions",
    "askGitLabAgain",
    "readDiscussions",
  ]);
  expect(live.slice.reloads.value.get(iid(THREADS))).toEqual({ kind: "running" });
  expect(log.info).toHaveBeenCalledWith("mergeRequests.ask_again_failed", {
    kind: "WorkerStopped",
  });
});

test("the_window_slice_offers_no_reload_that_skips_the_ask", () => {
  const live = rig();
  expect(Object.keys(live.slice)).toContain("refreshDiscussions");
  expect(Object.keys(live.slice)).not.toContain("reloadDiscussions");
});
