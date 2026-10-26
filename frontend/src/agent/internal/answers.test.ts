import { expect, test } from "vitest";

import type { CheckoutFolder } from "../../ipc";
import { INVALID_PARAMS, METHOD_NOT_FOUND } from "../../jsonrpc";
import { answerRequest } from "./answers";

function isFolder(path: string): path is CheckoutFolder {
  return path.startsWith("/");
}

function folder(path: string): CheckoutFolder {
  if (!isFolder(path)) {
    throw new Error(path);
  }
  return path;
}

const CHECKOUT = folder("/data/checkout");

const EVERY_OPTION = [
  { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
  { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
  { optionId: "reject_once", name: "Reject", kind: "reject_once" },
  { optionId: "reject_always", name: "Always reject", kind: "reject_always" },
] as const;

function permission(toolCall: object, options: readonly object[] = EVERY_OPTION): unknown {
  return { sessionId: "s1", toolCall: { toolCallId: "call-1", ...toolCall }, options };
}

function selected(optionId: string): unknown {
  return { outcome: { outcome: "selected", optionId } };
}

test("a command is allowed once, whatever its paths", () => {
  const params = permission({
    title: "rm -v /tmp/x",
    kind: "execute",
    locations: [{ path: "/tmp/x" }],
  });
  const { answer, refused } = answerRequest("session/request_permission", params, CHECKOUT);
  expect(answer).toEqual({ kind: "result", value: selected("allow_once"), log: null });
  expect(refused).toBeNull();
});

test("a delete inside the checkout is allowed once", () => {
  const params = permission({ title: "Delete a.ts", locations: [{ path: "/data/checkout/a.ts" }] });
  const { answer, refused } = answerRequest("session/request_permission", params, CHECKOUT);
  expect(answer).toEqual({ kind: "result", value: selected("allow_once"), log: null });
  expect(refused).toBeNull();
});

test("a move whose destination is outside is refused once and shown on its step", () => {
  const params = permission({
    title: "Move a.ts to /tmp/a.ts",
    kind: "move",
    locations: [{ path: "/data/checkout/a.ts" }, { path: "/tmp/a.ts" }],
  });
  const { answer, refused } = answerRequest("session/request_permission", params, CHECKOUT);
  expect(answer).toEqual({
    kind: "result",
    value: selected("reject_once"),
    log: 'Refused "Move a.ts to /tmp/a.ts"',
  });
  expect(refused).toEqual({
    session: "s1",
    refusal: { step: "call-1", title: "Move a.ts to /tmp/a.ts", paths: ["/tmp/a.ts"] },
  });
});

test.each([
  ["no locations", { title: "delete", kind: "delete" }],
  ["empty locations", { title: "delete", kind: "delete", locations: [] }],
  ["null locations and no kind", { title: "delete", kind: null, locations: null }],
])("%s and not a command is refused", (_, toolCall) => {
  const { answer, refused } = answerRequest(
    "session/request_permission",
    permission(toolCall),
    CHECKOUT,
  );
  expect(answer).toMatchObject({ kind: "result", value: selected("reject_once") });
  expect(refused?.refusal).toEqual({ step: "call-1", title: "delete", paths: [] });
});

test("a refusal without a title names the step id", () => {
  const params = permission({ locations: [{ path: "/elsewhere" }] });
  const { refused } = answerRequest("session/request_permission", params, CHECKOUT);
  expect(refused?.refusal).toEqual({ step: "call-1", title: "call-1", paths: ["/elsewhere"] });
});

test("options without allow_once answer cancelled, logged", () => {
  const options = [EVERY_OPTION[1], EVERY_OPTION[2], EVERY_OPTION[3]];
  const params = permission({ title: "git status", kind: "execute" }, options);
  const { answer } = answerRequest("session/request_permission", params, CHECKOUT);
  expect(answer).toEqual({
    kind: "result",
    value: { outcome: { outcome: "cancelled" } },
    log: 'No allow_once option for "git status"; answered cancelled',
  });
});

test("options without reject_once answer cancelled and still show the refusal", () => {
  const params = permission({ title: "Delete /tmp/x", locations: [{ path: "/tmp/x" }] }, [
    EVERY_OPTION[0],
    EVERY_OPTION[3],
  ]);
  const { answer, refused } = answerRequest("session/request_permission", params, CHECKOUT);
  expect(answer).toMatchObject({ value: { outcome: { outcome: "cancelled" } } });
  expect(refused?.refusal.paths).toEqual(["/tmp/x"]);
});

test("never an *_always option, even when it comes first", () => {
  const options = [EVERY_OPTION[1], EVERY_OPTION[3], EVERY_OPTION[0], EVERY_OPTION[2]];
  const allowed = answerRequest(
    "session/request_permission",
    permission({ kind: "execute" }, options),
    CHECKOUT,
  );
  const refusedOne = answerRequest(
    "session/request_permission",
    permission({ kind: "delete" }, options),
    CHECKOUT,
  );
  expect(allowed.answer).toMatchObject({ value: selected("allow_once") });
  expect(refusedOne.answer).toMatchObject({ value: selected("reject_once") });
});

test.each(["fs/read_text_file", "terminal/create", "session/elicit"])(
  "%s is not answered",
  (method) => {
    const { answer, refused } = answerRequest(method, {}, CHECKOUT);
    expect(answer).toEqual({
      kind: "error",
      code: METHOD_NOT_FOUND,
      message: `yamt does not answer ${method}`,
      log: `yamt does not answer ${method}`,
    });
    expect(refused).toBeNull();
  },
);

test("a malformed permission request is an invalid-params error", () => {
  const { answer } = answerRequest("session/request_permission", { toolCall: {} }, CHECKOUT);
  expect(answer).toMatchObject({ kind: "error", code: INVALID_PARAMS });
  expect(
    answer.kind === "error" && answer.message.startsWith("Malformed session/request_permission: "),
  ).toBe(true);
});
