import { afterEach, beforeEach, expect, test, vi } from "vitest";

import editAndCommand from "../../fixtures/agent/edit-and-command.jsonl?raw";
import type { AgentSource } from "./AgentSource";
import type { AgentRun, HostEvent } from "./domain";
import { createFixtureAgentSource, FIXTURE_CHECKOUT } from "./fixtureAgent";
import type { Log } from "./log";

type Message = {
  id?: number | string;
  method?: string;
  params?: { sessionId?: string; update?: { sessionUpdate: string } };
  result?: { stopReason?: string; sessionId?: string; protocolVersion?: number };
};

const LOG: Log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let events: HostEvent[];

function messages(): Message[] {
  return events.flatMap((event) => (event.kind === "Message" ? [JSON.parse(event.text)] : []));
}

async function started(source: AgentSource): Promise<AgentRun> {
  await source.prepareCheckout();
  const reply = await source.startAgent(
    { program: "omp", args: ["acp"], homeFolders: [] },
    (event) => events.push(event),
  );
  if (!reply.ok || reply.value.kind !== "Started") {
    throw new Error("not started");
  }
  return reply.value.run;
}

function send(source: AgentSource, run: AgentRun, message: object): void {
  source.sendToAgent(run, JSON.stringify({ jsonrpc: "2.0", ...message }));
}

async function newSession(source: AgentSource, run: AgentRun): Promise<string> {
  send(source, run, { id: 1, method: "initialize", params: {} });
  send(source, run, { id: 2, method: "session/new", params: { cwd: FIXTURE_CHECKOUT } });
  await vi.runAllTimersAsync();
  const created = messages().find((each) => each.id === 2)?.result?.sessionId;
  if (created === undefined) {
    throw new Error("no session");
  }
  return created;
}

beforeEach(() => {
  vi.useFakeTimers();
  events = [];
});

afterEach(() => {
  vi.useRealTimers();
});

test("?ai plays the recorded edit and command back with the live ids, checkout and session", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const run = await started(source);
  const session = await newSession(source, run);
  expect(messages().map((each) => each.id)).toEqual([1, 2]);
  expect(messages()[0]?.result?.protocolVersion).toBe(1);
  expect(session).toBe("fixture-session-1");
  send(source, run, {
    id: 7,
    method: "session/prompt",
    params: { sessionId: session, prompt: [] },
  });
  await vi.runAllTimersAsync();
  const played = messages().slice(2);
  const recordedAgentLines = editAndCommand
    .trim()
    .split("\n")
    .filter((line) => line.includes('"from":"agent"'));
  expect(played).toHaveLength(recordedAgentLines.length - 2);
  expect(played.at(-1)).toMatchObject({ id: 7, result: { stopReason: "end_turn" } });
  expect(
    played.every((each) => each.method !== "session/update" || each.params?.sessionId === session),
  ).toBe(true);
  expect(JSON.stringify(played)).toContain(`${FIXTURE_CHECKOUT}/README.md`);
  expect(JSON.stringify(played)).not.toContain("{{");
  expect(played.find((each) => each.method === "session/request_permission")?.id).toBe(0);
});

test("?ai=cancelled holds the prompt until session/cancel, which answers cancelled", async () => {
  const source = createFixtureAgentSource(LOG, "?ai=cancelled");
  const run = await started(source);
  const session = await newSession(source, run);
  send(source, run, {
    id: 3,
    method: "session/prompt",
    params: { sessionId: session, prompt: [] },
  });
  await vi.runAllTimersAsync();
  expect(messages().some((each) => each.id === 3)).toBe(false);
  expect(messages().at(-1)?.params?.update?.sessionUpdate).toBe("tool_call");
  send(source, run, { method: "session/cancel", params: { sessionId: session } });
  await vi.runAllTimersAsync();
  expect(messages().at(-1)).toEqual({ jsonrpc: "2.0", id: 3, result: { stopReason: "cancelled" } });
});

