import type { DescriptionReply } from "../ipc";
import { GLAB_MISSING_TEXT, glabNotLoggedInText } from "./glab";

export const SHOW_DESCRIPTION = "Show description";
export const CLOSE_DESCRIPTION = "Close";
export const DESCRIPTION_LOADING = "Loading…";
export const NO_DESCRIPTION = "No description.";
export const TASK_DONE = "Done";
export const TASK_OPEN = "Not done";
export const TASK_INAPPLICABLE = "Not applicable";
export const IMAGE_STAND_IN = "picture";

/** One sentence; the panel puts Retry (aiText.ts RETRY) after it. */
export function descriptionRefusalText(
  reply: Exclude<DescriptionReply, { readonly kind: "read" }>,
): string {
  switch (reply.kind) {
    case "glabMissing":
      return `${GLAB_MISSING_TEXT} — install glab, then Retry.`;
    case "notLoggedIn":
      return `${glabNotLoggedInText(reply.detail)} — run glab auth login in a terminal, then Retry.`;
    case "failed":
      return `Could not read the description: ${reply.message}`;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}
