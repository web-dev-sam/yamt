import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type MergeRequestIid,
  type MergeRequestPeople,
  type MergeRequestSource,
  type PeopleChange,
  type PeopleChangeReply,
  type PeopleSearchReply,
  type Person,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import {
  createPeopleChanges,
  rowPeopleAsks,
  SEARCH_PAUSE_MS,
  type PeopleChanges,
} from "./mergeRequestPeople";

type Call<T> = {
  readonly answer: (result: SourceResult<T>) => void;
  readonly fail: (error: Error) => void;
};
type SearchCall = Call<PeopleSearchReply> & { readonly text: string };
type ChangeCall = Call<PeopleChangeReply> & {
  readonly iid: MergeRequestIid;
  readonly change: PeopleChange;
};

type Rig = {
  readonly slice: PeopleChanges;
  readonly searches: SearchCall[];
  readonly changes: ChangeCall[];
  readonly replaced: [MergeRequestIid, MergeRequestPeople][];
};

const MICROTASKS = 10;
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const ANNA: Person = { username: "anna", name: "Anna Berg", picture: null };
const BEN: Person = { username: "ben", name: "Ben Okafor", picture: null };
const PEOPLE: MergeRequestPeople = {
  assignees: [ANNA],
  reviewers: [{ person: BEN, state: "requested" }],
};
const ADD_BEN: PeopleChange = { group: "reviewers", action: "add", username: "ben" };
const REMOVE_BEN: PeopleChange = { group: "reviewers", action: "remove", username: "ben" };
const ADD_ANNA: PeopleChange = { group: "assignees", action: "add", username: "anna" };
const ASSIGN_BEN: PeopleChange = { group: "assignees", action: "add", username: "ben" };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function rig(): Rig {
  const searches: SearchCall[] = [];
  const changes: ChangeCall[] = [];
  const replaced: [MergeRequestIid, MergeRequestPeople][] = [];
  const source: MergeRequestSource = {
    ...createFixtureCompareSource(log, "", {}),
    searchPeople: (text) =>
      new Promise((resolve, reject) => {
        searches.push({ text, answer: resolve, fail: reject });
      }),
    changePeople: (asked, change) =>
      new Promise((resolve, reject) => {
        changes.push({ iid: asked, change, answer: resolve, fail: reject });
      }),
  };
  const slice = createPeopleChanges({
    source,
    replaced: (asked, people) => replaced.push([asked, people]),
  });
  return { slice, searches, changes, replaced };
}

function at<T>(calls: readonly T[], index: number): T {
  const found = calls[index];
  if (found === undefined) {
    throw new Error(`no call ${index}; ${calls.length} made`);
  }
  return found;
}

async function settled(): Promise<void> {
  for (let turn = 0; turn < MICROTASKS; turn += 1) {
    await Promise.resolve();
  }
}

async function typed(live: Rig, text: string): Promise<void> {
  live.slice.peopleSearch.search(text);
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS);
}

function found(people: readonly Person[]): SourceResult<PeopleSearchReply> {
  return { ok: true, value: { kind: "found", people } };
}

function asksOf(live: Rig, value: number): unknown {
  return live.slice.peopleAsks.value.get(iid(value));
}

test("typing_waits_250_ms_then_asks_once_with_the_last_text", async () => {
  const live = rig();
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS * 4);
  expect(live.searches).toEqual([]);
  live.slice.peopleSearch.search("b");
  await vi.advanceTimersByTimeAsync(100);
  live.slice.peopleSearch.search("be");
  await vi.advanceTimersByTimeAsync(100);
  live.slice.peopleSearch.search(" @ben ");
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS - 1);
  expect(live.searches).toEqual([]);
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "searching",
    text: "ben",
    people: [],
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(live.searches.map((call) => call.text)).toEqual(["ben"]);
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS * 4);
  expect(live.searches).toHaveLength(1);
});

test("an_older_search_answer_is_dropped_once_a_newer_search_was_sent", async () => {
  const live = rig();
  await typed(live, "a");
  await typed(live, "an");
  at(live.searches, 0).answer(found([BEN]));
  await settled();
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "searching",
    text: "an",
    people: [],
  });
  at(live.searches, 1).answer(found([ANNA]));
  await settled();
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "found",
    text: "an",
    people: [ANNA],
  });
});

