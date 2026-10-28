import {
  firstMessage,
  type AgentFailure,
  type ConversationLoad,
  type Placeholder,
  type TurnEnd,
  type TurnView,
} from "../agent";
import type { AgentSessionId, Message, Thread } from "../ipc";
import { failureText } from "./aiText";
import type { PostBody } from "./rangeGitLab";
import {
  AI_ANSWER_TEXT,
  ANSWER_GONE_TEXT,
  ANSWER_LOADING_TEXT,
  ANSWER_UNLOADED_TEXT,
} from "./rangeThreadText";

/** `running` stays until the turn's answer is recorded. */
export type ThreadAi = {
  readonly running: TurnView | null;
  readonly end: TurnEnd | null;
  readonly loaded: ConversationLoad | null;
  readonly loadedSession: AgentSessionId | null;
};

type Held = "held" | "notHeld" | "replay";

export const IDLE: ThreadAi = { running: null, end: null, loaded: null, loadedSession: null };
/** Whether omp holds a turn's prompt; a stop or crash right after sending it may leave none (plan row 121). */
const HELD_AT_END: Readonly<Record<Exclude<TurnEnd["kind"], "failed">, Held>> = {
  finished: "held",
  stopped: "replay",
};
const HELD_AFTER: Readonly<Record<AgentFailure["kind"], Held>> = {
  ended: "held",
  crashed: "replay",
  refused: "replay",
  checkoutFailed: "notHeld",
  notFound: "notHeld",
  spawnFailed: "notHeld",
  noCommand: "notHeld",
  sessionGone: "notHeld",
  busy: "notHeld",
  app: "notHeld",
};

export function heldAfter(end: TurnEnd): Held {
  return end.kind === "failed" ? HELD_AFTER[end.failure.kind] : HELD_AT_END[end.kind];
}

export function isGone(ai: ThreadAi, session: AgentSessionId): boolean {
  return (
    ai.loadedSession === session &&
    ai.loaded?.kind === "failed" &&
    ai.loaded.failure.kind === "sessionGone"
  );
}

function isAnswerIn(message: Message, session: AgentSessionId | null): boolean {
  return message.body.kind === "aiAnswer" && message.body.session === session;
}

export function answersIn(thread: Thread | undefined, session: AgentSessionId | null): number {
  return thread?.messages.filter((message) => isAnswerIn(message, session)).length ?? 0;
}

/** A replay is kept only with exactly the session's stored answers (plan row 121); a failed load unless omp lost it. */
export function isKept(ai: ThreadAi, thread: Thread, session: AgentSessionId): boolean {
  const exact =
    ai.loaded?.kind === "loaded" && ai.loaded.turns.length === answersIn(thread, session);
  return ai.loadedSession === session && (exact || ai.loaded === null || isGone(ai, session));
}

export type AskContext = {
  readonly template: string;
  readonly values: Readonly<Record<Exclude<Placeholder, "MESSAGE">, string>>;
};

const NOTE_JOIN = "\n\n";

/** The prompt rule (request C2): the notes since the session's last answer; a session's first turn wrapped. */
export function promptText(
  thread: Thread,
  session: AgentSessionId | null,
  context: AskContext | null,
): string | null {
  const last = thread.messages.findLastIndex((message) => isAnswerIn(message, session));
  const notes = thread.messages
    .slice(last + 1)
    .flatMap(({ body }) => (body.kind === "note" ? [body.text] : []));
  if (notes.length === 0 || context === null) {
    return null;
  }
  const text = notes.join(NOTE_JOIN);
  return last === -1 ? firstMessage(context.template, { ...context.values, MESSAGE: text }) : text;
}

export type AnswerView =
  | { readonly kind: "turn"; readonly turn: TurnView; readonly end: TurnEnd }
  | { readonly kind: "loading" }
  | { readonly kind: "gone" }
  | { readonly kind: "failed"; readonly failure: AgentFailure };

export type UnshownAnswer = Exclude<AnswerView, { readonly kind: "turn" }>;

export type ShownTurn = { readonly turn: TurnView; readonly end: TurnEnd | null };

type AnswerBody = Extract<Message["body"], { readonly kind: "aiAnswer" }>;

/** An AI answer's message: turn i of the loaded conversation when it is the answer's session (plan row 121). */
export function answerView(ai: ThreadAi, { session, turn }: AnswerBody): AnswerView {
  const { loaded } = ai;
  if (ai.loadedSession !== session) {
    return ai.loadedSession === null ? { kind: "loading" } : { kind: "gone" };
  }
  if (loaded === null || loaded.kind === "stopped") {
    return { kind: "loading" };
  }
  if (loaded.kind === "failed") {
    return loaded.failure.kind === "sessionGone" ? { kind: "gone" } : loaded;
  }
  const shown = loaded.turns[turn];
  if (shown === undefined) {
    return { kind: "gone" };
  }
  const end: TurnEnd = ai.end?.turn === shown ? ai.end : { kind: "finished", turn: shown };
  return { kind: "turn", turn: shown, end };
}

/** Whether the thread's turn still runs: Stop instead of Ask AI. */
export function answering(ai: ThreadAi): boolean {
  return ai.running !== null && ai.end === null;
}

/** The turn under the messages: the running one, or an ended one no message shows. */
export function liveTurn(ai: ThreadAi): ShownTurn | null {
  const { end, running, loaded } = ai;
  const recorded = end !== null && loaded?.kind === "loaded" && loaded.turns.includes(end.turn);
  if (end !== null && (running !== null || !recorded)) {
    return { turn: end.turn, end };
  }
  return running === null ? null : { turn: running, end: null };
}

/** The words in an AI answer's place when no turn shows; null: the window runs without the AI. */
export function answerText(view: UnshownAnswer | null, platform: string): string {
  switch (view?.kind) {
    case undefined:
      return AI_ANSWER_TEXT;
    case "loading":
      return ANSWER_LOADING_TEXT;
    case "gone":
      return ANSWER_GONE_TEXT;
    case "failed":
      return failureText(view.failure, platform);
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

function answerBody(view: AnswerView): PostBody {
  switch (view.kind) {
    case "turn":
      return { kind: "text", text: view.turn.answer };
    case "loading":
      return { kind: "none", why: ANSWER_LOADING_TEXT };
    case "gone":
      return { kind: "none", why: ANSWER_GONE_TEXT };
    case "failed":
      return { kind: "none", why: ANSWER_UNLOADED_TEXT };
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

/** What Post offers: a note's text, a loaded AI answer's final text (`TurnView.answer`), or why not. */
export function postBody(body: Message["body"], ai: ThreadAi | null): PostBody {
  switch (body.kind) {
    case "note":
      return { kind: "text", text: body.text };
    case "aiAnswer":
      return ai === null ? { kind: "none", why: AI_ANSWER_TEXT } : answerBody(answerView(ai, body));
    default: {
      const _exhaustive: never = body;
      return _exhaustive;
    }
  }
}
