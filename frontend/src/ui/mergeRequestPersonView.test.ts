import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import {
  createFixtureCompareSource,
  isDiscussionId,
  isMergeRequestIid,
  log,
  type DiscussionDetails,
  type DiscussionId,
  type FirstComment,
  type MergeRequestIid,
  type MergeRequestSource,
  type SourceFailure,
} from "../ipc";
import { PERSON_GROUPS, type PersonGroup, type Viewer } from "../mergeRequests";
import type { PersonEntryShown, PersonFailure, PersonViewShown } from "./mergeRequestPersonView";
import { createMergeRequests, type MergeRequests } from "./mergeRequests";
import type { Screen } from "./screen";

type Pinned = readonly [iid: number, group: PersonGroup, serial: number];

const NOW = Date.parse("2026-11-04T12:00:00Z");
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const PAUSE_MS = 400;
const WRITE_MS = 300;
const CALLS = 3;
const ANNA: Viewer = { kind: "person", username: "anna", name: "Anna Berg" };
const P1 = 17;
const P3 = 19;
const P6 = 22;
const ANNA_CASES = 624;
const FOLD_CASE = 609;
const FAILING = 615;
const LOGGED_OUT = 629;

/** The ipc slice's table: p1–p7 are serials 17–23; "reviewer or other" allows both. */
const OTHER: readonly PersonGroup[] = ["reviewer", "other"];
const P_CASES: Readonly<
  Record<number, readonly [me: readonly PersonGroup[], anna: readonly PersonGroup[]]>
> = {
  17: [OTHER, ["turn"]],
  18: [["turn"], ["wrote"]],
  19: [OTHER, ["started"]],
  20: [["started"], OTHER],
  21: [["wrote"], OTHER],
  22: [OTHER, ["turn"]],
  23: [OTHER, OTHER],
};

const MES_ORDER: readonly Pinned[] = [
  [637, "turn", 1],
  [637, "turn", 3],
  [636, "turn", 16],
  [637, "turn", 4],
  [637, "turn", 5],
  [624, "turn", 18],
  [633, "turn", 63300],
  [626, "turn", 62601],
  [626, "turn", 62600],
  [623, "turn", 62300],
  [621, "turn", 62100],
  [618, "turn", 61800],
  [611, "turn", 61101],
  [611, "turn", 61100],
  [606, "turn", 60600],
  [636, "started", 15],
  [628, "started", 20],
  [632, "started", 63200],
  [627, "started", 62700],
  [623, "started", 62301],
  [617, "started", 61700],
  [612, "started", 61200],
  [608, "started", 60801],
  [602, "started", 60200],
  [636, "wrote", 14],
  [637, "wrote", 2],
  [628, "wrote", 21],
  [638, "reviewer", 63801],
  [638, "reviewer", 63800],
  [608, "reviewer", 60800],
  [603, "reviewer", 60300],
  [637, "other", 6],
  [637, "other", 7],
  [637, "other", 8],
  [637, "other", 9],
  [637, "other", 10],
  [637, "other", 11],
  [637, "other", 12],
  [637, "other", 13],
  [624, "other", 17],
  [624, "other", 19],
  [609, "other", 22],
  [607, "other", 23],
  [639, "other", 63900],
  [635, "other", 63501],
  [635, "other", 63500],
  [632, "other", 63201],
  [630, "other", 63000],
  [620, "other", 62001],
  [620, "other", 62000],
  [617, "other", 61701],
  [614, "other", 61401],
  [614, "other", 61400],
  [605, "other", 60501],
  [605, "other", 60500],
  [602, "other", 60201],
];