test("an_answer_after_more_typing_is_dropped", async () => {
  const live = rig();
  await typed(live, "a");
  live.slice.peopleSearch.search("an");
  at(live.searches, 0).answer(found([BEN]));
  await settled();
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "searching",
    text: "an",
    people: [],
  });
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS);
  expect(live.searches.map((call) => call.text)).toEqual(["a", "an"]);
});

test("an_empty_or_at_only_text_shows_the_suggestions_and_asks_nothing", async () => {
  const live = rig();
  live.slice.peopleSearch.search("a");
  live.slice.peopleSearch.search(" @ ");
  expect(live.slice.peopleSearch.state.value).toEqual({ kind: "empty" });
  live.slice.peopleSearch.search("");
  expect(live.slice.peopleSearch.state.value).toEqual({ kind: "empty" });
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS * 4);
  expect(live.searches).toEqual([]);
});

test("ending_the_search_drops_the_answer_in_flight", async () => {
  const live = rig();
  await typed(live, "a");
  live.slice.peopleSearch.end();
  expect(live.slice.peopleSearch.state.value).toEqual({ kind: "empty" });
  at(live.searches, 0).answer(found([ANNA]));
  await settled();
  expect(live.slice.peopleSearch.state.value).toEqual({ kind: "empty" });

  live.slice.peopleSearch.search("b");
  live.slice.peopleSearch.end();
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS * 4);
  expect(live.searches).toHaveLength(1);
});

test("searching_keeps_the_last_answers_people", async () => {
  const live = rig();
  await typed(live, "a");
  at(live.searches, 0).answer(found([ANNA, BEN]));
  await settled();
  live.slice.peopleSearch.search("an");
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "searching",
    text: "an",
    people: [ANNA, BEN],
  });
  live.slice.peopleSearch.search("ann");
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "searching",
    text: "ann",
    people: [ANNA, BEN],
  });
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS);
  at(live.searches, 1).answer({ ok: true, value: { kind: "glabMissing" } });
  await settled();
  live.slice.peopleSearch.search("anna");
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "searching",
    text: "anna",
    people: [],
  });
});

test("the_same_text_again_asks_nothing", async () => {
  const live = rig();
  live.slice.peopleSearch.search("an");
  await vi.advanceTimersByTimeAsync(100);
  live.slice.peopleSearch.search("an");
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS - 100);
  expect(live.searches.map((call) => call.text)).toEqual(["an"]);
  at(live.searches, 0).answer(found([ANNA]));
  await settled();
  const answered = { kind: "found", text: "an", people: [ANNA] };
  expect(live.slice.peopleSearch.state.value).toEqual(answered);

  live.slice.peopleSearch.search(" an ");
  live.slice.peopleSearch.search("@an");
  expect(live.slice.peopleSearch.state.value).toEqual(answered);
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS * 4);
  expect(live.searches).toHaveLength(1);

  await typed(live, "b");
  await typed(live, "an");
  at(live.searches, 2).answer({ ok: false, failure: STOPPED });
  await settled();
  await typed(live, "an");
  expect(live.searches.map((call) => call.text)).toEqual(["an", "b", "an", "an"]);
  at(live.searches, 3).answer({ ok: true, value: { kind: "glabMissing" } });
  await settled();
  await typed(live, "an");
  expect(live.searches.map((call) => call.text)).toEqual(["an", "b", "an", "an", "an"]);
});

test("a_refused_search_keeps_the_reply_and_a_thrown_one_is_failed_without_a_report", async () => {
  const live = rig();
  await typed(live, "a");
  at(live.searches, 0).answer({ ok: true, value: { kind: "failed", message: "no field" } });
  await settled();
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "refused",
    text: "a",
    reply: { kind: "failed", message: "no field" },
  });
  await typed(live, "b");
  at(live.searches, 1).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "failed",
    text: "b",
    cause: STOPPED,
  });
  await typed(live, "c");
  at(live.searches, 2).fail(new Error("boom"));
  await settled();
  expect(live.slice.peopleSearch.state.value).toEqual({
    kind: "failed",
    text: "c",
    cause: { kind: "Unexpected", message: "boom" },
  });
});

