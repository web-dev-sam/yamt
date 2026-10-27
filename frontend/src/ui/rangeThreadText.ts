import type {
  MergeRequestRef,
  NotLinedUp,
  Posting,
  RangeEntry,
  RangeStart,
  SendProgress,
  SendReply,
  ThreadLine,
} from "../ipc";
import type { NoticeRow } from "./noticeText";
import { sideLabel } from "./rangeText";

export const CHECKING_TEXT = "Checking GitLab…";
export const NOTHING_QUEUED = "Nothing queued";
export const PENDING_TEXT = "Pending on GitLab";
export const AI_ANSWER_TEXT = "An AI answer — start yamt with --ai to see it";
export const ANSWER_LOADING_TEXT = "Loading the AI's answer…";
export const ANSWER_GONE_TEXT = "omp no longer has this answer";
export const ANSWER_UNLOADED_TEXT = "The AI's conversation could not be loaded";
export const ASK_AI_LABEL = "Ask AI";
export const ASK_AI_TITLE = "Send your messages since the AI's last answer to the AI";
export const ASK_AI_WAITING =
  "Nothing to ask yet: write a message after the AI's last answer, or wait for its conversation to load";
export const STOP_AI_LABEL = "Stop";
export const STOP_AI_TITLE = "Stop the AI's turn; what it wrote so far stays";
export const POST_LABEL = "Post";
export const UNQUEUE_LABEL = "Unqueue";
export const UNQUEUE_TITLE = "Take this message out of the queue";
export const COMMENT_LABEL = "Comment";
export const CANCEL_LABEL = "Cancel";
export const COLLAPSE_THREAD = "Collapse the thread";
export const DRAFT_PROMPT = "Write a comment…";
export const REPLY_PROMPT = "Reply…";
export const QUEUE_LABEL = "Queue";
export const POST_FIELD_LABEL = "Text to post";
export const COPY_LINK_TITLE = "Copy the link to the merge request's changes";
export const EDIT_LABEL = "Edit";
export const EDIT_FIELD_LABEL = "Comment text";
export const SAVE_LABEL = "Save";
export const DELETE_LABEL = "Delete";

/** Why Edit and Delete are off (plan row 123). */
export type NoteChangeBlock = "sending" | "aiWorking";

const NOTE_CHANGE_TITLES: Readonly<
  Record<"edit" | "delete", Readonly<Record<NoteChangeBlock | "on", string>>>
> = {
  edit: {
    on: "Change this comment's text",
    sending: "Comments cannot be edited while a send to GitLab runs",
    aiWorking: "Comments cannot be edited while the AI works in this thread",
  },
  delete: {
    on: "Delete this comment",
    sending: "Comments cannot be deleted while a send to GitLab runs",
    aiWorking: "Comments cannot be deleted while the AI works in this thread",
  },
};

export function noteChangeTitle(change: "edit" | "delete", block: NoteChangeBlock | null): string {
  return NOTE_CHANGE_TITLES[change][block ?? "on"];
}

const SEND_RESULT_CLOSE = "Close the notice about the send to GitLab";

function twoDotsHint({ left, right }: RangeStart): string {
  if (left.label.kind !== "named") {
    return "";
  }
  const branch = sideLabel(right);
  return ` — ${left.label.name}...${branch} compares from where ${branch} branched off`;
}

export function notLinedUpText(why: NotLinedUp, start: RangeStart): string {
  switch (why.kind) {
    case "glabMissing":
      return "glab is not installed (not found on PATH)";
    case "notLoggedIn":
      return `glab is not logged in: ${why.detail}`;
    case "noMergeRequest": {
      const { lookedAt } = why;
      return lookedAt.kind === "branch"
        ? `no open merge request from ${lookedAt.name}`
        : `no open merge request ends at ${lookedAt.shortId} (the range names no branch)`;
    }
    case "several": {
      const { lookedAt } = why;
      const where =
        lookedAt.kind === "branch" ? `from ${lookedAt.name}` : `ending at ${lookedAt.shortId}`;
      return `several open merge requests ${where} (${why.references.join(", ")}); none compares ${start.left.shortId} with ${start.right.shortId}`;
    }
    case "moved":
      return `the merge request ${why.mergeRequest.reference} is at ${why.gitlabHead}, this window shows ${why.shownHead}`;
    case "otherBase":
      return `the merge request ${why.mergeRequest.reference} starts from ${why.gitlabBase}, this window from ${why.shownBase}${twoDotsHint(start)}`;
    case "preparing":
      return `GitLab is still preparing the changes of ${why.mergeRequest.reference}`;
    case "failed":
      return `glab failed: ${why.message}`;
    default: {
      const _exhaustive: never = why;
      return _exhaustive;
    }
  }
}

export function postingLabel(posting: Posting): string | null {
  switch (posting.kind) {
    case "notQueued":
      return null;
    case "queued":
      return "Queued for GitLab";
    case "refused":
      return `Refused by GitLab: ${posting.reason}`;
    case "pending":
      return PENDING_TEXT;
    default: {
      const _exhaustive: never = posting;
      return _exhaustive;
    }
  }
}

export function sendLabel(sending: SendProgress | null, queued: number): string {
  return sending === null
    ? `Send to GitLab (${queued})`
    : `Sending ${Math.min(sending.done + 1, sending.of)} of ${sending.of}…`;
}

export function sendTitle(mergeRequest: MergeRequestRef, queued: number): string {
  const comments = queued === 1 ? "comment" : "comments";
  return `Send the ${queued} queued ${comments} to your pending review on ${mergeRequest.reference}`;
}

export function postTitle(mergeRequest: MergeRequestRef): string {
  return `Queue this message as its own comment on ${mergeRequest.reference}`;
}

export function sendResultText(reply: Exclude<SendReply, { readonly kind: "notLinedUp" }>): string {
  const counts = `${reply.sent} sent, ${reply.refused} refused`;
  switch (reply.kind) {
    case "sent":
      return counts;
    case "stopped":
      return `${counts}; stopped: ${reply.reason}. The rest stay queued.`;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

export function sendNoticeRow(
  reply: Exclude<SendReply, { readonly kind: "notLinedUp" }>,
): NoticeRow {
  return { key: "send", text: sendResultText(reply), closeLabel: SEND_RESULT_CLOSE };
}

export function threadCountText(threads: number): string {
  return threads === 1 ? "1 thread" : `${threads} threads`;
}

export function threadPlaceText(
  entry: Pick<RangeEntry, "path" | "change">,
  line: ThreadLine,
): string {
  if (line.kind !== "removed") {
    return `${entry.path}:${line.right + 1}`;
  }
  const path = entry.change.kind === "renamed" ? entry.change.oldPath : entry.path;
  return `${path}:${line.left + 1}`;
}
