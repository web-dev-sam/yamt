import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  GitLabCheck,
  MergeRequestRef,
  Message,
  RangeStart,
  ReviewSource,
  SendProgress,
  SendReply,
} from "../ipc";
import { attempt, type Problem } from "./problem";
import { isQueued, type RangeThreads } from "./rangeThreads";
import {
  AI_ANSWER_TEXT,
  CHECKING_TEXT,
  NOTHING_QUEUED,
  notLinedUpText,
  PENDING_TEXT,
  POST_LABEL,
  postTitle,
  sendLabel,
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

export type GitLabState = {
  readonly check: Readonly<ShallowRef<GitLabCheck | null>>;
  readonly checking: Readonly<ShallowRef<boolean>>;
  readonly sending: Readonly<ShallowRef<SendProgress | null>>;
  readonly result: Readonly<ShallowRef<SentReply | null>>;
  readonly sendButton: ComputedRef<ButtonView>;
  postButton(message: Message): ButtonView;
  checkNow(): Promise<void>;
  checkOnFocus(): void;
  send(): Promise<void>;
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

export const RECHECK_PAUSE_MS = 30_000;

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

function postButton(state: State, { body, posting }: Message): ButtonView {
  if (body.kind === "aiAnswer") {
    return { label: POST_LABEL, title: AI_ANSWER_TEXT, disabled: true };
  }
  if (posting.kind === "pending") {
    return { label: POST_LABEL, title: PENDING_TEXT, disabled: true };
  }
  if (isQueued(posting)) {
    return { label: UNQUEUE_LABEL, title: UNQUEUE_TITLE, disabled: false };
  }
  const shown = gate(state);
  return shown.kind === "blocked"
    ? { label: POST_LABEL, title: shown.title, disabled: true }
    : { label: POST_LABEL, title: postTitle(shown.mergeRequest), disabled: false };
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

async function send(state: State): Promise<void> {
  if (state.sending.value !== null) {
    return;
  }
  state.result.value = null;
  state.sending.value = { done: 0, of: state.threads.queued.value };
  let running = true;
  const outcome = await attempt(() =>
    state.source.sendQueue((progress) => {
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
    postButton: (message) => postButton(state, message),
    checkNow: () => checkNow(state),
    checkOnFocus: () => {
      checkOnFocus(state);
    },
    send: () => send(state),
    dismissResult: () => {
      state.result.value = null;
    },
  };
}
