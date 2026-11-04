import type { DiscussionThread, DiscussionThreadReply } from "../ipc";
import { agoText, displayName } from "../mergeRequests";
import { GLAB_MISSING_TEXT, glabNotLoggedInText, glabRetryText } from "./glab";
import type { Preview } from "./mergeRequestPreview";
import type { WriteFailure, WriteKind } from "./mergeRequestThread";
import type { MergeRequestStep, ProblemCause } from "./problem";
import { problemText } from "./problemText";

type NoteEdit = NonNullable<DiscussionThread["comments"][number]["edited"]>;
type GlabRefusal =
  | { readonly kind: "glabMissing" }
  | { readonly kind: "notLoggedIn"; readonly detail: string }
  | { readonly kind: "failed"; readonly message: string };

export const THREAD_LOADING = "Loading…";
export const THREAD_GONE = "This discussion is no longer on GitLab.";
export const RESOLVED = "Resolved";
export const OPEN_ON_GITLAB = "Open on GitLab";
export const SUBMIT_REVIEW = "Submit review";
export const CLOSE_THREAD = "Close";
export const AUTHOR = "Author";
export const PENDING = "Pending";
export const WRITE = "Write";
export const PREVIEW = "Preview";
export const REPLY_PLACEHOLDER = "Write a reply… (Markdown)";
export const NOTHING_TO_PREVIEW = "Nothing to preview.";
export const ADD_REVIEW = "Add review";
export const ADD_COMMENT = "Add comment";
export const RESOLVE_THREAD = "Resolve thread";
export const UNRESOLVE_THREAD = "Unresolve thread";
export const MAY_NOT_RESOLVE = "You may not resolve this thread.";

const COMMENTING_REASONS: Readonly<Record<DiscussionThread["commenting"], string | null>> = {
  allowed: null,
  locked: "Comments on this merge request are locked to project members.",
  notAllowed: "You may not comment on this merge request.",
};

const WRITE_STEPS: Readonly<Record<WriteKind, MergeRequestStep>> = {
  comment: "reply",
  draft: "draft",
  resolve: "resolveThread",
  unresolve: "unresolveThread",
  submit: "submitReview",
};

export function threadLabel(place: string): string {
  return `Thread: ${place}`;
}

export function pendingText(count: number): string {
  return `${count} pending`;
}

export function submitTip(count: number): string {
  return count === 1
    ? "Publish your pending comment on this merge request"
    : `Publish your ${count} pending comments on this merge request`;
}

/** "· Edited 3 days ago", with " by <name>" when someone other than the comment's author edited it. */
export function editedText(edit: NoteEdit, authorUsername: string | null, now: number): string {
  const edited = `· Edited ${agoText(edit.at, now)}`;
  return edit.by.username === authorUsername ? edited : `${edited} by ${displayName(edit.by)}`;
}

/** Why the add buttons are disabled; null when the viewer may comment. */
export function commentingReason(commenting: DiscussionThread["commenting"]): string | null {
  return COMMENTING_REASONS[commenting];
}

function glabWords(refusal: GlabRefusal): string {
  switch (refusal.kind) {
    case "glabMissing":
      return GLAB_MISSING_TEXT;
    case "notLoggedIn":
      return glabNotLoggedInText(refusal.detail);
    case "failed":
      return refusal.message;
    default: {
      const _exhaustive: never = refusal;
      return _exhaustive;
    }
  }
}

function attemptText(step: MergeRequestStep, cause: ProblemCause, platform: string): string {
  return problemText({ action: "mergeRequests", step, cause }, platform);
}

/** One sentence; the panel puts Retry (aiText.ts RETRY) after it. */
export function threadRefusalText(
  reply: Exclude<DiscussionThreadReply, { readonly kind: "read" }>,
  platform: string,
): string {
  switch (reply.kind) {
    case "notFound":
      return THREAD_GONE;
    case "glabMissing":
    case "notLoggedIn":
      return glabRetryText(reply);
    case "failed":
      return attemptText("thread", { kind: "Unexpected", message: reply.message }, platform);
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

export function writeFailureText(what: WriteKind, failure: WriteFailure, platform: string): string {
  const cause: ProblemCause =
    failure.kind === "ipc"
      ? failure.cause
      : {
          kind: "Unexpected",
          message: failure.kind === "refused" ? failure.reason : glabWords(failure),
        };
  return attemptText(WRITE_STEPS[what], cause, platform);
}

export function previewFailureText(
  preview: Extract<Preview, { readonly kind: "refused" | "failed" }>,
  platform: string,
): string {
  const cause: ProblemCause =
    preview.kind === "failed"
      ? preview.cause
      : { kind: "Unexpected", message: glabWords(preview.reply) };
  return attemptText("preview", cause, platform);
}
