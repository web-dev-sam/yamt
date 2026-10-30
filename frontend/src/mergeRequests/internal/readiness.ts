type NamedReason =
  | "draft"
  | "discussions"
  | "approvals"
  | "pipelineMustPass"
  | "pipelineRunning"
  | "changesRequested"
  | "dependencies"
  | "statusChecks"
  | "jiraIssue"
  | "lockedFiles"
  | "lockedPaths"
  | "mergeTime"
  | "notOpen"
  | "sourceBranch"
  | "securityPolicies"
  | "securityPipelines"
  | "titleRule";

export type BlockedReason =
  | { readonly kind: NamedReason }
  | { readonly kind: "other"; readonly status: string };

export type Readiness =
  | { readonly kind: "ready" }
  | { readonly kind: "conflicts"; readonly also: readonly BlockedReason[] }
  | { readonly kind: "needsRebase" }
  | { readonly kind: "checking" }
  | { readonly kind: "blocked"; readonly reason: BlockedReason };

export type ReadinessIcon =
  | "circle-check"
  | "git-merge-conflict"
  | "git-compare-arrows"
  | "hourglass"
  | "circle-slash";

const REASON_TEXTS: Readonly<Record<NamedReason, string>> = {
  draft: "it is a draft",
  discussions: "discussions are unresolved",
  approvals: "approvals are missing",
  pipelineMustPass: "the pipeline must pass",
  pipelineRunning: "the pipeline is still running",
  changesRequested: "a reviewer requested changes",
  dependencies: "merge requests it depends on must be merged first",
  statusChecks: "status checks must pass",
  jiraIssue: "the title or description must name a Jira issue",
  lockedFiles: "it changes LFS files someone locked",
  lockedPaths: "it changes paths someone locked",
  mergeTime: "it may not be merged at this time",
  notOpen: "it is not open",
  sourceBranch: "its source branch is missing or has no commits",
  securityPolicies: "security policies are not satisfied",
  securityPipelines: "security policy pipelines must pass",
  titleRule: "its title does not match the project's rule",
};

const ICONS: Readonly<Record<Readiness["kind"], ReadinessIcon>> = {
  ready: "circle-check",
  conflicts: "git-merge-conflict",
  needsRebase: "git-compare-arrows",
  checking: "hourglass",
  blocked: "circle-slash",
};

function reasonText(reason: BlockedReason): string {
  return reason.kind === "other" ? `GitLab says "${reason.status}"` : REASON_TEXTS[reason.kind];
}

export function readinessText(readiness: Readiness): string {
  switch (readiness.kind) {
    case "ready":
      return "Ready to merge";
    case "conflicts":
      return readiness.also.length === 0
        ? "Has conflicts"
        : `Has conflicts. Also blocked: ${readiness.also.map(reasonText).join("; ")}`;
    case "needsRebase":
      return "Needs a rebase";
    case "checking":
      return "GitLab is still checking whether it can be merged";
    case "blocked":
      return `Blocked: ${reasonText(readiness.reason)}`;
    default: {
      const _exhaustive: never = readiness;
      return _exhaustive;
    }
  }
}

export function readinessIcon(readiness: Readiness): ReadinessIcon {
  return ICONS[readiness.kind];
}
