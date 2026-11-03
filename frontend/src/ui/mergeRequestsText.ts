import type {
  DiscussionDetails,
  ListEnd,
  MergeRequestIid,
  OpenReply,
  PageOpened,
  PeopleGroup,
  RerequestReply,
} from "../ipc";
import type { DraftFilter } from "../mergeRequests";
import { GLAB_MISSING_TEXT, glabFailedText, glabNotLoggedInText } from "./glab";
import type { DiscussionFailure } from "./mergeRequestDiscussions";
import type { NotDone, PeopleSearch } from "./mergeRequestPeople";
import { problemText } from "./problemText";
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
export const ADD_ASSIGNEE = "Add assignee";
export const ADD_REVIEWER = "Add reviewer";
export const MORE = "More";
export const REMOVE_ASSIGNEE = "Remove assignee";
export const REMOVE_REVIEWER = "Remove reviewer";
export const SEARCH_PEOPLE = "Search people";
export const SEARCH_PEOPLE_PLACEHOLDER = "Search people…";
export const SEARCHING_PEOPLE = "Searching…";
export const NO_ONE_FOUND = "No one found";
export const NO_ONE = "None";
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
export const REVIEW_MODE = "Review mode";

type GlabRefusal =
  | { readonly kind: "glabMissing" }
  | { readonly kind: "notLoggedIn"; readonly detail: string }
  | { readonly kind: "failed"; readonly message: string };

export function glabRefusalText(answer: GlabRefusal): string {
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
  return end.kind === "loaded" || end.kind === "cut" ? null : glabRefusalText(end);
}

/** Why a row's discussions are missing: refused → glabRefusalText(answer); failed → problemText at step
 *  "discussions". Shared by the discussions box and the review order's icon. */
export function discussionsFailedText(failure: DiscussionFailure, platform: string): string {
  return failure.kind === "refused"
    ? glabRefusalText(failure.answer)
    : problemText({ action: "mergeRequests", step: "discussions", cause: failure.cause }, platform);
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
      return glabRefusalText(reply);
    case "refused":
    case "failed":
      return reply.message;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

const ROLE: Readonly<Record<PeopleGroup, string>> = {
  assignees: "assignee",
  reviewers: "reviewer",
};

export function moreLabel(name: string): string {
  return `More for ${name}`;
}

export function alreadyText(group: PeopleGroup): string {
  return group === "assignees" ? "Already an assignee" : "Already a reviewer";
}

export function peopleSearchText(
  search: Extract<PeopleSearch, { kind: "refused" | "failed" }>,
  platform: string,
): string {
  if (search.kind === "failed") {
    return problemText(
      { action: "mergeRequests", step: "searchPeople", cause: search.cause },
      platform,
    );
  }
  const reply = search.reply;
  return reply.kind === "failed" ? reply.message : glabRefusalText(reply);
}

export function peopleChangeText(notDone: NotDone, name: string, platform: string): string {
  const { change, why } = notDone;
  const role = ROLE[change.group];
  switch (why.kind) {
    case "unchanged":
      return change.action === "add"
        ? `GitLab did not add ${name} as ${role} (GitLab Free allows one ${role} per merge request).`
        : `GitLab still lists ${name} as ${role}.`;
    case "refused":
      return why.reply.kind === "glabMissing" || why.reply.kind === "notLoggedIn"
        ? glabRefusalText(why.reply)
        : why.reply.message;
    case "failed":
      return problemText(
        { action: "mergeRequests", step: "changePeople", cause: why.cause },
        platform,
      );
    default: {
      const _exhaustive: never = why;
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
