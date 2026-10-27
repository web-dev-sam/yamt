import { INVALID_PARAMS, METHOD_NOT_FOUND, parseWith, type Answer } from "../../jsonrpc";
import { sectionOf } from "./json";
import { APPLY_EDIT_PARAMS, CONFIGURATION_PARAMS, MESSAGE_PARAMS } from "./protocol";

export type WorkspaceFolder = { readonly uri: string; readonly name: string };

export type AnswerContext = {
  readonly settings: unknown;
  readonly folder: WorkspaceFolder | null;
};

const NULL_ANSWERS: Readonly<Record<string, true>> = {
  "client/registerCapability": true,
  "client/unregisterCapability": true,
  "window/workDoneProgress/create": true,
};

const REFRESH_SUFFIX = "/refresh";

function invalidParams(method: string, reason: string): Answer {
  return {
    kind: "error",
    code: INVALID_PARAMS,
    message: `invalid params: ${reason}`,
    log: `The server sent ${method} with invalid params: ${reason}`,
  };
}

function configuration(params: unknown, settings: unknown): Answer {
  const parsed = parseWith(CONFIGURATION_PARAMS, params);
  if (!parsed.ok) {
    return invalidParams("workspace/configuration", parsed.reason);
  }
  const value = parsed.value.items.map((item) => sectionOf(settings, item.section ?? ""));
  return { kind: "result", value, log: null };
}

function showMessageRequest(params: unknown): Answer {
  const parsed = parseWith(MESSAGE_PARAMS, params);
  const message = parsed.ok ? parsed.value.message : "(no message)";
  return { kind: "result", value: null, log: `The server asks (not answered): ${message}` };
}

function applyEdit(params: unknown): Answer {
  const parsed = parseWith(APPLY_EDIT_PARAMS, params);
  const label = parsed.ok && parsed.value.label !== undefined ? ` "${parsed.value.label}"` : "";
  return {
    kind: "result",
    value: { applied: false, failureReason: "yamt does not apply edits from servers" },
    log: `The server asked to apply an edit${label}; refused`,
  };
}

export function answer(method: string, params: unknown, context: AnswerContext): Answer {
  if (method === "workspace/configuration") {
    return configuration(params, context.settings);
  }
  if (method === "workspace/workspaceFolders") {
    const value = context.folder === null ? null : [context.folder];
    return { kind: "result", value, log: null };
  }
  if (method === "window/showMessageRequest") {
    return showMessageRequest(params);
  }
  if (method === "workspace/applyEdit") {
    return applyEdit(params);
  }
  if (Object.hasOwn(NULL_ANSWERS, method) || method.endsWith(REFRESH_SUFFIX)) {
    return { kind: "result", value: null, log: null };
  }
  return {
    kind: "error",
    code: METHOD_NOT_FOUND,
    message: `method not found: ${method}`,
    log: `The server sent a request yamt does not answer: ${method}`,
  };
}
