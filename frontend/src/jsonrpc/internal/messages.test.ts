import { expect, test } from "vitest";

import {
  errorText,
  notificationText,
  parseIncoming,
  requestText,
  resultText,
  type Incoming,
} from "../index";

test("an incoming error keeps its data, and reads undefined data when it has none", () => {
  const withData: Incoming = {
    kind: "error",
    id: 4,
    code: -32603,
    message: "Internal error",
    data: { details: "ACP session not found: s1" },
  };
  const withoutData: Incoming = {
    kind: "error",
    id: null,
    code: -32700,
    message: "Parse error",
    data: undefined,
  };

  expect(
    parseIncoming(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        error: { code: -32603, message: "Internal error", data: withData.data },
      }),
    ),
  ).toStrictEqual({ ok: true, value: withData });
  expect(
    parseIncoming(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
    ),
  ).toStrictEqual({ ok: true, value: withoutData });
});

test("outgoing messages are JSON-RPC 2.0 texts", () => {
  expect(JSON.parse(requestText(1, "initialize", { a: 1 }))).toEqual({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { a: 1 },
  });
  expect(JSON.parse(notificationText("session/cancel", { sessionId: "s1" }))).toEqual({
    jsonrpc: "2.0",
    method: "session/cancel",
    params: { sessionId: "s1" },
  });
  expect(JSON.parse(resultText("a", null))).toEqual({ jsonrpc: "2.0", id: "a", result: null });
  expect(JSON.parse(errorText(2, -32601, "method not found: x"))).toEqual({
    jsonrpc: "2.0",
    id: 2,
    error: { code: -32601, message: "method not found: x" },
  });
});
