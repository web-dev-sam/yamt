import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  GitLabCheck,
  MergeRequestRef,
  MergeRequestRow,
  Message,
  MessageId,
  RangeStart,
  ReviewSource,
  SendProgress,
  SendReply,
  SourceResult,
} from "../ipc";
import { RECHECK_PAUSE_MS } from "./glab";
import { attempt, type Problem } from "./problem";
import { isBlank } from "./rangeDrafts";
import { isQueued, type AddTo, type RangeThreads } from "./rangeThreads";
import {
  CHECKING_TEXT,
  NOTHING_QUEUED,
  notLinedUpText,
  PENDING_TEXT,
  POST_LABEL,
  postTitle,
  QUEUE_LABEL,
  queueTitle,
  SEND_LABEL,
  SEND_RUNNING_TITLE,
  sendLabel,
  sendOneTitle,
  sendTitle,
  UNQUEUE_LABEL,
  UNQUEUE_TITLE,
} from "./rangeThreadText";

type SentReply = Exclude<SendReply, { readonly kind: "notLinedUp" }>;

type ButtonView = {
  readonly label: string;
  readonly title: string;
  readonly disabled: boolean;
};

type PostAction = "queue" | "write" | "unqueue";

type PostView = {
  readonly label: string;
  readonly title: string;
  readonly action: PostAction | null;
};

/** What a message offers to post: its text, or why it has none shown. */
export type PostBody =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "none"; readonly why: string };

export type GitLabState = {
  readonly check: Readonly<ShallowRef<GitLabCheck | null>>;
  readonly checking: Readonly<ShallowRef<boolean>>;
  readonly sending: Readonly<ShallowRef<SendProgress | null>>;
  readonly result: Readonly<ShallowRef<SentReply | null>>;
  readonly sendButton: ComputedRef<ButtonView>;
  postButton(message: Message, body: PostBody): PostView;
  /** Queue, or Send with `sendNow` (plan row 198): off while not lined up, Send also while a send runs. */
  queueButton(text: string, sendNow: boolean): ButtonView;
  checkNow(): Promise<void>;
  checkOnFocus(): void;
  send(): Promise<void>;
  /** Adds the typed text, queues it and, with `sendNow`, sends only that message; a failed step stops the rest. */
  queueTyped(to: AddTo, text: string, sendNow: boolean): Promise<void>;
  /** The Post box's Queue: queues the message with `text` and, with `sendNow`, sends only that message. */
  queuePost(message: MessageId, text: string, sendNow: boolean): Promise<void>;
  dismissResult(): void;
};

type Gate =
  | { readonly kind: "blocked"; readonly title: string }
  | { readonly kind: "linedUp"; readonly mergeRequest: MergeRequestRef };

type State = {
  readonly source: ReviewSource;
  readonly threads: RangeThreads;
  readonly report: (problem: Problem) => void;
  readonly start: Readonly<ShallowRef<RangeStart | null>>;
  readonly check: ShallowRef<GitLabCheck | null>;
  readonly checking: ShallowRef<boolean>;
  readonly sending: ShallowRef<SendProgress | null>;
  readonly result: ShallowRef<SentReply | null>;
  lastEnded: number | null;
};

function gate(state: State): Gate {
  const check = state.check.value;
  const start = state.start.value;
  if (check === null || start === null) {
    return { kind: "blocked", title: CHECKING_TEXT };
  }
  return check.kind === "linedUp"
    ? check
    : { kind: "blocked", title: notLinedUpText(check.why, start) };
}

function sendButton(state: State): ButtonView {
  const queued = state.threads.queued.value;
  const label = sendLabel(state.sending.value, queued);
  const shown = gate(state);
  if (shown.kind === "blocked") {
    return { label, title: shown.title, disabled: true };
  }
  if (queued === 0) {
    return { label, title: NOTHING_QUEUED, disabled: true };
  }
  const title = sendTitle(shown.mergeRequest, queued);
  return { label, title, disabled: state.sending.value !== null };
}

function postButton(state: State, { posting, body: shown }: Message, body: PostBody): PostView {
  if (posting.kind === "pending") {
    return { label: POST_LABEL, title: PENDING_TEXT, action: null };
  }
  if (isQueued(posting)) {
    return { label: UNQUEUE_LABEL, title: UNQUEUE_TITLE, action: "unqueue" };
  }
  if (body.kind === "none") {
    return { label: POST_LABEL, title: body.why, action: null };
  }
  const lined = gate(state);
  if (lined.kind === "blocked") {
    return { label: POST_LABEL, title: lined.title, action: null };
  }
  const action = shown.kind === "note" ? "queue" : "write";
  return { label: POST_LABEL, title: postTitle(lined.mergeRequest), action };
}

