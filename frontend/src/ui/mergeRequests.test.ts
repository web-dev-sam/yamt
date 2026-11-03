import type { StorageLike } from "@vueuse/core";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type CheckedRow,
  type ContinueMergeReply,
  type ListEnd,
  type LocalMerge,
  type MergeRequestIid,
  type MergeRequestPage,
  type MergeRequestRow,
  type MergeRequestSource,
  type OpenReply,
  type PageOpened,
  type RerequestReply,
  type ResolveReply,
  type Reviewer,
  type SourceFailure,
  type SourceResult,
  type WebPage,
} from "../ipc";
import { RECHECK_PAUSE_MS } from "./glab";
import type { RowActing } from "./mergeRequestActions";
import {
  createMergeRequests,
  type ListLoad,
  type MergeRequests,
  type Opening,
} from "./mergeRequests";
import { registerMergeRequests, useMergeRequests, windowMergeRequests } from "./mergeRequestsStore";
import type { PageKind } from "./mergeRequestsText";
import type { MergeRequestStep, Problem } from "./problem";
import type { Screen } from "./screen";

type Load = {
  readonly send: (page: MergeRequestPage) => void;
  readonly check: (row: CheckedRow) => void;
  readonly end: (result: SourceResult<ListEnd>) => void;
};

type Open = {
  readonly iid: MergeRequestIid;
  readonly answer: (result: SourceResult<OpenReply>) => void;
};

type Asked<T> = {
  readonly iid: MergeRequestIid;
  readonly answer: (result: SourceResult<T>) => void;
};

type Rig = {
  readonly slice: MergeRequests;
  readonly screen: ShallowRef<Screen>;
  readonly problems: Problem[];
  readonly loads: Load[];
  readonly opens: Open[];
  readonly resolves: Asked<ResolveReply>[];
  readonly continues: Asked<ContinueMergeReply>[];
  readonly localMerges: LocalMerge[];
  readonly rerequests: Asked<RerequestReply>[];
  readonly storage: MemoryStorage;
};

type MemoryStorage = StorageLike & { readonly items: Map<string, string> };

type Edit = Partial<MergeRequestSource>;

const T0 = 1_767_225_600_000;
const MICROTASKS = 10;
const REPOSITORY = "/home/sam/taskboard/.git";
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const FREE: LocalMerge = { kind: "free" };
const LOADED: SourceResult<ListEnd> = { ok: true, value: { kind: "loaded" } };
const JOB = "https://gitlab.example/taskboard/taskboard/-/jobs/9001";
const MR = "https://gitlab.example/taskboard/taskboard/-/merge_requests/639";

let ROWS: readonly MergeRequestRow[] = [];

