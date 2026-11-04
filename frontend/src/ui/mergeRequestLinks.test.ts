import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type DescriptionLinks,
  type LinksReply,
  type MergeRequestIid,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import {
  createLinks,
  linksOf,
  useRowLinks,
  type LinkQueue,
  type LinksLoad,
} from "./mergeRequestLinks";

type Call = {
  readonly iid: MergeRequestIid;
  readonly answer: (result: SourceResult<LinksReply>) => void;
  readonly fail: (error: unknown) => void;
};

type Rig = { readonly queue: LinkQueue; readonly calls: Call[] };

type Box = {
  readonly open: ShallowRef<boolean>;
  readonly load: ComputedRef<LinksLoad | undefined>;
  readonly stop: () => void;
};

const MICROTASKS = 10;
const FIXTURE_PAUSE_MS = 400;
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const LOADING: LinksLoad = { kind: "loading" };
const NONE: DescriptionLinks = { epics: [], issues: [], commits: [] };

let RICH: DescriptionLinks = NONE;

beforeAll(async () => {
  vi.useFakeTimers();
  const answer = createFixtureCompareSource(log, "", {}).readLinks(iid(640));
  await vi.advanceTimersByTimeAsync(FIXTURE_PAUSE_MS);
  const result = await answer;
  vi.useRealTimers();
  if (!result.ok || result.value.kind !== "read") {
    throw new Error("the fixture's !640 did not read");
  }
  RICH = result.value.links;
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

function rig(): Rig {
  const calls: Call[] = [];
  const source = {
    ...createFixtureCompareSource(log, "", {}),
    readLinks: (asked: MergeRequestIid) =>
      new Promise<SourceResult<LinksReply>>((resolve, reject) => {
        calls.push({ iid: asked, answer: resolve, fail: reject });
      }),
  };
  return { queue: createLinks({ source }), calls };
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

async function answered(live: Rig, index: number, links: DescriptionLinks = RICH): Promise<void> {
  callAt(live, index).answer({ ok: true, value: { kind: "read", links } });
  await settled();
}

function entry(live: Rig, value: number): LinksLoad | undefined {
  return live.queue.links.value.get(iid(value));
}

function asked(live: Rig): number[] {
  return live.calls.map((call) => call.iid);
}

function box(live: Rig, value: number): Box {
  const open = shallowRef(false);
  const scope = effectScope();
  const load = scope.run(() =>
    useRowLinks(
      linksOf(live.queue),
      () => iid(value),
      () => open.value,
    ),
  );
  if (load === undefined) {
    throw new Error("the scope ran nothing");
  }
  return { open, load, stop: () => scope.stop() };
}

test("only_a_hovered_row_is_asked", async () => {
  const live = rig();
  const closed = box(live, 640);
  await nextTick();
  await settled();
  expect(live.calls).toEqual([]);
  expect(live.queue.links.value.size).toBe(0);
  expect(closed.load.value).toBeUndefined();

  live.queue.askLinks(iid(639));
  await settled();
  expect(asked(live)).toEqual([639]);
  expect(entry(live, 640)).toBeUndefined();
  closed.stop();
});

test("a_box_opening_asks_and_shows_loading_then_the_answer", async () => {
  const live = rig();
  const shown = box(live, 640);
  shown.open.value = true;
  await nextTick();
  expect(asked(live)).toEqual([640]);
  expect(shown.load.value).toEqual(LOADING);

  await answered(live, 0);
  expect(shown.load.value).toEqual({ kind: "read", links: RICH });
  shown.stop();
});

test("a_read_or_loading_row_is_never_asked_again", async () => {
  const live = rig();
  const shown = box(live, 640);
  shown.open.value = true;
  await nextTick();
  shown.open.value = false;
  await nextTick();
  shown.open.value = true;
  await nextTick();
  live.queue.askLinks(iid(640));
  expect(asked(live)).toEqual([640]);

  await answered(live, 0);
  shown.open.value = false;
  await nextTick();
  shown.open.value = true;
  await nextTick();
  live.queue.askLinks(iid(640));
  await settled();
  expect(asked(live)).toEqual([640]);
  expect(entry(live, 640)).toEqual({ kind: "read", links: RICH });
  shown.stop();
});

test("asks_run_one_at_a_time_newest_first", async () => {
  const live = rig();
  live.queue.askLinks(iid(640));
  live.queue.askLinks(iid(639));
  live.queue.askLinks(iid(637));
  await settled();
  expect(asked(live)).toEqual([640]);
  expect([entry(live, 639), entry(live, 637)]).toEqual([LOADING, LOADING]);

  await answered(live, 0);
  expect(asked(live)).toEqual([640, 637]);
  await answered(live, 1, NONE);
  expect(asked(live)).toEqual([640, 637, 639]);
  await answered(live, 2, NONE);
  expect(live.calls).toHaveLength(3);
  expect(entry(live, 637)).toEqual({ kind: "read", links: NONE });
});

test("a_failure_is_asked_again_at_the_next_open", async () => {
  const live = rig();
  const failing = box(live, 636);
  failing.open.value = true;
  await nextTick();
  callAt(live, 0).answer({ ok: false, failure: STOPPED });
  await settled();
  expect(failing.load.value).toEqual({ kind: "failed", cause: STOPPED });

  failing.open.value = false;
  await nextTick();
  failing.open.value = true;
  await nextTick();
  expect(asked(live)).toEqual([636, 636]);
  expect(failing.load.value).toEqual(LOADING);
  callAt(live, 1).answer({ ok: true, value: { kind: "glabMissing" } });
  await settled();
  expect(failing.load.value).toEqual({ kind: "refused", reply: { kind: "glabMissing" } });

  live.queue.askLinks(iid(636));
  expect(asked(live)).toEqual([636, 636, 636]);
  await answered(live, 2);
  expect(failing.load.value).toEqual({ kind: "read", links: RICH });
  failing.stop();
});

test("an_answer_after_a_refresh_is_dropped", async () => {
  const live = rig();
  live.queue.askLinks(iid(640));
  live.queue.askLinks(iid(639));
  live.queue.dropped();
  expect(live.queue.links.value.size).toBe(0);

  await answered(live, 0);
  expect(live.queue.links.value.size).toBe(0);
  expect(asked(live)).toEqual([640]);

  live.queue.askLinks(iid(637));
  await settled();
  expect(asked(live)).toEqual([640, 637]);
});

test("an_ask_after_a_refresh_waits_for_the_call_in_flight", async () => {
  const live = rig();
  live.queue.askLinks(iid(640));
  live.queue.dropped();
  live.queue.askLinks(iid(640));
  await settled();
  expect(asked(live)).toEqual([640]);
  expect(entry(live, 640)).toEqual(LOADING);

  await answered(live, 0, NONE);
  expect(entry(live, 640)).toEqual(LOADING);
  expect(asked(live)).toEqual([640, 640]);
  await answered(live, 1);
  expect(entry(live, 640)).toEqual({ kind: "read", links: RICH });
});

test("a_box_left_open_across_a_refresh_asks_again", async () => {
  const live = rig();
  const shown = box(live, 640);
  const other = box(live, 639);
  shown.open.value = true;
  other.open.value = true;
  await nextTick();
  await answered(live, 0);
  await answered(live, 1);
  other.open.value = false;
  await nextTick();

  live.queue.dropped();
  await nextTick();
  expect(asked(live)).toEqual([640, 639, 640]);
  expect(shown.load.value).toEqual(LOADING);
  expect(other.load.value).toBeUndefined();
  shown.stop();
  other.stop();
});

test("a_refusal_is_refused_and_a_thrown_call_is_failed_with_its_cause", async () => {
  const live = rig();
  live.queue.askLinks(iid(634));
  const notLoggedIn: LinksReply = { kind: "notLoggedIn", detail: "gitlab.example: no token" };
  callAt(live, 0).answer({ ok: true, value: notLoggedIn });
  await settled();
  expect(entry(live, 634)).toEqual({ kind: "refused", reply: notLoggedIn });

  live.queue.askLinks(iid(636));
  callAt(live, 1).fail(new Error("link.page must be an http or https address"));
  await settled();
  expect(entry(live, 636)).toEqual({
    kind: "failed",
    cause: { kind: "Unexpected", message: "link.page must be an http or https address" },
  });
});

test("the_log_line_names_the_kind_and_counts_never_text", async () => {
  const live = rig();
  const info = vi.spyOn(log, "info");
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(1000)
    .mockReturnValueOnce(1250.4)
    .mockReturnValueOnce(2000)
    .mockReturnValueOnce(2008)
    .mockReturnValueOnce(3000)
    .mockReturnValueOnce(3001);
  live.queue.askLinks(iid(640));
  await answered(live, 0);
  live.queue.askLinks(iid(634));
  callAt(live, 1).answer({ ok: true, value: { kind: "failed", message: "glab timed out" } });
  await settled();
  live.queue.askLinks(iid(636));
  callAt(live, 2).fail(new Error("unreadable"));
  await settled();

  expect(info.mock.calls).toEqual([
    [
      "mergeRequests.links_read",
      { iid: 640, kind: "read", epics: 3, issues: 4, commits: 3, hidden: 3, ms: 250 },
    ],
    [
      "mergeRequests.links_read",
      { iid: 634, kind: "failed", epics: 0, issues: 0, commits: 0, hidden: 0, ms: 8 },
    ],
    [
      "mergeRequests.links_read",
      { iid: 636, kind: "thrown", epics: 0, issues: 0, commits: 0, hidden: 0, ms: 1 },
    ],
  ]);
  const logged = JSON.stringify(info.mock.calls);
  for (const line of [...RICH.epics, ...RICH.issues, ...RICH.commits]) {
    expect(logged).not.toContain(line.reference);
  }
  for (const secret of ["Board redesign", "Backfill due dates", "gitlab.example", "timed out"]) {
    expect(logged).not.toContain(secret);
  }
});
