import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type ShallowRef } from "vue";

import {
  createFixtureCompareSource,
  isDiscussionId,
  isMergeRequestIid,
  log,
  type DiscussionDetails,
  type DiscussionsAnswer,
  type MergeRequestIid,
  type MergeRequestRow,
  type OpenDiscussion,
  type RowDiscussions,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import {
  createDiscussions,
  useRowDiscussions,
  type DiscussionLoad,
  type DiscussionQueue,
  type Reload,
} from "./mergeRequestDiscussions";

type Call = {
  readonly iids: readonly MergeRequestIid[];
  readonly answer: (result: SourceResult<readonly RowDiscussions[]>) => void;
  readonly fail: (error: unknown) => void;
};

type Rig = {
  readonly queue: DiscussionQueue;
  readonly calls: Call[];
  readonly mode: ShallowRef<DiscussionDetails>;
  readonly rows: ShallowRef<readonly MergeRequestRow[]>;
  readonly counts: [MergeRequestIid, number][];
};

const MICROTASKS = 10;
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const LOADING: DiscussionLoad = { kind: "loading" };
const RUNNING: Reload = { kind: "running" };
const NOTE_TEXT = "Please rename this, Anna";

let ROWS: readonly MergeRequestRow[] = [];
let DISCUSSION: OpenDiscussion;
let OTHER: OpenDiscussion;

beforeAll(async () => {
  const rows: MergeRequestRow[] = [];
  await createFixtureCompareSource(log, "?mr=list", {}).listMergeRequests(
    (page) => {
      rows.push(...page.rows);
    },
    () => undefined,
  );
  ROWS = rows;
  const author = rows.find((row) => row.author !== null)?.author ?? null;
  const page = rows.find((row) => row.page !== null)?.page ?? null;
  const [id, other] = [
    "0000000000000000000000000000000000000001",
    "0000000000000000000000000000000000000002",
  ];
  if (!isDiscussionId(id) || !isDiscussionId(other)) {
    throw new Error(`${id} or ${other} is not a discussion id`);
  }
  DISCUSSION = {
    id,
    place: { kind: "file", path: "src/board/card.ts", line: 12 },
    earlier: [],
    last: { author, createdAt: 0, text: NOTE_TEXT, page, mentions: [] },
  };
  OTHER = { ...DISCUSSION, id: other, place: { kind: "overview" } };
});

afterEach(() => {
  vi.restoreAllMocks();
});

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function rig(start: DiscussionDetails = "full"): Rig {
  const calls: Call[] = [];
  const mode = shallowRef<DiscussionDetails>(start);
  const rows = shallowRef<readonly MergeRequestRow[]>([]);
  const counts: [MergeRequestIid, number][] = [];
  const source = {
    ...createFixtureCompareSource(log, "", {}),
    readDiscussions: (iids: readonly MergeRequestIid[]) =>
      new Promise<SourceResult<readonly RowDiscussions[]>>((resolve, reject) => {
        calls.push({ iids: [...iids], answer: resolve, fail: reject });
      }),
  };
  const queue = createDiscussions({
    source,
    mode: () => mode.value,
    rows: () => rows.value,
    counted: (asked, count) => {
      counts.push([asked, count]);
    },
  });
  return { queue, calls, mode, rows, counts };
}

async function settled(): Promise<void> {
  for (let turn = 0; turn < MICROTASKS; turn += 1) {
    await Promise.resolve();
  }
}

function callAt(live: Rig, index: number): Call {
  const call = live.calls[index];
  if (call === undefined) {
    throw new Error(`no call ${index}; ${live.calls.length} made`);
  }
  return call;
}

function openIids(rows: readonly MergeRequestRow[]): MergeRequestIid[] {
  return rows.filter((row) => row.openDiscussions > 0).map((row) => row.iid);
}

function opened(iids: readonly MergeRequestIid[]): SourceResult<readonly RowDiscussions[]> {
  return {
    ok: true,
    value: iids.map((each) => ({ iid: each, answer: { kind: "open", discussions: [DISCUSSION] } })),
  };
}

async function answered(
  live: Rig,
  index: number,
  iids?: readonly MergeRequestIid[],
): Promise<void> {
  const call = callAt(live, index);
  call.answer(opened(iids ?? call.iids));
  await settled();
}

function entry(live: Rig, value: number): DiscussionLoad | undefined {
  return live.queue.discussions.value.get(iid(value));
}

function read(): DiscussionLoad {
  return { kind: "read", discussions: [DISCUSSION], resolved: new Set() };
}

test("full_queues_each_page_with_open_discussions_as_it_arrives", async () => {
  const live = rig();
  const [first, second] = [ROWS.slice(0, 20), ROWS.slice(20)];

  live.queue.listed(first);
  expect(live.calls.map((call) => call.iids)).toEqual([openIids(first)]);
  expect([...live.queue.discussions.value.keys()]).toEqual(openIids(first));
  expect(entry(live, 639)).toEqual(LOADING);
  expect(entry(live, 640)).toBeUndefined();

  live.queue.listed(second);
  await answered(live, 0);

  expect(live.calls.map((call) => call.iids)).toEqual([openIids(first), openIids(second)]);
  const asked = live.calls.flatMap((call) => call.iids);
  const quiet = ROWS.filter((row) => row.openDiscussions === 0).map((row) => row.iid);
  expect(asked.filter((each) => quiet.includes(each))).toEqual([]);
});

test("a_prefix_answer_sends_the_rest_until_the_queue_is_empty", async () => {
  const live = rig();
  live.queue.listed(ROWS);
  const all = openIids(ROWS);

  await answered(live, 0, all.slice(0, 3));
  expect(callAt(live, 1).iids).toEqual(all.slice(3));
  expect(entry(live, all[0] ?? 0)).toEqual(read());
  expect(entry(live, all[3] ?? 0)).toEqual(LOADING);

  await answered(live, 1);
  expect(live.calls).toHaveLength(2);
  expect([...live.queue.discussions.value.values()].every((load) => load.kind === "read")).toBe(
    true,
  );
});

test("one_call_runs_at_a_time", async () => {
  const live = rig("lazy");
  live.queue.askDiscussions(iid(639));
  live.queue.askDiscussions(iid(638));
  live.queue.askDiscussions(iid(636));
  expect(live.calls.map((call) => call.iids)).toEqual([[639]]);

  await answered(live, 0);
  expect(live.calls.map((call) => call.iids)).toEqual([[639], [636, 638]]);
});

test("the_refresh_swap_drops_every_entry_and_asks_again", async () => {
  const live = rig();
  live.queue.listed(ROWS);
  await answered(live, 0);
  expect(entry(live, 639)).toEqual(read());

  const swapped = ROWS.slice(0, 10);
  const before = live.queue.discussions.value;
  live.queue.listed(ROWS);
  expect(live.queue.discussions.value).toBe(before);
  live.queue.replaced(swapped);
  expect([...live.queue.discussions.value.keys()]).toEqual(openIids(swapped));
  expect(entry(live, 639)).toEqual(LOADING);
  expect(callAt(live, 1).iids).toEqual(openIids(swapped));

  live.queue.replaced(ROWS.slice(0, 3));
  await answered(live, 1);
  expect(entry(live, 639)).toEqual(LOADING);
  expect(entry(live, 636)).toBeUndefined();
  expect(callAt(live, 2).iids).toEqual(openIids(ROWS.slice(0, 3)));
});

test("lazy_asks_the_hovered_row_first_and_once", async () => {
  const live = rig("lazy");
  live.queue.listed(ROWS);
  live.queue.askDiscussions(iid(639));
  live.queue.askDiscussions(iid(639));
  expect(live.calls.map((call) => call.iids)).toEqual([[639]]);
  expect(entry(live, 639)).toEqual(LOADING);

  await answered(live, 0);
  live.queue.askDiscussions(iid(639));
  expect(live.calls).toHaveLength(1);
  expect(entry(live, 639)).toEqual(read());

  live.queue.askDiscussions(iid(636));
  live.queue.askDiscussions(iid(635));
  live.queue.askDiscussions(iid(633));
  await answered(live, 1, [iid(636)]);
  expect(callAt(live, 2).iids).toEqual([633, 635]);
});

test("lazy_never_asks_unhovered_rows", async () => {
  const live = rig("lazy");
  live.queue.listed(ROWS);
  live.queue.replaced(ROWS);
  await settled();

  expect(live.calls).toEqual([]);
  expect(live.queue.discussions.value.size).toBe(0);
});

test("an_open_box_asks_again_when_a_refresh_swap_drops_its_entry_and_a_closed_one_waits", async () => {
  const live = rig("lazy");
  const open = shallowRef(false);
  const closed = shallowRef(false);
  const scope = effectScope();
  const boxes = scope.run(() => ({
    shown: useRowDiscussions(
      live.queue,
      () => iid(639),
      () => open.value,
    ),
    other: useRowDiscussions(
      live.queue,
      () => iid(638),
      () => closed.value,
    ),
  }));
  if (boxes === undefined) {
    throw new Error("the scope ran nothing");
  }
  await nextTick();
  expect(live.calls).toEqual([]);

  open.value = true;
  closed.value = true;
  await nextTick();
  await answered(live, 0);
  await answered(live, 1);
  expect([boxes.shown.value, boxes.other.value]).toEqual([read(), read()]);

  closed.value = false;
  await nextTick();
  live.queue.replaced(ROWS);
  await nextTick();
  expect(boxes.shown.value).toEqual(LOADING);
  expect(boxes.other.value).toBeUndefined();
  expect(live.calls.map((call) => call.iids)).toEqual([[639], [638], [639]]);

  await answered(live, 2);
  expect(live.calls).toHaveLength(3);
  closed.value = true;
  await nextTick();
  expect(callAt(live, 3).iids).toEqual([638]);
  scope.stop();
});

test("off_asks_nothing_and_drops_an_answer_in_flight", async () => {
  const live = rig();
  live.rows.value = ROWS;
  live.queue.listed(ROWS);
  live.mode.value = "off";
  await nextTick();
  expect(live.queue.discussions.value.size).toBe(0);
  expect(live.queue.discussionDetails.value).toBe("off");

  await answered(live, 0);
  live.queue.listed(ROWS);
  live.queue.replaced(ROWS);
  live.queue.askDiscussions(iid(639));
  await settled();

  expect(live.queue.discussions.value.size).toBe(0);
  expect(live.calls).toHaveLength(1);
});

test("switching_to_full_asks_what_is_missing_without_a_reload", async () => {
  const live = rig("lazy");
  live.rows.value = ROWS;
  live.queue.askDiscussions(iid(639));
  await answered(live, 0);
  live.queue.askDiscussions(iid(638));
  callAt(live, 1).answer({
    ok: true,
    value: [{ iid: iid(638), answer: { kind: "failed", message: "glab timed out" } }],
  });
  await settled();
  live.queue.askDiscussions(iid(636));
  callAt(live, 2).answer({ ok: false, failure: STOPPED });
  await settled();

  live.mode.value = "full";
  await nextTick();

  const missing = openIids(ROWS).filter((each) => ![639, 638, 636].includes(each));
  expect(callAt(live, 3).iids).toEqual(missing);
  expect(entry(live, 638)?.kind).toBe("refused");
  expect(entry(live, 636)?.kind).toBe("failed");
  expect(live.queue.discussionDetails.value).toBe("full");
});

test("switching_to_lazy_drops_unsent_asks_and_keeps_what_was_read", async () => {
  const live = rig();
  const [first, second, third] = [ROWS.slice(0, 20), ROWS.slice(20, 30), ROWS.slice(30)];
  live.queue.listed(first);
  await answered(live, 0);
  live.queue.listed(second);
  live.queue.listed(third);

  live.mode.value = "lazy";
  await nextTick();

  expect([...live.queue.discussions.value.keys()]).toEqual([
    ...openIids(first),
    ...openIids(second),
  ]);
  const sent = openIids(second);
  expect(entry(live, sent[0] ?? 0)).toEqual(LOADING);
  await answered(live, 1, sent.slice(0, 2));
  expect(live.calls).toHaveLength(2);
  expect(entry(live, sent[0] ?? 0)).toEqual(read());
  expect(entry(live, openIids(first)[0] ?? 0)).toEqual(read());
  expect([...live.queue.discussions.value.keys()]).toEqual([
    ...openIids(first),
    ...sent.slice(0, 2),
  ]);

  live.queue.askDiscussions(sent[2] ?? iid(0));
  expect(callAt(live, 2).iids).toEqual([sent[2]]);
});

test("a_row_hovered_while_the_call_before_lazy_runs_stays_asked", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 20));
  const sent = openIids(ROWS.slice(0, 20));
  const [first, second, third] = sent;
  live.mode.value = "lazy";
  await nextTick();
  live.queue.askDiscussions(second ?? iid(0));
  expect(live.calls).toHaveLength(1);

  await answered(live, 0, [first ?? iid(0)]);
  expect([...live.queue.discussions.value.keys()]).toEqual([first, second]);
  expect(entry(live, second ?? 0)).toEqual(LOADING);
  expect(callAt(live, 1).iids).toEqual([second]);
  expect(entry(live, third ?? 0)).toBeUndefined();
});

