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
import { sideLabel } from "./rangeText";

export const CHECKING_TEXT = "Checking GitLab…";
export const NOTHING_QUEUED = "Nothing queued";
export const PENDING_TEXT = "Pending on GitLab";
export const AI_ANSWER_TEXT = "An AI answer — start yamt with --ai to see it";
export const POST_LABEL = "Post";
export const UNQUEUE_LABEL = "Unqueue";
export const UNQUEUE_TITLE = "Take this message out of the queue";

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
