import { afterEach, expect, test, vi } from "vitest";

import { isMergeRequestIid, isWebPage, type MergeRequestIid } from "./domain";
import { createFixtureCompareSource } from "./fixtureCompare";
import {
  ALREADY_OPEN_IID,
  DROPPED_LABEL,
  FETCH_FAILS_IID,
  LOGGED_OUT_DETAIL,
  PAGE_FAILED_MESSAGE,
  PREPARING_IID,
  REFUSED_MESSAGE,
} from "./fixtureMergeRequestData";
import { createFixtureMergeRequests, type MergeRequestScript } from "./fixtureMergeRequests";
import { createFixtureRangeSource } from "./fixtureRange";
import type { Log } from "./log";
import type {
  ContinueMergeReply,
  ListEnd,
  LocalMerge,
  MergeRequestPage,
  ResolveReply,
} from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";
import { branded } from "./validate";

type Listed = { readonly pages: readonly MergeRequestPage[]; readonly end: ListEnd | null };

afterEach(() => {
  vi.useRealTimers();
});

function quietLog(lines: string[] = []): Log {
  function keep(event: string, fields: Record<string, string | number | boolean> = {}): void {
    lines.push(`${event} ${JSON.stringify(fields)}`);
  }
  return { debug: keep, info: keep, warn: keep, error: keep };
}

function source(search: string, lines: string[] = []): MergeRequestSource {
  return createFixtureMergeRequests(quietLog(lines), search);
}

async function listed(mergeRequests: MergeRequestSource): Promise<Listed> {
  const pages: MergeRequestPage[] = [];
  const result = await mergeRequests.listMergeRequests((page) => pages.push(page));
  return { pages, end: result.ok ? result.value : null };
}

test("without ?mr the window has no GitLab project and lists nothing (catches every fixture page growing a button)", async () => {
  const lines: string[] = [];
  const plain = source("?diff=sample", lines);
  expect(await plain.findGitLabProject()).toEqual({ ok: true, value: { kind: "none" } });
  expect(await listed(plain)).toEqual({ pages: [], end: { kind: "loaded" } });
  expect(await source("?mr=", lines).findGitLabProject()).toEqual({
    ok: true,
    value: { kind: "none" },
  });
  expect(lines).toEqual([]);
});

test("an unknown script is logged with the known ones and means no project", async () => {
  const lines: string[] = [];
  const unknown = source("?mr=nope", lines);
  expect(await unknown.findGitLabProject()).toEqual({ ok: true, value: { kind: "none" } });
  expect(lines).toEqual([
    'mergeRequests.fixture_miss {"mr":"nope","known":"list, slow, many, empty, noGlab, loggedOut, timeout, refused, pageFails"}',
  ]);
});

test("a script finds the project by its repository", async () => {
  expect(await source("?mr=list").findGitLabProject()).toEqual({
    ok: true,
    value: { kind: "found", repository: "/home/sam/taskboard/.git" },
  });
});

test.each<[MergeRequestScript, readonly number[], ListEnd]>([
  ["list", [20, 20], { kind: "loaded" }],
  ["many", [100, 100, 100, 100, 100], { kind: "cut", limit: 500 }],
  ["empty", [0], { kind: "loaded" }],
  ["noGlab", [], { kind: "glabMissing" }],
  ["loggedOut", [], { kind: "notLoggedIn", detail: LOGGED_OUT_DETAIL }],
  ["timeout", [], { kind: "failed", message: "glab timed out" }],
  ["refused", [], { kind: "failed", message: REFUSED_MESSAGE }],
  ["pageFails", [20], { kind: "failed", message: PAGE_FAILED_MESSAGE }],
])("?mr=%s sends pages of %j rows, then its end", async (script, sizes, end) => {
  const { pages, end: ended } = await listed(source(`?mr=${script}`));
  expect(pages.map((page) => page.rows.length)).toEqual(sizes);
  expect(pages.every((page) => page.me === "sam")).toBe(true);
  expect(ended).toEqual(end);
});

test("the list's rows are newest first, with distinct iids across pages (catches a page repeating the first)", async () => {
  const { pages } = await listed(source("?mr=list"));
  const rows = pages.flatMap((page) => page.rows);
  const times = rows.map((row) => row.createdAt);
  expect(times).toEqual(times.toSorted((a, b) => b - a));
  expect(new Set(rows.map((row) => row.iid)).size).toBe(rows.length);
  expect(rows.some((row) => row.draft && row.title.startsWith("Draft: "))).toBe(true);
  expect(rows.some((row) => row.pipeline === null)).toBe(true);
  const jobs = rows.flatMap((row) => row.pipeline?.failedJobs ?? []);
  expect(jobs.some((job) => job.allowFailure)).toBe(true);
});

