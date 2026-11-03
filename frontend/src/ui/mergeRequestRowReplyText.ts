import type { ContinueMergeReply, MergeRequestIid, Refusal, ResolveReply } from "../ipc";
import { leftoverText } from "./leftoverText";
import type { RowReply } from "./mergeRequestActions";
import { mergeRequestReference, openReplyText } from "./mergeRequestsText";

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
