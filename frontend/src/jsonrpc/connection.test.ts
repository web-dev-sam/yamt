import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  Connection,
  type Answer,
  type ConnectionHandlers,
  type ConnectionOptions,
  type Timers,
} from "./index";

const TIMERS: Timers = {
  now: () => Date.now(),
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

const LSP: ConnectionOptions = { cancelNotification: "$/cancelRequest" };

type Harness = {
  readonly connection: Connection;
  readonly sent: unknown[];
  readonly logged: string[];
  readonly notified: [string, unknown][];
  readonly cleared: (number | undefined)[];
};

function harness(
  answerWith: (method: string) => Answer = () => ({ kind: "result", value: null, log: null }),
  options: ConnectionOptions = LSP,
): Harness {
  const sent: unknown[] = [];
  const logged: string[] = [];
  const notified: [string, unknown][] = [];
  const cleared: (number | undefined)[] = [];
  const timers: Timers = {
    ...TIMERS,
    clearTimeout: (id) => {
      cleared.push(id);
      TIMERS.clearTimeout(id);
    },
  };
  const handlers: ConnectionHandlers = {
    send: (text) => sent.push(JSON.parse(text)),
    request: (method) => answerWith(method),
    notification: (method, params) => notified.push([method, params]),
    log: (text) => logged.push(text),
  };
  const connection = new Connection(handlers, timers, options);
  return { connection, sent, logged, notified, cleared };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("requests carry rising ids and settle with their own response", async () => {
  const { connection, sent } = harness();
  const first = connection.request("a", { x: 1 }, 1000);
  const second = connection.request("b", undefined, 1000);

  expect(sent).toEqual([
    { jsonrpc: "2.0", id: 1, method: "a", params: { x: 1 } },
    { jsonrpc: "2.0", id: 2, method: "b" },
  ]);
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 2, result: "two" }));
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -1, message: "no" } }));

  expect(await first).toStrictEqual({ kind: "error", code: -1, message: "no", data: undefined });
  expect(await second).toEqual({ kind: "result", value: "two" });
});

test("an error reply carries code, message and data", async () => {
  const { connection } = harness();
  const reply = connection.requestUntilAnswered("session/new", {});
  const error = {
    code: -32603,
    message: "Internal error",
    data: { details: "ACP session not found: s1" },
  };
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, error }));

  expect(await reply).toStrictEqual({ kind: "error", ...error });
});

test("an answered request does not time out later", async () => {
  const { connection, sent, logged } = harness();
  const reply = connection.request("a", null, 1000);
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }));
  await vi.advanceTimersByTimeAsync(5000);

  expect(await reply).toEqual({ kind: "result", value: null });
  expect(logged).toEqual([]);
  expect(sent).toHaveLength(1);
});

test("a request without an answer times out, is cancelled and logged; a late answer is ignored", async () => {
  const { connection, sent, logged } = harness();
  const reply = connection.request("textDocument/formatting", null, 2500);
  await vi.advanceTimersByTimeAsync(2500);

  expect(await reply).toEqual({ kind: "timedOut" });
  expect(sent.at(-1)).toEqual({ jsonrpc: "2.0", method: "$/cancelRequest", params: { id: 1 } });
  expect(logged).toEqual(["No answer to textDocument/formatting within 2.5 s; cancelled"]);

  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "late" }));
  expect(logged).toHaveLength(1);
});

test("a request with no cancel notification sends nothing on timeout", async () => {
  const { connection, sent, logged } = harness(undefined, { cancelNotification: null });
  const reply = connection.request("session/new", null, 1500);
  await vi.advanceTimersByTimeAsync(1499);
  expect(logged).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);

  expect(await reply).toEqual({ kind: "timedOut" });
  expect(sent).toEqual([{ jsonrpc: "2.0", id: 1, method: "session/new", params: null }]);
  expect(logged).toEqual(["No answer to session/new within 1.5 s"]);
});