test("a_failed_call_before_lazy_drops_its_unhovered_rows", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 20));
  const [first, second] = openIids(ROWS.slice(0, 20));
  live.mode.value = "lazy";
  await nextTick();
  live.queue.askDiscussions(first ?? iid(0));

  callAt(live, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  expect([...live.queue.discussions.value.keys()]).toEqual([first]);
  expect(entry(live, first ?? 0)?.kind).toBe("failed");
  expect(live.calls).toHaveLength(1);
  live.queue.askDiscussions(second ?? iid(0));
  expect(callAt(live, 1).iids).toEqual([second]);
});

test("switching_back_to_full_before_the_call_settles_keeps_its_unanswered_rows_asked", async () => {
  const live = rig();
  live.rows.value = ROWS.slice(0, 20);
  live.queue.listed(live.rows.value);
  const sent = openIids(live.rows.value);
  live.mode.value = "lazy";
  await nextTick();
  live.mode.value = "full";
  await nextTick();

  await answered(live, 0, sent.slice(0, 1));
  expect(callAt(live, 1).iids).toEqual(sent.slice(1));
});

test("switching_to_lazy_after_a_swap_drops_the_new_asks_behind_an_older_call", async () => {
  const live = rig();
  live.rows.value = ROWS.slice(0, 6);
  live.queue.listed(live.rows.value);
  live.queue.replaced(live.rows.value);
  live.mode.value = "lazy";
  await nextTick();
  expect(live.queue.discussions.value.size).toBe(0);

  await answered(live, 0);
  expect(live.calls).toHaveLength(1);
  expect(live.queue.discussions.value.size).toBe(0);

  live.mode.value = "full";
  await nextTick();
  await answered(live, 1);
  live.mode.value = "lazy";
  await nextTick();
  expect(entry(live, 639)).toEqual(read());
});

