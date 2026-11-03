import type { StorageLike } from "@vueuse/core";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

import {
  createFixtureCompareSource,
  log,
  type JobLogReply,
  type MergeRequestSource,
  type SourceFailure,
  type SourceResult,
  type WebPage,
} from "../ipc";
import type * as MergeRequestsCore from "../mergeRequests";
import { jobLogView } from "../mergeRequests";
import {
  createJobLogs,
  type JobLogLoad,
  type JobLogs,
  type LoggedJob,
  type ShownJobLog,
} from "./mergeRequestJobLogs";

vi.mock("../mergeRequests", async (original) => {
  const real = await original<typeof MergeRequestsCore>();
  return { ...real, jobLogView: vi.fn(real.jobLogView) };
});

type Ask = {
  readonly page: WebPage;
  readonly answer: (result: SourceResult<JobLogReply>) => void;
  readonly fail: (error: unknown) => void;
};

type MemoryStorage = StorageLike & { readonly items: Map<string, string> };

type Rig = { readonly logs: JobLogs; readonly asks: Ask[]; readonly storage: MemoryStorage };

const KEY = "yamt.mergeRequests.jobSearches";
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const RAW = "\u001b[31mError\u001b[0m: lint failed\r\nsecond error line\n";
const LOADING: JobLogLoad = { kind: "loading" };

let LINT: LoggedJob;
let UNIT: LoggedJob;

beforeAll(async () => {
  const jobs: LoggedJob[] = [];
  await createFixtureCompareSource(log, "?mr=list", {}).listMergeRequests(
    (page) => {
      for (const job of page.rows.flatMap((row) => row.pipeline?.failedJobs ?? [])) {
        if (job.page !== null) {
          jobs.push({ name: job.name, page: job.page });
        }
      }
    },
    () => undefined,
  );
  const [lint, unit] = jobs;
  if (lint === undefined || unit === undefined) {
    throw new Error("the fixture lists no two job pages");
  }
  LINT = lint;
  UNIT = unit;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(jobLogView).mockClear();
});

