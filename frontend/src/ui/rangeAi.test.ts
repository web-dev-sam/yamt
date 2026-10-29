import { expect, test, vi } from "vitest";
import { computed, shallowRef } from "vue";

import {
  agentSessionId,
  type AgentClient,
  type AgentFailure,
  type AgentSessionId,
  type AskRequest,
  type ConversationLoad,
  type TurnEnd,
  type TurnEvents,
  type TurnView,
} from "../agent";
import {
  changedThreadLine,
  createFixtureRangeSource,
  log,
  type Message,
  type RangeSource,
  type Thread,
  type ThreadId,
  type ThreadList,
} from "../ipc";
import type { Problem } from "./problem";
import { createRangeAi, type AskFrom, type RangeAi } from "./rangeAi";
import type { AskContext } from "./rangeAiRules";
import { answerView, liveTurn, postBody, type ThreadAi } from "./rangeAiView";
import { createRangeThreads, type RangeThreads } from "./rangeThreads";

type Asked = {
  readonly request: AskRequest;
  readonly events: TurnEvents;
  readonly end: (end: TurnEnd) => void;
  readonly stops: number;
};

type Loading = {
  readonly session: AgentSessionId;
  readonly answer: (load: ConversationLoad) => void;
};

/** A scripted agent client: each ask and load waits until the test answers it. */
class FakeClient implements Pick<AgentClient, "ask" | "loadConversation"> {
  readonly asks: Asked[] = [];
  readonly loads: Loading[] = [];

  ask(request: AskRequest, events: TurnEvents): { ended: Promise<TurnEnd>; stop: () => void } {
    let stops = 0;
    const ended = new Promise<TurnEnd>((end) => {
      this.asks.push({
        request,
        events,
        end,
        get stops() {
          return stops;
        },
      });
    });
    return {
      ended,
      stop: () => {
        stops += 1;
      },
    };
  }

  loadConversation(session: AgentSessionId): Promise<ConversationLoad> {
    return new Promise((answer) => {
      this.loads.push({ session, answer });
    });
  }
}

type Rig = {
  readonly client: FakeClient;
  readonly threads: RangeThreads;
  readonly ai: RangeAi;
  readonly problems: Problem[];
  readonly fresh: ThreadId;
  readonly seeded: ThreadId;
};

const SEEDED_SESSION = "fixture-session";
const TEMPLATE =
  "{{ RELATIVE_FILE_PATH_WITH_LINE }} {{ RANGE }} {{ OLD_COMMIT }}..{{ NEW_COMMIT }}\n{{ MESSAGE }}";
const CONTEXT: AskContext = {
  template: TEMPLATE,
  values: {
    RELATIVE_FILE_PATH_WITH_LINE: "src/board/board.ts:20",
    RANGE: "main...feature",
    OLD_COMMIT: "531ea52",
    NEW_COMMIT: "9c1ba3f",
  },
};
const WRAP = "src/board/board.ts:20 main...feature 531ea52..9c1ba3f\n";
const CRASHED: AgentFailure = { kind: "crashed", code: 1, lastLog: null };
const WRITE_FAILED = { kind: "WriteFailed", path: "/t/threads.json", message: "full" } as const;
const MAX_TOKENS: AgentFailure = { kind: "ended", reason: "max_tokens" };

function session(text: string): AgentSessionId {
  const id = agentSessionId(text);
  if (id === null) {
    throw new Error(`${text} is no session`);
  }
  return id;
}

function view(answer: string): TurnView {
  return { entries: [], answer };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** `failsWrite(n)`: whether the n-th `addAiAnswer` write fails; `edit` replaces source calls. */
async function rig(
  failsWrite: (write: number) => boolean = () => false,
  edit: (fixture: RangeSource) => Partial<RangeSource> = () => ({}),
): Promise<Rig> {
  const fixture = createFixtureRangeSource(log, "?range=review&threads=seeded");
  const problems: Problem[] = [];
  let writes = 0;
  const source = {
    ...fixture,
    addAiAnswer: async (thread: ThreadId, asked: AgentSessionId) => {
      writes += 1;
      return failsWrite(writes)
        ? { ok: false as const, failure: WRITE_FAILED }
        : fixture.addAiAnswer(thread, asked);
    },
    ...edit(fixture),
  };
  const threads = createRangeThreads(source, (problem) => {
    problems.push(problem);
  });
  await threads.load();
  const [fresh, , , seeded] = threads.list.value.threads.map(({ id }) => id);
  if (fresh === undefined || seeded === undefined) {
    throw new Error("no seeded threads");
  }
  const client = new FakeClient();
  const ai = createRangeAi(client, threads, () => CONTEXT);
  return { client, threads, ai, problems, fresh, seeded };
}

function on(thread: ThreadId): AskFrom {
  return { kind: "thread", thread };
}

function threadAt(live: Rig, index: number): ThreadId {
  const thread = live.threads.list.value.threads[index];
  if (thread === undefined) {
    throw new Error(`no thread at ${index}`);
  }
  return thread.id;
}

function threadOf(live: Rig, id: ThreadId): Thread {
  const found = live.threads.list.value.threads.find((thread) => thread.id === id);
  if (found === undefined) {
    throw new Error(`no thread ${id}`);
  }
  return found;
}

function aiOf(live: Rig, id: ThreadId): ThreadAi {
  return live.ai.of(id);
}

function askedAt(live: Rig, index: number): Asked {
  const asked = live.client.asks[index];
  if (asked === undefined) {
    throw new Error(`no ask ${index}`);
  }
  return asked;
}

function loadAt(live: Rig, index: number): Loading {
  const loading = live.client.loads[index];
  if (loading === undefined) {
    throw new Error(`no load ${index}`);
  }
  return loading;
}

function bodies(live: Rig, id: ThreadId): unknown[] {
  return threadOf(live, id).messages.map(({ body }) => body);
}

async function loadedSeeded(live: Rig, turns: readonly TurnView[]): Promise<void> {
  live.ai.load(live.seeded);
  loadAt(live, live.client.loads.length - 1).answer({ kind: "loaded", turns });
  await settle();
}

test("a new thread's first turn sends every note, wrapped in First message", async () => {
  const live = await rig();
  await live.threads.addNote(live.fresh, "And the reminder?");

  void live.ai.ask(on(live.fresh), "");

  expect(askedAt(live, 0).request).toEqual({
    session: null,
    text: `${WRAP}Why does the overdue check go?\n\nAnd the reminder?`,
  });
  expect(aiOf(live, live.fresh).running).toEqual(view(""));
});

test("the session is stored on omp's event, before the turn ends", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");

  askedAt(live, 0).events.session(session("s1"));
  await settle();

  expect(threadOf(live, live.fresh).session).toBe("s1");
  expect(aiOf(live, live.fresh)).toMatchObject({
    loadedSession: "s1",
    loaded: { kind: "loaded", turns: [] },
    end: null,
  });
  expect(bodies(live, live.fresh)).toHaveLength(1);
});

