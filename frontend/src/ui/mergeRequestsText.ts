import type {
  ContinueMergeReply,
  DiscussionDetails,
  DiscussionsAnswer,
  ListEnd,
  MergeRequestIid,
  OpenReply,
  PageOpened,
  Refusal,
  RerequestReply,
  ResolveReply,
} from "../ipc";
import type { DraftFilter } from "../mergeRequests";
import { GLAB_MISSING_TEXT, glabFailedText, glabNotLoggedInText } from "./glab";
import { leftoverText } from "./leftoverText";
import type { RowReply } from "./mergeRequestActions";
import { counted } from "./serverText";

export type PageKind = "job" | "mergeRequest" | "discussion";

export const PAGE_TITLE = "Merge requests";
export const LIST_LABEL = "Open merge requests";
export const REFRESH = "Refresh";
export const FILTERS_LABEL = "Filters";
export const SEARCH_FIELD_LABEL = "Search merge requests";
export const SEARCH_FIELD_PLACEHOLDER = "Search title or !number";
export const CLEAR_SEARCH = "Clear search";
export const CLEAR_FILTERS = "Clear filters";
export const DRAFT_LABEL = "Draft";
export const DRAFT_OPTIONS: readonly { readonly value: DraftFilter; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "drafts", label: "Drafts" },
  { value: "ready", label: "Ready" },
];
export const LOADING_TEXT = "Loading merge requests…";
export const NONE_TEXT = "No open merge requests.";
export const FAILED_JOBS_TITLE = "Failed jobs";
export const ALLOWED_TO_FAIL = "allowed to fail";
export const MORE_FAILED_JOBS = "More failed jobs on GitLab";
export const ASSIGNEES = "Assignees";
export const REVIEWERS = "Reviewers";
export const REREQUEST_REVIEW = "Re-request review";
export const SET_DUE_DATE = "Set a due date";
export const CLEAR_DUE_DATE = "Clear";
export const DUE_DATE_DIALOG = "Choose a due date";
export const DUE_DATE_PLACEHOLDER = "DD.MM.YYYY";
export const PICK_TODAY = "Today";
export const PREVIOUS_MONTH = "Previous month";
export const NEXT_MONTH = "Next month";
export const DISCUSSIONS_LOADING = "Loading discussions…";
export const DISCUSSION_DETAILS = "Discussion details";
export const DISCUSSION_DETAILS_OPTIONS: readonly {
  readonly value: DiscussionDetails;
  readonly label: string;
}[] = [
  { value: "full", label: "Load fully" },
  { value: "lazy", label: "Load lazily" },
  { value: "off", label: "Off" },
];
export const DISCUSSION_DETAILS_HINT =
  "On the merge-request page: every listed merge request's open discussions, right after the list; one merge " +
  "request's, when you first hover its count; or none.";

export function discussionsRefusedText(
  answer: Exclude<DiscussionsAnswer, { readonly kind: "open" }>,
): string {
  switch (answer.kind) {
    case "glabMissing":
      return `${GLAB_MISSING_TEXT} — install glab, then Refresh.`;
    case "notLoggedIn":
      return `${glabNotLoggedInText(answer.detail)} — run glab auth login in a terminal, then Refresh.`;
    case "failed":
      return glabFailedText(answer.message);
  }
}

export function listFailureText(end: ListEnd): string | null {
  return end.kind === "loaded" || end.kind === "cut" ? null : discussionsRefusedText(end);
}

export function mergeRequestReference(iid: MergeRequestIid): string {
  return `!${iid}`;
}

export function openChangesTitle(): string {
  return `Show Diff`;
}

export function openPageTitle(iid: MergeRequestIid, title: string): string {
  return `Open ${mergeRequestReference(iid)} on GitLab: ${title}`;
}

export function discussionsText(count: number): string {
  return counted(count, "open discussion", "open discussions");
}

export function approvalsText(count: number): string {
  return counted(count, "approval", "approvals");
}

export function jobTitle(name: string, page: string | null): string {
  return page === null
    ? "GitLab gave no address for this job's log"
    : `Open the log of ${name} on GitLab. Shift: show the log here`;
}

export function clearFilterTitle(name: string): string {
  return `Clear the ${name} filter`;
}

export function narrowLabel(name: string): string {
  return `Narrow the ${name} list`;
}

export function narrowPlaceholder(name: string): string {
  return `Find ${name.toLowerCase()}…`;
}

export function rerequestLabel(name: string): string {
  return `Re-request review from ${name}`;
}

