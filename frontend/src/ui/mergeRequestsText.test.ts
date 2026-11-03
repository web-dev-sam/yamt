import { expect, test } from "vitest";

import {
  isMergeRequestIid,
  type DiscussionsAnswer,
  type ListEnd,
  type MergeRequestIid,
  type OpenReply,
  type RerequestReply,
  type ContinueMergeReply,
  type Refusal,
  type ResolveRefusal,
  type ResolveReply,
  type Started,
  type PageOpened,
  type RangeStart,
} from "../ipc";
import { daysLeft, daysLeftText, dueDateText } from "../mergeRequests";
import {
  approvalsText,
  ASSIGNEES,
  CLEAR_DUE_DATE,
  DUE_DATE_DIALOG,
  DUE_DATE_PLACEHOLDER,
  NEXT_MONTH,
  PICK_TODAY,
  PREVIOUS_MONTH,
  clearFilterTitle,
  DISCUSSION_DETAILS,
  DISCUSSION_DETAILS_HINT,
  DISCUSSION_DETAILS_OPTIONS,
  DISCUSSIONS_LOADING,
  glabRefusalText,
  discussionsText,
  dueDateLabel,
  jobTitle,
  listFailureText,
  narrowLabel,
  narrowPlaceholder,
  LOADING_TEXT,
  NONE_TEXT,
  notValueLabel,
  openChangesTitle,
  openPageTitle,
  openReplyText,
  pageProblemText,
  REREQUEST_REVIEW,
  rerequestLabel,
  rerequestReplyText,
  REVIEWERS,
  rowReplyText,
  SET_DUE_DATE,
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

test.each<[Exclude<DiscussionsAnswer, { kind: "open" }>, string]>([
  [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [
    { kind: "notLoggedIn", detail: DETAIL },
    `glab is not logged in: ${DETAIL} — run glab auth login in a terminal, then Refresh.`,
  ],
  [{ kind: "failed", message: "glab timed out" }, "glab failed: glab timed out"],
])(
  "a refused discussions answer %j reads %j, the list's words (catches the two drifting apart)",
  (answer, words) => {
    expect(glabRefusalText(answer)).toBe(words);
  },
);

test("the discussion box's and setting's words are the request's (a renamed choice or hint)", () => {
  expect(DISCUSSIONS_LOADING).toBe("Loading discussions…");
  expect(DISCUSSION_DETAILS).toBe("Discussion details");
  expect(DISCUSSION_DETAILS_OPTIONS).toEqual([
    { value: "full", label: "Load fully" },
    { value: "lazy", label: "Load lazily" },
    { value: "off", label: "Off" },
  ]);
  expect(DISCUSSION_DETAILS_HINT).toBe(
    "On the merge-request page: every listed merge request's open discussions, right after the list; one " +
      "merge request's, when you first hover its count; or none.",
  );
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
  expect(openChangesTitle()).toBe("Show Diff");
  expect(openPageTitle(IID, "Fix: the login form")).toBe("Open !13 on GitLab: Fix: the login form");
  expect(jobTitle("test", "https://gitlab.example/taskboard/taskboard/-/jobs/9001")).toBe(
    "Open the log of test on GitLab. Shift: show the log here",
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
    { kind: "notOffered" },
    "discussion",
    "This comment's page was not listed by GitLab, so yamt did not open it.",
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

const STARTED: Started = { branch: "feature/x", target: "main", conflicts: true };
const RUN_YAMT = "Run yamt in this repository to finish or abort it.";

function resolved(reply: ResolveReply): { text: string; refused: boolean } {
  return rowReplyText({ kind: "resolve", reply }, IID);
}

test("a started merge with conflicts says where it merges, not refused", () => {
  expect(resolved({ kind: "started", started: STARTED })).toEqual({
    text: "Merging main into feature/x in a new window.",
    refused: false,
  });
});

test("a started merge without conflicts says GitLab's conflict was stale, not refused", () => {
  expect(resolved({ kind: "started", started: { ...STARTED, conflicts: false } })).toEqual({
    text: "main merges into feature/x without conflicts after all; check and commit it in the new window.",
    refused: false,
  });
});

test("a started merge whose window failed names git's merge and the way to finish it, refused", () => {
  expect(resolved({ kind: "windowFailed", started: STARTED, message: "yamt: not found" })).toEqual({
    text: `Merging main into feature/x, but its window did not start: yamt: not found. ${RUN_YAMT}`,
    refused: true,
  });
});

test.each<[Refusal, string]>([
  [
    { kind: "alreadyMerging", iid: 21 },
    "The merge of !21 is not finished in this repository; continue or abort it first.",
  ],
  [
    { kind: "alreadyMerging", iid: null },
    "Another merge is starting in this repository; try again in a moment.",
  ],
  [
    { kind: "busy" },
    "git is in the middle of another operation (a merge, rebase, cherry-pick, …) in this repository; finish or abort it first.",
  ],
  [
    { kind: "uncommittedChanges" },
    "This checkout has uncommitted changes to tracked files; commit or stash them first.",
  ],
  [
    { kind: "fetchFailed", message: "fatal: unable to access" },
    "Could not fetch the branches of !13: fatal: unable to access",
  ],
  [
    { kind: "localAhead", branch: "feature/x" },
    "Your local feature/x has commits that GitLab's feature/x does not have; yamt never drops a local commit. Push or move them first.",
  ],
  [
    { kind: "alreadyContains", branch: "feature/x", target: "main" },
    "feature/x already contains main: there is nothing to merge.",
  ],
  [
    { kind: "gitRefused", message: "error: boom", left: [] },
    "git refused to start the merge: error: boom",
  ],
  [
    {
      kind: "gitRefused",
      message: "error: boom",
      left: [
        { kind: "notReturned", to: { kind: "branch", name: "develop" } },
        { kind: "branchCheckedOut", branch: "feature/x" },
      ],
    },
    "git refused to start the merge: error: boom yamt could not put everything back: HEAD moved after the merge started, so yamt did not check out develop again.; feature/x is still checked out, so yamt did not delete it.",
  ],
  [
    { kind: "recordUnreadable", path: ".git/yamt-merge-request.json", message: "bad json" },
    "yamt cannot read its record of an earlier merge (.git/yamt-merge-request.json): bad json. Delete it if no merge is in progress.",
  ],
])("the refusal %j reads %j, refused", (refusal, text) => {
  expect(resolved({ kind: "refused", refusal })).toEqual({ text, refused: true });
});

test.each<[ResolveRefusal, string]>([
  [{ kind: "notOpen" }, "!13 is no longer open."],
  [{ kind: "fromFork" }, "Resolving a fork's merge request is not supported."],
  [
    { kind: "noRemote", project: "taskboard/taskboard" },
    "No remote of this repository points to taskboard/taskboard, so !13 cannot be fetched.",
  ],
  [{ kind: "glabMissing" }, "glab is not installed (not found on PATH)"],
  [{ kind: "notLoggedIn", detail: DETAIL }, `glab is not logged in: ${DETAIL}`],
  [{ kind: "failed", message: "500" }, "glab failed: 500"],
])("GitLab's refusal %j reads %j, refused", (refusal, text) => {
  expect(resolved({ kind: "gitLabRefused", refusal })).toEqual({ text, refused: true });
});

test.each<[ContinueMergeReply, string, boolean]>([
  [
    { kind: "opened", branch: "feature/x", target: "main" },
    "Merging main into feature/x in a new window.",
    false,
  ],
  [{ kind: "alreadyOpen" }, "The merge window of !13 is already open.", true],
  [{ kind: "ended" }, "The merge of !13 is no longer in progress.", true],
  [
    { kind: "windowFailed", message: "yamt: not found" },
    `The merge window did not start: yamt: not found. ${RUN_YAMT}`,
    true,
  ],
])("the continue reply %j reads %j", (reply, text, refused) => {
  expect(rowReplyText({ kind: "continue", reply }, IID)).toEqual({ text, refused });
});

test("the people box, re-request and due-date words are GitLab's and the request's", () => {
  expect([ASSIGNEES, REVIEWERS, REREQUEST_REVIEW, SET_DUE_DATE, CLEAR_DUE_DATE]).toEqual([
    "Assignees",
    "Reviewers",
    "Re-request review",
    "Set a due date",
    "Clear",
  ]);
});

test("the date picker's words are the request's, the field asks for day first", () => {
  expect([DUE_DATE_DIALOG, DUE_DATE_PLACEHOLDER, PICK_TODAY, PREVIOUS_MONTH, NEXT_MONTH]).toEqual([
    "Choose a due date",
    "DD.MM.YYYY",
    "Today",
    "Previous month",
    "Next month",
  ]);
});

test("the re-request button is named after its reviewer", () => {
  expect(rerequestLabel("Anna Berg")).toBe("Re-request review from Anna Berg");
});

test.each<[Exclude<RerequestReply, { kind: "requested" }>, string]>([
  [{ kind: "notReviewer" }, "Anna Berg is no longer a reviewer of this merge request."],
  [{ kind: "notOpen" }, "This merge request is no longer open."],
  [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [
    { kind: "notLoggedIn", detail: DETAIL },
    `glab is not logged in: ${DETAIL} — run glab auth login in a terminal, then Refresh.`,
  ],
  [{ kind: "refused", message: "Reviewer not found" }, "Reviewer not found"],
  [{ kind: "failed", message: "timed out" }, "timed out"],
])("the re-request reply %j reads %j", (reply, text) => {
  expect(rerequestReplyText(reply, "Anna Berg")).toBe(text);
});

test("a refused re-request reads the list's sentence for the same glab problem", () => {
  expect(rerequestReplyText({ kind: "glabMissing" }, "Anna Berg")).toBe(
    listFailureText({ kind: "glabMissing" }),
  );
  expect(rerequestReplyText({ kind: "notLoggedIn", detail: DETAIL }, "Anna Berg")).toBe(
    listFailureText({ kind: "notLoggedIn", detail: DETAIL }),
  );
});

test("the due-date button names the date day first, the days left and what a click does", () => {
  const due = { year: 2026, month: 11, day: 3 };
  const now = new Date(2026, 10, 2, 12).getTime();
  expect(dueDateLabel(dueDateText(due), daysLeftText(daysLeft(due, now)).text)).toBe(
    "Due 03.11.2026, 1 day left. Change the due date",
  );
});

test("an excluded value is named with not", () => {
  expect(notValueLabel("anna")).toBe("not anna");
});
