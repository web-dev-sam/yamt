import { expect, test } from "vitest";

import { jobLogView, type JobLogView, type LogStyle } from "../mergeRequests";
import { isWebPage, type WebPage } from "./domain";
import { fixtureRows, LOGGED_OUT_DETAIL, ORIGIN } from "./fixtureMergeRequestData";
import { fixtureJobLog, LOGGED_OUT_LOG_IID, NO_LOG_IID } from "./fixtureMergeRequestLogs";
import type { JobLogReply } from "./mergeRequestDomain";

const MANY_ROWS = 500;
const MAX_LOG_BYTES = 512_000;
const TIMESTAMP = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z/u;
const SCRIPTED: ReadonlySet<number> = new Set([NO_LOG_IID, LOGGED_OUT_LOG_IID]);

function webPage(text: string): WebPage {
  if (!isWebPage(text)) {
    throw new Error(`${text} is not a web page`);
  }
  return text;
}

function listedPages(name: string): readonly WebPage[] {
  return fixtureRows(0, MANY_ROWS)
    .filter((row) => !SCRIPTED.has(row.iid))
    .flatMap((row) => row.pipeline?.failedJobs ?? [])
    .filter((job) => job.name === name)
    .map((job) => webPage(job.page ?? ""));
}

function pageOf(iid: number, name: string): WebPage {
  const row = fixtureRows(0, MANY_ROWS).find((listed) => listed.iid === iid);
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

test("every_listed_lint_job_has_its_short_coloured_log", () => {
  const pages = listedPages("lint:docs");
  expect(pages.length).toBeGreaterThan(SCRIPTED.size);
  const raw = logOf(fixtureJobLog(pages[0] ?? webPage(ORIGIN)));
  for (const page of pages) {
    expect(fixtureJobLog(page)).toEqual({ kind: "log", log: { text: raw.text, cut: false } });
  }
  const physical = raw.text.split("\n").filter((line) => line !== "");
  expect(physical.length).toBeGreaterThanOrEqual(40);
  expect(physical.length).toBeLessThanOrEqual(80);
  expect(physical.every((line) => TIMESTAMP.test(line))).toBe(true);
  const times = physical.map((line) => Date.parse(line.slice(0, "2026-10-30T09:00:01.123".length)));
  expect(times.every((time, at) => at === 0 || time > (times[at - 1] ?? time))).toBe(true);
  expect(raw.text).toContain("\r\n");
  expect(raw.text).toContain(" 00O+");
  expect(raw.text).toContain("\u001b[0Ksection_start:");
  expect(raw.text).toMatch(/00O section_start:\d+:prepare_script\[collapsed=true\]\r/u);
  expect(raw.text).toContain(":prepare_script[collapsed=true]\r\u001b[0K");

  const view = jobLogView(raw.text);
  const lines = view.text.split("\n");
  expect(view.text).not.toMatch(TIMESTAMP);
  expect(view.text).not.toContain("section_");
  expect(lines).toContain("<b>not bold</b> &amp; <script>x</script>");
  expect(lines).toContain("Preparing environment");
  expect(lines).toContain("Receiving objects: 100% (120/120), done.");
  expect(lines).toContain(
    "The command stopped at the first error in each file; see the list above for every error.",
  );
  expect(lines.filter((line) => line.includes("Error")).length).toBeGreaterThanOrEqual(1);
  expect(lines.filter((line) => line.includes("error")).length).toBeGreaterThanOrEqual(2);
  expect(lines.at(-1)).toBe("ERROR: Job failed: exit code 1");
  expect(runStyle(view, "MD013/line-length")?.foreground).toBe("red");
  expect(runStyle(view, "MD040/fenced-code-language")?.foreground).toBe("brightRed");
  expect(runStyle(view, "Summary:")?.bold).toBe(true);
  expect(runStyle(view, "warning")?.foreground).not.toBeNull();
  expect(runStyle(view, " BLOCKER ")?.background).not.toBeNull();
  expect(runStyle(view, "Error")?.foreground).not.toBeNull();
});

test("every_listed_unit_job_has_the_long_cut_log", () => {
  const pages = listedPages("test:unit");
  expect(pages.length).toBeGreaterThan(SCRIPTED.size);
  const raw = logOf(fixtureJobLog(pages[0] ?? webPage(ORIGIN)));
  for (const page of pages) {
    const log = logOf(fixtureJobLog(page));
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
  expect(fixtureJobLog(pageOf(NO_LOG_IID, "lint:docs"))).toEqual({ kind: "noLog" });
  expect(fixtureJobLog(pageOf(NO_LOG_IID, "test:unit"))).toEqual({
    kind: "failed",
    message: "glab timed out",
  });
  expect(fixtureJobLog(pageOf(LOGGED_OUT_LOG_IID, "lint:docs"))).toEqual({
    kind: "notLoggedIn",
    detail: LOGGED_OUT_DETAIL,
  });
  expect(fixtureJobLog(pageOf(LOGGED_OUT_LOG_IID, "test:unit"))).toEqual({ kind: "glabMissing" });
  const firstFailed = fixtureRows(0, MANY_ROWS).find(
    (row) => (row.pipeline?.failedJobs.length ?? 0) > 0,
  );
  expect([NO_LOG_IID, LOGGED_OUT_LOG_IID]).not.toContain(firstFailed?.iid);
});

test.each([
  `${ORIGIN}/-/merge_requests/640`,
  `${ORIGIN}/-/jobs/9002`,
  `${ORIGIN}/-/jobs/8990`,
  `${ORIGIN}/-/jobs/9000/raw`,
  "https://gitlab.another/taskboard/taskboard/-/jobs/9000",
  "https://gitlab.example/taskboard/otherbord/-/jobs/9001",
])("a_page_that_is_no_listed_job_is_not_offered: %s", (page) => {
  expect(fixtureJobLog(webPage(page))).toEqual({ kind: "notOffered" });
});
