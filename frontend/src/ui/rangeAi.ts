import { shallowRef, type ShallowRef } from "vue";

import {
  agentSessionId,
  firstMessage,
  type AgentClient,
  type AgentFailure,
  type AgentSessionId,
  type ConversationLoad,
  type Placeholder,
  type RunningTurn,
  type TurnEnd,
  type TurnView,
} from "../agent";
import { log, type Message, type Thread, type ThreadId } from "../ipc";
import type { RangeThreads } from "./rangeThreads";

/** `session` is the conversation `loaded` holds; `running` stays until the turn's answer is recorded. */
export type ThreadAi = {
  readonly running: TurnView | null;
  readonly end: TurnEnd | null;
  readonly loaded: ConversationLoad | null;
  readonly session: AgentSessionId | null;
};

export type AskContext = {
  readonly template: string;
  readonly values: Readonly<Record<Exclude<Placeholder, "MESSAGE">, string>>;
};

export type RangeAi = {
  readonly byThread: Readonly<ShallowRef<ReadonlyMap<ThreadId, ThreadAi>>>;
  ask(thread: ThreadId): void;
  retry(thread: ThreadId): void;
  stop(thread: ThreadId): void;
  load(thread: ThreadId): void;
  canAsk(thread: ThreadId): boolean;
};

type AiClient = Pick<AgentClient, "ask" | "loadConversation">;
type Held = "held" | "notHeld" | "replay";

type State = {
  readonly client: AiClient;
  readonly threads: Pick<RangeThreads, "list" | "setSession" | "addAiAnswer">;
  readonly place: (thread: Thread) => AskContext | null;
  readonly byThread: ShallowRef<ReadonlyMap<ThreadId, ThreadAi>>;
  readonly turns: Map<ThreadId, RunningTurn>;
  readonly asked: Map<ThreadId, string>;
};

export const IDLE: ThreadAi = { running: null, end: null, loaded: null, session: null };
const NOTE_JOIN = "\n\n";
const STARTING: TurnView = { entries: [], answer: "" };
/** Whether omp holds a turn's prompt; a stop or crash right after sending it may leave none (measured). */
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
    ai.session === session &&
    ai.loaded?.kind === "failed" &&
    ai.loaded.failure.kind === "sessionGone"
  );
}

function storedSession(thread: Thread): AgentSessionId | null {
  return thread.session === null ? null : agentSessionId(thread.session);
}

/** The conversation the next ask continues: none when omp no longer has the stored one (plan row 115). */
function askedSession(state: State, thread: Thread): AgentSessionId | null {
  const stored = storedSession(thread);
  return stored !== null && isGone(aiOf(state, thread.id), stored) ? null : stored;
}

function isAnswerIn(message: Message, session: AgentSessionId | null): boolean {
  return message.body.kind === "aiAnswer" && message.body.session === session;
}

function answersIn(thread: Thread | undefined, session: AgentSessionId): number {
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
  const ai = aiOf(state, thread.id);
  const session = askedSession(state, thread);
  const loading = session !== null && (ai.session !== session || ai.loaded === null);
  return ai.running === null && !loading && promptText(state, thread, session) !== null;
}

async function replayHolds(
  state: State,
  thread: ThreadId,
  session: AgentSessionId,
): Promise<boolean> {
  const load = await state.client.loadConversation(session);
  if (load.kind !== "loaded") {
    log.warn("ai.replay_failed", { thread, load: load.kind });
    return false;
  }
  const known = answersIn(threadOf(state, thread), session);
  const held = load.turns.length > known;
  const turns = held ? load.turns.slice(0, known) : load.turns;
  put(state, thread, { session, loaded: { kind: "loaded", turns } });
  return held;
}

async function isHeld(
  state: State,
  { thread, session, end }: { thread: ThreadId; session: AgentSessionId; end: TurnEnd },
): Promise<boolean> {
  const held = end.kind === "failed" ? HELD_AFTER[end.failure.kind] : HELD_AT_END[end.kind];
  return held === "replay" ? replayHolds(state, thread, session) : held === "held";
}

async function ended(
  state: State,
  thread: ThreadId,
  { end, session }: { end: TurnEnd; session: AgentSessionId | null },
): Promise<void> {
  state.turns.delete(thread);
  if (end.kind === "failed" && end.failure.kind === "sessionGone" && session !== null) {
    put(state, thread, {
      running: null,
      session,
      loaded: { kind: "failed", failure: end.failure },
    });
    ask(state, thread);
    return;
  }
  put(state, thread, { end });
  const recorded =
    session !== null &&
    (await isHeld(state, { thread, session, end })) &&
    (await state.threads.addAiAnswer(thread, session));
  const ai = aiOf(state, thread);
  const { loaded } = ai;
  const appended =
    recorded && ai.session === session && loaded?.kind === "loaded"
      ? { loaded: { kind: "loaded" as const, turns: [...loaded.turns, end.turn] } }
      : {};
  put(state, thread, { running: null, ...appended });
}

function run(
  state: State,
  thread: ThreadId,
  request: { session: AgentSessionId | null; text: string },
): void {
  put(state, thread, { running: STARTING, end: null });
  state.asked.set(thread, request.text);
  const asked = { session: request.session };
  const turn = state.client.ask(request, {
    session: (created) => {
      asked.session = created;
      put(state, thread, { session: created, loaded: { kind: "loaded", turns: [] } });
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
    run(state, id, { session: ai.session, text });
  } else {
    ask(state, id);
  }
}

async function load(state: State, id: ThreadId): Promise<void> {
  const thread = threadOf(state, id);
  const session = thread === undefined ? null : storedSession(thread);
  const ai = aiOf(state, id);
  if (session === null || ai.running !== null) {
    return;
  }
  const kept = ai.loaded === null || ai.loaded.kind === "loaded" || isGone(ai, session);
  if (ai.session === session && kept) {
    return;
  }
  put(state, id, { session, loaded: null });
  const loaded = await state.client.loadConversation(session);
  if (aiOf(state, id).session !== session) {
    return;
  }
  const held = loaded.kind === "loaded" ? loaded.turns.length : 0;
  // Turns omp holds that no answer records (a reload mid-turn) become answers, plan row 121.
  for (let known = answersIn(thread, session); known < held; known += 1) {
    if (!(await state.threads.addAiAnswer(id, session))) {
      break;
    }
  }
  put(state, id, { loaded });
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
  };
  return {
    byThread: state.byThread,
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
