import type { CheckoutFolder } from "../../ipc";
import { INVALID_PARAMS, METHOD_NOT_FOUND, parseWith, type Answer } from "../../jsonrpc";
import { relativeInside } from "./inside";
import { PERMISSION_REQUEST, type PermissionRequest } from "./protocol";
import type { Refusal } from "./turn";

export type Answered = {
  readonly answer: Answer;
  readonly refused: { readonly session: string; readonly refusal: Refusal } | null;
};

type Choice = "allow_once" | "reject_once";

const PERMISSION = "session/request_permission";

function outsidePaths({ toolCall }: PermissionRequest, folder: CheckoutFolder): string[] | null {
  if (toolCall.kind === "execute") {
    return null;
  }
  const paths = (toolCall.locations ?? []).map((location) => location.path);
  const outside = paths.filter((path) => relativeInside(path, folder) === null);
  return paths.length > 0 && outside.length === 0 ? null : outside;
}

function chosen(request: PermissionRequest, choice: Choice, title: string): Answer {
  const option = request.options.find((each) => each.kind === choice);
  if (option === undefined) {
    const log = `No ${choice} option for "${title}"; answered cancelled`;
    return { kind: "result", value: { outcome: { outcome: "cancelled" } }, log };
  }
  const value = { outcome: { outcome: "selected", optionId: option.optionId } };
  return { kind: "result", value, log: choice === "allow_once" ? null : `Refused "${title}"` };
}

/**
 * The fixed table of answers to the agent's requests: a command is allowed; any other
 * permission only when every path lies inside the checkout; never an `*_always` option, which omp
 * remembers for the whole session.
 */
export function answerRequest(method: string, params: unknown, folder: CheckoutFolder): Answered {
  if (method !== PERMISSION) {
    const message = `yamt does not answer ${method}`;
    return {
      answer: { kind: "error", code: METHOD_NOT_FOUND, message, log: message },
      refused: null,
    };
  }
  const parsed = parseWith(PERMISSION_REQUEST, params);
  if (!parsed.ok) {
    const message = `Malformed ${PERMISSION}: ${parsed.reason}`;
    return {
      answer: { kind: "error", code: INVALID_PARAMS, message, log: message },
      refused: null,
    };
  }
  const request = parsed.value;
  const { toolCallId, title } = request.toolCall;
  const shown = title ?? toolCallId;
  const outside = outsidePaths(request, folder);
  if (outside === null) {
    return { answer: chosen(request, "allow_once", shown), refused: null };
  }
  const refusal: Refusal = { step: toolCallId, title: shown, paths: outside };
  return {
    answer: chosen(request, "reject_once", shown),
    refused: { session: request.sessionId, refusal },
  };
}
