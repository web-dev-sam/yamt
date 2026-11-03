import type { JobLogReply } from "../ipc";
import { GLAB_MISSING_TEXT, glabNotLoggedInText } from "./glab";

export const JOB_LOG_LOADING = "Loading the log…";
export const JOB_LOG_SEARCH = "Search the log";
export const JOB_LOG_CUT = "Earlier lines are on GitLab.";
export const JOB_LOG_WHOLE = "Open the whole log on GitLab";

const PRESS_AGAIN = "then press Shift over the job again.";

export function jobLogTitle(name: string): string {
  return `Log of ${name}`;
}

export function jobLogRefusalText(reply: Exclude<JobLogReply, { readonly kind: "log" }>): string {
  switch (reply.kind) {
    case "noLog":
      return "GitLab has no log for this job.";
    case "notOffered":
      return "This job's log was not listed by GitLab, so yamt did not read it.";
    case "glabMissing":
      return `${GLAB_MISSING_TEXT} — install glab, ${PRESS_AGAIN}`;
    case "notLoggedIn":
      return `${glabNotLoggedInText(reply.detail)} — run glab auth login in a terminal, ${PRESS_AGAIN}`;
    case "failed":
      return `Could not read the log: ${reply.message}`;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}
