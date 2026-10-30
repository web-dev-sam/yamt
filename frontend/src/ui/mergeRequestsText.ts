import type { JobOpened, ListEnd, MergeRequestIid, OpenReply } from "../ipc";
import { GLAB_MISSING_TEXT, glabFailedText, glabNotLoggedInText } from "./glab";

export const LOADING_TEXT = "Loading merge requests…";
export const NONE_TEXT = "No open merge requests.";

export function listEndText(end: ListEnd): string {
  switch (end.kind) {
    case "loaded":
      return "Loaded the open merge requests.";
    case "cut":
      return `Only the newest ${end.limit} merge requests are listed; GitLab has more.`;
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
  const mr = `!${iid}`;
  return reply.kind === "opened" ? `Opened ${mr} in a new window.` : openRefusedText(reply, mr);
}

export function jobOpenedText(opened: JobOpened): string {
  switch (opened.kind) {
    case "opened":
      return "Opened the job's log in the browser.";
    case "notOffered":
      return "This job's page was not listed by GitLab, so yamt did not open it.";
    case "failed":
      return `Could not open the browser: ${opened.message}`;
    default: {
      const _exhaustive: never = opened;
      return _exhaustive;
    }
  }
}