export function rerequestReplyText(
  reply: Exclude<RerequestReply, { kind: "requested" }>,
  name: string,
): string {
  switch (reply.kind) {
    case "notReviewer":
      return `${name} is no longer a reviewer of this merge request.`;
    case "notOpen":
      return "This merge request is no longer open.";
    case "glabMissing":
    case "notLoggedIn":
      return discussionsRefusedText(reply);
    case "refused":
    case "failed":
      return reply.message;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

export function dueDateLabel(date: string, left: string): string {
  return `Due ${date}, ${left}. Change the due date`;
}

export function notValueLabel(label: string): string {
  return `not ${label}`;
}

export function openReplyText(
  reply: Exclude<OpenReply, { kind: "opened" }>,
  iid: MergeRequestIid,
): string {
  const mr = mergeRequestReference(iid);
  switch (reply.kind) {
    case "alreadyOpen":
      return `${mr} is already open in another yamt window.`;
    case "preparing":
      return `GitLab is still preparing the changes of ${mr}; try again in a moment.`;
    case "notOpen":
      return `${mr} is no longer open.`;
    case "noRemote":
      return `No remote of this repository points to ${reply.project}, so ${mr} cannot be fetched.`;
    case "fetchFailed":
      return `Could not fetch ${mr}: ${reply.message}`;
    case "missingCommit":
      return `Commit ${reply.shortId} of ${mr} is not in the repository, even after fetching.`;
    case "startFailed":
      return `Could not start a window for ${mr}: ${reply.message}`;
    case "glabMissing":
      return GLAB_MISSING_TEXT;
    case "notLoggedIn":
      return glabNotLoggedInText(reply.detail);
    case "failed":
      return glabFailedText(reply.message);
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

const NOT_OFFERED: Readonly<Record<PageKind, string>> = {
  job: "This job's page was not listed by GitLab, so yamt did not open it.",
  mergeRequest: "This merge request's page was not listed by GitLab, so yamt did not open it.",
  discussion: "This comment's page was not listed by GitLab, so yamt did not open it.",
};

export function pageProblemText(opened: PageOpened, clicked: PageKind): string | null {
  switch (opened.kind) {
    case "opened":
      return null;
    case "notOffered":
      return NOT_OFFERED[clicked];
    case "failed":
      return `Could not open the browser: ${opened.message}`;
    default: {
      const _exhaustive: never = opened;
      return _exhaustive;
    }
  }
}

const RUN_YAMT = "Run yamt in this repository to finish or abort it.";

function merging(target: string, branch: string): string {
  return `Merging ${target} into ${branch} in a new window.`;
}

function gitRefusedText(refusal: Extract<Refusal, { kind: "gitRefused" }>): string {
  const refused = `git refused to start the merge: ${refusal.message}`;
  return refusal.left.length === 0
    ? refused
    : `${refused} yamt could not put everything back: ${refusal.left.map(leftoverText).join("; ")}`;
}

function refusalText(refusal: Refusal, mr: string): string {
  switch (refusal.kind) {
    case "alreadyMerging":
      return refusal.iid === null
        ? "Another merge is starting in this repository; try again in a moment."
        : `The merge of !${refusal.iid} is not finished in this repository; continue or abort it first.`;
    case "busy":
      return "git is in the middle of another operation (a merge, rebase, cherry-pick, …) in this repository; finish or abort it first.";
    case "uncommittedChanges":
      return "This checkout has uncommitted changes to tracked files; commit or stash them first.";
    case "fetchFailed":
      return `Could not fetch the branches of ${mr}: ${refusal.message}`;
    case "localAhead":
      return `Your local ${refusal.branch} has commits that GitLab's ${refusal.branch} does not have; yamt never drops a local commit. Push or move them first.`;
    case "alreadyContains":
      return `${refusal.branch} already contains ${refusal.target}: there is nothing to merge.`;
    case "gitRefused":
      return gitRefusedText(refusal);
    case "recordUnreadable":
      return `yamt cannot read its record of an earlier merge (${refusal.path}): ${refusal.message}. Delete it if no merge is in progress.`;
    default: {
      const _exhaustive: never = refusal;
      return _exhaustive;
    }
  }
}

function resolveReplyText(reply: ResolveReply, iid: MergeRequestIid): string {
  const mr = mergeRequestReference(iid);
  switch (reply.kind) {
    case "started": {
      const { branch, target, conflicts } = reply.started;
      return conflicts
        ? merging(target, branch)
        : `${target} merges into ${branch} without conflicts after all; check and commit it in the new window.`;
    }
    case "windowFailed":
      return `Merging ${reply.started.target} into ${reply.started.branch}, but its window did not start: ${reply.message}. ${RUN_YAMT}`;
    case "refused":
      return refusalText(reply.refusal, mr);
    case "gitLabRefused":
      return reply.refusal.kind === "fromFork"
        ? "Resolving a fork's merge request is not supported."
        : openReplyText(reply.refusal, iid);
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

function continueReplyText(reply: ContinueMergeReply, iid: MergeRequestIid): string {
  const mr = mergeRequestReference(iid);
  switch (reply.kind) {
    case "opened":
      return merging(reply.target, reply.branch);
    case "alreadyOpen":
      return `The merge window of ${mr} is already open.`;
    case "ended":
      return `The merge of ${mr} is no longer in progress.`;
    case "windowFailed":
      return `The merge window did not start: ${reply.message}. ${RUN_YAMT}`;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

export function rowReplyText(
  reply: RowReply,
  iid: MergeRequestIid,
): { readonly text: string; readonly refused: boolean } {
  if (reply.kind === "resolve") {
    return { text: resolveReplyText(reply.reply, iid), refused: reply.reply.kind !== "started" };
  }
  return { text: continueReplyText(reply.reply, iid), refused: reply.reply.kind !== "opened" };
}
