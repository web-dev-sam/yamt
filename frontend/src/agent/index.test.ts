import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  createFixtureAgentSource,
  log,
  type AgentCommand,
  type AgentRun,
  type AgentSource,
  type AgentStartReply,
  type CheckoutFolder,
  type CheckoutReady,
  type Difference,
  type HostEvent,
  type SourceResult,
} from "../ipc";
import {
  agentSessionId,
  AgentClient,
  DEFAULT_AGENT_COMMAND,
  DEFAULT_FIRST_MESSAGE,
  firstMessage,
  PLACEHOLDERS,
  unknownPlaceholders,
  type AgentSessionId,
  type Placeholder,
  type Step,
  type StepKind,
  type StepOutput,
  type StepStatus,
  type TurnEnd,
  type TurnEntry,
  type TurnView,
} from "./index";

type Sent = {
  readonly id?: number;
  readonly method?: string;
  readonly params?: { sessionId?: string; prompt?: { text: string }[] };
};

const FOLDER = "/data/checkout";

function isFolder(path: string): path is CheckoutFolder {
  return path.startsWith("/");
}

function isRun(n: number): n is AgentRun {
  return n > 0;
}

function session(text: string): AgentSessionId {
  const id = agentSessionId(text);
  if (id === null) {
    throw new Error("empty");
  }
  return id;
}

function ready(): SourceResult<CheckoutReady> {
  if (!isFolder(FOLDER)) {
    throw new Error(FOLDER);
  }
  return { ok: true, value: { kind: "Ready", folder: FOLDER } };
}

/** A scripted `omp acp`: answers initialize, session/new and session/load at once; prompts wait for the test. */
class FakeAgent implements AgentSource {
  readonly sent: Sent[] = [];
  readonly commands: AgentCommand[] = [];
  readonly stopped: AgentRun[] = [];
  prepares: SourceResult<CheckoutReady>[] = [];
  prepareCalls = 0;
  startReplies: SourceResult<AgentStartReply>[] = [];
  protocolVersion = 1;
  loadAnswer: (id: number, sessionId: string) => void = (id) => this.reply(id, {});
  #onEvent: ((event: HostEvent) => void) | null = null;
  #runs = 0;
  #sessions = 0;

  async prepareCheckout(): Promise<SourceResult<CheckoutReady>> {
    this.prepareCalls += 1;
    return this.prepares.shift() ?? ready();
  }

  async startAgent(
    command: AgentCommand,
    onEvent: (event: HostEvent) => void,
  ): Promise<SourceResult<AgentStartReply>> {
    this.commands.push(command);
    const scripted = this.startReplies.shift();
    if (scripted !== undefined) {
      return scripted;
    }
    this.#runs += 1;
    this.#onEvent = onEvent;
    const run = this.#runs;
    if (!isRun(run)) {
      throw new Error("run");
    }
    return { ok: true, value: { kind: "Started", run } };
  }

  sendToAgent(_run: AgentRun, message: string): void {
    const sent: Sent = JSON.parse(message);
    this.sent.push(sent);
    queueMicrotask(() => this.#answer(sent));
  }

  async stopAgent(run: AgentRun): Promise<void> {
    this.stopped.push(run);
    queueMicrotask(() => this.exit(null));
  }

  async checkoutChanges(): Promise<never> {
    throw new Error("not used");
  }

  async discardCheckout(): Promise<never> {
    throw new Error("not used");
  }

  diffTexts = vi.fn<AgentSource["diffTexts"]>();

  emit(message: object): void {
    this.#onEvent?.({ kind: "Message", text: JSON.stringify({ jsonrpc: "2.0", ...message }) });
  }

  reply(id: number, result: unknown): void {
    this.emit({ id, result });
  }

  update(sessionId: string, update: object): void {
    this.emit({ method: "session/update", params: { sessionId, update } });
  }

  said(sessionId: string, text: string): void {
    this.update(sessionId, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text },
    });
  }

  log(line: string): void {
    this.#onEvent?.({ kind: "Log", line });
  }

  exit(code: number | null): void {
    this.#onEvent?.({ kind: "Exited", code });
  }

  prompts(): Sent[] {
    return this.sent.filter((each) => each.method === "session/prompt");
  }

  methods(): (string | undefined)[] {
    return this.sent.map((each) => each.method);
  }

  #answer(sent: Sent): void {
    const { id, method } = sent;
    if (id === undefined) {
      return;
    }
    if (method === "initialize") {
      this.reply(id, { protocolVersion: this.protocolVersion });
    } else if (method === "session/new") {
      this.#sessions += 1;
      this.reply(id, { sessionId: `s${this.#sessions}` });
    } else if (method === "session/load") {
      this.loadAnswer(id, sent.params?.sessionId ?? "");
    }
  }
}

