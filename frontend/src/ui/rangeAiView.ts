import type { AgentFailure, ConversationLoad, TurnEnd, TurnView } from "../agent";
import type { AgentSessionId, Message } from "../ipc";
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

export const IDLE: ThreadAi = { running: null, end: null, loaded: null, loadedSession: null };

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
