import type { AgentFailure, TurnEnd, TurnView } from "../agent";
import type { Message } from "../ipc";
import type { ThreadAi } from "./rangeAi";
import type { PostBody } from "./rangeGitLab";
import {
  AI_ANSWER_TEXT,
  ANSWER_GONE_TEXT,
  ANSWER_LOADING_TEXT,
  ANSWER_UNLOADED_TEXT,
} from "./rangeThreadText";

export type AnswerView =
  | { readonly kind: "turn"; readonly turn: TurnView; readonly end: TurnEnd }
  | { readonly kind: "loading" }
  | { readonly kind: "gone" }
  | { readonly kind: "failed"; readonly failure: AgentFailure };

export type ShownTurn = { readonly turn: TurnView; readonly end: TurnEnd | null };

type AnswerBody = Extract<Message["body"], { readonly kind: "aiAnswer" }>;

/** An AI answer's message: turn i of the loaded conversation when it is the answer's session (plan row 121). */
export function answerView(ai: ThreadAi, { session, turn }: AnswerBody): AnswerView {
  const { loaded } = ai;
  if (ai.session !== session) {
    return ai.session === null ? { kind: "loading" } : { kind: "gone" };
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

/** The turn under the messages: the running one, or an ended one no message shows. */
export function liveTurn(ai: ThreadAi): ShownTurn | null {
  const { end, running, loaded } = ai;
  const recorded = end !== null && loaded?.kind === "loaded" && loaded.turns.includes(end.turn);
  if (end !== null && (running !== null || !recorded)) {
    return { turn: end.turn, end };
  }
  return running === null ? null : { turn: running, end: null };
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