type Asked = {
  readonly ended: Promise<TurnEnd>;
  readonly stop: () => void;
  readonly sessions: AgentSessionId[];
  readonly changes: TurnView[];
  end: TurnEnd | null;
};

let agent: FakeAgent;
let words: readonly string[];
let client: AgentClient;

function ask(sessionId: AgentSessionId | null, text = "Why?"): Asked {
  const sessions: AgentSessionId[] = [];
  const changes: TurnView[] = [];
  const turn = client.ask(
    { session: sessionId, text },
    {
      session: (id) => sessions.push(id),
      changed: (view) => changes.push(view),
    },
  );
  const asked: Asked = { ended: turn.ended, stop: () => turn.stop(), sessions, changes, end: null };
  void turn.ended.then((end) => {
    asked.end = end;
  });
  return asked;
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(100);
}

function promptId(sessionId: string): number {
  const prompt = agent.prompts().findLast((each) => each.params?.sessionId === sessionId);
  if (prompt?.id === undefined) {
    throw new Error(`no prompt for ${sessionId}`);
  }
  return prompt.id;
}

function finish(sessionId: string, stopReason = "end_turn"): void {
  agent.reply(promptId(sessionId), { stopReason });
}

beforeEach(() => {
  vi.useFakeTimers();
  agent = new FakeAgent();
  words = DEFAULT_AGENT_COMMAND;
  client = new AgentClient({ source: agent, command: () => words });
});

afterEach(() => {
  vi.useRealTimers();
});

test("a new thread makes the checkout, starts omp, names its session, prompts and finishes", async () => {
  const turn = ask(null, "Explain line 3");
  await flush();
  expect(agent.commands).toEqual([
    { program: "omp", args: ["acp"], homeFolders: [".bun/bin", ".local/bin"] },
  ]);
  expect(agent.methods()).toEqual(["initialize", "session/new", "session/prompt"]);
  expect(agent.sent[0]?.params).toEqual({
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: "yamt" },
  });
  expect(agent.sent[1]?.params).toEqual({ cwd: FOLDER, mcpServers: [] });
  expect(agent.sent[2]?.params).toEqual({
    sessionId: "s1",
    prompt: [{ type: "text", text: "Explain line 3" }],
  });
  expect(turn.sessions).toEqual(["s1"]);
  expect(client.isRunning()).toBe(true);
  agent.said("s1", "Because ");
  agent.said("s1", "it is.");
  finish("s1");
  await flush();
  expect(turn.end).toEqual({ kind: "finished", turn: { entries: [], answer: "Because it is." } });
  expect(client.isRunning()).toBe(false);
});

test("changes reach the view at most once per 50 ms and always at the end", async () => {
  const turn = ask(null);
  await flush();
  agent.said("s1", "a");
  agent.said("s1", "b");
  await vi.advanceTimersByTimeAsync(49);
  expect(turn.changes).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(turn.changes.map((view) => view.answer)).toEqual(["ab"]);
  agent.said("s1", "c");
  finish("s1");
  await flush();
  expect(turn.changes.map((view) => view.answer)).toEqual(["ab", "abc"]);
});

test("two threads share one process and their updates are routed apart", async () => {
  const first = ask(null);
  const second = ask(null);
  await flush();
  expect(agent.commands).toHaveLength(1);
  expect(agent.prepareCalls).toBe(1);
  expect([first.sessions, second.sessions]).toEqual([["s1"], ["s2"]]);
  agent.said("s2", "second");
  agent.said("s1", "first");
  finish("s2");
  finish("s1");
  await flush();
  expect(first.end?.turn.answer).toBe("first");
  expect(second.end?.turn.answer).toBe("second");
});