test("a_refused_answer_is_kept_per_row", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 6));
  const refusals: readonly [number, Exclude<DiscussionsAnswer, { kind: "open" }>][] = [
    [639, { kind: "glabMissing" }],
    [638, { kind: "notLoggedIn", detail: "gitlab.example: no token" }],
    [636, { kind: "failed", message: "glab timed out" }],
  ];
  expect(callAt(live, 0).iids).toEqual([639, 638, 637, 636, 635]);

  callAt(live, 0).answer({
    ok: true,
    value: [
      ...refusals.map(([value, answer]) => ({ iid: iid(value), answer })),
      { iid: iid(637), answer: { kind: "open", discussions: [] } },
      { iid: iid(635), answer: { kind: "open", discussions: [] } },
    ],
  });
  await settled();

  for (const [value, answer] of refusals) {
    expect(entry(live, value)).toEqual({ kind: "refused", answer });
  }
  expect(entry(live, 635)).toEqual({ kind: "read", discussions: [], resolved: new Set() });
  expect(live.calls).toHaveLength(1);
});

test("a_source_failure_is_kept_per_asked_row_not_reported", async () => {
  const warn = vi.spyOn(log, "warn");
  const error = vi.spyOn(log, "error");
  const live = rig();
  live.queue.listed(ROWS.slice(0, 3));
  callAt(live, 0).answer({ ok: false, failure: STOPPED });
  await settled();

  expect(entry(live, 639)).toEqual({ kind: "failed", cause: STOPPED });
  expect(entry(live, 638)).toEqual({ kind: "failed", cause: STOPPED });
  live.queue.listed(ROWS.slice(3, 6));
  callAt(live, 1).fail(new Error("unreadable answer"));
  await settled();

  expect(entry(live, 636)).toEqual({
    kind: "failed",
    cause: { kind: "Unexpected", message: "unreadable answer" },
  });
  expect(live.calls).toHaveLength(2);
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

test("the_log_event_never_carries_text_or_names", async () => {
  const info = vi.spyOn(log, "info");
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(1000)
    .mockReturnValueOnce(1250.4)
    .mockReturnValueOnce(2000)
    .mockReturnValueOnce(2008);
  const live = rig();
  live.queue.listed(ROWS.slice(0, 6));
  callAt(live, 0).answer({
    ok: true,
    value: [
      { iid: iid(639), answer: { kind: "open", discussions: [DISCUSSION] } },
      { iid: iid(638), answer: { kind: "notLoggedIn", detail: "gitlab.example: no token" } },
      { iid: iid(636), answer: { kind: "glabMissing" } },
    ],
  });
  await settled();
  callAt(live, 1).answer({ ok: false, failure: STOPPED });
  await settled();

  expect(info.mock.calls).toEqual([
    ["mergeRequests.discussions_read", { asked: 5, answered: 3, refused: 2, ms: 250 }],
    ["mergeRequests.discussions_read", { asked: 2, failed: "WorkerStopped", ms: 8 }],
  ]);
  const logged = JSON.stringify(info.mock.calls);
  const author = DISCUSSION.last.author;
  for (const secret of [NOTE_TEXT, DISCUSSION.last.page, author?.username, author?.name]) {
    expect(secret).toBeTruthy();
    expect(logged).not.toContain(secret);
  }
  expect(logged).not.toContain("gitlab.example");
});

function both(): SourceResult<readonly RowDiscussions[]> {
  return {
    ok: true,
    value: [{ iid: iid(639), answer: { kind: "open", discussions: [DISCUSSION, OTHER] } }],
  };
}

async function readFirstRows(live: Rig): Promise<void> {
  live.queue.listed(ROWS.slice(0, 3));
  await answered(live, 0);
}

test("a_reload_keeps_the_rows_until_its_answer", async () => {
  const live = rig();
  await readFirstRows(live);
  const before = live.queue.discussions.value;

  live.queue.reloadDiscussions(iid(639));
  expect(live.queue.discussions.value).toBe(before);
  expect(entry(live, 639)).toEqual(read());
  expect(live.queue.reloads.value.get(iid(639))).toEqual(RUNNING);
  expect(callAt(live, 1).iids).toEqual([639]);

  callAt(live, 1).answer(both());
  await settled();
  expect(entry(live, 639)).toEqual({
    kind: "read",
    discussions: [DISCUSSION, OTHER],
    resolved: new Set(),
  });
  expect(live.queue.reloads.value.size).toBe(0);
  expect(live.calls).toHaveLength(2);
});

test("a_reload_sets_the_rows_count", async () => {
  const info = vi.spyOn(log, "info");
  const live = rig();
  await readFirstRows(live);
  expect(live.counts).toEqual([]);

  live.queue.reloadDiscussions(iid(639));
  callAt(live, 1).answer(both());
  await settled();
  expect(live.counts).toEqual([[639, 2]]);
  expect(info).toHaveBeenCalledWith("mergeRequests.discussions_reloaded", {
    iid: 639,
    kind: "open",
    ms: expect.any(Number),
  });
  const reloaded = info.mock.calls.filter(
    ([event]) => event === "mergeRequests.discussions_reloaded",
  );
  expect(reloaded).toHaveLength(1);
  expect(JSON.stringify(info.mock.calls)).not.toContain(NOTE_TEXT);
});

test("a_failed_reload_keeps_the_rows_and_says_why", async () => {
  const info = vi.spyOn(log, "info");
  const live = rig();
  await readFirstRows(live);
  const refused = { kind: "notLoggedIn", detail: "gitlab.example: no token" } as const;

  live.queue.reloadDiscussions(iid(639));
  callAt(live, 1).answer({ ok: true, value: [{ iid: iid(639), answer: refused }] });
  await settled();
  expect(entry(live, 639)).toEqual(read());
  expect(live.queue.reloads.value.get(iid(639))).toEqual({ kind: "refused", answer: refused });

  live.queue.reloadDiscussions(iid(639));
  expect(live.queue.reloads.value.get(iid(639))).toEqual(RUNNING);
  callAt(live, 2).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(entry(live, 639)).toEqual(read());
  expect(live.queue.reloads.value.get(iid(639))).toEqual({ kind: "failed", cause: STOPPED });
  expect(live.counts).toEqual([]);
  expect(live.calls).toHaveLength(3);
  const kinds = info.mock.calls
    .filter(([event]) => event === "mergeRequests.discussions_reloaded")
    .map(([, fields]) => fields?.["kind"]);
  expect(kinds).toEqual(["notLoggedIn", "WorkerStopped"]);
  expect(JSON.stringify(info.mock.calls)).not.toContain("gitlab.example");
});

test("a_reload_goes_first_and_once", async () => {
  const live = rig("lazy");
  live.queue.askDiscussions(iid(639));
  await answered(live, 0);
  live.queue.askDiscussions(iid(638));
  live.queue.askDiscussions(iid(636));
  live.queue.askDiscussions(iid(635));

  live.queue.reloadDiscussions(iid(639));
  live.queue.reloadDiscussions(iid(639));
  expect(live.calls).toHaveLength(2);
  await answered(live, 1);
  expect(callAt(live, 2).iids).toEqual([639, 635, 636]);

  await answered(live, 2, [iid(639)]);
  expect(callAt(live, 3).iids).toEqual([635, 636]);
});

test("a_reload_answered_in_part_stays_asked_until_its_answer", async () => {
  const live = rig("lazy");
  live.queue.askDiscussions(iid(639));
  await answered(live, 0);
  live.queue.askDiscussions(iid(638));
  live.queue.reloadDiscussions(iid(639));

  await answered(live, 1);
  await answered(live, 2, []);
  expect(live.queue.reloads.value.get(iid(639))).toEqual(RUNNING);
  expect(callAt(live, 3).iids).toEqual([639]);
});

test("a_reload_without_an_entry_asks_like_a_hover_and_off_asks_nothing", async () => {
  const live = rig();
  live.queue.reloadDiscussions(iid(640));
  expect(entry(live, 640)).toEqual(LOADING);
  expect(live.queue.reloads.value.size).toBe(0);
  await answered(live, 0);
  expect(entry(live, 640)).toEqual(read());
  expect(live.counts).toEqual([]);

  live.queue.listed(ROWS.slice(0, 3));
  live.queue.reloadDiscussions(iid(639));
  expect(live.queue.reloads.value.size).toBe(0);
  expect(callAt(live, 1).iids).toEqual(openIids(ROWS.slice(0, 3)).filter((each) => each !== 640));
  expect(callAt(live, 1).iids[0]).toBe(639);

  live.mode.value = "off";
  await nextTick();
  live.queue.reloadDiscussions(iid(639));
  expect(live.queue.discussions.value.size).toBe(0);
  expect(live.queue.reloads.value.size).toBe(0);
  await answered(live, 1);
  expect(live.calls).toHaveLength(2);
});

test("a_reload_of_a_row_sent_before_lazy_keeps_it_asked", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 3));
  live.mode.value = "lazy";
  await nextTick();
  live.queue.reloadDiscussions(iid(638));
  await answered(live, 0, [iid(639)]);
  expect(entry(live, 638)).toEqual(LOADING);
  expect(callAt(live, 1).iids).toEqual([638]);
});

