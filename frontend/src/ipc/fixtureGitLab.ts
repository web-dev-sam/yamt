import type * as Generated from "./bindings";
import type { Log } from "./log";
import type { RangeSide, RangeStart } from "./rangeDomain";

export type GitLabScript =
  | "linedUp"
  | "checking"
  | "noGlab"
  | "loggedOut"
  | "noMergeRequest"
  | "noBranch"
  | "moved"
  | "otherBase"
  | "several"
  | "preparing"
  | "failed"
  | "refusal"
  | "stopped";

export type PostOutcome = "pending" | "refused" | "stopped";

const FAILING_POST = 1;

const MERGE_REQUEST: Generated.MergeRequestRef = {
  reference: "!12",
  title: "Reminders on cards",
  web_url: "https://gitlab.example.com/team/taskboard/-/merge_requests/12",
};
const DIFFS_PAGE = "/diffs";
const OTHER_REFERENCE = "!14";
const GITLAB_HEAD = "7d6c5b4";
const GITLAB_BASE = "3e2f1a0";
const LOGGED_OUT =
  "gitlab.example.com: No token found (checked config file, keyring, and environment variables).";
const FAILED = "glab api projects/:fullpath/merge_requests: 502 Bad Gateway";

export const REFUSAL = `400 Bad request - Note {:line_code=>["can't be blank"]}`;
export const TIMED_OUT = "glab timed out";

function lookedAt(side: RangeSide): Generated.LookedAt {
  return side.label.kind === "named"
    ? { kind: "branch", name: side.label.name }
    : { kind: "commit", short_id: side.shortId };
}

const GITLAB_SCRIPTS: Readonly<Record<GitLabScript, true>> = {
  linedUp: true,
  checking: true,
  noGlab: true,
  loggedOut: true,
  noMergeRequest: true,
  noBranch: true,
  moved: true,
  otherBase: true,
  several: true,
  preparing: true,
  failed: true,
  refusal: true,
  stopped: true,
};

function isGitLabScript(name: string): name is GitLabScript {
  return Object.hasOwn(GITLAB_SCRIPTS, name);
}

export function shownGitLabScript(log: Log, search: string): GitLabScript {
  const asked = new URLSearchParams(search).get("gitlab");
  if (asked === null || asked === "") {
    return "linedUp";
  }
  if (isGitLabScript(asked)) {
    return asked;
  }
  log.info("review.fixture_miss", { gitlab: asked, known: Object.keys(GITLAB_SCRIPTS).join(", ") });
  return "linedUp";
}

function notLinedUp(
  script: GitLabScript,
  { left, right }: RangeStart,
): Generated.NotLinedUp | null {
  const answers: Readonly<Record<GitLabScript, Generated.NotLinedUp | null>> = {
    linedUp: null,
    checking: null,
    noGlab: { kind: "glabMissing" },
    loggedOut: { kind: "notLoggedIn", detail: LOGGED_OUT },
    noMergeRequest: { kind: "noMergeRequest", looked_at: lookedAt(right) },
    noBranch: { kind: "noMergeRequest", looked_at: { kind: "commit", short_id: right.shortId } },
    moved: {
      kind: "moved",
      merge_request: MERGE_REQUEST,
      gitlab_head: GITLAB_HEAD,
      shown_head: right.shortId,
    },
    otherBase: {
      kind: "otherBase",
      merge_request: MERGE_REQUEST,
      gitlab_base: GITLAB_BASE,
      shown_base: left.shortId,
    },
    several: {
      kind: "several",
      looked_at: lookedAt(right),
      references: [MERGE_REQUEST.reference, OTHER_REFERENCE],
    },
    preparing: { kind: "preparing", merge_request: MERGE_REQUEST },
    failed: { kind: "failed", message: FAILED },
    refusal: null,
    stopped: null,
  };
  return answers[script];
}

export function gitLabCheck(script: GitLabScript, start: RangeStart): Generated.GitLabCheck {
  const why = notLinedUp(script, start);
  return why === null
    ? { kind: "linedUp", merge_request: MERGE_REQUEST }
    : { kind: "notLinedUp", why };
}

export function pendingPosting(text: string, draftNote: number): Generated.Posting {
  return {
    kind: "pending",
    text,
    draft_note: draftNote,
    merge_request: MERGE_REQUEST.reference,
    link: `${MERGE_REQUEST.web_url}${DIFFS_PAGE}`,
  };
}

export function postOutcome(script: GitLabScript, index: number): PostOutcome {
  if (index === FAILING_POST && script === "refusal") {
    return "refused";
  }
  return index === FAILING_POST && script === "stopped" ? "stopped" : "pending";
}