test("a second ask on a running thread ends busy at once and leaves the first running", async () => {
  const first = ask(session("s9"));
  await flush();
  const second = ask(session("s9"));
  await flush();
  expect(second.end).toEqual({
    kind: "failed",
    turn: { entries: [], answer: "" },
    failure: { kind: "busy" },
  });
  expect(first.end).toBeNull();
  expect(await client.loadConversation(session("s9"))).toEqual({
    kind: "failed",
    failure: { kind: "busy" },
  });
});

test("a crash ends every running turn once; the next ask restarts, reloads silently, then prompts", async () => {
  const first = ask(null);
  const second = ask(null);
  await flush();
  agent.said("s1", "partial");
  agent.log("panic: out of memory");
  agent.exit(1);
  agent.exit(1);
  await flush();
  const crashed = { kind: "crashed", code: 1, lastLog: "panic: out of memory" };
  expect(first.end).toMatchObject({
    kind: "failed",
    failure: crashed,
    turn: { answer: "partial" },
  });
  expect(second.end).toMatchObject({ kind: "failed", failure: crashed });
  expect(first.changes).toHaveLength(1);
  agent.loadAnswer = (id, sessionId) => {
    agent.update(sessionId, {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "Why?" },
    });
    agent.said(sessionId, "the replayed answer");
    agent.reply(id, {});
  };
  const again = ask(session("s1"), "And now?");
  await flush();
  expect(agent.commands).toHaveLength(2);
  expect(agent.methods().slice(5)).toEqual(["initialize", "session/load", "session/prompt"]);
  expect(agent.sent[6]?.params).toEqual({ sessionId: "s1", cwd: FOLDER, mcpServers: [] });
  agent.said("s1", "new");
  finish("s1");
  await flush();
  expect(again.end).toMatchObject({ kind: "finished", turn: { answer: "new" } });
});

test("a thread is loaded once per process before its prompts", async () => {
  const first = ask(session("s7"));
  await flush();
  finish("s7");
  await flush();
  ask(session("s7"));
  await flush();
  expect(first.end?.kind).toBe("finished");
  expect(agent.methods()).toEqual([
    "initialize",
    "session/load",
    "session/prompt",
    "session/prompt",
  ]);
});

test("a load omp cannot find is sessionGone; any other load error is refused", async () => {
  agent.loadAnswer = (id) =>
    agent.emit({
      id,
      error: {
        code: -32603,
        message: "Internal error",
        data: { details: "ACP session not found: s4" },
      },
    });
  const gone = ask(session("s4"));
  await flush();
  expect(gone.end).toMatchObject({ kind: "failed", failure: { kind: "sessionGone" } });
  expect(await client.loadConversation(session("s4"))).toEqual({
    kind: "failed",
    failure: { kind: "sessionGone" },
  });
  agent.loadAnswer = (id) =>
    agent.emit({
      id,
      error: {
        code: -32603,
        message: "Internal error",
        data: { details: "ACP session load was cancelled: s4" },
      },
    });
  const refused = {
    kind: "refused",
    method: "session/load",
    message: "ACP session load was cancelled: s4",
  };
  expect(await client.loadConversation(session("s4"))).toEqual({
    kind: "failed",
    failure: refused,
  });
  const other = ask(session("s4"));
  await flush();
  expect(other.end).toMatchObject({ kind: "failed", failure: refused });
  expect(agent.prompts()).toEqual([]);
});

test("an error without details is refused with its message", async () => {
  agent.loadAnswer = (id) => agent.emit({ id, error: { code: -32602, message: "Invalid params" } });
  expect(await client.loadConversation(session("s4"))).toEqual({
    kind: "failed",
    failure: { kind: "refused", method: "session/load", message: "Invalid params" },
  });
});

test("loadConversation hands back the replay as turns, and the next prompt needs no load", async () => {
  agent.loadAnswer = (id, sessionId) => {
    agent.update(sessionId, {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "one" },
    });
    agent.said(sessionId, "first answer");
    agent.update(sessionId, {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "two" },
    });
    agent.said(sessionId, "second answer");
    agent.reply(id, {});
  };
  const load = await client.loadConversation(session("s3"));
  expect(load.kind === "loaded" && load.turns.map((turn) => turn.answer)).toEqual([
    "first answer",
    "second answer",
  ]);
  ask(session("s3"));
  await flush();
  expect(agent.methods()).toEqual(["initialize", "session/load", "session/prompt"]);
});