test("the list holds every case the page filters and shows (catches a fixture that cannot exercise a filter)", async () => {
  const rows = (await listed(source("?mr=list"))).pages.flatMap((page) => page.rows);
  const newest = Date.parse("2026-10-30T09:00:00Z");
  const hour = 3_600_000;
  function count(pass: (row: (typeof rows)[number]) => boolean): number {
    return rows.filter(pass).length;
  }

  expect(rows.map((row) => row.iid)).toEqual(Array.from({ length: 40 }, (_, at) => 640 - at));
  expect(rows.slice(0, 3).map((row) => row.createdAt)).toEqual([
    newest,
    newest - 6 * hour,
    newest - 24 * hour,
  ]);
  expect(rows.map((row) => [row.openDiscussions, row.approvals])).toEqual(
    Array.from({ length: 40 }, (_, at) => [at % 3, at % 4]),
  );
  expect(rows.filter((row) => row.draft).map((row) => row.iid)).toEqual([634, 627, 620, 613, 606]);
  expect(count((row) => row.draft !== row.title.startsWith("Draft: "))).toBe(0);
  expect(count((row) => row.assignees.length === 0)).toBe(10);
  expect(count((row) => row.reviewers.length === 0)).toBe(14);
  expect(count((row) => row.labels.length === 0)).toBe(8);
  expect(count((row) => row.labels.includes("bug"))).toBe(11);
  expect(
    rows.slice(0, 2).map(({ assignees, reviewers, labels }) => [assignees, reviewers, labels]),
  ).toEqual([
    [[{ username: "sam", name: "Sam Weller" }], [], ["backend", "bug"]],
    [
      [{ username: "anna", name: "Anna Berg" }],
      [{ username: "dmitri", name: "Dmitri Volkov" }],
      ["frontend"],
    ],
  ]);
  expect(new Set(rows.map((row) => row.pipeline?.status ?? null))).toEqual(
    new Set(["passed", "failed", "running", "pending", "canceled", "skipped", "manual", null]),
  );
  const withJobs = rows.filter((row) => (row.pipeline?.failedJobs.length ?? 0) > 0);
  expect(withJobs.every((row) => row.pipeline?.status === "failed")).toBe(true);
  expect(withJobs).toHaveLength(5);
  expect(rows.filter((row) => row.pipeline?.moreFailedJobs === true).map((row) => row.iid)).toEqual(
    [632],
  );
  expect(rows[8]?.pipeline?.failedJobs.map((job) => job.page)).toEqual([
    "https://gitlab.example/taskboard/taskboard/-/jobs/9080",
    "https://gitlab.example/taskboard/taskboard/-/jobs/9081",
    null,
  ]);
  expect(rows[0]?.pipeline).toEqual({
    status: "failed",
    failedJobs: [
      {
        name: "lint:docs",
        stage: "lint",
        allowFailure: true,
        page: "https://gitlab.example/taskboard/taskboard/-/jobs/9000",
      },
      {
        name: "test:unit",
        stage: "test",
        allowFailure: false,
        page: "https://gitlab.example/taskboard/taskboard/-/jobs/9001",
      },
      { name: "test:e2e", stage: "test", allowFailure: false, page: null },
    ],
    moreFailedJobs: false,
  });
});

test("a second load of the list drops one label, so a checked label can stay at 0", async () => {
  const list = source("?mr=list");
  function labelsOf({ pages }: Listed): string[] {
    return pages.flatMap((page) => page.rows.flatMap((row) => row.labels));
  }
  expect(labelsOf(await listed(list))).toContain(DROPPED_LABEL);
  const second = labelsOf(await listed(list));
  expect(second).not.toContain(DROPPED_LABEL);
  expect(second.length).toBeGreaterThan(0);
});

test("slow sends its pages a second apart", async () => {
  vi.useFakeTimers();
  const pages: MergeRequestPage[] = [];
  const listing = source("?mr=slow").listMergeRequests((page) => pages.push(page));
  await vi.advanceTimersByTimeAsync(999);
  expect(pages).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(pages).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(pages).toHaveLength(2);
  expect(await listing).toEqual({ ok: true, value: { kind: "loaded" } });
});

test.each([
  [ALREADY_OPEN_IID, { kind: "alreadyOpen" }],
  [FETCH_FAILS_IID, { kind: "fetchFailed", message: expect.stringContaining("Could not resolve") }],
  [PREPARING_IID, { kind: "preparing" }],
  [640, { kind: "opened" }],
])("opening !%i answers after a second with its scripted reply", async (number, reply) => {
  vi.useFakeTimers();
  let answered: unknown = null;
  void source("?mr=list")
    .openMergeRequest(branded(number, isMergeRequestIid, "iid"))
    .then((result) => {
      answered = result;
    });
  await vi.advanceTimersByTimeAsync(999);
  expect(answered).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  expect(answered).toEqual({ ok: true, value: reply });
});

