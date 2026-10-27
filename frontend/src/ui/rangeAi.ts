import { shallowRef, type ShallowRef } from "vue";

import {
  firstMessage,
  type AgentClient,
  type AgentFailure,
  type ConversationLoad,
  type Placeholder,
  type RunningTurn,
  type TurnEnd,
  type TurnView,
} from "../agent";
import { log, type AgentSessionId, type Message, type Thread, type ThreadId } from "../ipc";
import type { RangeThreads } from "./rangeThreads";

/** `running` stays until the turn's answer is recorded. */
export type ThreadAi = {
  readonly running: TurnView | null;
  readonly end: TurnEnd | null;
  readonly loaded: ConversationLoad | null;
  readonly loadedSession: AgentSessionId | null;
};

export type AskContext = {
  readonly template: string;
  readonly values: Readonly<Record<Exclude<Placeholder, "MESSAGE">, string>>;
};

export type RangeAi = {
  of(thread: ThreadId): ThreadAi;
  ask(thread: ThreadId): void;
  retry(thread: ThreadId): void;
  stop(thread: ThreadId): void;
  load(thread: ThreadId): void;
  canAsk(thread: ThreadId): boolean;
};

type AiClient = Pick<AgentClient, "ask" | "loadConversation">;
type Held = "held" | "notHeld" | "replay";
type Kept = Readonly<{ thread: ThreadId; session: AgentSessionId }>;
type State = {
  readonly client: AiClient;
  readonly threads: Pick<RangeThreads, "list" | "setSession" | "addAiAnswer">;
  readonly place: (thread: Thread) => AskContext | null;
  readonly byThread: ShallowRef<ReadonlyMap<ThreadId, ThreadAi>>;
  readonly turns: Map<ThreadId, RunningTurn>;
  readonly asked: Map<ThreadId, string>;
  /** The thread's last ended turn while omp holds it, so the replay's last; dropped at the next ask. */
  readonly answered: Map<ThreadId, TurnEnd>;
};

export const IDLE: ThreadAi = { running: null, end: null, loaded: null, loadedSession: null };
const NOTE_JOIN = "\n\n";
const STARTING: TurnView = { entries: [], answer: "" };
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

function aiOf(state: State, thread: ThreadId): ThreadAi {
  return state.byThread.value.get(thread) ?? IDLE;
}

function put(state: State, thread: ThreadId, change: Partial<ThreadAi>): void {
  const next = new Map(state.byThread.value);
  next.set(thread, { ...aiOf(state, thread), ...change });
  state.byThread.value = next;
}

function threadOf(state: State, id: ThreadId): Thread | undefined {
  return state.threads.list.value.threads.find((thread) => thread.id === id);
}

function isGone(ai: ThreadAi, session: AgentSessionId): boolean {
  return (
    ai.loadedSession === session &&
    ai.loaded?.kind === "failed" &&
    ai.loaded.failure.kind === "sessionGone"
  );
}

/** The conversation the next ask continues: none when omp no longer has the stored one (plan row 115). */
function askedSession(state: State, thread: Thread): AgentSessionId | null {
  const stored = thread.session;
  return stored !== null && isGone(aiOf(state, thread.id), stored) ? null : stored;
}

function isAnswerIn(message: Message, session: AgentSessionId | null): boolean {
  return message.body.kind === "aiAnswer" && message.body.session === session;
}

function answersIn(thread: Thread | undefined, session: AgentSessionId | null): number {
  return thread?.messages.filter((message) => isAnswerIn(message, session)).length ?? 0;
}

/** The prompt rule (request C2): the notes since the session's last answer; a session's first turn wrapped. */
function promptText(state: State, thread: Thread, session: AgentSessionId | null): string | null {
  const last = thread.messages.findLastIndex((message) => isAnswerIn(message, session));
  const notes = thread.messages
    .slice(last + 1)
    .flatMap(({ body }) => (body.kind === "note" ? [body.text] : []));
  const context = state.place(thread);
  if (notes.length === 0 || context === null) {
    return null;
  }
  const text = notes.join(NOTE_JOIN);
  return last === -1 ? firstMessage(context.template, { ...context.values, MESSAGE: text }) : text;
}

function canAsk(state: State, thread: Thread): boolean {
  const { loaded, loadedSession, running } = aiOf(state, thread.id);
  const session = askedSession(state, thread);
  const unrecorded = loaded?.kind === "loaded" && loaded.turns.length > answersIn(thread, session);
  const waiting = session !== null && (loadedSession !== session || loaded === null || unrecorded);
  return running === null && !waiting && promptText(state, thread, session) !== null;
}

/** A replay is kept only with exactly the session's stored answers (plan row 121); a failed load unless omp lost it. */
function isKept(ai: ThreadAi, thread: Thread, session: AgentSessionId): boolean {
  const exact =
    ai.loaded?.kind === "loaded" && ai.loaded.turns.length === answersIn(thread, session);
  return ai.loadedSession === session && (exact || ai.loaded === null || isGone(ai, session));
}