test("a failed prepare is not kept, a ready checkout is", async () => {
  agent.prepares = [
    { ok: true, value: { kind: "Failed", message: "fatal: not a git repository" } },
  ];
  const failed = ask(null);
  await flush();
  expect(failed.end).toMatchObject({
    kind: "failed",
    failure: { kind: "checkoutFailed", message: "fatal: not a git repository" },
  });
  expect(agent.commands).toEqual([]);
  ask(null);
  await flush();
  ask(null);
  await flush();
  expect(agent.prepareCalls).toBe(2);
});

test("an app failure or a throw from prepare is checkoutFailed too, and not kept", async () => {
  agent.prepares = [{ ok: false, failure: { kind: "AiOff" } }];
  const off = ask(null);
  await flush();
  expect(off.end).toMatchObject({ failure: { kind: "checkoutFailed", message: "AiOff" } });
  agent.prepareCheckout = async () => {
    throw new Error("ipc down");
  };
  const thrown = ask(null);
  await flush();
  expect(thrown.end).toMatchObject({
    failure: { kind: "checkoutFailed", message: "Error: ipc down" },
  });
});

test("the command is read at each process start, not at each ask", async () => {
  const command = vi.fn(() => words);
  client = new AgentClient({ source: agent, command });
  ask(null);
  ask(null);
  await flush();
  expect(command).toHaveBeenCalledTimes(1);
  words = ["/opt/omp", "acp", "", "--verbose"];
  agent.exit(1);
  await flush();
  ask(null);
  await flush();
  expect(command).toHaveBeenCalledTimes(2);
  expect(agent.commands[1]).toEqual({
    program: "/opt/omp",
    args: ["acp", "--verbose"],
    homeFolders: [".bun/bin", ".local/bin"],
  });
});

test("an empty command starts nothing and ends noCommand", async () => {
  words = ["", ""];
  const turn = ask(null);
  await flush();
  expect(turn.end).toMatchObject({ kind: "failed", failure: { kind: "noCommand" } });
  expect(agent.commands).toEqual([]);
});

test.each<[string, SourceResult<AgentStartReply>, object]>([
  [
    "NotFound",
    { ok: true, value: { kind: "NotFound", program: "omp", searched: ["/usr/bin"] } },
    { kind: "notFound", program: "omp", searched: ["/usr/bin"] },
  ],
  [
    "SpawnFailed",
    { ok: true, value: { kind: "SpawnFailed", program: "omp", message: "denied" } },
    { kind: "spawnFailed", program: "omp", message: "denied" },
  ],
  [
    "an app failure",
    { ok: false, failure: { kind: "AiOff" } },
    { kind: "spawnFailed", program: "omp", message: "AiOff" },
  ],
])(
  "a start answered %s fails the turn and is retried at the next ask",
  async (_, reply, failure) => {
    agent.startReplies = [reply];
    const turn = ask(null);
    await flush();
    expect(turn.end).toMatchObject({ kind: "failed", failure });
    ask(null);
    await flush();
    expect(agent.commands).toHaveLength(2);
    expect(agent.prepareCalls).toBe(1);
  },
);

test("a start answered NoCheckout makes the checkout again at the next ask", async () => {
  agent.startReplies = [{ ok: true, value: { kind: "NoCheckout" } }];
  const turn = ask(null);
  await flush();
  expect(turn.end).toMatchObject({
    failure: { kind: "checkoutFailed", message: "the checkout is gone" },
  });
  ask(null);
  await flush();
  expect(agent.prepareCalls).toBe(2);
});

test("an agent speaking another protocol version is refused and stopped", async () => {
  agent.protocolVersion = 2;
  const turn = ask(null);
  await flush();
  expect(turn.end).toMatchObject({
    failure: {
      kind: "refused",
      method: "initialize",
      message: "protocol version 2; yamt speaks 1",
    },
  });
  expect(agent.stopped).toEqual([1]);
});

