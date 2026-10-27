import { expect, test, vi } from "vitest";

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
import { createFixtureRangeSource, log, type Message, type Thread, type ThreadId } from "../ipc";
import type { Problem } from "./problem";
import { createRangeAi, type AskContext, type RangeAi, type ThreadAi } from "./rangeAi";
import { answerView, liveTurn, postBody } from "./rangeAiView";
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

/** `failsWrite(n)`: whether the n-th `addAiAnswer` write fails. */
async function rig(failsWrite: (write: number) => boolean = () => false): Promise<Rig> {
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

  live.ai.ask(live.fresh);

  expect(askedAt(live, 0).request).toEqual({
    session: null,
    text: `${WRAP}Why does the overdue check go?\n\nAnd the reminder?`,
  });
  expect(aiOf(live, live.fresh).running).toEqual(view(""));
});

test("the session is stored on omp's event, before the turn ends", async () => {
  const live = await rig();
  live.ai.ask(live.fresh);

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
  live.ai.ask(live.fresh);
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
  expect(live.ai.canAsk(live.fresh)).toBe(false);

  await live.threads.addNote(live.fresh, "Where?");
  await live.threads.addNote(live.fresh, "And why?");
  live.ai.ask(live.fresh);

  expect(askedAt(live, 1).request).toEqual({ session: "s1", text: "Where?\n\nAnd why?" });
});

test("Ask does nothing while the thread's turn runs or with nothing new; Stop stops that turn", async () => {
  const live = await rig();
  expect(live.ai.canAsk(live.fresh)).toBe(true);
  live.ai.ask(live.fresh);
  expect(live.ai.canAsk(live.fresh)).toBe(false);

  live.ai.ask(live.fresh);
  live.ai.stop(live.fresh);

  expect(live.client.asks).toHaveLength(1);
  expect(askedAt(live, 0).stops).toBe(1);
  live.ai.stop(live.seeded);
  expect(askedAt(live, 0).stops).toBe(1);
});

test("a turn stopped before the prompt reached omp adds no answer; its stopped end stays shown", async () => {
  const live = await rig();
  live.ai.ask(live.fresh);
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
  expect(live.ai.canAsk(live.fresh)).toBe(true);
});

test("a turn stopped after omp holds its prompt adds one answer, shown with its own end", async () => {
  const live = await rig();
  live.ai.ask(live.fresh);
  const asked = askedAt(live, 0);
  asked.events.session(session("s1"));
  const partial = view("So far");
  const stopped: TurnEnd = { kind: "stopped", turn: partial };

  asked.events.changed(partial);
  asked.end(stopped);
  await settle();
  expect(aiOf(live, live.fresh)).toMatchObject({ running: partial, end: stopped });
  expect(live.ai.canAsk(live.fresh)).toBe(false);
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
    live.ai.ask(live.fresh);
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
  live.ai.ask(live.fresh);
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
  live.ai.ask(live.fresh);
  const first = askedAt(live, 0);
  first.events.session(session("s1"));
  first.end({ kind: "failed", turn: view(""), failure: CRASHED });
  await settle();
  loadAt(live, 0).answer({ kind: "loaded", turns: [view("")] });
  await settle();
  expect(bodies(live, live.fresh).slice(1)).toEqual([{ kind: "aiAnswer", session: "s1", turn: 0 }]);
  expect(live.ai.canAsk(live.fresh)).toBe(false);

  live.ai.retry(live.fresh);

  expect(askedAt(live, 1).request).toEqual({ session: "s1", text: first.request.text });
});

test("a crash before omp held the prompt adds nothing; a failed replay adds nothing either", async () => {
  const live = await rig();
  live.ai.ask(live.fresh);
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
  expect(live.ai.canAsk(live.seeded)).toBe(false);

  live.ai.load(live.seeded);
  live.ai.load(live.seeded);
  live.ai.load(live.fresh);

  expect(live.client.loads.map((each) => each.session)).toEqual([SEEDED_SESSION]);
  expect(aiOf(live, live.seeded)).toMatchObject({ loadedSession: SEEDED_SESSION, loaded: null });
  await live.threads.addNote(live.seeded, "Who calls it?");
  expect(live.ai.canAsk(live.seeded)).toBe(false);
  live.ai.ask(live.seeded);
  expect(live.client.asks).toEqual([]);

  loadAt(live, 0).answer({ kind: "loaded", turns: [view("Yes")] });
  await settle();
  live.ai.load(live.seeded);
  expect(live.client.loads).toHaveLength(1);
  expect(live.ai.canAsk(live.seeded)).toBe(true);
  live.ai.ask(live.seeded);
  expect(askedAt(live, 0).request).toEqual({ session: SEEDED_SESSION, text: "Who calls it?" });
});

