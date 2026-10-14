import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Answer } from "./answers";
import { Connection } from "./connection";
import type { Timers } from "./timers";

const TIMERS: Timers = {
  now: () => Date.now(),
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

type Harness = {
  readonly connection: Connection;
  readonly sent: unknown[];
  readonly logged: string[];
  readonly notified: [string, unknown][];
};

function harness(
  answerWith: (method: string) => Answer = () => ({ kind: "result", value: null, log: null }),
): Harness {
  const sent: unknown[] = [];
  const logged: string[] = [];
  const notified: [string, unknown][] = [];
  const connection = new Connection(
    {
      send: (text) => sent.push(JSON.parse(text)),
      request: (method) => answerWith(method),
      notification: (method, params) => notified.push([method, params]),
      log: (text) => logged.push(text),
    },
    TIMERS,
  );
  return { connection, sent, logged, notified };
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

  expect(await first).toEqual({ kind: "error", message: "no" });
  expect(await second).toEqual({ kind: "result", value: "two" });
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
