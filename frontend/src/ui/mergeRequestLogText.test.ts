import { expect, test } from "vitest";

import type { JobLogReply } from "../ipc";
import {
  JOB_LOG_CUT,
  JOB_LOG_LOADING,
  JOB_LOG_SEARCH,
  JOB_LOG_WHOLE,
  jobLogRefusalText,
  jobLogTitle,
} from "./mergeRequestLogText";

type Refused = Exclude<JobLogReply, { readonly kind: "log" }>;

const REFUSALS: Readonly<Record<Refused["kind"], readonly [Refused, string]>> = {
  noLog: [{ kind: "noLog" }, "GitLab has no log for this job."],
  notOffered: [
    { kind: "notOffered" },
    "This job's log was not listed by GitLab, so yamt did not read it.",
  ],
  glabMissing: [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then press Shift over the job again.",
  ],
  notLoggedIn: [
    { kind: "notLoggedIn", detail: "gitlab.example: not logged in" },
    "glab is not logged in: gitlab.example: not logged in — run glab auth login in a terminal, then press Shift over the job again.",
  ],
  failed: [{ kind: "failed", message: "glab timed out" }, "Could not read the log: glab timed out"],
};

test("the log box's words", () => {
  expect(jobLogTitle("test:unit")).toBe("Log of test:unit");
  expect([JOB_LOG_LOADING, JOB_LOG_SEARCH, JOB_LOG_CUT, JOB_LOG_WHOLE]).toEqual([
    "Loading the log…",
    "Search the log",
    "Earlier lines are on GitLab.",
    "Open the whole log on GitLab",
  ]);
});

test.each(Object.values(REFUSALS))("a refused log says why: %o", (reply, words) => {
  expect(jobLogRefusalText(reply)).toBe(words);
});
