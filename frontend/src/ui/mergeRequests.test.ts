import type { StorageLike } from "@vueuse/core";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type JobOpened,
  type JobPage,
  type ListEnd,
  type MergeRequestIid,
  type MergeRequestPage,
  type MergeRequestRow,
  type MergeRequestSource,
  type OpenReply,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import { RECHECK_PAUSE_MS } from "./glab";
import {
  createMergeRequests,
  type ListLoad,
  type MergeRequests,
  type Opening,
} from "./mergeRequests";
import { registerMergeRequests, useMergeRequests, windowMergeRequests } from "./mergeRequestsStore";
import type { Problem } from "./problem";
import type { Screen } from "./screen";

type Load = {
  readonly send: (page: MergeRequestPage) => void;
  readonly end: (result: SourceResult<ListEnd>) => void;
};

type Open = {
  readonly iid: MergeRequestIid;
  readonly answer: (result: SourceResult<OpenReply>) => void;
};

type Rig = {
  readonly slice: MergeRequests;
  readonly screen: ShallowRef<Screen>;
  readonly problems: Problem[];
  readonly loads: Load[];
  readonly opens: Open[];
  readonly storage: MemoryStorage;
};

type MemoryStorage = StorageLike & { readonly items: Map<string, string> };

type Edit = Partial<MergeRequestSource>;

const T0 = 1_767_225_600_000;
const MICROTASKS = 10;
const REPOSITORY = "/home/sam/taskboard/.git";
const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const LOADED: SourceResult<ListEnd> = { ok: true, value: { kind: "loaded" } };
const JOB = "https://gitlab.example/taskboard/taskboard/-/jobs/9001";

let ROWS: readonly MergeRequestRow[] = [];

beforeAll(async () => {
  const rows: MergeRequestRow[] = [];
  await createFixtureCompareSource(log, "?mr=list", {}).listMergeRequests((page) => {
    rows.push(...page.rows);
  });
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

function jobPage(): JobPage {
  const page = ROWS.flatMap((row) => row.pipeline?.failedJobs ?? []).find(
    (job) => job.page === JOB,
  )?.page;
  if (page === undefined || page === null) {
    throw new Error("the fixture offers no job page");
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
  const problems: Problem[] = [];
  const source: MergeRequestSource = {
    findGitLabProject: async () => ({ ok: true, value: { kind: "found", repository: REPOSITORY } }),
    listMergeRequests: (onPage) =>
      new Promise((resolve) => {
        loads.push({ send: onPage, end: resolve });
      }),
    openMergeRequest: (asked) =>
      new Promise((resolve) => {
        opens.push({ iid: asked, answer: resolve });
      }),
    openJobPage: async () => ({ ok: true, value: { kind: "opened" } }),
    ...edit,
  };
  const screen = shallowRef<Screen>({ kind: "files" });
  const slice = createMergeRequests({
    source,
    screen,
    report: (problem) => problems.push(problem),
    storage,
  });
  return { slice, screen, problems, loads, opens, storage };
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

  live.slice.toggle("assignee", { kind: "me" });
  const mine = ROWS.filter((row) => row.assignees.some((person) => person.username === "sam"));
  expect(iids(live.slice.shownRows.value)).toEqual(iids(mine));
  expect(live.slice.summary.value).toBe(`${mine.length} of 40 merge requests`);
  expect(live.slice.choices.value.assignee[0]).toEqual({
    value: { kind: "me" },
    label: "Me",
    count: mine.length,
    checked: true,
  });
  live.slice.setDraft("ready");
  live.slice.toggle("label", { kind: "none" });
  expect(live.slice.choices.value.label[0]?.checked).toBe(true);
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

test("without a GitLab project a filter is not remembered (catches filters stored under no repository)", async () => {
  const live = rig();
  await loaded(live);
  live.slice.toggle("assignee", { kind: "me" });
  expect(live.slice.filters.value.assignee).toEqual([]);
  expect(live.storage.items.size).toBe(0);
});

test("a reviewer choice counts reviewers, not assignees", async () => {
  const live = rig();
  await loaded(live);
  const none = live.slice.choices.value.reviewer.find((choice) => choice.value.kind === "none");
  expect(none?.count).toBe(ROWS.filter((row) => row.reviewers.length === 0).length);
});

test("opening shows fetching, then opened or the refusal (catches the row staying busy)", async () => {
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
  expect(live.slice.openings.value.get(first)).toEqual({ kind: "opened" });
  expect(live.slice.openings.value.get(second)).toEqual({
    kind: "refused",
    reply: { kind: "alreadyOpen" },
  });

  const again = live.slice.openChanges(second);
  expect(live.slice.openings.value.get(second)).toEqual({ kind: "fetching" });
  live.opens[2]?.answer({ ok: true, value: { kind: "opened" } });
  await again;
  expect(live.slice.openings.value.get(second)).toEqual({ kind: "opened" });
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

test.each<[JobOpened, string | null]>([
  [{ kind: "opened" }, null],
  [{ kind: "notOffered" }, "This job's page was not listed by GitLab, so yamt did not open it."],
  [{ kind: "failed", message: "no opener" }, "Could not open the browser: no opener"],
])("a job answer %j leaves the job problem %j", async (answer, words) => {
  const pages: JobPage[] = [];
  const live = rig({
    openJobPage: async (page) => {
      pages.push(page);
      return { ok: true, value: answer };
    },
  });
  await live.slice.openJob(jobPage());
  expect(pages).toEqual([JOB]);
  expect(live.slice.jobProblem.value).toBe(words);
  live.slice.dismissJobProblem();
  expect(live.slice.jobProblem.value).toBeNull();
});

test("an opened job clears an earlier job problem; a failed job call is reported", async () => {
  let answer: SourceResult<JobOpened> = { ok: true, value: { kind: "notOffered" } };
  const live = rig({ openJobPage: async () => answer });
  await live.slice.openJob(jobPage());
  answer = { ok: true, value: { kind: "opened" } };
  await live.slice.openJob(jobPage());
  expect(live.slice.jobProblem.value).toBeNull();

  answer = { ok: false, failure: STOPPED };
  await live.slice.openJob(jobPage());
  expect(live.problems).toEqual([{ action: "mergeRequests", step: "job", cause: STOPPED }]);
});

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