test("turns omp holds without an answer in the thread (a reload mid-turn) become answers before Ask is offered", async () => {
  const live = await rig();
  await live.threads.addNote(live.seeded, "Who calls it?");
  live.ai.load(live.seeded);
  const turns = [view("Yes"), view("Half"), view("Rest")];
  loadAt(live, 0).answer({ kind: "loaded", turns });
  expect(live.ai.canAsk(live.seeded)).toBe(false);
  await settle();

  expect(bodies(live, live.seeded).slice(1)).toEqual([
    { kind: "aiAnswer", session: SEEDED_SESSION, turn: 0 },
    { kind: "note", text: "Who calls it?" },
    { kind: "aiAnswer", session: SEEDED_SESSION, turn: 1 },
    { kind: "aiAnswer", session: SEEDED_SESSION, turn: 2 },
  ]);
  expect(live.ai.canAsk(live.seeded)).toBe(false);
  await live.threads.addNote(live.seeded, "And now?");
  live.ai.ask(live.seeded);
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

  live.ai.ask(live.seeded);

  expect(askedAt(live, 0).request).toEqual({ session: null, text: `${WRAP}Is this still used?` });
});

test("a session omp lost at the ask: a new one starts at once with every note wrapped", async () => {
  const live = await rig();
  await loadedSeeded(live, [view("Yes")]);
  await live.threads.addNote(live.seeded, "Who calls it?");
  live.ai.ask(live.seeded);
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
  live.ai.ask(live.fresh);
  askedAt(live, 0).events.session(session("s1"));
  askedAt(live, 0).end({ kind: "finished", turn: view("A") });
  await settle();
  await live.threads.addNote(live.fresh, "More?");
  live.ai.ask(live.fresh);
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

  live.ai.ask(live.fresh);
  live.ai.ask(live.seeded);
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

  ai.ask(fresh.id);
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

  expect(ai.canAsk(live.fresh)).toBe(false);
  ai.ask(live.fresh);
  expect(live.client.asks).toEqual([]);
});

async function askedSeeded(live: Rig, turns: readonly TurnView[]): Promise<Asked> {
  await loadedSeeded(live, turns);
  await live.threads.addNote(live.seeded, "Who calls it?");
  live.ai.ask(live.seeded);
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
  live.ai.ask(live.fresh);

  askedAt(live, 0).end(end);
  await settle();

  expect(live.client.loads).toEqual([]);
  expect(bodies(live, live.fresh)).toHaveLength(1);
});

test("a crash after a failed load replaces the failed load with the replay", async () => {
  const live = await rig();
  await failedSeededLoad(live);
  live.ai.ask(live.seeded);

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
    live.ai.ask(live.seeded);

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
  live.ai.ask(live.fresh);
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
  live.ai.ask(live.seeded);
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
  live.ai.ask(live.seeded);

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
  expect(live.ai.canAsk(live.seeded)).toBe(false);
  live.ai.ask(live.seeded);
  expect(live.client.asks).toEqual([]);
  expect(answerView(aiOf(live, live.seeded), aiAnswer(seeded, 0))).toMatchObject({
    turn: view("Yes"),
  });

  live.ai.load(live.seeded);
  loadAt(live, 1).answer({ kind: "loaded", turns });
  await settle();
  expect(lastAnswer(live, live.seeded)).toEqual(aiAnswer(seeded, 1));
  await live.threads.addNote(live.seeded, "Then?");
  live.ai.ask(live.seeded);
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
  live.ai.ask(live.fresh);
  askedAt(live, 0).events.session(session("s1"));
  const finished: TurnEnd = { kind: "finished", turn: view("A") };
  askedAt(live, 0).end(finished);
  await settle();
  expect(loadAt(live, 0).session).toBe("s1");
  loadAt(live, 0).answer({ kind: "loaded", turns: [view("A")] });
  await settle();

  expect(bodies(live, live.fresh)).toHaveLength(1);
  expect(live.ai.canAsk(live.fresh)).toBe(false);
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
  live.ai.ask(live.fresh);
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