const ANNAS_ORDER: readonly Pinned[] = [
  [636, "turn", 14],
  [637, "turn", 2],
  [637, "turn", 8],
  [624, "turn", 17],
  [609, "turn", 22],
  [635, "turn", 63501],
  [635, "turn", 63500],
  [630, "turn", 63000],
  [620, "turn", 62001],
  [620, "turn", 62000],
  [605, "turn", 60501],
  [605, "turn", 60500],
  [602, "turn", 60200],
  [637, "started", 1],
  [636, "started", 16],
  [637, "started", 5],
  [637, "started", 7],
  [624, "started", 19],
  [632, "started", 63201],
  [626, "started", 62600],
  [621, "started", 62100],
  [617, "started", 61701],
  [611, "started", 61100],
  [606, "started", 60600],
  [602, "started", 60201],
  [637, "wrote", 3],
  [637, "wrote", 6],
  [624, "wrote", 18],
  [632, "reviewer", 63200],
  [627, "reviewer", 62700],
  [617, "reviewer", 61700],
  [612, "reviewer", 61200],
  [636, "other", 15],
  [637, "other", 4],
  [637, "other", 9],
  [637, "other", 10],
  [637, "other", 11],
  [637, "other", 12],
  [637, "other", 13],
  [628, "other", 20],
  [628, "other", 21],
  [607, "other", 23],
  [639, "other", 63900],
  [638, "other", 63801],
  [638, "other", 63800],
  [633, "other", 63300],
  [626, "other", 62601],
  [623, "other", 62301],
  [623, "other", 62300],
  [618, "other", 61800],
  [614, "other", 61401],
  [614, "other", 61400],
  [611, "other", 61101],
  [608, "other", 60801],
  [608, "other", 60800],
  [603, "other", 60300],
];