test("a_second_change_on_a_merge_request_waits_for_the_first", async () => {
  const live = rig();
  const answered: string[] = [];
  void live.slice.changePeople(iid(1), ADD_BEN).then(() => answered.push("first"));
  void live.slice.changePeople(iid(1), ADD_ANNA).then(() => answered.push("second"));
  await settled();
  expect(live.changes.map((call) => call.change)).toEqual([ADD_BEN]);
  expect(asksOf(live, 1)).toEqual({ queue: [ADD_BEN, ADD_ANNA], notDone: [] });

  at(live.changes, 0).answer({ ok: true, value: { kind: "changed", people: PEOPLE } });
  await settled();
  expect(answered).toEqual(["first"]);
  expect(live.changes.map((call) => call.change)).toEqual([ADD_BEN, ADD_ANNA]);
  expect(asksOf(live, 1)).toEqual({ queue: [ADD_ANNA], notDone: [] });

  at(live.changes, 1).answer({ ok: true, value: { kind: "changed", people: PEOPLE } });
  await settled();
  expect(answered).toEqual(["first", "second"]);
});

test("changes_on_two_merge_requests_run_side_by_side", async () => {
  const live = rig();
  void live.slice.changePeople(iid(1), ADD_BEN);
  void live.slice.changePeople(iid(2), ADD_BEN);
  await settled();
  expect(live.changes.map((call) => call.iid)).toEqual([1, 2]);
  at(live.changes, 1).answer({ ok: true, value: { kind: "changed", people: PEOPLE } });
  await settled();
  expect(asksOf(live, 1)).toEqual({ queue: [ADD_BEN], notDone: [] });
  expect(asksOf(live, 2)).toBeUndefined();
});

test("an_equal_change_already_queued_is_not_sent_twice", async () => {
  const live = rig();
  void live.slice.changePeople(iid(1), ADD_BEN);
  void live.slice.changePeople(iid(1), { ...ADD_BEN });
  void live.slice.changePeople(iid(1), REMOVE_BEN);
  void live.slice.changePeople(iid(1), ASSIGN_BEN);
  void live.slice.changePeople(iid(1), { ...REMOVE_BEN });
  expect(asksOf(live, 1)).toEqual({ queue: [ADD_BEN, REMOVE_BEN, ASSIGN_BEN], notDone: [] });
  for (let index = 0; index < 3; index += 1) {
    await settled();
    at(live.changes, index).answer({ ok: true, value: { kind: "changed", people: PEOPLE } });
  }
  await settled();
  expect(live.changes.map((call) => call.change)).toEqual([ADD_BEN, REMOVE_BEN, ASSIGN_BEN]);
});

test("changed_hands_gitlabs_people_to_the_row", async () => {
  const live = rig();
  const changing = live.slice.changePeople(iid(7), ADD_BEN);
  await settled();
  at(live.changes, 0).answer({ ok: true, value: { kind: "changed", people: PEOPLE } });
  await changing;
  expect(live.replaced).toEqual([[7, PEOPLE]]);
  expect(live.slice.peopleAsks.value.size).toBe(0);
});

test("an_unchanged_reply_takes_gitlabs_lists_and_keeps_its_sentence", async () => {
  const live = rig();
  const changing = live.slice.changePeople(iid(7), ADD_BEN);
  await settled();
  at(live.changes, 0).answer({ ok: true, value: { kind: "unchanged", people: PEOPLE } });
  await changing;
  expect(live.replaced).toEqual([[7, PEOPLE]]);
  expect(asksOf(live, 7)).toEqual({
    queue: [],
    notDone: [{ change: ADD_BEN, why: { kind: "unchanged" } }],
  });
});

