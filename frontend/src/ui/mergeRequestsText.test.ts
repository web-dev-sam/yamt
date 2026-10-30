import { expect, test } from "vitest";

import {
  isMergeRequestIid,
  type ListEnd,
  type MergeRequestIid,
  type OpenReply,
  type PageOpened,
  type RangeStart,
} from "../ipc";
import {
  approvalsText,
  clearFilterTitle,
  discussionsText,
  jobTitle,
  listFailureText,
  narrowLabel,
  narrowPlaceholder,
  LOADING_TEXT,
  NONE_TEXT,
  openChangesTitle,
  openPageTitle,
  openReplyText,
  pageProblemText,
  type PageKind,
} from "./mergeRequestsText";
import { notLinedUpText } from "./rangeThreadText";

const START: RangeStart = {
  range: "main..feature",
  left: { label: { kind: "named", name: "main" }, shortId: "1b2cfed", subject: "Start" },
  right: { label: { kind: "named", name: "feature" }, shortId: "2b3b4b5", subject: "Next" },
  files: [],
};

const DETAIL = "gitlab.example: No token found";

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

const IID = iid(13);

test("the page's loading and empty words are the request's (rule 3)", () => {
  expect([LOADING_TEXT, NONE_TEXT]).toEqual(["Loading merge requests…", "No open merge requests."]);
});

test.each<[ListEnd, string | null]>([
  [{ kind: "loaded" }, null],
  [{ kind: "cut", limit: 500 }, null],
  [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [
    { kind: "notLoggedIn", detail: DETAIL },
    `glab is not logged in: ${DETAIL} — run glab auth login in a terminal, then Refresh.`,
  ],
  [{ kind: "failed", message: "glab timed out" }, "glab failed: glab timed out"],
])("the list end %j is a failure reading %j, or none when the list was listed", (end, words) => {
  expect(listFailureText(end)).toBe(words);
});

test.each([
  [0, "0 open discussions", "0 approvals"],
  [1, "1 open discussion", "1 approval"],
  [2, "2 open discussions", "2 approvals"],
])("a row's counts of %i read %j and %j", (count, discussions, approvals) => {
  expect(discussionsText(count)).toBe(discussions);
  expect(approvalsText(count)).toBe(approvals);
});

test("a row's button and a job's title name what they open; a job without a page says why", () => {
  expect(openChangesTitle(IID)).toBe("Open the changes of !13");
  expect(openPageTitle(IID, "Fix: the login form")).toBe("Open !13 on GitLab: Fix: the login form");
  expect(jobTitle("test", "https://gitlab.example/taskboard/taskboard/-/jobs/9001")).toBe(
    "Open the log of test on GitLab",
  );
  expect(jobTitle("test", null)).toBe("GitLab gave no address for this job's log");
});

test("a filter's clear button and narrowing box name the filter; the placeholder in lower case", () => {
  expect(clearFilterTitle("Reviewer")).toBe("Clear the Reviewer filter");
  expect(narrowLabel("Label")).toBe("Narrow the Label list");
  expect(narrowPlaceholder("Label")).toBe("Find label…");
});

test.each<[Exclude<OpenReply, { kind: "opened" }>, string]>([
  [{ kind: "alreadyOpen" }, "!13 is already open in another yamt window."],
  [{ kind: "preparing" }, "GitLab is still preparing the changes of !13; try again in a moment."],
  [{ kind: "notOpen" }, "!13 is no longer open."],
  [
    { kind: "noRemote", project: "taskboard/taskboard" },
    "No remote of this repository points to taskboard/taskboard, so !13 cannot be fetched.",
  ],
  [{ kind: "fetchFailed", message: "no route to host" }, "Could not fetch !13: no route to host"],
  [
    { kind: "missingCommit", shortId: "531ea52" },
    "Commit 531ea52 of !13 is not in the repository, even after fetching.",
  ],
  [
    { kind: "startFailed", message: "permission denied" },
    "Could not start a window for !13: permission denied",
  ],
  [{ kind: "glabMissing" }, "glab is not installed (not found on PATH)"],
  [{ kind: "notLoggedIn", detail: DETAIL }, `glab is not logged in: ${DETAIL}`],
  [{ kind: "failed", message: "500" }, "glab failed: 500"],
])("the open reply %j reads %j", (reply, words) => {
  expect(openReplyText(reply, IID)).toBe(words);
});

test.each<[PageOpened, PageKind, string | null]>([
  [{ kind: "opened" }, "job", null],
  [{ kind: "opened" }, "mergeRequest", null],
  [
    { kind: "notOffered" },
    "job",
    "This job's page was not listed by GitLab, so yamt did not open it.",
  ],
  [
    { kind: "notOffered" },
    "mergeRequest",
    "This merge request's page was not listed by GitLab, so yamt did not open it.",
  ],
  [
    { kind: "failed", message: "xdg-open: not found" },
    "mergeRequest",
    "Could not open the browser: xdg-open: not found",
  ],
  [{ kind: "failed", message: "no opener" }, "job", "Could not open the browser: no opener"],
])("the answer %j for a %s page shows %j", (opened, clicked, words) => {
  expect(pageProblemText(opened, clicked)).toBe(words);
});

test("glab's words are the Send button's (catches the two drifting apart)", () => {
  const missing = notLinedUpText({ kind: "glabMissing" }, START);
  const loggedOut = notLinedUpText({ kind: "notLoggedIn", detail: DETAIL }, START);
  const failed = notLinedUpText({ kind: "failed", message: "boom" }, START);

  expect(listFailureText({ kind: "glabMissing" })?.startsWith(`${missing} — `)).toBe(true);
  expect(
    listFailureText({ kind: "notLoggedIn", detail: DETAIL })?.startsWith(`${loggedOut} — `),
  ).toBe(true);
  expect(listFailureText({ kind: "failed", message: "boom" })).toBe(failed);
  expect(openReplyText({ kind: "glabMissing" }, IID)).toBe(missing);
  expect(openReplyText({ kind: "notLoggedIn", detail: DETAIL }, IID)).toBe(loggedOut);
  expect(openReplyText({ kind: "failed", message: "boom" }, IID)).toBe(failed);
});