test("a finished turn adds one answer; the next ask sends only the notes since it, unwrapped", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  const first = askedAt(live, 0);
  first.events.session(session("s1"));
  first.events.changed(view("Part"));
  expect(aiOf(live, live.fresh).running).toEqual(view("Part"));
  const answer = view("It moved to the reminders.");

  first.end({ kind: "finished", turn: answer });
  await settle();

  expect(bodies(live, live.fresh).slice(1)).toEqual([{ kind: "aiAnswer", session: "s1", turn: 0 }]);
  expect(aiOf(live, live.fresh)).toMatchObject({
    running: null,
    loaded: { kind: "loaded", turns: [answer] },
  });
  expect(live.client.loads).toEqual([]);
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(false);

  await live.threads.addNote(live.fresh, "Where?");
  await live.threads.addNote(live.fresh, "And why?");
  void live.ai.ask(on(live.fresh), "");

  expect(askedAt(live, 1).request).toEqual({ session: "s1", text: "Where?\n\nAnd why?" });
});

test("Ask does nothing while the thread's turn runs or with nothing new; Stop stops that turn", async () => {
  const live = await rig();
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(true);
  void live.ai.ask(on(live.fresh), "");
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(false);

  void live.ai.ask(on(live.fresh), "");
  live.ai.stop(live.fresh);

  expect(live.client.asks).toHaveLength(1);
  expect(askedAt(live, 0).stops).toBe(1);
  live.ai.stop(live.seeded);
  expect(askedAt(live, 0).stops).toBe(1);
});

test("a turn stopped before the prompt reached omp adds no answer; its stopped end stays shown", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  const asked = askedAt(live, 0);
  asked.events.session(session("s1"));
  const stopped: TurnEnd = { kind: "stopped", turn: view("") };

  asked.end(stopped);
  await settle();
  expect(loadAt(live, 0).session).toBe("s1");
  loadAt(live, 0).answer({ kind: "loaded", turns: [] });
  await settle();

  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(aiOf(live, live.fresh)).toMatchObject({ running: null, end: stopped });
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(true);
});

test("a turn stopped after omp holds its prompt adds one answer, shown with its own end", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  const asked = askedAt(live, 0);
  asked.events.session(session("s1"));
  const partial = view("So far");
  const stopped: TurnEnd = { kind: "stopped", turn: partial };

  asked.events.changed(partial);
  asked.end(stopped);
  await settle();
  expect(aiOf(live, live.fresh)).toMatchObject({ running: partial, end: stopped });
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(false);
  loadAt(live, 0).answer({ kind: "loaded", turns: [view("")] });
  await settle();

  expect(bodies(live, live.fresh).slice(1)).toEqual([{ kind: "aiAnswer", session: "s1", turn: 0 }]);
  expect(aiOf(live, live.fresh)).toMatchObject({
    running: null,
    loaded: { kind: "loaded", turns: [partial] },
  });
});

test.each<[string, AgentFailure]>([
  ["checkout", { kind: "checkoutFailed", message: "no git" }],
  ["missing program", { kind: "notFound", program: "omp", searched: [] }],
  ["app", { kind: "app", failure: { kind: "AiOff" } }],
])(
  "a %s failure before the prompt adds no answer and asks omp nothing more",
  async (_case, failure) => {
    const live = await rig();
    void live.ai.ask(on(live.fresh), "");
    const failed: TurnEnd = { kind: "failed", turn: view(""), failure };

    askedAt(live, 0).end(failed);
    await settle();

    expect(bodies(live, live.fresh)).toHaveLength(1);
    expect(live.client.loads).toEqual([]);
    expect(aiOf(live, live.fresh)).toMatchObject({ running: null, end: failed });

    live.ai.retry(live.fresh);
    expect(askedAt(live, 1).request).toEqual(askedAt(live, 0).request);
  },
);

