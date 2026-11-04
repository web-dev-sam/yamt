import { expect, test } from "vitest";

import {
  isMergeRequestIid,
  type DiscussionsAnswer,
  type ListEnd,
  type MergeRequestIid,
  type OpenReply,
  type RerequestReply,
  type PageOpened,
  type RangeStart,
} from "../ipc";
import { daysLeft, daysLeftText, dueDateText } from "../mergeRequests";
import type { NotDone, PeopleChangeFailure, PeopleSearch } from "./mergeRequests";
import {
  ADD_ASSIGNEE,
  ADD_REVIEWER,
  alreadyText,
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
  discussionsFailedText,
  discussionsText,
  dueDateLabel,
  jobTitle,
  listFailureText,
  MORE,
  moreLabel,
  narrowLabel,
  narrowPlaceholder,
  LOADING_TEXT,
  NO_ONE,
  NO_ONE_FOUND,
  NONE_TEXT,
  notValueLabel,
  openChangesTitle,
  openPageTitle,
  openReplyText,
  pageProblemText,
  peopleChangeText,
  peopleSearchText,
  REMOVE_ASSIGNEE,
  REMOVE_REVIEWER,
  REREQUEST_REVIEW,
  rerequestLabel,
  rerequestReplyText,
  REVIEW_MODE,
  REVIEWERS,
  SEARCH_PEOPLE,
  SEARCH_PEOPLE_PLACEHOLDER,
  SEARCHING_PEOPLE,
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

test.each<[Exclude<DiscussionsAnswer, { kind: "open" }>, string]>([
  [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [
    { kind: "notLoggedIn", detail: DETAIL },
    `glab is not logged in: ${DETAIL} — run glab auth login in a terminal, then Refresh.`,
  ],
  [{ kind: "failed", message: "500" }, "glab failed: 500"],
])("a refused row's discussions %j read %j in the box and the sort icon", (answer, words) => {
  expect(discussionsFailedText({ kind: "refused", answer }, "Linux x86_64")).toBe(words);
});

test("a row's discussions lost to an IPC failure read the problem bar's discussions words", () => {
  expect(
    discussionsFailedText({ kind: "failed", cause: { kind: "WorkerStopped" } }, "Linux x86_64"),
  ).toBe("Could not read the discussions: yamt's worker stopped; try again.");
});

test("review mode's button is named as the request names it", () => {
  expect(REVIEW_MODE).toBe("Review mode");
});

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
  [{ kind: "notOffered" }, "link", "This link was not listed by GitLab, so yamt did not open it."],
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

test("the people box's add, menu and search words are the request's and GitLab's", () => {
  expect([
    ADD_ASSIGNEE,
    ADD_REVIEWER,
    MORE,
    REMOVE_ASSIGNEE,
    REMOVE_REVIEWER,
    SEARCH_PEOPLE,
    SEARCH_PEOPLE_PLACEHOLDER,
    SEARCHING_PEOPLE,
    NO_ONE_FOUND,
    NO_ONE,
  ]).toEqual([
    "Add assignee",
    "Add reviewer",
    "More",
    "Remove assignee",
    "Remove reviewer",
    "Search people",
    "Search people…",
    "Searching…",
    "No one found",
    "None",
  ]);
});

test("a person's menu button is named after them; a person already there says which group", () => {
  expect(moreLabel("Anna Berg")).toBe("More for Anna Berg");
  expect(alreadyText("assignees")).toBe("Already an assignee");
  expect(alreadyText("reviewers")).toBe("Already a reviewer");
});

test.each<[Extract<PeopleSearch, { kind: "refused" | "failed" }>, string]>([
  [
    { kind: "refused", text: "er", reply: { kind: "glabMissing" } },
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [
    { kind: "refused", text: "er", reply: { kind: "notLoggedIn", detail: DETAIL } },
    `glab is not logged in: ${DETAIL} — run glab auth login in a terminal, then Refresh.`,
  ],
  [
    { kind: "refused", text: "er", reply: { kind: "failed", message: "no autocompleteUsers" } },
    "no autocompleteUsers",
  ],
  [
    { kind: "failed", text: "er", cause: { kind: "WorkerStopped" } },
    "Could not search people: yamt's worker stopped; try again.",
  ],
])("a search ending %j reads %j", (search, words) => {
  expect(peopleSearchText(search, "Linux x86_64")).toBe(words);
});

function notDone(
  group: "assignees" | "reviewers",
  action: "add" | "remove",
  why: PeopleChangeFailure,
): NotDone {
  return { change: { group, action, username: "olga" }, why };
}

test.each<[NotDone, string]>([
  [
    notDone("assignees", "add", { kind: "unchanged" }),
    "GitLab did not add @olga as assignee (GitLab Free allows one assignee per merge request).",
  ],
  [
    notDone("reviewers", "add", { kind: "unchanged" }),
    "GitLab did not add @olga as reviewer (GitLab Free allows one reviewer per merge request).",
  ],
  [notDone("reviewers", "remove", { kind: "unchanged" }), "GitLab still lists @olga as reviewer."],
  [notDone("assignees", "remove", { kind: "unchanged" }), "GitLab still lists @olga as assignee."],
  [
    notDone("assignees", "add", { kind: "refused", reply: { kind: "glabMissing" } }),
    "glab is not installed (not found on PATH) — install glab, then Refresh.",
  ],
  [
    notDone("assignees", "add", {
      kind: "refused",
      reply: { kind: "notLoggedIn", detail: DETAIL },
    }),
    `glab is not logged in: ${DETAIL} — run glab auth login in a terminal, then Refresh.`,
  ],
  [
    notDone("reviewers", "add", {
      kind: "refused",
      reply: { kind: "refused", message: "Cannot assign @olga to !640" },
    }),
    "Cannot assign @olga to !640",
  ],
  [
    notDone("reviewers", "remove", {
      kind: "refused",
      reply: { kind: "failed", message: "glab timed out" },
    }),
    "glab timed out",
  ],
  [
    notDone("assignees", "remove", { kind: "failed", cause: { kind: "WorkerStopped" } }),
    "Could not change the merge request's people: yamt's worker stopped; try again.",
  ],
])("a change GitLab did not make, %j, reads %j", (change, words) => {
  expect(peopleChangeText(change, "@olga", "Linux x86_64")).toBe(words);
});
