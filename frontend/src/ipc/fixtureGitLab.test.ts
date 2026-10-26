import { expect, test } from "vitest";

import { gitLabCheck, pendingPosting, postOutcome, type GitLabScript } from "./fixtureGitLab";
import type { RangeStart } from "./rangeDomain";

const COMMIT_ID_RIGHT: RangeStart = {
  range: "1a2b3c4..5d6e7f8",
  left: { label: { kind: "named", name: "1a2b3c4" }, shortId: "1a2b3c4", subject: "Old" },
  right: { label: { kind: "named", name: "5d6e7f8" }, shortId: "5d6e7f8", subject: "New" },
  files: [],
};

test.each<GitLabScript>(["noMergeRequest", "several"])(
  "%s looks the merge requests up by the right side's name as a branch, even a commit id",
  (script) => {
    expect(gitLabCheck(script, COMMIT_ID_RIGHT)).toMatchObject({
      kind: "notLinedUp",
      why: { looked_at: { kind: "branch", name: "5d6e7f8" } },
    });
  },
);

test("only noBranch looks up by the right commit, even when the right side names a branch", () => {
  const named: RangeStart = {
    ...COMMIT_ID_RIGHT,
    right: { ...COMMIT_ID_RIGHT.right, label: { kind: "named", name: "feature" } },
  };

  expect(gitLabCheck("noBranch", named)).toEqual({
    kind: "notLinedUp",
    why: { kind: "noMergeRequest", looked_at: { kind: "commit", short_id: "5d6e7f8" } },
  });
});

test("a right side labelled as a merge base is refused as impossible", () => {
  const mergeBaseRight: RangeStart = {
    ...COMMIT_ID_RIGHT,
    right: {
      ...COMMIT_ID_RIGHT.right,
      label: { kind: "mergeBase", left: "main", right: "feature" },
    },
  };

  expect(() => gitLabCheck("noMergeRequest", mergeBaseRight)).toThrow(
    "a range's right side is never a merge base",
  );
});

test("a pending posting links the merge request's Changes page", () => {
  expect(pendingPosting("Hi", 7)).toEqual({
    kind: "pending",
    text: "Hi",
    draft_note: 7,
    merge_request: "!12",
    link: "https://gitlab.example.com/team/taskboard/-/merge_requests/12/diffs",
  });
});

test.each<[GitLabScript, number, string]>([
  ["linedUp", 0, "pending"],
  ["linedUp", 1, "pending"],
  ["refusal", 0, "pending"],
  ["refusal", 1, "refused"],
  ["refusal", 2, "pending"],
  ["stopped", 0, "pending"],
  ["stopped", 1, "stopped"],
  ["checking", 1, "pending"],
])("%s's post %i is %s", (script, index, outcome) => {
  expect(postOutcome(script, index)).toBe(outcome);
});
