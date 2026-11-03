import { expect, test } from "vitest";

import { jobLogView, type JobLogView, type LogStyle } from "../mergeRequests";
import { isWebPage, type WebPage } from "./domain";
import { fixtureRows, LOGGED_OUT_DETAIL, ORIGIN } from "./fixtureMergeRequestData";
import { fixtureJobLog, LOGGED_OUT_LOG_IID, NO_LOG_IID } from "./fixtureMergeRequestLogs";
import type { JobLogReply } from "./mergeRequestDomain";

const MANY_ROWS = 500;
const MAX_LOG_BYTES = 512_000;
const TIMESTAMP = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z/u;
const STAMPED = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z 00O[ +]/u;
const SECTIONS = 6;
const SCRIPTED: ReadonlySet<number> = new Set([NO_LOG_IID, LOGGED_OUT_LOG_IID]);
const LISTED = fixtureRows(0, MANY_ROWS);

function webPage(text: string): WebPage {
  if (!isWebPage(text)) {
    throw new Error(`${text} is not a web page`);
  }
  return text;
}

function listedPages(name: string): readonly WebPage[] {
  return LISTED.filter((row) => !SCRIPTED.has(row.iid))
    .flatMap((row) => row.pipeline?.failedJobs ?? [])
    .filter((job) => job.name === name)
    .map((job) => webPage(job.page ?? ""));
}

function pageOf(iid: number, name: string): WebPage {
  const row = LISTED.find((listed) => listed.iid === iid);
  const job = row?.pipeline?.failedJobs.find((failed) => failed.name === name);
  return webPage(job?.page ?? "");
}

function logOf(reply: JobLogReply): { readonly text: string; readonly cut: boolean } {
  if (reply.kind !== "log") {
    throw new Error(`no log: ${reply.kind}`);
  }
  return reply.log;
}

function runStyle(view: JobLogView, text: string): LogStyle | undefined {
  return view.lines.flatMap((line) => line.runs).find((run) => run.text === text)?.style;
}

function runsOf(view: JobLogView, shown: string): readonly (readonly [string, unknown, unknown])[] {
  const line = view.lines.find((each) => each.runs.map((run) => run.text).join("") === shown);
  return (line?.runs ?? []).map((run) => [run.text, run.style.foreground, run.style.background]);
}

