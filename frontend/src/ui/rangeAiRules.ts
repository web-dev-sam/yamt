import { firstMessage, type AgentFailure, type Placeholder, type TurnEnd } from "../agent";
import type { AgentSessionId, Message, Thread } from "../ipc";
import type { ThreadAi } from "./rangeAiView";

type Held = "held" | "notHeld" | "replay";

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