test("Stop during the prompt sends session/cancel and the turn ends stopped", async () => {
  const turn = ask(null);
  await flush();
  turn.stop();
  expect(agent.sent.at(-1)).toEqual({
    jsonrpc: "2.0",
    method: "session/cancel",
    params: { sessionId: "s1" },
  });
  finish("s1", "cancelled");
  await flush();
  expect(turn.end?.kind).toBe("stopped");
});

test("Stop before the prompt ends the turn without prompting", async () => {
  const turn = ask(null);
  turn.stop();
  await flush();
  expect(turn.end?.kind).toBe("stopped");
  expect(agent.prompts()).toEqual([]);
});

test.each([
  [
    "a stop reason the client does not know",
    { stopReason: "max_tokens" },
    { kind: "ended", reason: "max_tokens" },
  ],
  ["a malformed prompt result", { nothing: true }, { kind: "refused", method: "session/prompt" }],
])("%s fails the turn", async (_, result, failure) => {
  const turn = ask(null);
  await flush();
  agent.reply(promptId("s1"), result);
  await flush();
  expect(turn.end).toMatchObject({ kind: "failed", failure });
});

test("a refused session/new fails the turn without a session", async () => {
  agent.sendToAgent = (_run, message) => {
    const sent: Sent = JSON.parse(message);
    agent.sent.push(sent);
    queueMicrotask(() => {
      if (sent.method === "initialize" && sent.id !== undefined) {
        agent.reply(sent.id, { protocolVersion: 1 });
      } else if (sent.id !== undefined) {
        agent.emit({ id: sent.id, error: { code: -32603, message: "no model" } });
      }
    });
  };
  const turn = ask(null);
  await flush();
  expect(turn.end).toMatchObject({
    failure: { kind: "refused", method: "session/new", message: "no model" },
  });
  expect(turn.sessions).toEqual([]);
});

test("a refusal of a delete outside the checkout shows on the asking thread's step", async () => {
  const turn = ask(null);
  await flush();
  agent.emit({
    id: 0,
    method: "session/request_permission",
    params: {
      sessionId: "s1",
      toolCall: { toolCallId: "t1", title: "Delete /tmp/x", locations: [{ path: "/tmp/x" }] },
      options: [{ optionId: "reject_once", name: "Reject", kind: "reject_once" }],
    },
  });
  await flush();
  expect(agent.sent.at(-1)).toEqual({
    jsonrpc: "2.0",
    id: 0,
    result: { outcome: { outcome: "selected", optionId: "reject_once" } },
  });
  finish("s1");
  await flush();
  expect(turn.end?.turn.entries).toEqual([
    {
      kind: "step",
      step: {
        id: "t1",
        kind: "other",
        title: "Delete /tmp/x",
        status: "noResult",
        outputs: [{ kind: "refused", title: "Delete /tmp/x", paths: ["/tmp/x"] }],
      },
    },
  ]);
});

test("destroy stops the process and ends running turns stopped; later asks stop at once", async () => {
  const turn = ask(null);
  await flush();
  client.destroy();
  await flush();
  expect(agent.stopped).toEqual([1]);
  expect(turn.end?.kind).toBe("stopped");
  const later = ask(null);
  await flush();
  expect(later.end?.kind).toBe("stopped");
  expect(agent.commands).toHaveLength(1);
});

const DIFFERENCES: readonly Difference[] = [];

test("editDiff asks the app for the differences, a created file against nothing", async () => {
  agent.diffTexts.mockResolvedValue({ ok: true, value: DIFFERENCES });
  expect(await client.editDiff({ path: "a.ts", oldText: null, newText: "x\n" })).toEqual({
    kind: "differences",
    differences: DIFFERENCES,
  });
  expect(agent.diffTexts).toHaveBeenCalledWith("", "x\n");
});

test.each<[string, () => Promise<never> | Promise<SourceResult<readonly Difference[]>>, object]>([
  [
    "too large",
    async () => ({ ok: false, failure: { kind: "ColumnTooLarge", limit: 8 } }),
    { kind: "tooLarge", limit: 8 },
  ],
  [
    "stopped",
    async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
    { kind: "failed", message: "WorkerStopped" },
  ],
  [
    "thrown",
    async () => Promise.reject(new Error("gone")),
    { kind: "failed", message: "Error: gone" },
  ],
])("editDiff %s", async (_, reply, expected) => {
  agent.diffTexts.mockImplementation(reply);
  expect(await client.editDiff({ path: "a.ts", oldText: "a", newText: "b" })).toEqual(expected);
  expect(agent.diffTexts).toHaveBeenCalledWith("a", "b");
});

