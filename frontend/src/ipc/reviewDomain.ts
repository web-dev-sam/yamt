import type * as Generated from "./bindings";
import {
  agentSessionId,
  isMessageId,
  isRangeFileId,
  isThreadId,
  type AgentSessionId,
  type MessageId,
  type RangeFileId,
  type ThreadId,
} from "./domain";
import { toThreadLine, type ThreadLine } from "./threadLine";
import { branded, invalid, isNonNegativeInteger } from "./validate";

type MessageBody =
  | Readonly<Extract<Generated.MessageBody, { kind: "note" }>>
  | { readonly kind: "aiAnswer"; readonly session: AgentSessionId; readonly turn: number };
export type Posting =
  | Readonly<Exclude<Generated.Posting, { kind: "pending" }>>
  | {
      readonly kind: "pending";
      readonly text: string;
      readonly draftNote: number;
      readonly mergeRequest: string;
      readonly link: string;
    };
export type Message = {
  readonly id: MessageId;
  readonly body: MessageBody;
  readonly written: number;
  readonly posting: Posting;
};
export type Thread = {
  readonly id: ThreadId;
  readonly file: RangeFileId;
  readonly line: ThreadLine;
  readonly messages: readonly Message[];
  readonly session: AgentSessionId | null;
};
export type ThreadList = { readonly threads: readonly Thread[] };
export type ThreadAdded = { readonly thread: ThreadId; readonly list: ThreadList };
export type MergeRequestRef = {
  readonly reference: string;
  readonly title: string;
  readonly webUrl: string;
};
type LookedAt =
  | { readonly kind: "branch"; readonly name: string }
  | { readonly kind: "commit"; readonly shortId: string };
export type NotLinedUp =
  | { readonly kind: "glabMissing" }
  | { readonly kind: "notLoggedIn"; readonly detail: string }
  | { readonly kind: "noMergeRequest"; readonly lookedAt: LookedAt }
  | {
      readonly kind: "several";
      readonly lookedAt: LookedAt;
      readonly references: readonly string[];
    }
  | {
      readonly kind: "moved";
      readonly mergeRequest: MergeRequestRef;
      readonly gitlabHead: string;
      readonly shownHead: string;
    }
  | {
      readonly kind: "otherBase";
      readonly mergeRequest: MergeRequestRef;
      readonly gitlabBase: string;
      readonly shownBase: string;
    }
  | { readonly kind: "preparing"; readonly mergeRequest: MergeRequestRef }
  | { readonly kind: "failed"; readonly message: string };
export type GitLabCheck =
  | { readonly kind: "linedUp"; readonly mergeRequest: MergeRequestRef }
  | { readonly kind: "notLinedUp"; readonly why: NotLinedUp };
export type SendProgress = Readonly<Generated.SendProgress>;
export type SendReply =
  | { readonly kind: "notLinedUp"; readonly why: NotLinedUp }
  | {
      readonly kind: "sent";
      readonly list: ThreadList;
      readonly sent: number;
      readonly refused: number;
    }
  | {
      readonly kind: "stopped";
      readonly list: ThreadList;
      readonly sent: number;
      readonly refused: number;
      readonly reason: string;
    };

function toPosting(raw: Generated.Posting): Posting {
  if (raw.kind !== "pending") {
    return raw;
  }
  const { text, draft_note: draftNote, merge_request: mergeRequest, link } = raw;
  return { kind: "pending", text, draftNote, mergeRequest, link };
}

function toSession(text: string, field: string): AgentSessionId {
  const session = agentSessionId(text);
  if (session === null) {
    throw new Error(`${field} must be a non-empty session id`);
  }
  return session;
}

function toBody(body: Generated.MessageBody, field: string): MessageBody {
  if (body.kind === "note") {
    return body;
  }
  if (!isNonNegativeInteger(body.turn)) {
    throw invalid(`${field}.turn`, body.turn);
  }
  return { ...body, session: toSession(body.session, `${field}.session`) };
}

function toMessage({ id, body, written, posting }: Generated.Message, field: string): Message {
  return {
    id: branded(id, isMessageId, `${field}.id`),
    body: toBody(body, `${field}.body`),
    written,
    posting: toPosting(posting),
  };
}

function toThread(raw: Generated.Thread, index: number): Thread {
  const field = `threads[${index}]`;
  return {
    id: branded(raw.id, isThreadId, `${field}.id`),
    file: branded(raw.file, isRangeFileId, `${field}.file`),
    line: toThreadLine(raw.line, `${field}.line`),
    messages: raw.messages.map((message, at) => toMessage(message, `${field}.messages[${at}]`)),
    session: raw.session === null ? null : toSession(raw.session, `${field}.session`),
  };
}

export function toThreadList(raw: Generated.ThreadList): ThreadList {
  return { threads: raw.threads.map(toThread) };
}

export function toThreadAdded(raw: Generated.ThreadAdded): ThreadAdded {
  return { thread: branded(raw.thread, isThreadId, "thread"), list: toThreadList(raw.list) };
}

function toMergeRequest({
  reference,
  title,
  web_url: webUrl,
}: Generated.MergeRequestRef): MergeRequestRef {
  return { reference, title, webUrl };
}

function toLookedAt(raw: Generated.LookedAt): LookedAt {
  return raw.kind === "branch" ? raw : { kind: "commit", shortId: raw.short_id };
}

function toNotLinedUp(raw: Generated.NotLinedUp): NotLinedUp {
  switch (raw.kind) {
    case "glabMissing":
    case "notLoggedIn":
    case "failed":
      return raw;
    case "noMergeRequest":
      return { kind: "noMergeRequest", lookedAt: toLookedAt(raw.looked_at) };
    case "several":
      return { kind: "several", lookedAt: toLookedAt(raw.looked_at), references: raw.references };
    case "moved":
      return {
        kind: "moved",
        mergeRequest: toMergeRequest(raw.merge_request),
        gitlabHead: raw.gitlab_head,
        shownHead: raw.shown_head,
      };
    case "otherBase":
      return {
        kind: "otherBase",
        mergeRequest: toMergeRequest(raw.merge_request),
        gitlabBase: raw.gitlab_base,
        shownBase: raw.shown_base,
      };
    case "preparing":
      return { kind: "preparing", mergeRequest: toMergeRequest(raw.merge_request) };
    default: {
      const _exhaustive: never = raw;
      return _exhaustive;
    }
  }
}

export function toGitLabCheck(raw: Generated.GitLabCheck): GitLabCheck {
  return raw.kind === "linedUp"
    ? { kind: "linedUp", mergeRequest: toMergeRequest(raw.merge_request) }
    : { kind: "notLinedUp", why: toNotLinedUp(raw.why) };
}

export function toSendReply(raw: Generated.SendReply): SendReply {
  switch (raw.kind) {
    case "notLinedUp":
      return { kind: "notLinedUp", why: toNotLinedUp(raw.why) };
    case "sent":
    case "stopped":
      return { ...raw, list: toThreadList(raw.list) };
    default: {
      const _exhaustive: never = raw;
      return _exhaustive;
    }
  }
}