/** Records every replayed turn no answer holds; the answered turn shows as its own object, the replay's last. */
async function keep(state: State, replay: ConversationLoad, kept: Kept): Promise<void> {
  const { thread, session } = kept;
  const turns = replay.kind === "loaded" ? replay.turns : [];
  for (let known = answersIn(threadOf(state, thread), session); known < turns.length; known += 1) {
    if ((await state.threads.addAiAnswer(thread, session)) === null) {
      put(state, thread, { loadedSession: session, loaded: replay });
      return;
    }
  }
  const answered = state.answered.get(thread);
  const shown = answered === undefined ? turns : [...turns.slice(0, -1), answered.turn];
  const loaded = replay.kind === "loaded" ? { kind: replay.kind, turns: shown } : replay;
  put(state, thread, { loadedSession: session, loaded });
}

async function reload(state: State, kept: Kept): Promise<void> {
  put(state, kept.thread, { loadedSession: kept.session, loaded: null });
  await keep(state, await state.client.loadConversation(kept.session), kept);
}

/** A held turn is recorded at once and appended when the store numbers it next; else the replay decides. */
async function record(state: State, kept: Kept, end: TurnEnd): Promise<void> {
  const { thread, session } = kept;
  const held = end.kind === "failed" ? HELD_AFTER[end.failure.kind] : HELD_AT_END[end.kind];
  if (held === "held") {
    state.answered.set(thread, end);
    const turn = await state.threads.addAiAnswer(thread, session);
    const { loaded, loadedSession } = aiOf(state, thread);
    if (loadedSession === session && loaded?.kind === "loaded" && turn === loaded.turns.length) {
      put(state, thread, { loaded: { kind: "loaded", turns: [...loaded.turns, end.turn] } });
    } else {
      void reload(state, kept);
    }
  } else if (held === "replay") {
    const replay = await state.client.loadConversation(session);
    if (replay.kind !== "loaded") {
      log.warn("ai.replay_failed", { thread, load: replay.kind });
    } else if (replay.turns.length > answersIn(threadOf(state, thread), session)) {
      state.answered.set(thread, end);
    }
    await keep(state, replay, kept);
  }
}

async function ended(
  state: State,
  thread: ThreadId,
  { end, session }: { end: TurnEnd; session: AgentSessionId | null },
): Promise<void> {
  state.turns.delete(thread);
  if (end.kind === "failed" && end.failure.kind === "sessionGone" && session !== null) {
    const gone: ConversationLoad = { kind: "failed", failure: end.failure };
    put(state, thread, { running: null, loadedSession: session, loaded: gone });
    ask(state, thread);
    return;
  }
  put(state, thread, { end });
  if (session !== null) {
    await record(state, { thread, session }, end);
  }
  put(state, thread, { running: null });
}

function run(
  state: State,
  thread: ThreadId,
  request: { session: AgentSessionId | null; text: string },
): void {
  put(state, thread, { running: STARTING, end: null });
  state.asked.set(thread, request.text);
  state.answered.delete(thread);
  const asked = { session: request.session };
  const turn = state.client.ask(request, {
    session: (created) => {
      asked.session = created;
      put(state, thread, { loadedSession: created, loaded: { kind: "loaded", turns: [] } });
      void state.threads.setSession(thread, created);
    },
    changed: (view) => {
      if (aiOf(state, thread).end === null) {
        put(state, thread, { running: view });
      }
    },
  });
  state.turns.set(thread, turn);
  void turn.ended.then((end) => ended(state, thread, { end, session: asked.session }));
}

function ask(state: State, id: ThreadId): void {
  const thread = threadOf(state, id);
  if (thread === undefined || !canAsk(state, thread)) {
    return;
  }
  const session = askedSession(state, thread);
  const text = promptText(state, thread, session);
  if (text !== null) {
    run(state, id, { session, text });
  }
}

/** Retry sends a failed turn's prompt again when omp holds it (its answer is recorded); else it asks. */
function retry(state: State, id: ThreadId): void {
  const ai = aiOf(state, id);
  const text = state.asked.get(id);
  if (ai.running !== null || ai.end?.kind !== "failed") {
    return;
  }
  const recorded = ai.loaded?.kind === "loaded" && ai.loaded.turns.includes(ai.end.turn);
  if (text !== undefined && recorded) {
    run(state, id, { session: ai.loadedSession, text });
  } else {
    ask(state, id);
  }
}

async function load(state: State, id: ThreadId): Promise<void> {
  const thread = threadOf(state, id);
  const session = thread?.session ?? null;
  const kept = thread === undefined || session === null || isKept(aiOf(state, id), thread, session);
  if (!kept && aiOf(state, id).running === null) {
    await reload(state, { thread: id, session });
  }
}

export function createRangeAi(
  client: AiClient,
  threads: State["threads"],
  place: (thread: Thread) => AskContext | null,
): RangeAi {
  const state: State = {
    client,
    threads,
    place,
    byThread: shallowRef<ReadonlyMap<ThreadId, ThreadAi>>(new Map()),
    turns: new Map(),
    asked: new Map(),
    answered: new Map(),
  };
  return {
    of: (thread) => aiOf(state, thread),
    ask: (thread) => {
      ask(state, thread);
    },
    retry: (thread) => {
      retry(state, thread);
    },
    stop: (thread) => {
      state.turns.get(thread)?.stop();
    },
    load: (thread) => {
      void load(state, thread);
    },
    canAsk: (id) => {
      const thread = threadOf(state, id);
      return thread !== undefined && canAsk(state, thread);
    },
  };
}
