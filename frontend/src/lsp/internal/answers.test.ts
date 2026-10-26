import { expect, test } from "vitest";

import { INVALID_PARAMS, METHOD_NOT_FOUND } from "../../jsonrpc";
import { answer, type AnswerContext } from "./answers";

const FOLDER = { uri: "file:///repo/frontend", name: "frontend" };

const CONTEXT: AnswerContext = {
  settings: { validate: "on", nested: { run: "onType", deep: { flag: false } } },
  folder: FOLDER,
};

test("workspace/configuration: the whole settings for an empty or absent section", () => {
  expect(answer("workspace/configuration", { items: [{ section: "" }, {}] }, CONTEXT)).toEqual({
    kind: "result",
    value: [CONTEXT.settings, CONTEXT.settings],
    log: null,
  });
});

test("workspace/configuration: dotted sections walk into the settings, missing ones are null", () => {
  const items = [
    { section: "validate" },
    { section: "nested.run" },
    { section: "nested.deep.flag" },
    { section: "missing" },
    { section: "validate.deeper" },
  ];

  expect(answer("workspace/configuration", { items }, CONTEXT)).toEqual({
    kind: "result",
    value: ["on", "onType", false, null, null],
    log: null,
  });
});

test("workspace/configuration: null settings answer null for every item", () => {
  const context = { ...CONTEXT, settings: null };

  expect(
    answer("workspace/configuration", { items: [{ section: "" }, { section: "a" }] }, context),
  ).toEqual({ kind: "result", value: [null, null], log: null });
});

test("workspace/configuration: invalid params are an invalid-params error, logged", () => {
  const reply = answer("workspace/configuration", { items: "all" }, CONTEXT);

  expect(reply).toMatchObject({ kind: "error", code: INVALID_PARAMS });
  expect(reply.kind === "error" ? reply.message : "").toMatch(/^invalid params: \S/);
  expect(reply.log).toMatch(/^The server sent workspace\/configuration with invalid params: \S/);
});

test.each([
  "client/registerCapability",
  "client/unregisterCapability",
  "window/workDoneProgress/create",
  "workspace/diagnostic/refresh",
  "workspace/semanticTokens/refresh",
  "workspace/inlayHint/refresh",
])("%s is answered null without a log line", (method) => {
  expect(answer(method, {}, CONTEXT)).toEqual({ kind: "result", value: null, log: null });
});

test("workspace/workspaceFolders is the project folder", () => {
  expect(answer("workspace/workspaceFolders", undefined, CONTEXT)).toEqual({
    kind: "result",
    value: [FOLDER],
    log: null,
  });
});

test("workspace/workspaceFolders before the folder is known is null", () => {
  expect(answer("workspace/workspaceFolders", undefined, { ...CONTEXT, folder: null })).toEqual({
    kind: "result",
    value: null,
    log: null,
  });
});

test("window/showMessageRequest is answered null and its message logged", () => {
  expect(
    answer("window/showMessageRequest", { type: 1, message: "Pick one", actions: [] }, CONTEXT),
  ).toEqual({ kind: "result", value: null, log: "The server asks (not answered): Pick one" });
});

test("window/showMessageRequest without a message still logs a line", () => {
  expect(answer("window/showMessageRequest", null, CONTEXT)).toEqual({
    kind: "result",
    value: null,
    log: "The server asks (not answered): (no message)",
  });
});

test("workspace/applyEdit is refused and logged with its label", () => {
  const reply = answer("workspace/applyEdit", { label: "Fix all", edit: {} }, CONTEXT);

  expect(reply).toMatchObject({
    kind: "result",
    value: { applied: false, failureReason: "yamt does not apply edits from servers" },
  });
  expect(reply.log).toBe('The server asked to apply an edit "Fix all"; refused');
  expect(answer("workspace/applyEdit", { edit: {} }, CONTEXT).log).toBe(
    "The server asked to apply an edit; refused",
  );
});

test("any other request is method-not-found, logged", () => {
  expect(answer("workspace/codeLens/resolve", {}, CONTEXT)).toEqual({
    kind: "error",
    code: METHOD_NOT_FOUND,
    message: "method not found: workspace/codeLens/resolve",
    log: "The server sent a request yamt does not answer: workspace/codeLens/resolve",
  });
});