test("every_listed_lint_job_has_its_short_coloured_log", () => {
  const pages = listedPages("lint:docs");
  expect(pages.length).toBeGreaterThan(SCRIPTED.size);
  const raw = logOf(fixtureJobLog(pages[0] ?? webPage(ORIGIN), LISTED));
  for (const page of pages) {
    expect(fixtureJobLog(page, LISTED)).toEqual({
      kind: "log",
      log: { text: raw.text, cut: false },
    });
  }
  const physical = raw.text.split("\n").filter((line) => line !== "");
  expect(physical.length).toBeGreaterThanOrEqual(40);
  expect(physical.length).toBeLessThanOrEqual(80);
  expect(physical.every((line) => STAMPED.test(line))).toBe(true);
  const times = physical.map((line) => Date.parse(line.slice(0, "2026-10-30T09:00:01.123".length)));
  expect(times.every((time, at) => at === 0 || time > (times[at - 1] ?? time))).toBe(true);
  expect(raw.text).toContain("\r\n");
  expect(raw.text).toContain(" 00O+");
  expect(raw.text).toContain("\u001b[0Ksection_start:");
  expect(raw.text.match(/section_start:/gu)).toHaveLength(SECTIONS);
  expect(raw.text.match(/section_end:\d+:\w+\r/gu)).toHaveLength(SECTIONS);
  expect(raw.text).toMatch(/00O section_start:\d+:prepare_script\[collapsed=true\]\r/u);
  expect(raw.text).toContain(":prepare_script[collapsed=true]\r\u001b[0K");

  const view = jobLogView(raw.text);
  expect(view.text.split("\n")).toEqual([
    "itleRunning with gitlab-runner 17.5.0 (8ec04662)",
    "  on docker-auto-scale-1 ZxAiwUvB, system ID: s_4c1a2b3d5e6f",
    'Preparing the "docker+machine" executor',
    "Using Docker executor with image node:22-bookworm ...",
    "Pulling docker image node:22-bookworm ...",
    "Preparing environment",
    "Running on runner-zxaiwuvb-project-42-concurrent-0 via runner-manager-1...",
    "Getting source from Git repository",
    "Fetching changes with git depth set to 20...",
    "Receiving objects: 100% (120/120), done.",
    "Checking out 3f9c2a1b as detached HEAD (ref is refs/merge-requests/632/head)...",
    'Executing "step_script" stage of the job script',
    "$ pnpm install --frozen-lockfile",
    "Lockfile is up to date, resolution step is skipped",
    "Progress: resolved 812, reused 812, downloaded 0, added 812, done",
    "$ pnpm lint:docs",
    "> taskboard@1.4.0 lint:docs /builds/taskboard/taskboard",
    '> markdownlint "docs/**/*.md"',
    "docs/setup.md:12 MD013/line-length Line length [Expected: 120; Actual: 143]",
    "docs/setup.md:40 MD040/fenced-code-language Fenced code blocks should have a language specified",
    "docs/api.md:7 MD025/single-h1 Multiple top-level headings in the same document",
    "docs/api.md:88 MD034/no-bare-urls Bare URL used",
    "Summary: 4 errors in 2 files",
    "warning: docs/changelog.md is older than the last release",
    " BLOCKER  the docs build has been broken since 1.3.9",
    "Error: markdownlint found 4 problems",
    "<b>not bold</b> &amp; <script>x</script>",
    "hint: run pnpm lint:docs --fix to fix 2 of them",
    "note: the rules live in .markdownlint.jsonc",
    "The command stopped at the first error in each file; see the list above for every error.",
    " ELIFECYCLE  Command failed with exit code 1.",
    "Uploading artifacts for failed job",
    "Uploading artifacts...",
    "WARNING: report.xml: no matching files. Ensure that the artifact path is relative to the working directory",
    "ERROR: No files to upload",
    "Cleaning up project directory and file based variables",
    "ERROR: Job failed: exit code 1",
  ]);
  expect(runStyle(view, "MD013/line-length")?.foreground).toBe("red");
  expect(runStyle(view, "MD040/fenced-code-language")?.foreground).toBe("brightRed");
  expect(runStyle(view, "Summary:")?.bold).toBe(true);
  expect(runsOf(view, "warning: docs/changelog.md is older than the last release")).toEqual([
    ["warning", "yellow", null],
    [": docs/changelog.md is older than the last release", null, null],
  ]);
  expect(runsOf(view, " BLOCKER  the docs build has been broken since 1.3.9")).toEqual([
    [" BLOCKER ", "brightWhite", "brightRed"],
    [" the docs build has been broken since 1.3.9", null, null],
  ]);
  expect(runsOf(view, "Error: markdownlint found 4 problems")).toEqual([
    ["Error: markdownlint found 4 problems", null, null],
  ]);
});

