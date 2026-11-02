import { expect, test } from "vitest";

import {
  readinessIcon,
  readinessText,
  rechecked,
  type BlockedReason,
  type Readiness,
  type ReadinessIcon,
} from "../index";

test.each<[BlockedReason, string]>([
  [{ kind: "draft" }, "Blocked: it is a draft"],
  [{ kind: "discussions" }, "Blocked: discussions are unresolved"],
  [{ kind: "approvals" }, "Blocked: approvals are missing"],
  [{ kind: "pipelineMustPass" }, "Blocked: the pipeline must pass"],
  [{ kind: "pipelineRunning" }, "Blocked: the pipeline is still running"],
  [{ kind: "changesRequested" }, "Blocked: a reviewer requested changes"],
  [{ kind: "dependencies" }, "Blocked: merge requests it depends on must be merged first"],
  [{ kind: "statusChecks" }, "Blocked: status checks must pass"],
  [{ kind: "jiraIssue" }, "Blocked: the title or description must name a Jira issue"],
  [{ kind: "lockedFiles" }, "Blocked: it changes LFS files someone locked"],
  [{ kind: "lockedPaths" }, "Blocked: it changes paths someone locked"],
  [{ kind: "mergeTime" }, "Blocked: it may not be merged at this time"],
  [{ kind: "notOpen" }, "Blocked: it is not open"],
  [{ kind: "sourceBranch" }, "Blocked: its source branch is missing or has no commits"],
  [{ kind: "securityPolicies" }, "Blocked: security policies are not satisfied"],
  [{ kind: "securityPipelines" }, "Blocked: security policy pipelines must pass"],
  [{ kind: "titleRule" }, "Blocked: its title does not match the project's rule"],
  [{ kind: "other", status: "MERGE_TRAIN_STUCK" }, 'Blocked: GitLab says "MERGE_TRAIN_STUCK"'],
])("a row blocked by %j says why, with the blocked icon", (reason, text) => {
  const blocked: Readiness = { kind: "blocked", reason };
  expect(readinessText(blocked)).toBe(text);
  expect(readinessIcon(blocked)).toBe("circle-slash");
});

test.each<[Readiness, string, ReadinessIcon]>([
  [{ kind: "ready" }, "Ready to merge", "circle-check"],
  [{ kind: "needsRebase" }, "Needs a rebase", "git-compare-arrows"],
  [{ kind: "checking" }, "GitLab is still checking whether it can be merged", "hourglass"],
  [{ kind: "conflicts", also: [] }, "Has conflicts", "git-merge-conflict"],
])("readiness %j has its own words and icon", (readiness, text, icon) => {
  expect(readinessText(readiness)).toBe(text);
  expect(readinessIcon(readiness)).toBe(icon);
});

test("a row yamt merged cleanly says so in its own words and icon, not ready's (catches a local check shown as GitLab's ready)", () => {
  const local: Readiness = { kind: "mergesCleanly" };
  const ready: Readiness = { kind: "ready" };
  expect(readinessText(local)).toBe(
    "No conflicts (checked locally). GitLab has not checked the rest yet",
  );
  expect(readinessIcon(local)).toBe("circle-dashed-check");
  expect(readinessText(local)).not.toBe(readinessText(ready));
  expect(readinessIcon(local)).not.toBe(readinessIcon(ready));
});

test("a conflicting row names its one other blocker after the conflict", () => {
  const readiness: Readiness = { kind: "conflicts", also: [{ kind: "discussions" }] };
  expect(readinessText(readiness)).toBe("Has conflicts. Also blocked: discussions are unresolved");
  expect(readinessIcon(readiness)).toBe("git-merge-conflict");
});

test("a conflicting row's two blockers are joined by a semicolon, in GitLab's order", () => {
  const readiness: Readiness = {
    kind: "conflicts",
    also: [{ kind: "pipelineMustPass" }, { kind: "draft" }],
  };
  expect(readinessText(readiness)).toBe(
    "Has conflicts. Also blocked: the pipeline must pass; it is a draft",
  );
});

test("an unknown blocker beside a conflict quotes GitLab's word", () => {
  const readiness: Readiness = {
    kind: "conflicts",
    also: [{ kind: "other", status: "MERGE_TRAIN_STUCK" }],
  };
  expect(readinessText(readiness)).toBe(
    'Has conflicts. Also blocked: GitLab says "MERGE_TRAIN_STUCK"',
  );
});

test("a checked row replaces only its own row's readiness and keeps the row and the order (catches another row or field changed)", () => {
  const rows: { iid: number; title: string; readiness: Readiness }[] = [
    { iid: 640, title: "newest", readiness: { kind: "conflicts", also: [] } },
    { iid: 638, title: "older", readiness: { kind: "checking" } },
  ];
  expect(rechecked(rows, { iid: 640, readiness: { kind: "mergesCleanly" } })).toEqual([
    { iid: 640, title: "newest", readiness: { kind: "mergesCleanly" } },
    { iid: 638, title: "older", readiness: { kind: "checking" } },
  ]);
});

test("a checked row whose iid is not listed changes nothing", () => {
  const rows: { iid: number; readiness: Readiness }[] = [
    { iid: 640, readiness: { kind: "ready" } },
  ];
  expect(rechecked(rows, { iid: 1, readiness: { kind: "mergesCleanly" } })).toEqual(rows);
});