test("a turn omp ended itself (max tokens) is an answer without asking the replay", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 0).events.session(session("s1"));

  askedAt(live, 0).end({
    kind: "failed",
    turn: view("Cut"),
    failure: { kind: "ended", reason: "max_tokens" },
  });
  await settle();

  expect(live.client.loads).toEqual([]);
  expect(bodies(live, live.fresh).slice(1)).toEqual([{ kind: "aiAnswer", session: "s1", turn: 0 }]);
});

test("a crash after omp held the prompt adds the answer; Retry sends that prompt again in the session", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  const first = askedAt(live, 0);
  first.events.session(session("s1"));
  first.end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 0).answer({ kind: "loaded", turns: [view("")] });
  await settle();
  expect(bodies(live, live.fresh).slice(1)).toEqual([{ kind: "aiAnswer", session: "s1", turn: 0 }]);
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(false);

  live.ai.retry(live.fresh);

  expect(askedAt(live, 1).request).toEqual({ session: "s1", text: first.request.text });
});

test("a crash before omp held the prompt adds nothing; a failed replay adds nothing either", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 0).events.session(session("s1"));
  askedAt(live, 0).end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 0).answer({ kind: "loaded", turns: [] });
  await settle();
  live.ai.retry(live.fresh);
  askedAt(live, 1).end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 1).answer({ kind: "failed", failure: CRASHED });
  await settle();

  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(askedAt(live, 1).request).toEqual({ session: "s1", text: askedAt(live, 0).request.text });
});

test("a stored session is loaded once when shown, and Ask waits for it", async () => {
  const live = await rig();
  expect(live.ai.canAsk(on(live.seeded), "")).toBe(false);

  live.ai.load(live.seeded);
  live.ai.load(live.seeded);
  live.ai.load(live.fresh);

  expect(live.client.loads.map((each) => each.session)).toEqual([SEEDED_SESSION]);
  expect(aiOf(live, live.seeded)).toMatchObject({ loadedSession: SEEDED_SESSION, loaded: null });
  await live.threads.addNote(live.seeded, "Who calls it?");
  expect(live.ai.canAsk(on(live.seeded), "")).toBe(false);
  void live.ai.ask(on(live.seeded), "");
  expect(live.client.asks).toEqual([]);

  loadAt(live, 0).answer({ kind: "loaded", turns: [view("Yes")] });
  await settle();
  live.ai.load(live.seeded);
  expect(live.client.loads).toHaveLength(1);
  expect(live.ai.canAsk(on(live.seeded), "")).toBe(true);
  void live.ai.ask(on(live.seeded), "");
  expect(askedAt(live, 0).request).toEqual({ session: SEEDED_SESSION, text: "Who calls it?" });
});

test("turns omp holds without an answer in the thread (a reload mid-turn) become answers before Ask is offered", async () => {
  const live = await rig();
  await live.threads.addNote(live.seeded, "Who calls it?");
  live.ai.load(live.seeded);
  const turns = [view("Yes"), view("Half"), view("Rest")];
  loadAt(live, 0).answer({ kind: "loaded", turns });
  expect(live.ai.canAsk(on(live.seeded), "")).toBe(false);
  await settle();

  expect(bodies(live, live.seeded).slice(1)).toEqual([
    { kind: "aiAnswer", session: SEEDED_SESSION, turn: 0 },
    { kind: "note", text: "Who calls it?" },
    { kind: "aiAnswer", session: SEEDED_SESSION, turn: 1 },
    { kind: "aiAnswer", session: SEEDED_SESSION, turn: 2 },
  ]);
  expect(live.ai.canAsk(on(live.seeded), "")).toBe(false);
  await live.threads.addNote(live.seeded, "And now?");
  void live.ai.ask(on(live.seeded), "");
  expect(askedAt(live, 0).request.text).toBe("And now?");
  askedAt(live, 0).end({ kind: "finished", turn: view("Now") });
  await settle();
  expect(bodies(live, live.seeded).at(-1)).toEqual({
    kind: "aiAnswer",
    session: SEEDED_SESSION,
    turn: 3,
  });
  expect(aiOf(live, live.seeded).loaded).toEqual({
    kind: "loaded",
    turns: [...turns, view("Now")],
  });
});

test("a failed write of an unseen turn's answer stops there and still shows the conversation", async () => {
  const fixture = createFixtureRangeSource(log, "?range=review&threads=seeded");
  const failure = { kind: "WriteFailed", path: "/t/threads.json", message: "full" } as const;
  let writes = 0;
  const threads = createRangeThreads(
    {
      ...fixture,
      addAiAnswer: async () => {
        writes += 1;
        return { ok: false, failure };
      },
    },
    () => undefined,
  );
  await threads.load();
  const client = new FakeClient();
  const ai = createRangeAi(client, threads, () => CONTEXT);
  const seeded = threads.list.value.threads[3];
  if (seeded === undefined) {
    throw new Error("no seeded thread");
  }

  ai.load(seeded.id);
  const turns = [view("Yes"), view("Half"), view("Rest")];
  client.loads[0]?.answer({ kind: "loaded", turns });
  await settle();

  expect(writes).toBe(1);
  expect(ai.of(seeded.id)).toMatchObject({ loaded: { kind: "loaded", turns } });
});