test("session/cancel stops the session's playback mid-prompt", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const run = await started(source);
  const session = await newSession(source, run);
  send(source, run, {
    id: 3,
    method: "session/prompt",
    params: { sessionId: session, prompt: [] },
  });
  await vi.advanceTimersByTimeAsync(100);
  send(source, run, { method: "session/cancel", params: { sessionId: session } });
  const count = messages().length;
  await vi.runAllTimersAsync();
  expect(messages()).toHaveLength(count);
  expect(messages().at(-1)).toMatchObject({ id: 3, result: { stopReason: "cancelled" } });
});

test("session/load plays the recorded replay before its result", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const run = await started(source);
  send(source, run, {
    id: 4,
    method: "session/load",
    params: { sessionId: "kept", cwd: FIXTURE_CHECKOUT },
  });
  await vi.runAllTimersAsync();
  const kinds = messages().map((each) => each.params?.update?.sessionUpdate ?? each.id);
  expect(kinds[0]).toBe("user_message_chunk");
  expect(kinds.at(-1)).toBe(4);
  expect(
    messages()
      .filter((each) => each.method !== undefined)
      .every((each) => each.params?.sessionId === "kept"),
  ).toBe(true);
});

test("?ai=crash exits with code 1 mid-turn once; the next process plays the turn whole", async () => {
  const source = createFixtureAgentSource(LOG, "?ai=crash");
  const run = await started(source);
  const session = await newSession(source, run);
  send(source, run, {
    id: 3,
    method: "session/prompt",
    params: { sessionId: session, prompt: [] },
  });
  await vi.runAllTimersAsync();
  expect(events.slice(-2)).toEqual([
    { kind: "Log", line: "fixture agent: crashed mid-turn" },
    { kind: "Exited", code: 1 },
  ]);
  expect(messages().some((each) => each.id === 3)).toBe(false);
  events = [];
  const next = await started(source);
  expect(next).not.toBe(run);
  send(source, next, {
    id: 3,
    method: "session/prompt",
    params: { sessionId: session, prompt: [] },
  });
  await vi.runAllTimersAsync();
  expect(messages().at(-1)).toMatchObject({ id: 3, result: { stopReason: "end_turn" } });
});

test("stopAgent ends playback and reports Exited without a code; old runs are ignored", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const run = await started(source);
  send(source, run, { id: 1, method: "initialize", params: {} });
  await source.stopAgent(run);
  await vi.runAllTimersAsync();
  expect(events).toEqual([{ kind: "Exited", code: null }]);
  send(source, run, { id: 2, method: "initialize", params: {} });
  await vi.runAllTimersAsync();
  expect(events).toHaveLength(1);
});

test("a start before the checkout answers NoCheckout", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const reply = await source.startAgent(
    { program: "omp", args: [], homeFolders: [] },
    () => undefined,
  );
  expect(reply).toEqual({ ok: true, value: { kind: "NoCheckout" } });
});

test("?ai=checkout-fails fails every prepare and starts nothing", async () => {
  const source = createFixtureAgentSource(LOG, "?ai=checkout-fails");
  expect(await source.prepareCheckout()).toEqual({
    ok: true,
    value: { kind: "Failed", message: "fixture: git clone failed" },
  });
  expect(await source.prepareCheckout()).toMatchObject({ value: { kind: "Failed" } });
  expect(
    await source.startAgent({ program: "omp", args: [], homeFolders: [] }, () => undefined),
  ).toMatchObject({ value: { kind: "NoCheckout" } });
});

test("the checkout is Missing, then Clean, then Missing after a discard", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  expect(await source.checkoutChanges()).toEqual({ ok: true, value: { kind: "Missing" } });
  expect(await source.prepareCheckout()).toEqual({
    ok: true,
    value: { kind: "Ready", folder: FIXTURE_CHECKOUT },
  });
  expect(await source.checkoutChanges()).toEqual({ ok: true, value: { kind: "Clean" } });
  expect(await source.discardCheckout()).toEqual({ ok: true, value: null });
  expect(await source.checkoutChanges()).toEqual({ ok: true, value: { kind: "Missing" } });
});

