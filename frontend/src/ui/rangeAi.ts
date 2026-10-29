import { shallowRef, type ShallowRef } from "vue";

import type { AgentClient, ConversationLoad, RunningTurn, TurnEnd, TurnView } from "../agent";
import { log, type AgentSessionId, type Thread, type ThreadId } from "../ipc";
import { answersIn, heldAfter, isGone, isKept, promptText, type AskContext } from "./rangeAiRules";
import { IDLE, type ThreadAi } from "./rangeAiView";
import { isBlank } from "./rangeDrafts";
import type { RangeThreads } from "./rangeThreads";

/** Where Ask AI was pressed: an open thread, or a line's new thread not added yet (its draft key). */
export type AskFrom =
  | { readonly kind: "thread"; readonly thread: ThreadId }
  | { readonly kind: "draft"; readonly key: string };

export type RangeAi = {
  of(thread: ThreadId): ThreadAi;
  /** Ask AI (plan row 124): a non-blank `typed` is added first (the note, or the new thread) and the AI is asked once
   *  it is stored; a failed add asks nothing; nothing typed asks with the notes since the last answer. */
  ask(from: AskFrom, typed: string): Promise<void>;
  /** Plan row 124: no turn runs, the conversation has loaded, no add in that box still runs, and something to send. */
  canAsk(from: AskFrom, typed: string): boolean;
  retry(thread: ThreadId): void;
  stop(thread: ThreadId): void;
  load(thread: ThreadId): void;
};

type AiClient = Pick<AgentClient, "ask" | "loadConversation">;
type AiThreads = Pick<
  RangeThreads,
  "list" | "setSession" | "addAiAnswer" | "addThread" | "addNote" | "addingThread" | "addingNote"
>;
type Kept = Readonly<{ thread: ThreadId; session: AgentSessionId }>;
type State = {
  readonly client: AiClient;
  readonly threads: AiThreads;
  readonly place: (thread: Thread) => AskContext | null;
  readonly byThread: ShallowRef<ReadonlyMap<ThreadId, ThreadAi>>;
  readonly turns: Map<ThreadId, RunningTurn>;
  readonly asked: Map<ThreadId, string>;
  /** The thread's last ended turn while omp holds it, so the replay's last; dropped at the next ask. */
  readonly answered: Map<ThreadId, TurnEnd>;
};

const STARTING: TurnView = { entries: [], answer: "" };

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

/** The conversation the next ask continues: none when omp no longer has the stored one (plan row 115). */
function askedSession(state: State, thread: Thread): AgentSessionId | null {
  const stored = thread.session;
  return stored !== null && isGone(aiOf(state, thread.id), stored) ? null : stored;
}

/** No turn runs, the conversation has loaded and the First message has its context (`place`): what Ask needs
 *  besides something to send. */
function isReady(state: State, thread: Thread): boolean {
  const { loaded, loadedSession, running } = aiOf(state, thread.id);
  const session = askedSession(state, thread);
  const unrecorded = loaded?.kind === "loaded" && loaded.turns.length > answersIn(thread, session);
  const waiting = session !== null && (loadedSession !== session || loaded === null || unrecorded);
  return running === null && !waiting && state.place(thread) !== null;
}

function canAsk(state: State, thread: Thread): boolean {
  const prompt = promptText(thread, askedSession(state, thread), state.place(thread));
  return isReady(state, thread) && prompt !== null;
}

function canAskFrom(state: State, from: AskFrom, typed: string): boolean {
  if (from.kind === "draft") {
    return !isBlank(typed) && !state.threads.addingThread(from.key);
  }
  const thread = threadOf(state, from.thread);
  if (thread === undefined || state.threads.addingNote(from.thread)) {
    return false;
  }
  return isBlank(typed) ? canAsk(state, thread) : isReady(state, thread);
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
  const held = heldAfter(end);
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
  const text = promptText(thread, session, state.place(thread));
  if (text !== null) {
    run(state, id, { session, text });
  }
}

/** The thread a non-blank typed text was added to: the open thread's new note, or the draft's new thread. */
async function addTyped(state: State, from: AskFrom, typed: string): Promise<ThreadId | null> {
  if (from.kind === "draft") {
    return state.threads.addThread(from.key, typed);
  }
  return (await state.threads.addNote(from.thread, typed)) ? from.thread : null;
}

async function askFrom(state: State, from: AskFrom, typed: string): Promise<void> {
  if (!canAskFrom(state, from, typed)) {
    return;
  }
  if (from.kind === "thread" && isBlank(typed)) {
    ask(state, from.thread);
    return;
  }
  const thread = await addTyped(state, from, typed);
  if (thread !== null) {
    ask(state, thread);
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
    ask: (from, typed) => askFrom(state, from, typed),
    retry: (thread) => {
      retry(state, thread);
    },
    stop: (thread) => {
      state.turns.get(thread)?.stop();
    },
    load: (thread) => {
      void load(state, thread);
    },
    canAsk: (from, typed) => canAskFrom(state, from, typed),
  };
}