function queueButton(state: State, text: string, sendNow: boolean): ButtonView {
  const label = sendNow ? SEND_LABEL : QUEUE_LABEL;
  const shown = gate(state);
  if (shown.kind === "blocked") {
    return { label, title: shown.title, disabled: true };
  }
  if (sendNow && state.sending.value !== null) {
    return { label, title: SEND_RUNNING_TITLE, disabled: true };
  }
  const title = sendNow ? sendOneTitle(shown.mergeRequest) : queueTitle(shown.mergeRequest);
  return { label, title, disabled: isBlank(text) };
}

async function checkNow(state: State): Promise<void> {
  if (state.checking.value) {
    return;
  }
  state.checking.value = true;
  const outcome = await attempt(() => state.source.checkGitLab());
  state.checking.value = false;
  state.lastEnded = Date.now();
  if (outcome.ok) {
    state.check.value = outcome.value;
  } else {
    state.report({ action: "threads", step: "check", cause: outcome.cause });
  }
}

function checkOnFocus(state: State): void {
  const { lastEnded } = state;
  if (state.sending.value !== null || lastEnded === null) {
    return;
  }
  if (Date.now() - lastEnded >= RECHECK_PAUSE_MS) {
    void checkNow(state);
  }
}

type SendCall = (onProgress: (progress: SendProgress) => void) => Promise<SourceResult<SendReply>>;

async function send(state: State, of: number, call: SendCall): Promise<void> {
  if (state.sending.value !== null) {
    return;
  }
  state.result.value = null;
  state.sending.value = { done: 0, of };
  let running = true;
  const outcome = await attempt(() =>
    call((progress) => {
      if (running) {
        state.sending.value = progress;
      }
    }),
  );
  running = false;
  state.sending.value = null;
  if (!outcome.ok) {
    state.report({ action: "threads", step: "send", cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  if (reply.kind === "notLinedUp") {
    state.check.value = { kind: "notLinedUp", why: reply.why };
    return;
  }
  state.threads.replace(reply.list);
  state.result.value = reply;
}

async function queueAndSend(
  state: State,
  message: MessageId,
  text: string,
  sendNow: boolean,
): Promise<void> {
  if ((await state.threads.queue(message, text)) && sendNow) {
    await send(state, 1, (onProgress) => state.source.sendMessage(message, onProgress));
  }
}

async function queueTyped(state: State, to: AddTo, text: string, sendNow: boolean): Promise<void> {
  if (queueButton(state, text, sendNow).disabled) {
    return;
  }
  const added = await state.threads.addTyped(to, text);
  if (added !== null) {
    await queueAndSend(state, added.message, text, sendNow);
  }
}

async function queuePost(
  state: State,
  message: MessageId,
  text: string,
  sendNow: boolean,
): Promise<void> {
  if (!queueButton(state, text, sendNow).disabled) {
    await queueAndSend(state, message, text, sendNow);
  }
}

/** The loaded row of the merge request the range lines up with (design §2.2): when `check` is `linedUp`, the first of
 *  `rows` whose `page` equals `check.mergeRequest.webUrl`; else null (the Post box then shows search results only). */
export function linedUpRow(
  check: GitLabCheck | null,
  rows: readonly MergeRequestRow[],
): MergeRequestRow | null {
  if (check?.kind !== "linedUp") {
    return null;
  }
  return rows.find((row) => row.page === check.mergeRequest.webUrl) ?? null;
}

export function createGitLabCheck(
  source: ReviewSource,
  threads: RangeThreads,
  report: (problem: Problem) => void,
  start: Readonly<ShallowRef<RangeStart | null>>,
): GitLabState {
  const state: State = {
    source,
    threads,
    report,
    start,
    check: shallowRef<GitLabCheck | null>(null),
    checking: shallowRef(false),
    sending: shallowRef<SendProgress | null>(null),
    result: shallowRef<SentReply | null>(null),
    lastEnded: null,
  };
  return {
    check: state.check,
    checking: state.checking,
    sending: state.sending,
    result: state.result,
    sendButton: computed(() => sendButton(state)),
    postButton: (message, body) => postButton(state, message, body),
    queueButton: (text, sendNow) => queueButton(state, text, sendNow),
    checkNow: () => checkNow(state),
    checkOnFocus: () => {
      checkOnFocus(state);
    },
    send: () => send(state, threads.queued.value, (onProgress) => source.sendQueue(onProgress)),
    queueTyped: (to, text, sendNow) => queueTyped(state, to, text, sendNow),
    queuePost: (message, text, sendNow) => queuePost(state, message, text, sendNow),
    dismissResult: () => {
      state.result.value = null;
    },
  };
}
