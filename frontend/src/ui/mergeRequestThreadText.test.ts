import { expect, test } from "vitest";

import {
  ADD_COMMENT,
  ADD_REVIEW,
  AUTHOR,
  CLOSE_THREAD,
  commentingReason,
  editedText,
  MAY_NOT_RESOLVE,
  NOTHING_TO_PREVIEW,
  OPEN_ON_GITLAB,
  PENDING,
  pendingText,
  PREVIEW,
  previewFailureText,
  REPLY_PLACEHOLDER,
  RESOLVE_THREAD,
  RESOLVED,
  SUBMIT_REVIEW,
  submitTip,
  THREAD_GONE,
  THREAD_LOADING,
  threadLabel,
  threadRefusalText,
  UNRESOLVE_THREAD,
  WRITE,
  writeFailureText,
} from "./mergeRequestThreadText";

const LINUX = "Linux x86_64";
const NOW = Date.parse("2026-11-04T12:00:00Z");
const DAY_MS = 86_400_000;
const STOPPED = { kind: "ipc", cause: { kind: "WorkerStopped" } } as const;
const DMITRI = { username: "dmitri", name: "Dmitri Volkov", picture: null };

test("the panel's fixed words", () => {
  expect([
    THREAD_LOADING,
    THREAD_GONE,
    RESOLVED,
    OPEN_ON_GITLAB,
    SUBMIT_REVIEW,
    CLOSE_THREAD,
    AUTHOR,
    PENDING,
    WRITE,
    PREVIEW,
    REPLY_PLACEHOLDER,
    NOTHING_TO_PREVIEW,
    ADD_REVIEW,
    ADD_COMMENT,
    RESOLVE_THREAD,
    UNRESOLVE_THREAD,
    MAY_NOT_RESOLVE,
  ]).toEqual([
    "Loading…",
    "This discussion is no longer on GitLab.",
    "Resolved",
    "Open on GitLab",
    "Submit review",
    "Close",
    "Author",
    "Pending",
    "Write",
    "Preview",
    "Write a reply… (Markdown)",
    "Nothing to preview.",
    "Add review",
    "Add comment",
    "Resolve thread",
    "Unresolve thread",
    "You may not resolve this thread.",
  ]);
  expect(threadLabel("src/app.ts:12")).toBe("Thread: src/app.ts:12");
});

test("pendingText and submitTip count the drafts, singular and plural", () => {
  expect(pendingText(3)).toBe("3 pending");
  expect(pendingText(1)).toBe("1 pending");
  expect(submitTip(3)).toBe("Publish your 3 pending comments on this merge request");
  expect(submitTip(2)).toBe("Publish your 2 pending comments on this merge request");
  expect(submitTip(1)).toBe("Publish your pending comment on this merge request");
});

test("editedText names the editor only when it is not the comment's author", () => {
  const edit = { at: NOW - 3 * DAY_MS, by: DMITRI };
  expect(editedText(edit, "sam", NOW)).toBe("· Edited 3 days ago by Dmitri Volkov");
  expect(editedText(edit, null, NOW)).toBe("· Edited 3 days ago by Dmitri Volkov");
  expect(editedText(edit, "dmitri", NOW)).toBe("· Edited 3 days ago");
  expect(editedText({ at: NOW, by: { ...DMITRI, name: " " } }, "sam", NOW)).toBe(
    "· Edited just now by dmitri",
  );
});

test("commentingReason words why the add buttons are disabled", () => {
  expect(commentingReason("allowed")).toBeNull();
  expect(commentingReason("locked")).toBe(
    "Comments on this merge request are locked to project members.",
  );
  expect(commentingReason("notAllowed")).toBe("You may not comment on this merge request.");
});

test("threadRefusalText: gone, glab's words with Retry, or GitLab's message", () => {
  expect(threadRefusalText({ kind: "notFound" }, LINUX)).toBe(
    "This discussion is no longer on GitLab.",
  );
  expect(threadRefusalText({ kind: "glabMissing" }, LINUX)).toBe(
    "glab is not installed (not found on PATH) — install glab, then Retry.",
  );
  expect(threadRefusalText({ kind: "notLoggedIn", detail: "gitlab.com" }, LINUX)).toBe(
    "glab is not logged in: gitlab.com — run glab auth login in a terminal, then Retry.",
  );
  expect(threadRefusalText({ kind: "failed", message: "glab timed out" }, LINUX)).toBe(
    "Could not read the thread: glab timed out",
  );
});

test.each([
  ["comment", "Could not add the comment"],
  ["draft", "Could not add the review comment"],
  ["resolve", "Could not resolve the thread"],
  ["unresolve", "Could not unresolve the thread"],
  ["submit", "Could not submit the review"],
] as const)("a failed %s says %s and why", (what, words) => {
  expect(writeFailureText(what, { kind: "refused", reason: "403 Forbidden" }, LINUX)).toBe(
    `${words}: 403 Forbidden`,
  );
  expect(writeFailureText(what, { kind: "failed", message: "glab timed out" }, LINUX)).toBe(
    `${words}: glab timed out`,
  );
  expect(writeFailureText(what, { kind: "glabMissing" }, LINUX)).toBe(
    `${words}: glab is not installed (not found on PATH)`,
  );
  expect(writeFailureText(what, { kind: "notLoggedIn", detail: "gitlab.com" }, LINUX)).toBe(
    `${words}: glab is not logged in: gitlab.com`,
  );
  expect(writeFailureText(what, STOPPED, LINUX)).toBe(
    `${words}: yamt's worker stopped; try again.`,
  );
});

test("previewFailureText: Could not preview, with glab's words or the cause", () => {
  expect(
    previewFailureText({ kind: "refused", reply: { kind: "failed", message: "timed out" } }, LINUX),
  ).toBe("Could not preview: timed out");
  expect(previewFailureText({ kind: "refused", reply: { kind: "glabMissing" } }, LINUX)).toBe(
    "Could not preview: glab is not installed (not found on PATH)",
  );
  expect(
    previewFailureText(
      { kind: "refused", reply: { kind: "notLoggedIn", detail: "gitlab.com" } },
      LINUX,
    ),
  ).toBe("Could not preview: glab is not logged in: gitlab.com");
  expect(previewFailureText({ kind: "failed", cause: { kind: "WorkerStopped" } }, LINUX)).toBe(
    "Could not preview: yamt's worker stopped; try again.",
  );
});