test("requestUntilAnswered never times out and settles on its answer", async () => {
  const { connection, sent, logged, cleared } = harness();
  const reply = connection.requestUntilAnswered("session/prompt", { sessionId: "s1" });
  let settled = false;
  void reply.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

  expect(settled).toBe(false);
  expect(sent).toEqual([
    { jsonrpc: "2.0", id: 1, method: "session/prompt", params: { sessionId: "s1" } },
  ]);
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { stopReason: "end_turn" } }));

  expect(await reply).toEqual({ kind: "result", value: { stopReason: "end_turn" } });
  expect(logged).toEqual([]);
  expect(cleared).toEqual([]);
});

test("requestUntilAnswered settles closed on close()", async () => {
  const { connection, sent, logged, cleared } = harness();
  const reply = connection.requestUntilAnswered("session/prompt", null);
  connection.close();

  expect(await reply).toEqual({ kind: "closed" });
  expect(logged).toEqual(["No answer to session/prompt: the server stopped"]);
  expect(await connection.requestUntilAnswered("again", null)).toEqual({ kind: "closed" });
  expect(sent).toHaveLength(1);
  expect(cleared).toEqual([]);
});

test("responses with an unknown, string or null id settle nothing", async () => {
  const { connection } = harness();
  const reply = connection.request("a", null, 1000);
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 7, result: 1 }));
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: "1", result: 2 }));
  connection.receive(
    JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "x" } }),
  );
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 1, result: 3 }));

  expect(await reply).toEqual({ kind: "result", value: 3 });
});

test("close fails pending requests once, logs them, and stops every later send", async () => {
  const { connection, sent, logged } = harness();
  const reply = connection.request("shutdown", undefined, 1000);
  connection.close();

  expect(await reply).toEqual({ kind: "closed" });
  expect(logged).toEqual(["No answer to shutdown: the server stopped"]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(logged).toHaveLength(1);

  expect(await connection.request("again", null, 1000)).toEqual({ kind: "closed" });
  connection.notify("exit", undefined);
  connection.receive(
    JSON.stringify({ jsonrpc: "2.0", id: "s1", method: "workspace/configuration" }),
  );
  connection.close();
  expect(sent).toEqual([{ jsonrpc: "2.0", id: 1, method: "shutdown" }]);
  expect(logged).toHaveLength(1);
});

test("a server request is answered with a result or an error; only a log line is logged", () => {
  const bad: Answer = {
    kind: "error",
    code: -32601,
    message: "method not found: bad",
    log: "unknown bad",
  };
  const answers: Record<string, Answer> = {
    quiet: { kind: "result", value: [1], log: null },
    loud: { kind: "result", value: null, log: "asked loudly" },
  };
  const { connection, sent, logged } = harness((method) => answers[method] ?? bad);
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: "a", method: "quiet" }));
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "loud", params: {} }));
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "bad" }));

  expect(sent).toEqual([
    { jsonrpc: "2.0", id: "a", result: [1] },
    { jsonrpc: "2.0", id: 2, result: null },
    { jsonrpc: "2.0", id: 3, error: { code: -32601, message: "method not found: bad" } },
  ]);
  expect(logged).toEqual(["asked loudly", "unknown bad"]);
});

test("notifications reach the handler with their params", () => {
  const { connection, notified } = harness();
  connection.receive(
    JSON.stringify({ jsonrpc: "2.0", method: "window/logMessage", params: { a: 1 } }),
  );
  connection.receive(JSON.stringify({ jsonrpc: "2.0", method: "exit" }));

  expect(notified).toEqual([
    ["window/logMessage", { a: 1 }],
    ["exit", undefined],
  ]);
});

test("malformed messages are logged with their reason and dropped", () => {
  const { connection, sent, logged, notified } = harness();
  connection.receive("{not json");
  connection.receive(JSON.stringify({ jsonrpc: "2.0", method: 42 }));
  connection.receive(JSON.stringify({ jsonrpc: "2.0", id: 1 }));
  connection.receive("null");

  expect(logged).toHaveLength(4);
  expect(logged[0]).toMatch(/^Dropped a malformed message from the server: SyntaxError: .*JSON/);
  for (const line of logged.slice(1)) {
    expect(line).toMatch(/^Dropped a malformed message from the server: .*Invalid/);
  }
  expect(sent).toEqual([]);
  expect(notified).toEqual([]);
});