test("switching_to_lazy_keeps_a_waiting_reload", async () => {
  const live = rig();
  await readFirstRows(live);
  live.queue.listed(ROWS.slice(3, 6));
  live.queue.reloadDiscussions(iid(639));
  live.mode.value = "lazy";
  await nextTick();

  expect(entry(live, 639)).toEqual(read());
  await answered(live, 1);
  expect(callAt(live, 2).iids).toEqual([639]);
  callAt(live, 2).answer(both());
  await settled();
  expect(live.counts).toEqual([[639, 2]]);
});

test("a_reload_in_flight_while_switching_to_lazy_keeps_the_rows", async () => {
  const live = rig();
  await readFirstRows(live);
  live.queue.reloadDiscussions(iid(639));
  live.mode.value = "lazy";
  await nextTick();

  callAt(live, 1).answer({ ok: true, value: [] });
  await settled();
  expect(entry(live, 639)).toEqual(read());
  expect(live.queue.reloads.value.get(iid(639))).toEqual(RUNNING);
});

test("a_reload_after_a_refresh_is_dropped", async () => {
  const live = rig();
  await readFirstRows(live);
  live.queue.reloadDiscussions(iid(639));
  live.queue.replaced(ROWS.slice(0, 3));
  expect(live.queue.reloads.value.size).toBe(0);

  callAt(live, 1).answer(both());
  await settled();
  expect(entry(live, 639)).toEqual(LOADING);
  expect(live.counts).toEqual([]);
  expect(callAt(live, 2).iids).toEqual(openIids(ROWS.slice(0, 3)));
});