test.each([
  "https://gitlab.example/taskboard/taskboard/-/jobs/9001",
  "https://gitlab.example/taskboard/taskboard/-/merge_requests/639",
])("the listed page %s opens as logged (catches a click that leaves no trace)", async (page) => {
  const lines: string[] = [];
  const { pages } = await listed(source("?mr=list"));
  const rows = pages.flatMap((each) => each.rows);
  const offered = [
    ...rows.map((row) => row.page),
    ...rows.flatMap((row) => row.pipeline?.failedJobs ?? []).map((job) => job.page),
  ];
  expect(offered).toContain(page);
  if (!isWebPage(page)) {
    throw new Error(`${page} is not a web page`);
  }
  expect(await source("?mr=list", lines).openPage(page)).toEqual({
    ok: true,
    value: { kind: "opened" },
  });
  expect(lines).toEqual([`mergeRequests.fixture_page {"page":"${page}"}`]);
});

test("every listed row has its own merge request's page", async () => {
  const { pages } = await listed(source("?mr=list"));
  for (const row of pages.flatMap((each) => each.rows)) {
    expect(row.page).toBe(`https://gitlab.example/taskboard/taskboard/-/merge_requests/${row.iid}`);
  }
});

test("the compare and range fixtures answer ?mr beside their own parameters", async () => {
  const found = { ok: true, value: { kind: "found", repository: "/home/sam/taskboard/.git" } };
  const compare = createFixtureCompareSource(quietLog(), "?mr=list", {});
  const range = createFixtureRangeSource(quietLog(), "?range=review&mr=list");
  expect(await compare.findGitLabProject()).toEqual(found);
  expect(await range.findGitLabProject()).toEqual(found);
  expect(await createFixtureRangeSource(quietLog(), "?range=review").findGitLabProject()).toEqual({
    ok: true,
    value: { kind: "none" },
  });
});

function iid(value: number): MergeRequestIid {
  return branded(value, isMergeRequestIid, "iid");
}

async function answered<T>(asked: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(1000);
  return asked;
}

test.each<[number, ResolveReply]>([
  [
    640,
    {
      kind: "started",
      started: { branch: "feature/fixture-640", target: "main", conflicts: true },
    },
  ],
  [
    632,
    {
      kind: "started",
      started: { branch: "feature/fixture-632", target: "main", conflicts: false },
    },
  ],
  [624, { kind: "refused", refusal: { kind: "localAhead", branch: "feature/fixture-624" } }],
  [
    616,
    {
      kind: "windowFailed",
      started: { branch: "feature/fixture-616", target: "main", conflicts: true },
      message: "yamt: not found",
    },
  ],
  [
    636,
    {
      kind: "started",
      started: { branch: "feature/fixture-636", target: "main", conflicts: true },
    },
  ],
])("resolving !%i answers after a second with its scripted reply", async (number, reply) => {
  vi.useFakeTimers();
  let replied: unknown = null;
  void source("?mr=list")
    .resolveMergeRequest(iid(number))
    .then((result) => {
      replied = result;
    });
  await vi.advanceTimersByTimeAsync(999);
  expect(replied).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  expect(replied).toEqual({ ok: true, value: reply });
});

test.each([640, 616])(
  "after !%i started, the local merge names it with its window closed",
  async (number) => {
    vi.useFakeTimers();
    const mergeRequests = source("?mr=list");
    expect(await mergeRequests.findLocalMerge()).toEqual({ ok: true, value: { kind: "free" } });
    await answered(mergeRequests.resolveMergeRequest(iid(number)));
    const merging: LocalMerge = { kind: "merging", iid: number, windowOpen: false };
    expect(await mergeRequests.findLocalMerge()).toEqual({ ok: true, value: merging });
  },
);

test("a refused resolve leaves no local merge", async () => {
  vi.useFakeTimers();
  const mergeRequests = source("?mr=list");
  await answered(mergeRequests.resolveMergeRequest(iid(624)));
  expect(await mergeRequests.findLocalMerge()).toEqual({ ok: true, value: { kind: "free" } });
});

test("continuing the started merge opens its window, and from then the window is open", async () => {
  vi.useFakeTimers();
  const mergeRequests = source("?mr=list");
  await answered(mergeRequests.resolveMergeRequest(iid(640)));
  const opened: ContinueMergeReply = {
    kind: "opened",
    branch: "feature/fixture-640",
    target: "main",
  };
  expect(await answered(mergeRequests.continueMergeRequest(iid(640)))).toEqual({
    ok: true,
    value: opened,
  });
  const open: LocalMerge = { kind: "merging", iid: 640, windowOpen: true };
  expect(await mergeRequests.findLocalMerge()).toEqual({ ok: true, value: open });
});

test("continuing another merge request, or with nothing started, answers ended", async () => {
  vi.useFakeTimers();
  const mergeRequests = source("?mr=list");
  const ended = { ok: true, value: { kind: "ended" } };
  expect(await answered(mergeRequests.continueMergeRequest(iid(640)))).toEqual(ended);
  await answered(mergeRequests.resolveMergeRequest(iid(640)));
  expect(await answered(mergeRequests.continueMergeRequest(iid(636)))).toEqual(ended);
  const stillClosed: LocalMerge = { kind: "merging", iid: 640, windowOpen: false };
  expect(await mergeRequests.findLocalMerge()).toEqual({ ok: true, value: stillClosed });
});