let slice: MergeRequests;
let mode: ShallowRef<DiscussionDetails>;
let reads: MergeRequestIid[][];
let asks: number;
let threadReads: number;
let writes: number;
/** While set, every discussions read fails with STOPPED. */
let failing: boolean;
let calls: string[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(log, "info").mockImplementation(() => undefined);
  mode = shallowRef<DiscussionDetails>("lazy");
  reads = [];
  asks = 0;
  threadReads = 0;
  writes = 0;
  failing = false;
  calls = [];
  const fixture = createFixtureCompareSource(log, "?mr=list", {});
  const source: MergeRequestSource = {
    ...fixture,
    askGitLabAgain: () => {
      asks += 1;
      calls.push("ask");
      return fixture.askGitLabAgain();
    },
    readDiscussions: async (iids) => {
      reads.push([...iids]);
      calls.push("read");
      return failing ? { ok: false, failure: STOPPED } : fixture.readDiscussions(iids);
    },
    readDiscussionThread: (...args) => {
      threadReads += 1;
      return fixture.readDiscussionThread(...args);
    },
    replyToDiscussion: (...args) => {
      writes += 1;
      return fixture.replyToDiscussion(...args);
    },
  };
  slice = createMergeRequests({
    source,
    screen: shallowRef<Screen>({ kind: "mergeRequests" }),
    report: () => undefined,
    discussionDetails: () => mode.value,
  });
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

function d(serial: number): DiscussionId {
  const id = String(serial).padStart(40, "0");
  if (!isDiscussionId(id)) {
    throw new Error(`${id} is not a discussion id`);
  }
  return id;
}

function shown(): PersonViewShown {
  const view = slice.personView.value;
  if (view === null) {
    throw new Error("the person view is closed");
  }
  return view;
}

function pinned(): Pinned[] {
  return shown().entries.map((each) => [each.row.iid, each.group, Number(each.discussion.id)]);
}

function indexOf(serial: number): number {
  return shown().entries.findIndex((each) => each.discussion.id === d(serial));
}

function entryOf(serial: number): PersonEntryShown {
  const found = shown().entries.find((each) => each.discussion.id === d(serial));
  if (found === undefined) {
    throw new Error(`no entry d${serial}`);
  }
  return found;
}

async function everyRowRead(): Promise<void> {
  await slice.refresh();
  slice.openPersonView();
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(shown().loading).toBeNull();
}

async function expanded(row: number, serial: number): Promise<void> {
  slice.expandEntry(iid(row), d(serial));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
}

function groupsOf(order: readonly Pinned[]): PersonGroup[] {
  return [...new Set(order.map(([, group]) => group))];
}

function expectCases(side: 0 | 1): void {
  for (const [serial, groups] of Object.entries(P_CASES)) {
    expect(groups[side], `p-case d${serial}`).toContain(entryOf(Number(serial)).group);
  }
}

test("over_the_list_fixture_mes_order_is_pinned", async () => {
  await everyRowRead();

  expect(shown().person).toEqual({ kind: "me", username: "sam" });
  expect(pinned()).toEqual(MES_ORDER);
  expect(groupsOf(MES_ORDER)).toEqual(PERSON_GROUPS);
  expectCases(0);
});

test("over_the_list_fixture_annas_order_is_pinned", async () => {
  await everyRowRead();
  slice.pickPerson(ANNA);

  expect(shown().person).toEqual(ANNA);
  expect(pinned()).toEqual(ANNAS_ORDER);
  expect(groupsOf(ANNAS_ORDER)).toEqual(PERSON_GROUPS);
  expectCases(1);
  expect(shown().people.find((line) => line.chosen)?.label).toBe("Anna Berg");
  expect(shown().people[0]?.label).toBe("Me");
});

test("opening_starts_on_the_viewer_or_review_modes_reviewer", async () => {
  mode.value = "full";
  await slice.findProject();
  await slice.refresh();
  slice.openPersonView();
  expect(shown().person).toEqual({ kind: "me", username: "sam" });
  slice.leavePersonView();

  slice.review({ kind: "person", username: "anna" });
  slice.openPersonView();
  expect(shown().person).toEqual(ANNA);
  expect(shown().people.find((line) => line.chosen)?.label).toBe("Anna Berg");
});

function lastMovedToNow(row: number, serial: number): void {
  const entry = entryOf(serial);
  const { discussion } = entry;
  slice.threadRead(
    iid(row),
    { ...discussion, last: { ...discussion.last, createdAt: NOW } },
    entry.resolved,
  );
}

test("picking_anna_reorders_and_empties_held", async () => {
  await everyRowRead();
  await expanded(ANNA_CASES, P1);
  slice.collapseEntry(d(P1));
  await expanded(FOLD_CASE, P6);

  slice.pickPerson(ANNA);
  expect(pinned()).toEqual(ANNAS_ORDER);
  const kept = indexOf(P6);
  lastMovedToNow(ANNA_CASES, P1);
  lastMovedToNow(FOLD_CASE, P6);

  expect(indexOf(P1)).toBe(0);
  expect(indexOf(P6)).toBe(kept);
});

test("an_expanded_entry_keeps_its_place_when_its_discussion_changes", async () => {
  await everyRowRead();
  const before = indexOf(P1);
  await expanded(ANNA_CASES, P1);
  slice.setReplyText(d(P1), "Thanks, merged the test.");
  const sending = slice.sendReply(d(P1), "comment");
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await sending;

  expect(entryOf(P1).group).toBe("wrote");
  expect(indexOf(P1)).toBe(before);
  slice.collapseEntry(d(P1));
  expect(indexOf(P1)).toBe(before);

  const [asksBefore, readsBefore] = [asks, reads.length];
  slice.refreshPersonView();
  expect(shown().reloading).toBe(true);
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(asks - asksBefore).toBe(1);
  expect(reads.length).toBeGreaterThan(readsBefore);
  expect(shown().reloading).toBe(false);
  expect(indexOf(P1)).toBeLessThan(before);
  expect(
    pinned()
      .filter(([, group]) => group === "wrote")
      .map(([, , serial]) => serial),
  ).toContain(P1);
});

test("the_refresh_keeps_an_expanded_entry_and_reads_its_thread_again", async () => {
  await everyRowRead();
  await expanded(ANNA_CASES, P1);
  const [threadsBefore, place, called] = [threadReads, indexOf(P1), reads.length];
  const listed = slice.shownRows.value.filter((row) => row.openDiscussions > 0);

  slice.refreshPersonView();
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(threadReads - threadsBefore).toBe(1);
  expect(asks).toBe(2);
  expect(reads[called]).toEqual(listed.map((row) => row.iid));
  expect(indexOf(P1)).toBe(place);
});

test("a_resolved_entry_stays_marked_until_back_and_back_drops_it_and_counts", async () => {
  await everyRowRead();
  const [place, total] = [indexOf(P1), shown().counts.total];
  const count = slice.rows.value.find((row) => row.iid === ANNA_CASES)?.openDiscussions ?? 0;
  await expanded(ANNA_CASES, P1);

  const resolving = slice.setResolved(d(P1), true);
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await resolving;
  expect(entryOf(P1).resolved).toBe(true);
  expect(entryOf(P3).resolved).toBe(false);
  expect(indexOf(P1)).toBe(place);
  expect(shown().counts.total).toBe(total - 1);

  slice.leavePersonView();
  expect(slice.rows.value.find((row) => row.iid === ANNA_CASES)?.openDiscussions).toBe(count - 1);
  slice.openPersonView();
  expect(indexOf(P1)).toBe(-1);
  expect(shown().entries).toHaveLength(MES_ORDER.length - 1);
});

test("the_loading_counts_follow_the_answers", async () => {
  await slice.refresh();
  const asked = slice.shownRows.value.filter((row) => row.openDiscussions > 0).length;
  slice.openPersonView();
  expect(shown().loading).toEqual({ answered: 0, asked });
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(shown().loading).toEqual({ answered: 10, asked });
  expect(shown().entries.length).toBeGreaterThan(0);
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(shown().loading).toEqual({ answered: 20, asked });
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  expect(shown().loading).toBeNull();
  expect(reads.map((call) => call.length)).toEqual([asked, asked - 10, asked - 20]);
});

test("a_failed_row_is_listed_with_its_failure", async () => {
  await everyRowRead();
  const failures: readonly PersonFailure[] = shown().failures;
  const reasons = failures.map(({ row, failure }) => [
    row.iid,
    failure.kind === "refused" ? failure.answer.kind : failure.cause.kind,
  ]);
  expect(reasons).toEqual([
    [LOGGED_OUT, "notLoggedIn"],
    [FAILING, "failed"],
  ]);
  const [entries, counts] = [shown().entries.length, shown().counts];

  slice.retryRow(iid(FAILING));
  expect(reads.at(-1)).toEqual([FAILING]);
  expect(shown().failures.map(({ row }) => row.iid)).toEqual([LOGGED_OUT]);
  expect(shown().loading).toEqual({ answered: expect.any(Number), asked: expect.any(Number) });
  expect([shown().entries.length, shown().counts]).toEqual([entries, counts]);
});

test("back_collapses_every_entry_and_keeps_their_texts", async () => {
  await everyRowRead();
  await expanded(ANNA_CASES, P1);
  await expanded(ANNA_CASES, P3);
  slice.setReplyText(d(P1), "one");
  slice.setReplyText(d(P3), "three");

  slice.leavePersonView();
  expect(slice.personView.value).toBeNull();
  expect(slice.expanded.value.size).toBe(0);
  expect(slice.threads.value.size).toBe(0);
  slice.openPersonView();
  await expanded(ANNA_CASES, P1);
  expect([...slice.expanded.value]).toEqual([d(P1)]);
  expect(slice.replyTexts.value.get(d(P1))).toBe("one");
  expect(slice.replyTexts.value.get(d(P3))).toBe("three");
});

test("two_entries_expand_and_one_write_runs_at_a_time", async () => {
  await everyRowRead();
  await expanded(ANNA_CASES, P1);
  slice.expandEntry(iid(ANNA_CASES), d(P1));
  await expanded(ANNA_CASES, P3);
  expect([...slice.threads.value.keys()]).toEqual([d(P1), d(P3)]);
  expect(threadReads).toBe(2);
  slice.setReplyText(d(P1), "one");
  slice.setReplyText(d(P3), "three");

  const first = slice.sendReply(d(P1), "comment");
  expect(slice.writing.value).toBe("comment");
  await slice.sendReply(d(P3), "comment");
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await first;
  expect(writes).toBe(1);
  expect(slice.replyTexts.value.get(d(P3))).toBe("three");
});

test("the_view_asks_again_after_a_switch_to_off_and_keeps_its_reads_after_back", async () => {
  await everyRowRead();
  mode.value = "off";
  await vi.advanceTimersByTimeAsync(0);
  expect(shown().loading).toEqual({ answered: 0, asked: expect.any(Number) });
  expect(shown().entries).toEqual([]);
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(pinned()).toEqual(MES_ORDER);

  slice.leavePersonView();
  const called = reads.length;
  slice.openPersonView();
  expect(shown().loading).toBeNull();
  expect(pinned()).toEqual(MES_ORDER);
  slice.leavePersonView();
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(reads).toHaveLength(called);
});

test("a_first_comment_reaches_the_entry", async () => {
  await everyRowRead();
  const first: FirstComment = entryOf(P1).discussion.first;
  expect(first.body.blocks.length).toBeGreaterThan(1);
});

test("a_list_refresh_lets_a_collapsed_entry_take_its_new_place", async () => {
  await everyRowRead();
  const before = indexOf(P1);
  await expanded(ANNA_CASES, P1);
  slice.setReplyText(d(P1), "Thanks, merged the test.");
  const sending = slice.sendReply(d(P1), "comment");
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await sending;
  slice.collapseEntry(d(P1));
  expect(indexOf(P1)).toBe(before);

  await slice.refresh();
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(entryOf(P1).group).toBe("wrote");
  expect(indexOf(P1)).toBeLessThan(before);
});

test("a_failed_reload_is_listed_and_a_running_one_is_not", async () => {
  await everyRowRead();
  const listed = slice.shownRows.value.filter((row) => row.openDiscussions > 0);
  const entries = shown().entries;
  failing = true;
  slice.refreshPersonView();
  expect(shown().failures).toEqual([]);
  await vi.advanceTimersByTimeAsync(PAUSE_MS);

  const failures: readonly PersonFailure[] = shown().failures;
  expect(failures.map(({ row }) => row.iid)).toEqual(listed.map((row) => row.iid));
  expect(failures.every(({ failure }) => failure.kind === "failed")).toBe(true);
  expect(shown().entries).toEqual(entries);

  failing = false;
  slice.retryRow(iid(ANNA_CASES));
  expect(shown().failures.map(({ row }) => row.iid)).not.toContain(ANNA_CASES);
  expect(shown().reloading).toBe(true);
});

test("the_counts_sum_each_rows_unresolved_discussions_for_the_person", async () => {
  await everyRowRead();
  const turns = MES_ORDER.filter(([, group]) => group === "turn").length;
  expect(shown().counts).toEqual({ viewersTurn: turns, viewerWrote: 16, total: MES_ORDER.length });
  slice.pickPerson(ANNA);
  const annas = ANNAS_ORDER.filter(([, group]) => group === "turn").length;
  expect(shown().counts).toEqual({
    viewersTurn: annas,
    viewerWrote: 20,
    total: ANNAS_ORDER.length,
  });
});

test("the_people_include_every_writer_of_a_read_discussion", async () => {
  await everyRowRead();
  const zoe = { username: "zoe", name: "Zoe Quinn", picture: null };
  const { discussion } = entryOf(P1);
  slice.threadRead(
    iid(ANNA_CASES),
    { ...discussion, last: { ...discussion.last, author: zoe } },
    false,
  );
  expect(shown().people.map((line) => line.label)).toContain("Zoe Quinn");
});

test("a_closed_view_neither_refreshes_nor_expands", async () => {
  await slice.refresh();
  slice.refreshPersonView();
  slice.expandEntry(iid(ANNA_CASES), d(P1));
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect([asks, reads.length, threadReads]).toEqual([1, 0, 0]);
  expect(slice.expanded.value.size).toBe(0);
});

test("a_refresh_at_opening_asks_gitlab_before_reading_any_row", async () => {
  await slice.refresh();
  calls = [];
  slice.openPersonView();
  slice.refreshPersonView();
  const listed = slice.shownRows.value.filter((row) => row.openDiscussions > 0);
  expect([...slice.discussions.value.keys()]).toEqual(listed.map((row) => row.iid));
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(calls.slice(0, 2)).toEqual(["ask", "read"]);
  expect(shown().loading).toBeNull();
});

test("back_before_a_refresh_is_answered_reads_nothing", async () => {
  await slice.refresh();
  slice.openPersonView();
  const asksBefore = asks;
  slice.refreshPersonView();
  slice.leavePersonView();
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect([asks - asksBefore, reads.length]).toEqual([1, 0]);
  expect(slice.discussions.value.size).toBe(0);
});

test("a_refresh_reloads_a_row_whose_every_discussion_was_resolved_here", async () => {
  await everyRowRead();
  await expanded(FOLD_CASE, P6);
  const resolving = slice.setResolved(d(P6), true);
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await resolving;
  slice.leavePersonView();
  expect(slice.rows.value.find((row) => row.iid === FOLD_CASE)?.openDiscussions).toBe(0);

  slice.openPersonView();
  const called = reads.length;
  slice.refreshPersonView();
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
  expect(reads[called]).toContain(FOLD_CASE);
});