test("a load that failed for another reason than a lost session is tried again", async () => {
  const live = await rig();
  live.ai.load(live.seeded);
  loadAt(live, 0).answer({ kind: "failed", failure: CRASHED });
  await settle();

  live.ai.load(live.seeded);

  expect(live.client.loads).toHaveLength(2);
});

test("a session omp lost at load: the next ask starts a new one with every note wrapped", async () => {
  const live = await rig();
  live.ai.load(live.seeded);
  loadAt(live, 0).answer({ kind: "failed", failure: { kind: "sessionGone" } });
  await settle();
  live.ai.load(live.seeded);
  expect(live.client.loads).toHaveLength(1);

  void live.ai.ask(on(live.seeded), "");

  expect(askedAt(live, 0).request).toEqual({ session: null, text: `${WRAP}Is this still used?` });
});

test("a session omp lost at the ask: a new one starts at once with every note wrapped", async () => {
  const live = await rig();
  await loadedSeeded(live, [view("Yes")]);
  await live.threads.addNote(live.seeded, "Who calls it?");
  void live.ai.ask(on(live.seeded), "");
  expect(askedAt(live, 0).request.text).toBe("Who calls it?");

  askedAt(live, 0).end({ kind: "failed", turn: view(""), failure: { kind: "sessionGone" } });
  await settle();

  expect(askedAt(live, 1).request).toEqual({
    session: null,
    text: `${WRAP}Is this still used?\n\nWho calls it?`,
  });
  askedAt(live, 1).events.session(session("s2"));
  await settle();
  expect(threadOf(live, live.seeded).session).toBe("s2");
});

test("a turn of a new session omp never held shows no answer of the lost session", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 0).events.session(session("s1"));
  askedAt(live, 0).end({ kind: "finished", turn: view("A") });
  await settle();
  await live.threads.addNote(live.fresh, "More?");
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 1).end({ kind: "failed", turn: view(""), failure: { kind: "sessionGone" } });
  await settle();
  askedAt(live, 2).events.session(session("s2"));

  askedAt(live, 2).end({ kind: "stopped", turn: view("") });
  await settle();
  loadAt(live, 0).answer({ kind: "loaded", turns: [] });
  await settle();

  expect(aiOf(live, live.fresh)).toMatchObject({
    loadedSession: "s2",
    loaded: { kind: "loaded", turns: [] },
  });
});

test("two threads run at once; one ending leaves the other running", async () => {
  const live = await rig();
  await loadedSeeded(live, [view("Yes")]);
  await live.threads.addNote(live.seeded, "Who calls it?");

  void live.ai.ask(on(live.fresh), "");
  void live.ai.ask(on(live.seeded), "");
  expect(live.client.asks).toHaveLength(2);
  askedAt(live, 1).end({ kind: "finished", turn: view("board.ts") });
  await settle();

  expect(aiOf(live, live.fresh).running).not.toBeNull();
  expect(aiOf(live, live.seeded).running).toBeNull();
  expect(bodies(live, live.seeded).slice(-1)).toEqual([
    { kind: "aiAnswer", session: SEEDED_SESSION, turn: 1 },
  ]);
});

test("a failed write of the session or the answer is reported as such", async () => {
  const fixture = createFixtureRangeSource(log, "?range=review&threads=seeded");
  const problems: Problem[] = [];
  const failure = { kind: "WriteFailed", path: "/t/threads.json", message: "full" } as const;
  const threads = createRangeThreads(
    {
      ...fixture,
      setThreadSession: async () => ({ ok: false, failure }),
      addAiAnswer: async () => ({ ok: false, failure }),
    },
    (problem) => {
      problems.push(problem);
    },
  );
  await threads.load();
  const client = new FakeClient();
  const ai = createRangeAi(client, threads, () => CONTEXT);
  const [fresh] = threads.list.value.threads;
  if (fresh === undefined) {
    throw new Error("no thread");
  }
  const answer = view("A");

  void ai.ask(on(fresh.id), "");
  client.asks[0]?.events.session(session("s1"));
  client.asks[0]?.end({ kind: "finished", turn: answer });
  await settle();

  expect(problems.map((problem) => problem.action === "threads" && problem.step)).toEqual([
    "session",
    "answer",
  ]);
  expect(ai.of(fresh.id)).toMatchObject({ running: null, loadedSession: "s1", loaded: null });
  expect(client.loads.map((each) => each.session)).toEqual(["s1"]);
  ai.load(fresh.id);
  expect(client.loads).toHaveLength(1);
});

test("no First message context (the range not open) means nothing to ask", async () => {
  const live = await rig();
  const ai = createRangeAi(live.client, live.threads, () => null);

  expect(ai.canAsk(on(live.fresh), "")).toBe(false);
  expect(ai.canAsk(on(live.fresh), "Typed?")).toBe(false);
  void ai.ask(on(live.fresh), "");
  expect(live.client.asks).toEqual([]);
});

async function askedSeeded(live: Rig, turns: readonly TurnView[]): Promise<Asked> {
  await loadedSeeded(live, turns);
  await live.threads.addNote(live.seeded, "Who calls it?");
  void live.ai.ask(on(live.seeded), "");
  return askedAt(live, live.client.asks.length - 1);
}

function lastAnswer(live: Rig, id: ThreadId): Extract<Message["body"], { kind: "aiAnswer" }> {
  const body = threadOf(live, id).messages.at(-1)?.body;
  if (body?.kind !== "aiAnswer") {
    throw new Error("the last message is no AI answer");
  }
  return body;
}

