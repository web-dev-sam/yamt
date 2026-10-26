import { expect, test } from "vitest";

import type { CheckoutFolder } from "../../ipc";
import { parseUpdate } from "./protocol";

const CHECKOUT_TEXT = "/fixture/checkout";

function isFolder(path: string): path is CheckoutFolder {
  return path === CHECKOUT_TEXT;
}

function folder(): CheckoutFolder {
  if (!isFolder(CHECKOUT_TEXT)) {
    throw new Error(CHECKOUT_TEXT);
  }
  return CHECKOUT_TEXT;
}

function parsed(update: object, sessionId: unknown = "s1"): unknown {
  return parseUpdate({ sessionId, update }, folder());
}

const STEP = { sessionUpdate: "tool_call_update", toolCallId: "t1" };

test("a step keeps only the content items yamt reads: text and diffs", () => {
  expect(
    parsed({
      ...STEP,
      content: [
        { type: "terminal", terminalId: "x" },
        { type: "content", content: { type: "image", data: "", mimeType: "image/png" } },
        { type: "content", content: { type: "text", text: "out" } },
        { type: "diff", path: `${CHECKOUT_TEXT}/a.ts`, oldText: null, newText: "x" },
        { type: "diff", path: "/elsewhere/b.ts", newText: "y" },
      ],
    }),
  ).toEqual({
    ok: true,
    value: {
      session: "s1",
      update: {
        kind: "step",
        step: {
          id: "t1",
          title: null,
          kind: null,
          status: null,
          outputs: [
            { kind: "text", text: "out" },
            { kind: "edit", edit: { path: "a.ts", oldText: null, newText: "x" } },
            { kind: "edit", edit: { path: "/elsewhere/b.ts", oldText: null, newText: "y" } },
          ],
        },
      },
    },
  });
});

test("null content, kind and status leave the step's own", () => {
  expect(parsed({ ...STEP, content: null, kind: null, status: null, title: null })).toMatchObject({
    ok: true,
    value: { update: { step: { kind: null, status: null, outputs: null } } },
  });
});

test("an unknown kind is other, an unknown status none", () => {
  expect(parsed({ ...STEP, kind: "dance", status: "dreaming" })).toMatchObject({
    value: { update: { step: { kind: "other", status: null } } },
  });
  expect(parsed({ ...STEP, kind: "execute", status: "in_progress" })).toMatchObject({
    value: { update: { step: { kind: "execute", status: "running" } } },
  });
});

test("a chunk that is not text says nothing", () => {
  expect(
    parsed({ sessionUpdate: "agent_message_chunk", content: { type: "image", data: "" } }),
  ).toEqual({ ok: true, value: { session: "s1", update: { kind: "said", text: "" } } });
});

test("a missing or empty sessionId is a parse failure", () => {
  expect(parseUpdate({ update: { sessionUpdate: "plan" } }, folder()).ok).toBe(false);
  expect(parsed({ sessionUpdate: "plan" }, "")).toMatchObject({ ok: false });
});

test("a malformed update yamt reads fails; one yamt does not read is ignored", () => {
  expect(parsed({ sessionUpdate: "tool_call", title: "no id" })).toMatchObject({ ok: false });
  expect(parsed({ sessionUpdate: "plan", entries: "anything" })).toEqual({
    ok: true,
    value: { session: "s1", update: null },
  });
  expect(parsed({ nothing: true })).toEqual({ ok: true, value: { session: "s1", update: null } });
});