test("?ai-changes reports README.md changed in the checkout", async () => {
  const source = createFixtureAgentSource(LOG, "?ai&ai-changes");
  expect(await source.checkoutChanges()).toEqual({
    ok: true,
    value: {
      kind: "Changed",
      folder: FIXTURE_CHECKOUT,
      files: ["README.md"],
      refs: { branches: [], stash: false },
      headMoved: false,
    },
  });
});

test("diffTexts answers the recorded edit's differences and nothing for other texts", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const run = await started(source);
  const session = await newSession(source, run);
  send(source, run, {
    id: 3,
    method: "session/prompt",
    params: { sessionId: session, prompt: [] },
  });
  await vi.runAllTimersAsync();
  const diff = events
    .flatMap((event) => (event.kind === "Message" ? [JSON.parse(event.text)] : []))
    .flatMap((each) => each.params?.update?.content ?? [])
    .find((content: { type: string }) => content.type === "diff");
  const result = await source.diffTexts(diff.oldText, diff.newText);
  expect(result.ok && result.value.map((each) => [each.left, each.right])).toEqual([
    [
      { start: 23, len: 0 },
      { start: 23, len: 1 },
    ],
  ]);
  expect(await source.diffTexts("a", "b")).toEqual({ ok: true, value: [] });
  expect(await source.diffTexts(diff.oldText, `${diff.newText}more\n`)).toEqual({
    ok: true,
    value: [],
  });
  expect(await source.diffTexts(`${diff.oldText}more\n`, diff.newText)).toEqual({
    ok: true,
    value: [],
  });
  expect(LOG.info).toHaveBeenCalledWith("agent.fixture_miss", { old: 1, next: 1 });
});

test("diffTexts refuses a side over 8 MiB as the app does", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  expect(await source.diffTexts("x".repeat(8_388_609), "")).toEqual({
    ok: false,
    failure: { kind: "ColumnTooLarge", limit: 8_388_608 },
  });
  expect((await source.diffTexts("x".repeat(8_388_608), "")).ok).toBe(true);
});

test("an unknown case names the known ones; the load recording is not one to play", () => {
  expect(() => createFixtureAgentSource(LOG, "?ai=nope")).toThrow(
    "no agent fixture nope; known: cancelled, edit-and-command, permission-outside",
  );
  expect(() => createFixtureAgentSource(LOG, "?ai=load")).toThrow(/^no agent fixture load;/u);
});

test("stopAgent of an old run leaves the new run playing", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const first = await started(source);
  const second = await started(source);
  await vi.runAllTimersAsync();
  events = [];
  await source.stopAgent(first);
  send(source, second, { id: 1, method: "initialize", params: {} });
  await vi.runAllTimersAsync();
  expect(events).toEqual([expect.objectContaining({ kind: "Message" })]);
  expect(messages()[0]).toMatchObject({ id: 1, result: { protocolVersion: 1 } });
});

test("a discard during playback ends the run with Exited and no code", async () => {
  const source = createFixtureAgentSource(LOG, "?ai");
  const run = await started(source);
  const session = await newSession(source, run);
  events = [];
  send(source, run, {
    id: 3,
    method: "session/prompt",
    params: { sessionId: session, prompt: [] },
  });
  await vi.advanceTimersByTimeAsync(31);
  await source.discardCheckout();
  await vi.runAllTimersAsync();
  expect(events.filter((event) => event.kind !== "Message")).toEqual([
    { kind: "Exited", code: null },
  ]);
  expect(events.at(-1)).toEqual({ kind: "Exited", code: null });
});

test("a recording line that is not a message is refused", () => {
  const files = {
    recordings: { "x/edit-and-command.jsonl": '{"from":"agent"}\n', "x/load.jsonl": "" },
    diffs: {},
  };
  expect(() => createFixtureAgentSource(LOG, "?ai", files)).toThrow(
    "agent fixture edit-and-command line 1 is not a recorded message",
  );
});