function aiAnswer(
  id: AgentSessionId,
  turn: number,
): Extract<Message["body"], { kind: "aiAnswer" }> {
  return { kind: "aiAnswer", session: id, turn };
}

async function failedSeededLoad(live: Rig): Promise<void> {
  live.ai.load(live.seeded);
  loadAt(live, 0).answer({ kind: "failed", failure: CRASHED });
  await settle();
  await live.threads.addNote(live.seeded, "Who calls it?");
}

test("a session's second turn stopped before omp held it (replay of one turn) adds no answer", async () => {
  const live = await rig();
  const first = view("Yes");
  const asked = await askedSeeded(live, [first]);

  asked.end({ kind: "stopped", turn: view("") });
  await settle();
  loadAt(live, 1).answer({ kind: "loaded", turns: [view("Yes")] });
  await settle();

  expect(bodies(live, live.seeded)).toHaveLength(3);
  expect(aiOf(live, live.seeded)).toMatchObject({
    running: null,
    loaded: { kind: "loaded", turns: [first] },
  });
});

test("a session's second turn stopped after omp held it is answer 1, shown with its own end", async () => {
  const live = await rig();
  const asked = await askedSeeded(live, [view("Yes")]);
  const stopped: TurnEnd = { kind: "stopped", turn: view("Half") };

  asked.end(stopped);
  await settle();
  loadAt(live, 1).answer({ kind: "loaded", turns: [view("Yes"), view("Half")] });
  await settle();

  expect(lastAnswer(live, live.seeded)).toEqual({
    kind: "aiAnswer",
    session: SEEDED_SESSION,
    turn: 1,
  });
  const { loaded } = aiOf(live, live.seeded);
  expect(loaded).toEqual({ kind: "loaded", turns: [view("Yes"), stopped.turn] });
  expect(loaded?.kind === "loaded" && loaded.turns[1]).toBe(stopped.turn);
});

test("a checkout failure on the stored session adds no answer and asks for no replay", async () => {
  const live = await rig();
  const asked = await askedSeeded(live, [view("Yes")]);

  asked.end({
    kind: "failed",
    turn: view(""),
    failure: { kind: "checkoutFailed", message: "no git" },
  });
  await settle();

  expect(live.client.loads).toHaveLength(1);
  expect(bodies(live, live.seeded)).toHaveLength(3);
});

test.each<[string, TurnEnd]>([
  ["stopped", { kind: "stopped", turn: view("") }],
  ["crashed", { kind: "failed", turn: view(""), failure: CRASHED }],
])("a new thread's turn %s before omp named the session asks for no replay", async (_case, end) => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");

  askedAt(live, 0).end(end);
  await settle();

  expect(live.client.loads).toEqual([]);
  expect(bodies(live, live.fresh)).toHaveLength(1);
});

test("a crash after a failed load replaces the failed load with the replay", async () => {
  const live = await rig();
  await failedSeededLoad(live);
  void live.ai.ask(on(live.seeded), "");

  askedAt(live, 0).end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 1).answer({ kind: "loaded", turns: [view("Yes")] });
  await settle();

  expect(aiOf(live, live.seeded).loaded).toEqual({ kind: "loaded", turns: [view("Yes")] });
  expect(bodies(live, live.seeded)).toHaveLength(3);
});

test.each<[string, TurnEnd]>([
  ["finished", { kind: "finished", turn: view("board.ts") }],
  ["ended at max tokens", { kind: "failed", turn: view("board.ts"), failure: MAX_TOKENS }],
])(
  "an answer %s after a failed load loads the conversation again and shows once, as its turn",
  async (_case, end) => {
    const live = await rig();
    await failedSeededLoad(live);
    void live.ai.ask(on(live.seeded), "");

    askedAt(live, 0).end(end);
    await settle();
    expect(live.client.loads.map((each) => each.session)).toEqual([SEEDED_SESSION, SEEDED_SESSION]);
    loadAt(live, 1).answer({ kind: "loaded", turns: [view("Yes"), view("board.ts")] });
    await settle();

    const answer = lastAnswer(live, live.seeded);
    const ai = aiOf(live, live.seeded);
    expect(answer.turn).toBe(1);
    expect(answerView(ai, answer)).toEqual({ kind: "turn", turn: end.turn, end });
    expect(ai.loaded?.kind === "loaded" && ai.loaded.turns[1]).toBe(end.turn);
    expect(liveTurn(ai)).toBeNull();
    expect(postBody(answer, ai)).toEqual({ kind: "text", text: "board.ts" });
  },
);

test("a failed replay check leaves the conversation unloaded; the next finished turn reloads it", async () => {
  const live = await rig();
  const warn = vi.spyOn(log, "warn").mockReturnValue();
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 0).events.session(session("s1"));
  askedAt(live, 0).end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 0).answer({ kind: "failed", failure: CRASHED });
  await settle();
  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(warn).toHaveBeenCalledWith("ai.replay_failed", { thread: live.fresh, load: "failed" });
  warn.mockRestore();
  live.ai.retry(live.fresh);
  const now: TurnEnd = { kind: "finished", turn: view("Now") };

  askedAt(live, 1).end(now);
  await settle();
  expect(live.client.loads).toHaveLength(2);
  const crashed = view("Crashed");
  loadAt(live, 1).answer({ kind: "loaded", turns: [crashed, view("Now")] });
  await settle();

  const s1 = session("s1");
  const ai = aiOf(live, live.fresh);
  expect(bodies(live, live.fresh).slice(1)).toEqual([aiAnswer(s1, 0), aiAnswer(s1, 1)]);
  expect(answerView(ai, aiAnswer(s1, 0))).toEqual({
    kind: "turn",
    turn: crashed,
    end: { kind: "finished", turn: crashed },
  });
  expect(answerView(ai, aiAnswer(s1, 1))).toEqual({ kind: "turn", turn: now.turn, end: now });
  expect(liveTurn(ai)).toBeNull();
});