beforeAll(async () => {
  const rows: MergeRequestRow[] = [];
  await createFixtureCompareSource(log, "?mr=list", {}).listMergeRequests(
    (page) => {
      rows.push(...page.rows);
    },
    () => undefined,
  );
  ROWS = rows;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function memoryStorage(): MemoryStorage {
  const items = new Map<string, string>();
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

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function webPage(address: string): WebPage {
  const page = [
    ...ROWS.map((row) => row.page),
    ...ROWS.flatMap((row) => row.pipeline?.failedJobs ?? []).map((job) => job.page),
  ].find((offered) => offered === address);
  if (page === undefined || page === null) {
    throw new Error(`the fixture offers no page ${address}`);
  }
  return page;
}

async function settled(): Promise<void> {
  for (let turn = 0; turn < MICROTASKS; turn += 1) {
    await Promise.resolve();
  }
}

function rig(edit: Edit = {}, storage = memoryStorage()): Rig {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  const loads: Load[] = [];
  const opens: Open[] = [];
  const resolves: Asked<ResolveReply>[] = [];
  const continues: Asked<ContinueMergeReply>[] = [];
  const localMerges: LocalMerge[] = [];
  const rerequests: Asked<RerequestReply>[] = [];
  const problems: Problem[] = [];
  const source: MergeRequestSource = {
    findGitLabProject: async () => ({ ok: true, value: { kind: "found", repository: REPOSITORY } }),
    listMergeRequests: (onPage, onChecked) =>
      new Promise((resolve) => {
        loads.push({ send: onPage, check: onChecked, end: resolve });
      }),
    openMergeRequest: (asked) =>
      new Promise((resolve) => {
        opens.push({ iid: asked, answer: resolve });
      }),
    openPage: async () => ({ ok: true, value: { kind: "opened" } }),
    resolveMergeRequest: (asked) =>
      new Promise((resolve) => {
        resolves.push({ iid: asked, answer: resolve });
      }),
    continueMergeRequest: (asked) =>
      new Promise((resolve) => {
        continues.push({ iid: asked, answer: resolve });
      }),
    findLocalMerge: async () => {
      const found = localMerges.shift() ?? FREE;
      return { ok: true, value: found };
    },
    rerequestReview: (asked) =>
      new Promise((resolve) => {
        rerequests.push({ iid: asked, answer: resolve });
      }),
    readJobLog: async () => ({ ok: true, value: { kind: "noLog" } }),
    ...edit,
  };
  const screen = shallowRef<Screen>({ kind: "files" });
  const slice = createMergeRequests({
    source,
    screen,
    report: (problem) => problems.push(problem),
    storage,
  });
  return {
    slice,
    screen,
    problems,
    loads,
    opens,
    resolves,
    continues,
    localMerges,
    rerequests,
    storage,
  };
}

function loadAt(live: Rig, index: number): Load {
  const load = live.loads[index];
  if (load === undefined) {
    throw new Error(`no load ${index}; ${live.loads.length} started`);
  }
  return load;
}

async function loaded(live: Rig, rows: readonly MergeRequestRow[] = ROWS): Promise<void> {
  live.slice.show();
  const load = loadAt(live, live.loads.length - 1);
  load.send({ me: "sam", rows });
  load.end(LOADED);
  await settled();
}

function iids(rows: readonly MergeRequestRow[]): number[] {
  return rows.map((row) => row.iid);
}

const CLEAN: CheckedRow["readiness"] = { kind: "mergesCleanly" };

function checkedRow(value: number, readiness: CheckedRow["readiness"] = CLEAN): CheckedRow {
  return { iid: iid(value), readiness };
}

function readinessOf(live: Rig, value: number): MergeRequestRow["readiness"] | undefined {
  return live.slice.rows.value.find((row) => row.iid === value)?.readiness;
}

test("the seam refuses use before a slice is registered", () => {
  expect(() => useMergeRequests()).toThrow(
    "useMergeRequests() called before registerMergeRequests()",
  );
});

test("findProject shows the GitLab project; a failed call is reported and leaves none (catches an IPC failure not reported)", async () => {
  const found = rig();
  expect(found.slice.project.value).toEqual({ kind: "none" });
  await found.slice.findProject();
  expect(found.slice.project.value).toEqual({ kind: "found", repository: REPOSITORY });

  const failing = rig({ findGitLabProject: async () => ({ ok: false, failure: STOPPED }) });
  await failing.slice.findProject();
  expect(failing.slice.project.value).toEqual({ kind: "none" });
  expect(failing.problems).toEqual([{ action: "mergeRequests", step: "find", cause: STOPPED }]);
});

test("show opens the page and starts the first load; close returns to the files", () => {
  const live = rig();
  live.slice.show();
  expect(live.screen.value).toEqual({ kind: "mergeRequests" });
  const firstLoad: ListLoad = { kind: "loading", first: true };
  expect(live.slice.listing.value).toEqual(firstLoad);
  expect(live.loads).toHaveLength(1);

  live.slice.close();
  expect(live.screen.value).toEqual({ kind: "files" });
});

test("the first load shows each page as it arrives, then ends with its time (catches pages held back)", async () => {
  const live = rig();
  live.slice.show();
  const load = loadAt(live, 0);
  const [first, second] = [ROWS.slice(0, 20), ROWS.slice(20)];

  load.send({ me: "sam", rows: second });
  expect(iids(live.slice.rows.value)).toEqual(iids(second));
  expect(live.slice.me.value).toBe("sam");
  expect(live.slice.summary.value).toBe("20 of 20 merge requests");
  load.send({ me: "sam", rows: first });
  expect(iids(live.slice.rows.value)).toEqual(iids(ROWS));
  expect(live.slice.listing.value).toEqual({ kind: "loading", first: true });

  vi.setSystemTime(T0 + 5);
  load.end(LOADED);
  await settled();
  expect(live.slice.listing.value).toEqual({ kind: "done", end: { kind: "loaded" }, at: T0 + 5 });
});

test("no reload on show before 30 s; a show at 30 s reloads in the background (catches a reload on every show)", async () => {
  const live = rig();
  await loaded(live);
  live.slice.close();

  vi.setSystemTime(T0 + RECHECK_PAUSE_MS - 1);
  live.slice.show();
  expect(live.loads).toHaveLength(1);
  expect(live.screen.value).toEqual({ kind: "mergeRequests" });

  vi.setSystemTime(T0 + RECHECK_PAUSE_MS);
  live.slice.show();
  expect(live.loads).toHaveLength(2);
  expect(live.slice.listing.value).toEqual({ kind: "loading", first: false });
  expect(iids(live.slice.rows.value)).toEqual(iids(ROWS));
});

test("a reload keeps the old rows until its end, then swaps them in (catches a reload emptying the list)", async () => {
  const live = rig();
  await loaded(live);
  const kept = ROWS.slice(1);

  const reloading = live.slice.refresh();
  const reload = loadAt(live, 1);
  reload.send({ me: "anna", rows: kept.slice(0, 5) });
  reload.send({ me: "anna", rows: kept.slice(5) });
  expect(iids(live.slice.rows.value)).toEqual(iids(ROWS));
  expect(live.slice.me.value).toBe("sam");

  reload.end(LOADED);
  await reloading;
  expect(iids(live.slice.rows.value)).toEqual(iids(kept));
  expect(live.slice.me.value).toBe("anna");
});

test.each<ListEnd>([
  { kind: "failed", message: "glab timed out" },
  { kind: "glabMissing" },
  { kind: "notLoggedIn", detail: "no token" },
])(
  "a reload ending %j keeps the old rows and shows its end (catches a failure losing the list)",
  async (end) => {
    const live = rig();
    await loaded(live);

    const reloading = live.slice.refresh();
    const reload = loadAt(live, 1);
    reload.send({ me: "sam", rows: ROWS.slice(0, 3) });
    reload.end({ ok: true, value: end });
    await reloading;
    expect(iids(live.slice.rows.value)).toEqual(iids(ROWS));
    expect(live.slice.listing.value).toEqual({ kind: "done", end, at: T0 });
  },
);

test("a first load that fails after a page keeps that page (the sent pages stay)", async () => {
  const live = rig();
  live.slice.show();
  const load = loadAt(live, 0);
  load.send({ me: "sam", rows: ROWS.slice(0, 20) });
  load.end({ ok: true, value: { kind: "failed", message: "502" } });
  await settled();
  expect(live.slice.rows.value).toHaveLength(20);
});

test.each<ListEnd>([
  { kind: "notLoggedIn", detail: "no token" },
  { kind: "failed", message: "glab timed out" },
])(
  "Retry after a first load ending %j streams its pages as the first does (catches a buffered retry showing nothing)",
  async (end) => {
    const live = rig();
    live.slice.show();
    loadAt(live, 0).end({ ok: true, value: end });
    await settled();

    const retrying = live.slice.refresh();
    expect(live.slice.listing.value).toEqual({ kind: "loading", first: true });
    loadAt(live, 1).send({ me: "sam", rows: ROWS.slice(0, 20) });
    expect(iids(live.slice.rows.value)).toEqual(iids(ROWS.slice(0, 20)));
    expect(live.slice.me.value).toBe("sam");
    loadAt(live, 1).end(LOADED);
    await retrying;
    expect(iids(live.slice.rows.value)).toEqual(iids(ROWS.slice(0, 20)));
  },
);

test("Refresh of a loaded empty list streams its pages (catches the page blank until the end)", async () => {
  const live = rig();
  await loaded(live, []);

  const refreshing = live.slice.refresh();
  expect(live.slice.listing.value).toEqual({ kind: "loading", first: true });
  loadAt(live, 1).send({ me: "sam", rows: ROWS.slice(0, 3) });
  expect(live.slice.rows.value).toHaveLength(3);
  loadAt(live, 1).end(LOADED);
  await refreshing;
});

test.each<[ListEnd, string | null]>([
  [{ kind: "loaded" }, null],
  [{ kind: "cut", limit: 500 }, null],
  [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [{ kind: "failed", message: "502" }, "glab failed: 502"],
])(
  "a load ending %j shows the failure %j, and none while the next load runs (catches the list end decided twice)",
  async (end, failure) => {
    const live = rig();
    expect(live.slice.failure.value).toBeNull();
    live.slice.show();
    loadAt(live, 0).end({ ok: true, value: end });
    await settled();
    expect(live.slice.failure.value).toBe(failure);

    const again = live.slice.refresh();
    expect(live.slice.failure.value).toBeNull();
    loadAt(live, 1).end(LOADED);
    await again;
  },
);

test("one load at a time: Refresh and show while loading start nothing (catches two loads racing)", async () => {
  const live = rig();
  live.slice.show();
  const refreshing = live.slice.refresh();
  vi.setSystemTime(T0 + RECHECK_PAUSE_MS * 2);
  live.slice.show();
  expect(live.loads).toHaveLength(1);
  await refreshing;
});

test("a failed first list call is reported and leaves nothing loaded, so the next show tries again", async () => {
  const live = rig();
  live.slice.show();
  loadAt(live, 0).send({ me: "sam", rows: ROWS.slice(0, 2) });
  loadAt(live, 0).end({ ok: false, failure: STOPPED });
  await settled();

  expect(live.problems).toEqual([{ action: "mergeRequests", step: "list", cause: STOPPED }]);
  expect(live.slice.listing.value).toEqual({ kind: "notLoaded" });
  expect(live.slice.rows.value).toEqual([]);
  live.slice.show();
  expect(live.loads).toHaveLength(2);
});

test("a failed reload call is reported and keeps the list and its last end", async () => {
  const live = rig();
  await loaded(live);

  const reloading = live.slice.refresh();
  loadAt(live, 1).end({ ok: false, failure: STOPPED });
  await reloading;

  expect(live.problems).toEqual([{ action: "mergeRequests", step: "list", cause: STOPPED }]);
  expect(live.slice.listing.value).toEqual({ kind: "done", end: { kind: "loaded" }, at: T0 });
  expect(iids(live.slice.rows.value)).toEqual(iids(ROWS));
});

test("a thrown list call is reported as unexpected", async () => {
  const live = rig({
    listMergeRequests: () => Promise.reject(new Error("unreadable page")),
  });
  await live.slice.refresh();
  expect(live.problems).toEqual([
    {
      action: "mergeRequests",
      step: "list",
      cause: { kind: "Unexpected", message: "unreadable page" },
    },
  ]);
});

test("a first load's checked row changes that row's readiness, also with the page closed, and nothing else (catches a local result never shown)", async () => {
  const live = rig();
  await loaded(live);
  const others = live.slice.rows.value.filter((row) => row.iid !== 640);
  expect(readinessOf(live, 640)).toEqual({ kind: "conflicts", also: [] });

  loadAt(live, 0).check(checkedRow(640));
  expect(readinessOf(live, 640)).toEqual(CLEAN);
  expect(live.slice.rows.value.filter((row) => row.iid !== 640)).toEqual(others);

  live.slice.close();
  loadAt(live, 0).check(checkedRow(638, { kind: "conflicts", also: [] }));
  expect(readinessOf(live, 638)).toEqual({ kind: "conflicts", also: [] });
  expect(live.problems).toEqual([]);
});

test("a refresh's checked row arriving while it is buffered lands in the swapped rows, and one after the swap in the rows (catches results applied to the old rows)", async () => {
  const live = rig();
  await loaded(live);
  const reloading = live.slice.refresh();
  const reload = loadAt(live, 1);
  reload.send({ me: "sam", rows: ROWS });
  reload.check(checkedRow(640));
  expect(readinessOf(live, 640)).toEqual({ kind: "conflicts", also: [] });

  reload.end(LOADED);
  await reloading;
  expect(readinessOf(live, 640)).toEqual(CLEAN);
  reload.check(checkedRow(635));
  expect(readinessOf(live, 635)).toEqual(CLEAN);
  expect(live.problems).toEqual([]);
});

test("an older load's checked row lands while its rows are shown and is dropped once a newer load's rows are (catches a stale result over fresh rows)", async () => {
  const live = rig();
  await loaded(live);
  const reloading = live.slice.refresh();
  loadAt(live, 1).send({ me: "sam", rows: ROWS });
  loadAt(live, 0).check(checkedRow(640));
  expect(readinessOf(live, 640)).toEqual(CLEAN);

  loadAt(live, 1).end(LOADED);
  await reloading;
  loadAt(live, 0).check(checkedRow(635));
  expect(readinessOf(live, 640)).toEqual({ kind: "conflicts", also: [] });
  expect(readinessOf(live, 635)).toEqual({ kind: "checking" });
  expect(live.problems).toEqual([]);
});

test.each<SourceResult<ListEnd>>([
  { ok: true, value: { kind: "failed", message: "502" } },
  { ok: false, failure: STOPPED },
])(
  "a refresh ending %j never lets its checked rows touch the shown rows (catches a failed load's results shown)",
  async (result) => {
    const live = rig();
    await loaded(live);
    const reloading = live.slice.refresh();
    const reload = loadAt(live, 1);
    reload.send({ me: "sam", rows: ROWS });
    reload.check(checkedRow(640));
    reload.end(result);
    await reloading;
    reload.check(checkedRow(635));

    expect(readinessOf(live, 640)).toEqual({ kind: "conflicts", also: [] });
    expect(readinessOf(live, 635)).toEqual({ kind: "checking" });
  },
);

test("a checked row with an iid that is not listed changes nothing and reports nothing", async () => {
  const live = rig();
  await loaded(live);
  const before = live.slice.rows.value;
  loadAt(live, 0).check(checkedRow(1));
  expect(live.slice.rows.value).toEqual(before);
  expect(live.problems).toEqual([]);
});

test("the summary counts shown and loaded rows and says when the list was cut, also through a failed reload", async () => {
  const live = rig();
  live.slice.show();
  loadAt(live, 0).send({ me: "sam", rows: ROWS });
  loadAt(live, 0).end({ ok: true, value: { kind: "cut", limit: 500 } });
  await settled();
  const cut = live.slice.summary.value;
  expect(cut).toContain("40 of 40 merge requests");
  expect(cut).not.toBe("40 of 40 merge requests");

  const reloading = live.slice.refresh();
  loadAt(live, 1).end({ ok: true, value: { kind: "failed", message: "502" } });
  await reloading;
  expect(live.slice.summary.value).toBe(cut);

  const again = live.slice.refresh();
  loadAt(live, 2).send({ me: "sam", rows: ROWS });
  loadAt(live, 2).end(LOADED);
  await again;
  expect(live.slice.summary.value).toBe("40 of 40 merge requests");
});

test("filters narrow the shown rows and the choices, and are remembered through createRememberedFilters per repository", async () => {
  const storage = memoryStorage();
  const live = rig({}, storage);
  await live.slice.findProject();
  await loaded(live);

  live.slice.click("assignee", { kind: "me" }, false);
  const mine = ROWS.filter((row) => row.assignees.some((person) => person.username === "sam"));
  expect(iids(live.slice.shownRows.value)).toEqual(iids(mine));
  expect(live.slice.summary.value).toBe(`${mine.length} of 40 merge requests`);
  expect(live.slice.choices.value.assignee[0]).toEqual({
    value: { kind: "me" },
    label: "Me",
    count: mine.length,
    state: "included",
  });
  live.slice.setDraft("ready");
  live.slice.click("label", { kind: "none" }, false);
  expect(live.slice.choices.value.label[0]?.state).toBe("included");
  expect(live.slice.shownRows.value.every((row) => !row.draft && row.labels.length === 0)).toBe(
    true,
  );
  expect(JSON.parse(storage.items.get("yamt.mergeRequests.filters") ?? "null")).toEqual({
    [REPOSITORY]: { assignee: ["me"], reviewer: [], label: ["none"], draft: "ready" },
  });

  const reopened = rig({}, storage);
  expect(reopened.slice.filters.value.draft).toBe("all");
  await reopened.slice.findProject();
  expect(reopened.slice.filters.value).toEqual(live.slice.filters.value);

  live.slice.clear("label");
  expect(live.slice.filters.value.label).toEqual([]);
  expect(live.slice.filters.value.draft).toBe("ready");
  live.slice.clearAll();
  expect(live.slice.shownRows.value).toHaveLength(40);
  expect(storage.items.get("yamt.mergeRequests.filters")).toBe("{}");
});

test("shift_click_excludes_and_the_filter_is_stored_with_not; a plain click on it turns it off", async () => {
  const storage = memoryStorage();
  const live = rig({}, storage);
  await live.slice.findProject();
  await loaded(live);

  live.slice.click("assignee", { kind: "me" }, true);
  live.slice.click("label", { kind: "label", title: "frontend" }, false);
  expect(iids(live.slice.shownRows.value)).toEqual([639, 627, 623, 619, 607, 603]);
  expect(live.slice.choices.value.assignee[0]?.state).toBe("excluded");
  expect(JSON.parse(storage.items.get("yamt.mergeRequests.filters") ?? "null")).toEqual({
    [REPOSITORY]: { assignee: ["not:me"], reviewer: [], label: ["label:frontend"], draft: "all" },
  });

  live.slice.click("assignee", { kind: "me" }, false);
  expect(live.slice.filters.value.assignee).toEqual([]);
});

test("without a GitLab project a filter is not remembered (catches filters stored under no repository)", async () => {
  const live = rig();
  await loaded(live);
  live.slice.click("assignee", { kind: "me" }, false);
  expect(live.slice.filters.value.assignee).toEqual([]);
  expect(live.storage.items.size).toBe(0);
});

test("a reviewer choice counts reviewers, not assignees", async () => {
  const live = rig();
  await loaded(live);
  const none = live.slice.choices.value.reviewer.find((choice) => choice.value.kind === "none");
  expect(none?.count).toBe(ROWS.filter((row) => row.reviewers.length === 0).length);
});

test("opening shows fetching, then nothing once opened or the refusal (catches the row staying busy)", async () => {
  const live = rig();
  const [first, second] = [iid(640), iid(639)];

  const opening = live.slice.openChanges(first);
  const refusing = live.slice.openChanges(second);
  const fetching: Opening = { kind: "fetching" };
  expect(live.slice.openings.value.get(first)).toEqual(fetching);
  await live.slice.openChanges(first);
  expect(live.opens.map((open) => open.iid)).toEqual([first, second]);

  live.opens[0]?.answer({ ok: true, value: { kind: "opened" } });
  live.opens[1]?.answer({ ok: true, value: { kind: "alreadyOpen" } });
  await Promise.all([opening, refusing]);
  expect(live.slice.openings.value.has(first)).toBe(false);
  expect(live.slice.openings.value.get(second)).toEqual({
    kind: "refused",
    reply: { kind: "alreadyOpen" },
  });

  const again = live.slice.openChanges(second);
  expect(live.slice.openings.value.get(second)).toEqual({ kind: "fetching" });
  live.opens[2]?.answer({ ok: true, value: { kind: "opened" } });
  await again;
  expect(live.slice.openings.value.has(second)).toBe(false);
});

test("a failed open call is reported and clears the row's state", async () => {
  const live = rig();
  const asked = iid(638);
  const opening = live.slice.openChanges(asked);
  live.opens[0]?.answer({ ok: false, failure: STOPPED });
  await opening;
  expect(live.problems).toEqual([{ action: "mergeRequests", step: "open", cause: STOPPED }]);
  expect(live.slice.openings.value.has(asked)).toBe(false);
});

test.each<[PageKind, string, PageOpened, string | null]>([
  ["job", JOB, { kind: "opened" }, null],
  [
    "job",
    JOB,
    { kind: "notOffered" },
    "This job's page was not listed by GitLab, so yamt did not open it.",
  ],
  ["job", JOB, { kind: "failed", message: "no opener" }, "Could not open the browser: no opener"],
  ["mergeRequest", MR, { kind: "opened" }, null],
  [
    "mergeRequest",
    MR,
    { kind: "notOffered" },
    "This merge request's page was not listed by GitLab, so yamt did not open it.",
  ],
  [
    "mergeRequest",
    MR,
    { kind: "failed", message: "no opener" },
    "Could not open the browser: no opener",
  ],
])(
  "a %s click on %s answered %j leaves the page problem %j",
  async (clicked, address, answer, words) => {
    const pages: WebPage[] = [];
    const live = rig({
      openPage: async (page) => {
        pages.push(page);
        return { ok: true, value: answer };
      },
    });
    await live.slice.openPage(clicked, webPage(address));
    expect(pages).toEqual([address]);
    expect(live.slice.pageProblem.value).toBe(words);
    live.slice.dismissPageProblem();
    expect(live.slice.pageProblem.value).toBeNull();
  },
);

test("an opened page clears an earlier page problem, whichever kind it was", async () => {
  let answer: SourceResult<PageOpened> = { ok: true, value: { kind: "notOffered" } };
  const live = rig({ openPage: async () => answer });
  await live.slice.openPage("job", webPage(JOB));
  answer = { ok: true, value: { kind: "opened" } };
  await live.slice.openPage("mergeRequest", webPage(MR));
  expect(live.slice.pageProblem.value).toBeNull();
});

test.each<[PageKind, string, MergeRequestStep]>([
  ["job", JOB, "job"],
  ["mergeRequest", MR, "mergeRequest"],
])(
  "a failed %s page call is reported at its own step and leaves no page problem",
  async (clicked, address, step) => {
    const live = rig({ openPage: async () => ({ ok: false, failure: STOPPED }) });
    await live.slice.openPage(clicked, webPage(address));
    expect(live.problems).toEqual([{ action: "mergeRequests", step, cause: STOPPED }]);
    expect(live.slice.pageProblem.value).toBeNull();
  },
);

test("the seam hands every header and the page the window's one slice; problems reach the window's bar", async () => {
  registerMergeRequests(rig().slice);
  const problem = shallowRef<Problem | null>(null);
  const screen = shallowRef<Screen>({ kind: "files" });
  const failing: MergeRequestSource = {
    ...createFixtureCompareSource(log, "", {}),
    findGitLabProject: async () => ({ ok: false, failure: STOPPED }),
  };
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const slice = windowMergeRequests(failing, { screen, problem });
  expect(useMergeRequests()).toBe(slice);
  await slice.findProject();
  expect(problem.value).toEqual({ action: "mergeRequests", step: "find", cause: STOPPED });
  slice.show();
  expect(screen.value).toEqual({ kind: "mergeRequests" });
});

const MERGING_640: LocalMerge = { kind: "merging", iid: 640, windowOpen: false };
const STARTED_640: ResolveReply = {
  kind: "started",
  started: { branch: "feature/fixture-640", target: "main", conflicts: true },
};

function askedAt<T>(asked: readonly Asked<T>[], index: number): Asked<T> {
  const found = asked[index];
  if (found === undefined) {
    throw new Error(`no call ${index}; ${asked.length} made`);
  }
  return found;
}

test("a resolve runs, then holds its reply, and the local merge is read after the reply (catches a stale Resolve after a start)", async () => {
  const live = rig();
  live.localMerges.push(MERGING_640);
  const asked = iid(640);
  const resolving = live.slice.resolve(asked);
  const running: RowActing = { kind: "running" };
  expect(live.slice.actions.value.get(asked)).toEqual(running);
  expect(live.slice.localMerge.value).toEqual(FREE);

  askedAt(live.resolves, 0).answer({ ok: true, value: STARTED_640 });
  await resolving;
  const replied: RowActing = { kind: "replied", reply: { kind: "resolve", reply: STARTED_640 } };
  expect(live.slice.actions.value.get(asked)).toEqual(replied);
  expect(live.slice.localMerge.value).toEqual(MERGING_640);
  expect(live.resolves.map((each) => each.iid)).toEqual([asked]);
});

test("a continue runs, then holds its reply, and the local merge is read after the reply", async () => {
  const live = rig();
  const open: LocalMerge = { ...MERGING_640, windowOpen: true };
  live.localMerges.push(open);
  const asked = iid(640);
  const continuing = live.slice.continueMerge(asked);
  expect(live.slice.actions.value.get(asked)).toEqual({ kind: "running" });

  const opened: ContinueMergeReply = {
    kind: "opened",
    branch: "feature/fixture-640",
    target: "main",
  };
  askedAt(live.continues, 0).answer({ ok: true, value: opened });
  await continuing;
  expect(live.slice.actions.value.get(asked)).toEqual({
    kind: "replied",
    reply: { kind: "continue", reply: opened },
  });
  expect(live.slice.localMerge.value).toEqual(open);
  expect(live.continues.map((each) => each.iid)).toEqual([asked]);
});

test("a second click while the row runs sends nothing; another row runs beside it", async () => {
  const live = rig();
  const [first, second] = [iid(640), iid(636)];
  const resolving = live.slice.resolve(first);
  await live.slice.resolve(first);
  await live.slice.continueMerge(first);
  const other = live.slice.resolve(second);
  expect(live.resolves.map((each) => each.iid)).toEqual([first, second]);
  expect(live.continues).toEqual([]);

  askedAt(live.resolves, 0).answer({ ok: true, value: STARTED_640 });
  askedAt(live.resolves, 1).answer({
    ok: true,
    value: { kind: "refused", refusal: { kind: "alreadyMerging", iid: 640 } },
  });
  await Promise.all([resolving, other]);
  expect(live.slice.actions.value.get(second)).toEqual({
    kind: "replied",
    reply: {
      kind: "resolve",
      reply: { kind: "refused", refusal: { kind: "alreadyMerging", iid: 640 } },
    },
  });
});

test("the next click replaces the row's reply with running", async () => {
  const live = rig();
  const asked = iid(640);
  const resolving = live.slice.resolve(asked);
  askedAt(live.resolves, 0).answer({ ok: true, value: STARTED_640 });
  await resolving;
  const continuing = live.slice.continueMerge(asked);
  expect(live.slice.actions.value.get(asked)).toEqual({ kind: "running" });
  askedAt(live.continues, 0).answer({ ok: true, value: { kind: "ended" } });
  await continuing;
  expect(live.slice.actions.value.get(asked)).toEqual({
    kind: "replied",
    reply: { kind: "continue", reply: { kind: "ended" } },
  });
});

test.each(["resolve", "continue"] as const)(
  "a failed %s call is reported, clears the row and reads no local merge",
  async (step) => {
    const live = rig();
    live.localMerges.push(MERGING_640);
    const asked = iid(640);
    const acting = step === "resolve" ? live.slice.resolve(asked) : live.slice.continueMerge(asked);
    if (step === "resolve") {
      askedAt(live.resolves, 0).answer({ ok: false, failure: STOPPED });
    } else {
      askedAt(live.continues, 0).answer({ ok: false, failure: STOPPED });
    }
    await acting;
    expect(live.problems).toEqual([{ action: "mergeRequests", step, cause: STOPPED }]);
    expect(live.slice.actions.value.has(asked)).toBe(false);
    expect(live.slice.localMerge.value).toEqual(FREE);
  },
);

test("the local merge is read at show and at checkLocalMerge (catches a merge window closed meanwhile)", async () => {
  const live = rig();
  live.localMerges.push(MERGING_640, { kind: "free" });
  live.slice.show();
  await settled();
  expect(live.slice.localMerge.value).toEqual(MERGING_640);
  await live.slice.checkLocalMerge();
  expect(live.slice.localMerge.value).toEqual(FREE);
});

test("a failed local merge read is reported and keeps what was known", async () => {
  let answers: SourceResult<LocalMerge>[] = [
    { ok: true, value: MERGING_640 },
    { ok: false, failure: STOPPED },
  ];
  const live = rig({
    findLocalMerge: async () => {
      const [next, ...rest] = answers;
      answers = rest;
      return next ?? { ok: true, value: FREE };
    },
  });
  await live.slice.checkLocalMerge();
  await live.slice.checkLocalMerge();
  expect(live.slice.localMerge.value).toEqual(MERGING_640);
  expect(live.problems).toEqual([{ action: "mergeRequests", step: "localMerge", cause: STOPPED }]);
});

const NOV_5 = { year: 2026, month: 11, day: 5 };
const DEC_24 = { year: 2026, month: 12, day: 24 };
const DUE_KEY = "yamt.mergeRequests.dueDates";

function storedDueDates(live: Rig): unknown {
  return JSON.parse(live.storage.items.get(DUE_KEY) ?? "null");
}

async function dated(): Promise<Rig> {
  const live = rig();
  await live.slice.findProject();
  await loaded(live);
  live.slice.setDueDate(iid(640), NOV_5);
  live.slice.setDueDate(iid(630), DEC_24);
  return live;
}

test("a_complete_load_drops_due_dates_of_merge_requests_it_no_longer_lists, the first load and a swapped-in refresh alike", async () => {
  const storage = memoryStorage();
  storage.setItem(
    DUE_KEY,
    JSON.stringify({ [REPOSITORY]: { "1": "2026-11-05", "639": "2026-11-05" } }),
  );
  const first = rig({}, storage);
  await first.slice.findProject();
  expect([...first.slice.dueDates.value.keys()]).toEqual([1, 639]);
  await loaded(first);
  expect([...first.slice.dueDates.value.keys()]).toEqual([639]);

  const live = await dated();
  const reloading = live.slice.refresh();
  loadAt(live, 1).send({ me: "sam", rows: ROWS.filter((row) => row.iid !== 640) });
  expect([...live.slice.dueDates.value.keys()]).toEqual([630, 640]);
  loadAt(live, 1).end(LOADED);
  await reloading;
  expect(live.slice.dueDates.value).toEqual(new Map([[630, DEC_24]]));
  expect(storedDueDates(live)).toEqual({ [REPOSITORY]: { "630": "2026-12-24" } });
});

test.each<SourceResult<ListEnd>>([
  { ok: true, value: { kind: "cut", limit: 500 } },
  { ok: true, value: { kind: "failed", message: "502" } },
  { ok: true, value: { kind: "glabMissing" } },
  { ok: true, value: { kind: "notLoggedIn", detail: "no token" } },
  { ok: false, failure: STOPPED },
])("a_cut_or_failed_load_keeps_every_due_date: %j", async (result) => {
  const live = await dated();
  const reloading = live.slice.refresh();
  loadAt(live, 1).send({ me: "sam", rows: ROWS.slice(20) });
  loadAt(live, 1).end(result);
  await reloading;
  expect([...live.slice.dueDates.value.keys()]).toEqual([630, 640]);
  expect(storedDueDates(live)).toEqual({
    [REPOSITORY]: { "630": "2026-12-24", "640": "2026-11-05" },
  });
});

test("dated_rows_come_first_in_shown_rows, soonest first, and a cleared date puts its row back", async () => {
  const live = await dated();
  live.slice.setDueDate(iid(620), DEC_24);
  expect(iids(live.slice.shownRows.value).slice(0, 5)).toEqual([640, 630, 620, 639, 638]);

  live.slice.click("label", { kind: "label", title: "frontend" }, false);
  expect(iids(live.slice.shownRows.value).slice(0, 2)).toEqual([639, 635]);
  live.slice.clearAll();

  live.slice.setDueDate(iid(640), null);
  expect(iids(live.slice.shownRows.value).slice(0, 3)).toEqual([630, 620, 640]);
  expect(live.slice.rows.value).toEqual(ROWS);
});

const RE_REQUESTED: readonly Reviewer[] = [
  { person: { username: "chiara", name: "Chiara Rossi", picture: null }, state: "requested" },
];

function reviewersOf(rows: readonly MergeRequestRow[], value: number): readonly Reviewer[] {
  return rows.find((row) => row.iid === value)?.reviewers ?? [];
}

test("a_rerequest_reply_replaces_that_rows_reviewers_in_rows_and_in_a_buffering_refresh", async () => {
  const live = rig();
  await loaded(live);
  const reloading = live.slice.refresh();
  loadAt(live, 1).send({ me: "sam", rows: ROWS });

  const asking = live.slice.rerequestReview(iid(638), "chiara");
  askedAt(live.rerequests, 0).answer({
    ok: true,
    value: { kind: "requested", reviewers: RE_REQUESTED },
  });
  await asking;
  expect(reviewersOf(live.slice.rows.value, 638)).toEqual(RE_REQUESTED);
  expect(live.slice.rows.value.filter((row) => row.iid !== 638)).toEqual(
    ROWS.filter((row) => row.iid !== 638),
  );

  loadAt(live, 1).end(LOADED);
  await reloading;
  expect(reviewersOf(live.slice.rows.value, 638)).toEqual(RE_REQUESTED);
  expect(live.slice.rerequests.value.size).toBe(0);
});

test("a later refresh's rows replace a re-requested row's reviewers", async () => {
  const live = rig();
  await loaded(live);
  const asking = live.slice.rerequestReview(iid(630), "anna");
  askedAt(live.rerequests, 0).answer({
    ok: true,
    value: { kind: "requested", reviewers: RE_REQUESTED },
  });
  await asking;
  expect(reviewersOf(live.slice.rows.value, 630)).toEqual(RE_REQUESTED);

  const reloading = live.slice.refresh();
  loadAt(live, 1).send({ me: "sam", rows: ROWS });
  loadAt(live, 1).end(LOADED);
  await reloading;
  expect(reviewersOf(live.slice.rows.value, 630)).toEqual(reviewersOf(ROWS, 630));
});

test("a refused re-request leaves the rows as they were", async () => {
  const live = rig();
  await loaded(live);
  const asking = live.slice.rerequestReview(iid(638), "dmitri");
  askedAt(live.rerequests, 0).answer({ ok: true, value: { kind: "notOpen" } });
  await asking;
  expect(live.slice.rows.value).toEqual(ROWS);
  expect(live.slice.rerequests.value.get(iid(638))).toEqual(
    new Map([["dmitri", { kind: "refused", reply: { kind: "notOpen" } }]]),
  );
});

function titled(part: string): number[] {
  return iids(ROWS.filter((row) => row.title.toLowerCase().includes(part)));
}

test("the search narrows the shown rows and the summary, never the checklist counts (catches the search ignored or counted in the choices)", async () => {
  const live = rig();
  await loaded(live);
  const choices = live.slice.choices.value;

  live.slice.setSearch("!630");
  expect(live.slice.search.value).toBe("!630");
  expect(iids(live.slice.shownRows.value)).toEqual([630]);
  expect(live.slice.summary.value).toBe("1 of 40 merge requests");
  expect(live.slice.choices.value).toEqual(choices);

  live.slice.setSearch("SNOOZE");
  expect(iids(live.slice.shownRows.value)).toEqual(titled("snooze"));
  expect(live.slice.summary.value).toBe(`${titled("snooze").length} of 40 merge requests`);

  live.slice.setSearch(" ");
  expect(live.slice.shownRows.value).toHaveLength(40);
});

test("a row is shown only when it passes the filters and matches the search; Clear filters keeps the search (catches search OR filters)", async () => {
  const live = rig();
  await live.slice.findProject();
  await loaded(live);
  live.slice.click("label", { kind: "label", title: "frontend" }, false);
  const frontend = iids(live.slice.shownRows.value);
  const outside = ROWS.find((row) => !frontend.includes(row.iid));
  const inside = frontend[0];
  if (outside === undefined || inside === undefined) {
    throw new Error("the fixture has rows with and without frontend");
  }

  live.slice.setSearch(`!${inside} !${outside.iid}`);
  expect(iids(live.slice.shownRows.value)).toEqual([inside]);

  live.slice.clearAll();
  expect(live.slice.search.value).toBe(`!${inside} !${outside.iid}`);
  const both = ROWS.filter((row) => row.iid === inside || row.iid === outside.iid);
  expect(iids(live.slice.shownRows.value)).toEqual(iids(both));
});

test("searched rows keep dated rows first (catches the search dropping the due-date order)", async () => {
  const live = await dated();
  live.slice.setSearch("620 630 638 640");
  expect(iids(live.slice.shownRows.value)).toEqual([640, 630, 638, 620]);
});

test("Refresh keeps the search; show empties it (catches the text surviving a page visit or lost on reload)", async () => {
  const live = rig();
  await loaded(live);
  live.slice.setSearch("!630");

  const reloading = live.slice.refresh();
  loadAt(live, 1).send({ me: "sam", rows: ROWS });
  loadAt(live, 1).end(LOADED);
  await reloading;
  expect(live.slice.search.value).toBe("!630");
  expect(iids(live.slice.shownRows.value)).toEqual([630]);

  live.slice.close();
  live.slice.show();
  expect(live.slice.search.value).toBe("");
  expect(live.slice.shownRows.value).toHaveLength(40);
});

test("the slice shows a job's log through its source and remembers job searches in its storage (catches the job-log calls left out of the slice)", async () => {
  const pages: WebPage[] = [];
  const live = rig({
    readJobLog: async (page) => {
      pages.push(page);
      return {
        ok: true,
        value: { kind: "log", log: { text: "\u001b[31mError\u001b[0m", cut: false } },
      };
    },
  });
  const job = { name: "test:unit", page: webPage(JOB) };

  await live.slice.showJobLog(job);
  expect(pages).toEqual([JOB]);
  expect(live.slice.jobLog.value?.job).toEqual(job);
  expect(live.slice.jobLog.value?.load.kind).toBe("shown");
  live.slice.closeJobLog();
  expect(live.slice.jobLog.value).toBeNull();

  live.slice.setJobSearch("test:unit", "fail");
  expect(live.slice.jobSearch("test:unit")).toBe("fail");
  expect(live.storage.items.get("yamt.mergeRequests.jobSearches")).toBe('{"test:unit":"fail"}');
});