test("a_refused_or_thrown_change_keeps_a_notice_and_the_queue_goes_on", async () => {
  const live = rig();
  const last = live.slice.changePeople(iid(7), ADD_BEN);
  void live.slice.changePeople(iid(7), ADD_ANNA);
  const third = live.slice.changePeople(iid(7), ASSIGN_BEN);
  await settled();
  at(live.changes, 0).answer({ ok: true, value: { kind: "refused", message: "Cannot assign" } });
  await settled();
  at(live.changes, 1).fail(new Error("boom"));
  await settled();
  at(live.changes, 2).answer({ ok: false, failure: STOPPED });
  await Promise.all([last, third]);
  expect(live.replaced).toEqual([]);
  expect(asksOf(live, 7)).toEqual({
    queue: [],
    notDone: [
      {
        change: ADD_BEN,
        why: { kind: "refused", reply: { kind: "refused", message: "Cannot assign" } },
      },
      { change: ADD_ANNA, why: { kind: "failed", cause: { kind: "Unexpected", message: "boom" } } },
      { change: ASSIGN_BEN, why: { kind: "failed", cause: STOPPED } },
    ],
  });
});

test("closing_the_box_keeps_the_running_and_waiting_changes", async () => {
  const live = rig();
  const refused = live.slice.changePeople(iid(7), ASSIGN_BEN);
  await settled();
  at(live.changes, 0).answer({ ok: true, value: { kind: "refused", message: "no" } });
  await refused;
  void live.slice.changePeople(iid(7), ADD_BEN);
  void live.slice.changePeople(iid(7), ADD_ANNA);
  live.slice.peopleBoxOpened(iid(7));
  live.slice.peopleBoxClosed(iid(7));
  expect(asksOf(live, 7)).toEqual({ queue: [ADD_BEN, ADD_ANNA], notDone: [] });
  await settled();
  at(live.changes, 1).answer({ ok: true, value: { kind: "changed", people: PEOPLE } });
  await settled();
  expect(live.changes.map((call) => call.change)).toEqual([ASSIGN_BEN, ADD_BEN, ADD_ANNA]);
});

test("a_box_opened_on_two_rows_keeps_both_until_each_closes", async () => {
  const live = rig();
  const unchanged = live.slice.changePeople(iid(3), ADD_BEN);
  await settled();
  at(live.changes, 0).answer({ ok: true, value: { kind: "unchanged", people: PEOPLE } });
  await unchanged;

  live.slice.peopleBoxOpened(iid(1));
  live.slice.peopleBoxOpened(iid(2));
  live.slice.peopleBoxOpened(iid(2));
  expect(live.slice.openPeopleBoxes.value).toEqual(new Set([1, 2]));
  live.slice.peopleBoxClosed(iid(1));
  expect(live.slice.openPeopleBoxes.value).toEqual(new Set([2]));
  expect(live.slice.peopleAsks.value.size).toBe(1);
  live.slice.peopleBoxClosed(iid(3));
  expect(live.slice.openPeopleBoxes.value).toEqual(new Set([2]));
  expect(asksOf(live, 3)).toBeUndefined();
  live.slice.peopleBoxClosed(iid(2));
  expect(live.slice.openPeopleBoxes.value).toEqual(new Set());
});

test("a_new_change_for_the_person_drops_their_old_notice", async () => {
  const live = rig();
  const first = live.slice.changePeople(iid(7), ADD_BEN);
  const second = live.slice.changePeople(iid(7), ASSIGN_BEN);
  await settled();
  at(live.changes, 0).answer({ ok: true, value: { kind: "unchanged", people: PEOPLE } });
  await settled();
  at(live.changes, 1).answer({ ok: true, value: { kind: "unchanged", people: PEOPLE } });
  await Promise.all([first, second]);

  void live.slice.changePeople(iid(7), REMOVE_BEN);
  expect(asksOf(live, 7)).toEqual({
    queue: [REMOVE_BEN],
    notDone: [{ change: ASSIGN_BEN, why: { kind: "unchanged" } }],
  });
});

test("a_row_with_no_asks_reads_an_empty_queue_and_no_notice", () => {
  const live = rig();
  void live.slice.changePeople(iid(7), ADD_BEN);
  const asks = live.slice.peopleAsks.value;
  expect(rowPeopleAsks(asks, iid(8))).toEqual({ queue: [], notDone: [] });
  expect(rowPeopleAsks(asks, iid(7))).toEqual({ queue: [ADD_BEN], notDone: [] });
});