function memoryStorage(stored?: string): MemoryStorage {
  const items = new Map<string, string>(stored === undefined ? [] : [[KEY, stored]]);
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

function rig(storage = memoryStorage()): Rig {
  const asks: Ask[] = [];
  const source: MergeRequestSource = {
    ...createFixtureCompareSource(log, "", {}),
    readJobLog: (page) =>
      new Promise((resolve, reject) => {
        asks.push({ page, answer: resolve, fail: reject });
      }),
  };
  return { logs: createJobLogs({ source, storage }), asks, storage };
}

function askAt(live: Rig, index: number): Ask {
  const ask = live.asks[index];
  if (ask === undefined) {
    throw new Error(`no ask ${index}; ${live.asks.length} made`);
  }
  return ask;
}

function logReply(text: string, cut: boolean): SourceResult<JobLogReply> {
  return { ok: true, value: { kind: "log", log: { text, cut } } };
}

function shownOf(live: Rig): ShownJobLog | null {
  return live.logs.jobLog.value;
}

test("a_job_shows_loading_then_its_parsed_log", async () => {
  const live = rig();
  expect(shownOf(live)).toBeNull();
  const showing = live.logs.showJobLog(LINT);
  expect(shownOf(live)).toEqual({ job: LINT, load: LOADING });
  expect(live.asks.map((ask) => ask.page)).toEqual([LINT.page]);

  askAt(live, 0).answer(logReply(RAW, true));
  await showing;
  expect(shownOf(live)).toEqual({
    job: LINT,
    load: { kind: "shown", view: jobLogView(RAW), cut: true },
  });
});

test("a_reply_for_a_job_no_longer_shown_is_dropped", async () => {
  const live = rig();
  const first = live.logs.showJobLog(LINT);
  const second = live.logs.showJobLog(UNIT);
  expect(live.asks.map((ask) => ask.page)).toEqual([LINT.page, UNIT.page]);

  askAt(live, 0).answer(logReply(RAW, false));
  await first;
  expect(shownOf(live)).toEqual({ job: UNIT, load: LOADING });
  expect(jobLogView).not.toHaveBeenCalled();

  askAt(live, 1).answer(logReply("unit", false));
  await second;
  expect(shownOf(live)).toEqual({
    job: UNIT,
    load: { kind: "shown", view: jobLogView("unit"), cut: false },
  });
});

test("a_reply_after_close_is_dropped", async () => {
  const live = rig();
  const info = vi.spyOn(log, "info");
  const showing = live.logs.showJobLog(LINT);
  live.logs.closeJobLog();
  expect(shownOf(live)).toBeNull();

  askAt(live, 0).answer(logReply(RAW, false));
  await showing;
  expect(shownOf(live)).toBeNull();
  expect(info).not.toHaveBeenCalled();
});

test("a_reply_for_a_closed_box_is_dropped_after_the_same_job_reopens", async () => {
  const live = rig();
  const info = vi.spyOn(log, "info");
  const first = live.logs.showJobLog(LINT);
  live.logs.closeJobLog();
  const second = live.logs.showJobLog(LINT);
  expect(live.asks.map((ask) => ask.page)).toEqual([LINT.page, LINT.page]);

  askAt(live, 0).answer(logReply(RAW, false));
  await first;
  expect(shownOf(live)).toEqual({ job: LINT, load: LOADING });
  expect(info).not.toHaveBeenCalled();

  askAt(live, 1).answer(logReply(RAW, true));
  await second;
  expect(shownOf(live)).toEqual({
    job: LINT,
    load: { kind: "shown", view: jobLogView(RAW), cut: true },
  });
});

test("the_same_job_while_loading_or_shown_asks_nothing", async () => {
  const live = rig();
  const showing = live.logs.showJobLog(LINT);
  const loading = shownOf(live);
  await live.logs.showJobLog({ ...LINT });
  expect(live.asks).toHaveLength(1);
  expect(shownOf(live)).toBe(loading);

  askAt(live, 0).answer(logReply(RAW, false));
  await showing;
  const shown = shownOf(live);
  await live.logs.showJobLog(LINT);
  expect(live.asks).toHaveLength(1);
  expect(shownOf(live)).toBe(shown);

  void live.logs.showJobLog(UNIT);
  expect(live.asks).toHaveLength(2);
});

test("a_refused_or_failed_job_is_asked_again", async () => {
  const live = rig();
  const refused = live.logs.showJobLog(LINT);
  askAt(live, 0).answer({ ok: true, value: { kind: "noLog" } });
  await refused;
  expect(shownOf(live)?.load.kind).toBe("refused");

  const failed = live.logs.showJobLog(LINT);
  expect(live.asks).toHaveLength(2);
  expect(shownOf(live)).toEqual({ job: LINT, load: LOADING });
  askAt(live, 1).answer({ ok: false, failure: STOPPED });
  await failed;
  expect(shownOf(live)?.load.kind).toBe("failed");

  void live.logs.showJobLog(LINT);
  expect(live.asks.map((ask) => ask.page)).toEqual([LINT.page, LINT.page, LINT.page]);
  expect(shownOf(live)).toEqual({ job: LINT, load: LOADING });
});

test.each<Exclude<JobLogReply, { readonly kind: "log" }>>([
  { kind: "notOffered" },
  { kind: "noLog" },
  { kind: "glabMissing" },
  { kind: "notLoggedIn", detail: "gitlab.example: No token found" },
  { kind: "failed", message: "glab timed out" },
])("every_reply_but_a_log_is_kept_as_refused: %j", async (reply) => {
  const live = rig();
  const showing = live.logs.showJobLog(UNIT);
  askAt(live, 0).answer({ ok: true, value: reply });
  await showing;
  expect(shownOf(live)).toEqual({ job: UNIT, load: { kind: "refused", reply } });
});

test("a_source_failure_is_shown_not_reported", async () => {
  const live = rig();
  const warn = vi.spyOn(log, "warn");
  const error = vi.spyOn(log, "error");
  const failing = live.logs.showJobLog(LINT);
  askAt(live, 0).answer({ ok: false, failure: STOPPED });
  await failing;
  expect(shownOf(live)).toEqual({ job: LINT, load: { kind: "failed", cause: STOPPED } });

  const throwing = live.logs.showJobLog(LINT);
  askAt(live, 1).fail(new Error("ipc gone"));
  await throwing;
  expect(shownOf(live)).toEqual({
    job: LINT,
    load: { kind: "failed", cause: { kind: "Unexpected", message: "ipc gone" } },
  });
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

test("the_log_is_parsed_once_per_ask", async () => {
  const live = rig();
  const showing = live.logs.showJobLog(LINT);
  askAt(live, 0).answer(logReply(RAW, false));
  await showing;
  const first = shownOf(live);
  const view = first?.load.kind === "shown" ? first.load.view : null;
  expect(view).not.toBeNull();
  await live.logs.showJobLog(LINT);
  const again = shownOf(live);
  expect(again?.load.kind === "shown" ? again.load.view : null).toBe(view);
  expect(jobLogView).toHaveBeenCalledTimes(1);
  expect(jobLogView).toHaveBeenCalledWith(RAW);
});

test("a_search_text_is_remembered_per_job_name_for_every_repository", () => {
  const storage = memoryStorage();
  const first = rig(storage);
  expect(first.logs.jobSearch("test:unit")).toBe("");
  first.logs.setJobSearch("test:unit", "fail");
  expect(first.logs.jobSearch("test:unit")).toBe("fail");
  expect(first.logs.jobSearch("lint:docs")).toBe("");

  const second = rig(storage);
  expect(second.logs.jobSearch("test:unit")).toBe("fail");
  expect(JSON.parse(storage.items.get(KEY) ?? "null")).toEqual({ "test:unit": "fail" });
});

test("an_empty_search_text_forgets_the_name", () => {
  const live = rig();
  live.logs.setJobSearch("test:unit", "fail");
  live.logs.setJobSearch("lint:docs", "MD013");
  live.logs.setJobSearch("test:unit", "");
  expect(live.logs.jobSearch("test:unit")).toBe("");
  expect(live.logs.jobSearch("lint:docs")).toBe("MD013");
  expect(JSON.parse(live.storage.items.get(KEY) ?? "null")).toEqual({ "lint:docs": "MD013" });
});

test("a_stored_non_string_reads_as_empty", () => {
  const live = rig(
    memoryStorage(JSON.stringify({ "test:unit": 3, "lint:docs": "warn", e2e: null })),
  );
  expect(live.logs.jobSearch("test:unit")).toBe("");
  expect(live.logs.jobSearch("e2e")).toBe("");
  expect(live.logs.jobSearch("lint:docs")).toBe("warn");
});

test("the_log_event_never_carries_the_text", async () => {
  const live = rig();
  const info = vi.spyOn(log, "info");
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(1000)
    .mockReturnValueOnce(1250.4)
    .mockReturnValueOnce(2000)
    .mockReturnValueOnce(2007.6);
  const shown = live.logs.showJobLog(LINT);
  askAt(live, 0).answer(logReply(RAW, true));
  await shown;
  const refused = live.logs.showJobLog(UNIT);
  askAt(live, 1).answer({ ok: true, value: { kind: "failed", message: "glab timed out" } });
  await refused;

  expect(info.mock.calls).toEqual([
    [
      "mergeRequests.job_log_shown",
      { page: LINT.page, kind: "shown", lines: 2, cut: true, ms: 250 },
    ],
    ["mergeRequests.job_log_shown", { page: UNIT.page, kind: "refused", ms: 8 }],
  ]);
  expect(JSON.stringify(info.mock.calls)).not.toContain("lint failed");
});