test("every_listed_unit_job_has_the_long_cut_log", () => {
  const pages = listedPages("test:unit");
  expect(pages.length).toBeGreaterThan(SCRIPTED.size);
  const raw = logOf(fixtureJobLog(pages[0] ?? webPage(ORIGIN), LISTED));
  for (const page of pages) {
    const log = logOf(fixtureJobLog(page, LISTED));
    expect(log.cut).toBe(true);
    expect(log.text).toBe(raw.text);
  }
  expect(new TextEncoder().encode(raw.text).length).toBeLessThanOrEqual(MAX_LOG_BYTES);
  expect(raw.text.split("\n")[0]).toMatch(TIMESTAMP);

  const view = jobLogView(raw.text);
  const lines = view.text.split("\n");
  expect(view.lines.length).toBeGreaterThanOrEqual(8000);
  expect(view.text).not.toMatch(TIMESTAMP);
  expect(lines[0]).toBe("$ pnpm test:unit");
  expect(lines.slice(1, 3)).toEqual(["PASS t1.ts", "PASS t2.ts"]);
  expect(lines[97]).toBe("FAIL t97.ts");
  expect(view.lines[1]?.runs.map((run) => [run.text, run.style.foreground])).toEqual([
    ["PASS t1.ts", null],
  ]);
  expect(view.lines[2]?.runs.map((run) => [run.text, run.style.foreground])).toEqual([
    ["PASS", "green"],
    [" t2.ts", null],
  ]);
  expect(
    view.lines[97]?.runs.map((run) => [run.text, run.style.foreground, run.style.bold]),
  ).toEqual([
    ["FAIL", "brightRed", true],
    [" t97.ts", null, false],
  ]);
  expect(lines.at(-1)).toBe("ERROR: Job failed: exit code 1");
});

test("the_scripted_rows_refuse_as_named", () => {
  expect(NO_LOG_IID).not.toBe(LOGGED_OUT_LOG_IID);
  expect(fixtureJobLog(pageOf(NO_LOG_IID, "lint:docs"), LISTED)).toEqual({ kind: "noLog" });
  expect(fixtureJobLog(pageOf(NO_LOG_IID, "test:unit"), LISTED)).toEqual({
    kind: "failed",
    message: "glab timed out",
  });
  expect(fixtureJobLog(pageOf(LOGGED_OUT_LOG_IID, "lint:docs"), LISTED)).toEqual({
    kind: "notLoggedIn",
    detail: LOGGED_OUT_DETAIL,
  });
  expect(fixtureJobLog(pageOf(LOGGED_OUT_LOG_IID, "test:unit"), LISTED)).toEqual({
    kind: "glabMissing",
  });
  const firstFailed = LISTED.find((row) => (row.pipeline?.failedJobs.length ?? 0) > 0);
  expect([NO_LOG_IID, LOGGED_OUT_LOG_IID]).not.toContain(firstFailed?.iid);
});

test.each([
  `${ORIGIN}/-/merge_requests/640`,
  `${ORIGIN}/-/jobs/9002`,
  `${ORIGIN}/-/jobs/9010`,
  `${ORIGIN}/-/jobs/8990`,
  `${ORIGIN}/-/jobs/99990`,
  `${ORIGIN}/-/jobs/9000/raw`,
  "https://gitlab.another/taskboard/taskboard/-/jobs/9000",
  "https://gitlab.example/taskboard/otherbord/-/jobs/9001",
])("a_page_that_is_no_listed_job_is_not_offered: %s", (page) => {
  expect(fixtureJobLog(webPage(page), LISTED)).toEqual({ kind: "notOffered" });
});

test("a_job_page_answers_only_while_its_row_is_listed", () => {
  const page = listedPages("lint:docs")[0] ?? webPage(ORIGIN);
  expect(fixtureJobLog(page, LISTED).kind).toBe("log");
  expect(fixtureJobLog(page, [])).toEqual({ kind: "notOffered" });
});

test("a_listed_job_of_another_name_has_no_log", () => {
  const row = LISTED.find((listed) => !SCRIPTED.has(listed.iid) && listed.pipeline !== null);
  const pipeline = row?.pipeline;
  if (row === undefined || pipeline === null || pipeline === undefined) {
    throw new Error("the fixture lists no row with a pipeline");
  }
  const page = webPage(`${ORIGIN}/-/jobs/1`);
  const build = { name: "build", stage: "build", allowFailure: false, page };
  const listed = [{ ...row, pipeline: { ...pipeline, failedJobs: [build] } }];
  expect(fixtureJobLog(page, listed)).toEqual({ kind: "notOffered" });
});