test("a stop after a failed load records every turn the replay holds past the answers, each shown as omp's", async () => {
  const live = await rig();
  await failedSeededLoad(live);
  void live.ai.ask(on(live.seeded), "");
  const stopped: TurnEnd = { kind: "stopped", turn: view("Part") };

  askedAt(live, 0).end(stopped);
  await settle();
  const held = view("Held");
  loadAt(live, 1).answer({ kind: "loaded", turns: [view("Yes"), held, view("Part")] });
  await settle();

  const seeded = session(SEEDED_SESSION);
  const ai = aiOf(live, live.seeded);
  expect(bodies(live, live.seeded).slice(-3)).toEqual([
    { kind: "note", text: "Who calls it?" },
    aiAnswer(seeded, 1),
    aiAnswer(seeded, 2),
  ]);
  expect(answerView(ai, aiAnswer(seeded, 1))).toEqual({
    kind: "turn",
    turn: held,
    end: { kind: "finished", turn: held },
  });
  expect(answerView(ai, aiAnswer(seeded, 2))).toEqual({
    kind: "turn",
    turn: stopped.turn,
    end: stopped,
  });
  expect(liveTurn(ai)).toBeNull();
});

test("showing the box again while a turn runs after a failed load loads nothing", async () => {
  const live = await rig();
  await failedSeededLoad(live);
  void live.ai.ask(on(live.seeded), "");

  live.ai.load(live.seeded);

  expect(live.client.loads).toHaveLength(1);
});

test("a failed record of a replayed turn keeps Ask off until a load records it; answer i stays omp's turn i", async () => {
  const live = await rig((write) => write === 1);
  await live.threads.addNote(live.seeded, "And now?");
  live.ai.load(live.seeded);
  const turns = [view("Yes"), view("Half")];
  loadAt(live, 0).answer({ kind: "loaded", turns });
  await settle();

  const seeded = session(SEEDED_SESSION);
  expect(bodies(live, live.seeded)).toHaveLength(3);
  expect(live.ai.canAsk(on(live.seeded), "")).toBe(false);
  void live.ai.ask(on(live.seeded), "");
  expect(live.client.asks).toEqual([]);
  expect(answerView(aiOf(live, live.seeded), aiAnswer(seeded, 0))).toMatchObject({
    turn: view("Yes"),
  });

  live.ai.load(live.seeded);
  loadAt(live, 1).answer({ kind: "loaded", turns });
  await settle();
  expect(lastAnswer(live, live.seeded)).toEqual(aiAnswer(seeded, 1));
  await live.threads.addNote(live.seeded, "Then?");
  void live.ai.ask(on(live.seeded), "");
  expect(askedAt(live, 0).request.text).toBe("Then?");
  const now = view("Now");
  askedAt(live, 0).end({ kind: "finished", turn: now });
  await settle();

  expect(lastAnswer(live, live.seeded)).toEqual(aiAnswer(seeded, 2));
  expect(aiOf(live, live.seeded).loaded).toEqual({ kind: "loaded", turns: [...turns, now] });
  expect(live.client.loads).toHaveLength(2);
});

test("a finished turn whose record failed keeps Ask off and shows once after a load records it", async () => {
  const live = await rig((write) => write <= 2);
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 0).events.session(session("s1"));
  const finished: TurnEnd = { kind: "finished", turn: view("A") };
  askedAt(live, 0).end(finished);
  await settle();
  expect(loadAt(live, 0).session).toBe("s1");
  loadAt(live, 0).answer({ kind: "loaded", turns: [view("A")] });
  await settle();

  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(false);
  expect(liveTurn(aiOf(live, live.fresh))).toEqual({ turn: finished.turn, end: finished });

  live.ai.load(live.fresh);
  loadAt(live, 1).answer({ kind: "loaded", turns: [view("A")] });
  await settle();

  const s1 = session("s1");
  expect(bodies(live, live.fresh).slice(1)).toEqual([aiAnswer(s1, 0)]);
  expect(answerView(aiOf(live, live.fresh), aiAnswer(s1, 0))).toEqual({
    kind: "turn",
    turn: finished.turn,
    end: finished,
  });
  expect(liveTurn(aiOf(live, live.fresh))).toBeNull();
});

test("Retry after a crash omp never held asks again with the notes added since", async () => {
  const live = await rig();
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 0).events.session(session("s1"));
  askedAt(live, 0).end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 0).answer({ kind: "loaded", turns: [] });
  await settle();
  await live.threads.addNote(live.fresh, "Also X");

  live.ai.retry(live.fresh);

  expect(askedAt(live, 1).request).toEqual({
    session: "s1",
    text: `${WRAP}Why does the overdue check go?\n\nAlso X`,
  });
});