test("a_resolved_row_stays_until_the_box_closes_then_the_count_drops", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 3));
  callAt(live, 0).answer(both());
  await settled();

  live.queue.threadRead(iid(639), DISCUSSION, true);
  expect(entry(live, 639)).toEqual({
    kind: "read",
    discussions: [DISCUSSION, OTHER],
    resolved: new Set([DISCUSSION.id]),
  });
  expect(live.counts).toEqual([]);

  live.queue.boxClosed(iid(639));
  expect(entry(live, 639)).toEqual({ kind: "read", discussions: [OTHER], resolved: new Set() });
  expect(live.counts).toEqual([[639, 1]]);
});

test("an_unresolved_row_loses_its_mark", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 3));
  callAt(live, 0).answer(both());
  await settled();
  live.queue.threadRead(iid(639), DISCUSSION, true);
  live.queue.threadRead(iid(639), OTHER, true);

  live.queue.threadRead(iid(639), DISCUSSION, false);
  expect(entry(live, 639)).toEqual({
    kind: "read",
    discussions: [DISCUSSION, OTHER],
    resolved: new Set([OTHER.id]),
  });
});

test("a_thread_answer_replaces_its_discussion_in_the_box", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 3));
  callAt(live, 0).answer({
    ok: true,
    value: [{ iid: iid(639), answer: { kind: "open", discussions: [DISCUSSION, OTHER] } }],
  });
  await settled();
  const answeredLater = { ...OTHER, last: { ...OTHER.last, createdAt: 1 } };

  live.queue.threadRead(iid(639), answeredLater, false);
  expect(entry(live, 639)).toEqual({
    kind: "read",
    discussions: [DISCUSSION, answeredLater],
    resolved: new Set(),
  });

  const before = live.queue.discussions.value;
  live.queue.threadRead(
    iid(639),
    { ...answeredLater, id: DISCUSSION.id, place: OTHER.place },
    false,
  );
  expect(entry(live, 639)).toEqual({
    kind: "read",
    discussions: [{ ...answeredLater, id: DISCUSSION.id }, answeredLater],
    resolved: new Set(),
  });
  expect(live.queue.discussions.value).not.toBe(before);
});

test("a_thread_answer_for_no_such_row_or_discussion_changes_nothing", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 3));
  await settled();
  const loading = live.queue.discussions.value;
  live.queue.threadRead(iid(639), DISCUSSION, true);
  live.queue.threadRead(iid(640), DISCUSSION, true);
  expect(live.queue.discussions.value).toBe(loading);

  await answered(live, 0);
  const afterRead = live.queue.discussions.value;
  live.queue.threadRead(iid(639), OTHER, true);
  expect(live.queue.discussions.value).toBe(afterRead);
  live.queue.boxClosed(iid(639));
  expect(live.counts).toEqual([]);
});

test("closing_a_box_without_marks_changes_nothing", async () => {
  const live = rig();
  live.queue.listed(ROWS.slice(0, 3));
  live.queue.boxClosed(iid(639));
  await answered(live, 0);
  const before = live.queue.discussions.value;

  live.queue.boxClosed(iid(639));
  live.queue.boxClosed(iid(640));
  expect(live.queue.discussions.value).toBe(before);
  expect(live.counts).toEqual([]);
});
