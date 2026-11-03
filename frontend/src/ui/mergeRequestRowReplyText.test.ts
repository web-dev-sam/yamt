import { expect, test } from "vitest";

import {
  isMergeRequestIid,
  type ContinueMergeReply,
  type MergeRequestIid,
  type Refusal,
  type ResolveRefusal,
  type ResolveReply,
  type Started,
} from "../ipc";
import { rowReplyText } from "./mergeRequestRowReplyText";

const DETAIL = "gitlab.example: No token found";

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

const IID = iid(13);

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