type Gate = { readonly passed: Promise<void>; readonly open: () => void };

function gate(): Gate {
  const opens: (() => void)[] = [];
  const passed = new Promise<void>((resolve) => {
    opens.push(resolve);
  });
  return {
    passed,
    open: () => {
      for (const open of opens) {
        open();
      }
    },
  };
}

function draftOf(key: string): AskFrom {
  return { kind: "draft", key };
}

test("Ask AI with typed text on a thread with an answer stores it as a note, then asks with the notes since the answer", async () => {
  const live = await rig();
  await loadedSeeded(live, [view("Yes")]);
  await live.threads.addNote(live.seeded, "Who calls it?");
  live.threads.writeNote(live.seeded, "And where?");

  await live.ai.ask(on(live.seeded), "And where?");

  expect(bodies(live, live.seeded).slice(-2)).toEqual([
    { kind: "note", text: "Who calls it?" },
    { kind: "note", text: "And where?" },
  ]);
  expect(live.threads.noteText(live.seeded)).toBe("");
  expect(live.client.asks.map(({ request }) => request)).toEqual([
    { session: SEEDED_SESSION, text: "Who calls it?\n\nAnd where?" },
  ]);
});

test("Ask AI with typed text on a thread's first turn wraps every note in First message", async () => {
  const live = await rig();

  await live.ai.ask(on(live.fresh), "And the reminder?");

  expect(live.client.asks.map(({ request }) => request)).toEqual([
    { session: null, text: `${WRAP}Why does the overdue check go?\n\nAnd the reminder?` },
  ]);
});

test("Ask AI with only blank text typed adds nothing and asks with the notes since the answer", async () => {
  const live = await rig();
  await loadedSeeded(live, [view("Yes")]);
  await live.threads.addNote(live.seeded, "Who calls it?");

  await live.ai.ask(on(live.seeded), " \n");

  expect(bodies(live, live.seeded)).toHaveLength(3);
  expect(askedAt(live, 0).request).toEqual({ session: SEEDED_SESSION, text: "Who calls it?" });
});

test("a refused add reports its problem, keeps the text in the field and asks nothing", async () => {
  const live = await rig(undefined, () => ({
    addNote: async () => ({ ok: false, failure: WRITE_FAILED }),
  }));
  live.threads.writeNote(live.fresh, "Lost?");

  await live.ai.ask(on(live.fresh), "Lost?");

  expect(live.problems).toEqual([{ action: "threads", step: "note", cause: WRITE_FAILED }]);
  expect(live.threads.noteText(live.fresh)).toBe("Lost?");
  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(live.client.asks).toEqual([]);
  expect(live.ai.canAsk(on(live.fresh), "Lost?")).toBe(true);
});

test("Ask AI on a line's new thread adds the thread with the text, then asks its first turn", async () => {
  const live = await rig();
  const line = changedThreadLine("right", 3);
  live.threads.startThread(threadOf(live, live.fresh).file, line);
  expect(live.ai.canAsk(draftOf("draft-0"), " ")).toBe(false);
  expect(live.ai.canAsk(draftOf("draft-0"), "New here?")).toBe(true);

  await live.ai.ask(draftOf("draft-0"), "New here?");

  const added = live.threads.list.value.threads.at(-1);
  expect(added?.line).toEqual(line);
  expect(added?.messages.map(({ body }) => body)).toEqual([{ kind: "note", text: "New here?" }]);
  expect(live.threads.drafts.value.has("draft-0")).toBe(false);
  expect(live.client.asks.map(({ request }) => request)).toEqual([
    { session: null, text: `${WRAP}New here?` },
  ]);
  expect(added === undefined ? null : aiOf(live, added.id).running).toEqual(view(""));
});

test("a refused new thread asks nothing", async () => {
  const live = await rig(undefined, () => ({
    addThread: async () => ({ ok: false, failure: WRITE_FAILED }),
  }));
  live.threads.startThread(threadOf(live, live.fresh).file, changedThreadLine("right", 3));

  await live.ai.ask(draftOf("draft-0"), "New here?");

  expect(live.problems).toEqual([{ action: "threads", step: "add", cause: WRITE_FAILED }]);
  expect(live.client.asks).toEqual([]);
});

test("a second Ask AI while the first one's note is added adds it once and asks once; other threads stay askable", async () => {
  const adding = gate();
  let calls = 0;
  const live = await rig(undefined, (fixture) => ({
    addNote: async (thread, text) => {
      if (thread === live.fresh) {
        calls += 1;
        await adding.passed;
      }
      return fixture.addNote(thread, text);
    },
  }));
  const other = threadAt(live, 1);

  const first = live.ai.ask(on(live.fresh), "Q?");
  expect(live.ai.canAsk(on(live.fresh), "Q?")).toBe(false);
  expect(live.ai.canAsk(on(other), "Q?")).toBe(true);
  await live.ai.ask(on(other), "Also?");
  expect(live.ai.canAsk(on(live.fresh), "Q?")).toBe(false);
  const second = live.ai.ask(on(live.fresh), "Q?");
  adding.open();
  await Promise.all([first, second]);

  expect(calls).toBe(1);
  expect(bodies(live, live.fresh)).toHaveLength(2);
  expect(live.client.asks).toHaveLength(2);
});