test("agentSessionId refuses an empty id", () => {
  expect(agentSessionId("")).toBeNull();
  expect(agentSessionId("s1")).toBe("s1");
});

test("the seam fills First message from the five placeholders and names unknown ones", () => {
  const filled: Readonly<Record<Placeholder, string>> = {
    RELATIVE_FILE_PATH_WITH_LINE: "<file>",
    MESSAGE: "<message>",
    RANGE: "<range>",
    OLD_COMMIT: "<old>",
    NEW_COMMIT: "<new>",
  };
  expect(PLACEHOLDERS).toEqual(Object.keys(filled));
  expect(firstMessage(DEFAULT_FIRST_MESSAGE, filled)).toContain(
    "My comment on <file>:\n\n<message>",
  );
  expect(unknownPlaceholders("{{ RANGE }} {{ PR }}")).toEqual(["{{ PR }}"]);
});

function stepsOf(turn: TurnView | undefined): Step[] {
  return (turn?.entries ?? []).flatMap((entry: TurnEntry) =>
    entry.kind === "step" ? [entry.step] : [],
  );
}

test("over the fixture agent a turn plays the recorded edit and command, and its edit opens as a diff", async () => {
  client = new AgentClient({ source: createFixtureAgentSource(log, "?ai"), command: () => words });
  const turn = ask(null, "Add a line");
  await vi.runAllTimersAsync();
  expect(turn.sessions).toEqual(["fixture-session-1"]);
  expect(turn.end?.kind).toBe("finished");
  const steps = stepsOf(turn.end?.turn);
  const shape: [StepKind, StepStatus][] = steps.map((step) => [step.kind, step.status]);
  expect(shape).toEqual([
    ["read", "done"],
    ["edit", "done"],
    ["execute", "done"],
  ]);
  const edit = steps[1]?.outputs.find((output: StepOutput) => output.kind === "edit");
  if (edit?.kind !== "edit") {
    throw new Error("no edit");
  }
  expect(edit.edit.path).toBe("README.md");
  const diff = await client.editDiff(edit.edit);
  expect(diff.kind === "differences" && diff.differences).toHaveLength(1);
  expect(turn.end?.turn.answer).toMatch(/^I added `hello`/u);
});

test("over the fixture agent a crash fails the turn once and Retry continues the thread", async () => {
  client = new AgentClient({
    source: createFixtureAgentSource(log, "?ai=crash"),
    command: () => words,
  });
  const crashed = ask(null);
  await vi.runAllTimersAsync();
  expect(crashed.end).toMatchObject({
    kind: "failed",
    failure: { kind: "crashed", code: 1, lastLog: "fixture agent: crashed mid-turn" },
  });
  const [thread] = crashed.sessions;
  const retried = ask(thread ?? null);
  await vi.runAllTimersAsync();
  expect(retried.end?.kind).toBe("finished");
  expect(stepsOf(retried.end?.turn)).toHaveLength(3);
});

test("over the fixture agent Stop on the recorded long command ends the turn stopped", async () => {
  client = new AgentClient({
    source: createFixtureAgentSource(log, "?ai=cancelled"),
    command: () => words,
  });
  const turn = ask(null);
  await vi.runAllTimersAsync();
  expect(turn.end).toBeNull();
  turn.stop();
  await vi.runAllTimersAsync();
  expect(turn.end?.kind).toBe("stopped");
  expect(stepsOf(turn.end?.turn).map((step) => step.status)).toEqual(["noResult"]);
});

test("over the fixture agent loadConversation gives back the recorded conversation", async () => {
  client = new AgentClient({ source: createFixtureAgentSource(log, "?ai"), command: () => words });
  const loading = client.loadConversation(session("kept"));
  await vi.runAllTimersAsync();
  const load = await loading;
  expect(load.kind === "loaded" && load.turns.map((turn) => stepsOf(turn).length)).toEqual([3]);
});
