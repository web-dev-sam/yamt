import type { ListEnd, MergeRequestIid, OpenReply, PageOpened } from "../ipc";
import type { DraftFilter } from "../mergeRequests";
import { GLAB_MISSING_TEXT, glabFailedText, glabNotLoggedInText } from "./glab";
import { counted } from "./serverText";

export type PageKind = "job" | "mergeRequest";

export const PAGE_TITLE = "Merge requests";
export const LIST_LABEL = "Open merge requests";
export const REFRESH = "Refresh";
export const FILTERS_LABEL = "Filters";
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

export function listFailureText(end: ListEnd): string | null {
  switch (end.kind) {
    case "loaded":
    case "cut":
      return null;
    case "glabMissing":
      return `${GLAB_MISSING_TEXT} — install glab, then Refresh.`;
    case "notLoggedIn":
      return `${glabNotLoggedInText(end.detail)} — run glab auth login in a terminal, then Refresh.`;
    case "failed":
      return glabFailedText(end.message);
    default: {
      const _exhaustive: never = end;
      return _exhaustive;
    }
  }
}

export function mergeRequestReference(iid: MergeRequestIid): string {
  return `!${iid}`;
}

export function openChangesTitle(iid: MergeRequestIid): string {
  return `Open the changes of ${mergeRequestReference(iid)}`;
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
    : `Open the log of ${name} on GitLab`;
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

function openRefusedText(reply: Exclude<OpenReply, { kind: "opened" }>, mr: string): string {
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

export function openReplyText(reply: OpenReply, iid: MergeRequestIid): string {
  const mr = mergeRequestReference(iid);
  return reply.kind === "opened" ? `Opened ${mr} in a new window.` : openRefusedText(reply, mr);
}

const NOT_OFFERED: Readonly<Record<PageKind, string>> = {
  job: "This job's page was not listed by GitLab, so yamt did not open it.",
  mergeRequest: "This merge request's page was not listed by GitLab, so yamt did not open it.",
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