test("Retry after a crash whose answer could not be recorded asks nothing until a load records it", async () => {
  const live = await rig((write) => write === 1);
  void live.ai.ask(on(live.fresh), "");
  askedAt(live, 0).events.session(session("s1"));
  askedAt(live, 0).end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 0).answer({ kind: "loaded", turns: [view("")] });
  await settle();

  live.ai.retry(live.fresh);

  expect(live.client.asks).toHaveLength(1);
});

test("a new thread's add blocks only its own Ask AI, and a second press adds one thread", async () => {
  const adding = gate();
  let calls = 0;
  const live = await rig(undefined, (fixture) => ({
    addThread: async (file, line, text) => {
      calls += 1;
      await adding.passed;
      return fixture.addThread(file, line, text);
    },
  }));
  const { file } = threadOf(live, live.fresh);
  live.threads.startThread(file, changedThreadLine("right", 3));
  live.threads.startThread(file, changedThreadLine("right", 4));

  const first = live.ai.ask(draftOf("draft-0"), "New?");
  expect(live.ai.canAsk(draftOf("draft-0"), "New?")).toBe(false);
  expect(live.ai.canAsk(draftOf("draft-1"), "Other?")).toBe(true);
  expect(live.ai.canAsk(on(live.fresh), "")).toBe(true);
  const second = live.ai.ask(draftOf("draft-0"), "New?");
  adding.open();
  await Promise.all([first, second]);

  expect(calls).toBe(1);
  expect(live.client.asks).toHaveLength(1);
  expect(live.ai.canAsk(draftOf("draft-0"), "New?")).toBe(true);
});

test("canAsk: off while the turn runs or the conversation loads, even with text typed; typed text alone is enough", async () => {
  const live = await rig();
  expect(live.ai.canAsk(on(live.seeded), "Who?")).toBe(false);
  await loadedSeeded(live, [view("Yes")]);

  expect(live.ai.canAsk(on(live.seeded), " ")).toBe(false);
  expect(live.ai.canAsk(on(live.seeded), "Who?")).toBe(true);

  void live.ai.ask(on(live.fresh), "");
  expect(live.ai.canAsk(on(live.fresh), "More?")).toBe(false);
  await live.ai.ask(on(live.fresh), "More?");
  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(live.client.asks).toHaveLength(1);
});

test("Ask AI on a thread no longer listed adds and asks nothing", async () => {
  const live = await rig();
  const gone = on(live.fresh);
  const unlisted = { ...live.threads, list: shallowRef<ThreadList>({ threads: [] }) };
  const other = createRangeAi(live.client, unlisted, () => CONTEXT);

  expect(other.canAsk(gone, "x")).toBe(false);
  await other.ask(gone, "x");

  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(live.client.asks).toEqual([]);
});

/** A rig whose note and thread adds wait for `adds`, then land or are refused. */
async function gatedRig(refuses: boolean): Promise<{ readonly live: Rig; readonly adds: Gate }> {
  const adds = gate();
  const live = await rig(undefined, (fixture) => ({
    addNote: async (thread, text) => {
      await adds.passed;
      return refuses ? { ok: false, failure: WRITE_FAILED } : fixture.addNote(thread, text);
    },
    addThread: async (file, line, text) => {
      await adds.passed;
      return refuses ? { ok: false, failure: WRITE_FAILED } : fixture.addThread(file, line, text);
    },
  }));
  return { live, adds };
}

test.each([false, true])(
  "Ask AI is off while Comment adds that thread's note, and on again once it lands (refused: %s)",
  async (refuses) => {
    const { live, adds } = await gatedRig(refuses);
    const askable = computed(() => live.ai.canAsk(on(live.fresh), "Q?"));
    expect(askable.value).toBe(true);

    const comment = live.threads.addNote(live.fresh, "Q?");
    expect(askable.value).toBe(false);
    expect(live.ai.canAsk(on(threadAt(live, 1)), "Q?")).toBe(true);
    adds.open();
    await comment;

    expect(askable.value).toBe(true);
    expect(live.client.asks).toEqual([]);
  },
);

test("Ask AI is off while Comment adds that line's new thread; the added thread is askable", async () => {
  const { live, adds } = await gatedRig(false);
  const { file } = threadOf(live, live.fresh);
  live.threads.startThread(file, changedThreadLine("right", 3));
  live.threads.startThread(file, changedThreadLine("right", 4));
  const askable = computed(() => live.ai.canAsk(draftOf("draft-0"), "New?"));
  expect(askable.value).toBe(true);

  const comment = live.threads.addThread("draft-0", "New?");
  expect(askable.value).toBe(false);
  expect(live.ai.canAsk(draftOf("draft-1"), "New?")).toBe(true);
  adds.open();
  const added = await comment;

  expect(added === null ? false : live.ai.canAsk(on(added), "")).toBe(true);
  expect(live.client.asks).toEqual([]);
});

test("a refused Comment of a line's new thread turns its Ask AI on again", async () => {
  const { live, adds } = await gatedRig(true);
  live.threads.startThread(threadOf(live, live.fresh).file, changedThreadLine("right", 3));
  const askable = computed(() => live.ai.canAsk(draftOf("draft-0"), "New?"));

  const comment = live.threads.addThread("draft-0", "New?");
  expect(askable.value).toBe(false);
  adds.open();
  await comment;

  expect(askable.value).toBe(true);
  expect(live.problems).toEqual([{ action: "threads", step: "add", cause: WRITE_FAILED }]);
});
