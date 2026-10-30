import { expect, test } from "vitest";

import {
  isMergeRequestIid,
  type JobOpened,
  type ListEnd,
  type MergeRequestIid,
  type OpenReply,
  type RangeStart,
} from "../ipc";
import {
  jobOpenedText,
  listEndText,
  LOADING_TEXT,
  NONE_TEXT,
  openReplyText,
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

test.each<[ListEnd, string]>([
  [{ kind: "loaded" }, "Loaded the open merge requests."],
  [{ kind: "cut", limit: 500 }, "Only the newest 500 merge requests are listed; GitLab has more."],
  [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [
    { kind: "notLoggedIn", detail: DETAIL },
    `glab is not logged in: ${DETAIL} — run glab auth login in a terminal, then Refresh.`,
  ],
  [{ kind: "failed", message: "glab timed out" }, "glab failed: glab timed out"],
])("the list end %j reads %j", (end, words) => {
  expect(listEndText(end)).toBe(words);
});

test.each<[OpenReply, string]>([
  [{ kind: "opened" }, "Opened !13 in a new window."],
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

test.each<[JobOpened, string]>([
  [{ kind: "opened" }, "Opened the job's log in the browser."],
  [{ kind: "notOffered" }, "This job's page was not listed by GitLab, so yamt did not open it."],
  [
    { kind: "failed", message: "xdg-open: not found" },
    "Could not open the browser: xdg-open: not found",
  ],
])("the job answer %j reads %j", (opened, words) => {
  expect(jobOpenedText(opened)).toBe(words);
});

test("glab's words are the Send button's (catches the two drifting apart)", () => {
  const missing = notLinedUpText({ kind: "glabMissing" }, START);
  const loggedOut = notLinedUpText({ kind: "notLoggedIn", detail: DETAIL }, START);
  const failed = notLinedUpText({ kind: "failed", message: "boom" }, START);

  expect(listEndText({ kind: "glabMissing" }).startsWith(`${missing} — `)).toBe(true);
  expect(listEndText({ kind: "notLoggedIn", detail: DETAIL }).startsWith(`${loggedOut} — `)).toBe(
    true,
  );
  expect(listEndText({ kind: "failed", message: "boom" })).toBe(failed);
  expect(openReplyText({ kind: "glabMissing" }, IID)).toBe(missing);
  expect(openReplyText({ kind: "notLoggedIn", detail: DETAIL }, IID)).toBe(loggedOut);
  expect(openReplyText({ kind: "failed", message: "boom" }, IID)).toBe(failed);
});
