import * as v from "valibot";

import type { AgentStartReply, SourceFailure } from "../../ipc";
import { parseWith, type Reply } from "../../jsonrpc";

export type AgentFailure =
  | { readonly kind: "checkoutFailed"; readonly message: string }
  | { readonly kind: "notFound"; readonly program: string; readonly searched: readonly string[] }
  | { readonly kind: "spawnFailed"; readonly program: string; readonly message: string }
  | { readonly kind: "noCommand" }
  | { readonly kind: "crashed"; readonly code: number | null; readonly lastLog: string | null }
  | { readonly kind: "refused"; readonly method: string; readonly message: string }
  | { readonly kind: "sessionGone" }
  | { readonly kind: "ended"; readonly reason: string }
  | { readonly kind: "busy" };

export type Exit = { readonly code: number | null; readonly lastLog: string | null };

type Unanswered = Exclude<Reply, { kind: "result" }>;

const DETAILS = v.object({ details: v.string() });

/** omp 18.12.6 puts its own words ("ACP session not found: …") in `data.details`. */
function errorWords(reply: Extract<Reply, { kind: "error" }>): string {
  const details = parseWith(DETAILS, reply.data);
  return details.ok ? details.value.details : reply.message;
}

export function sourceText(failure: SourceFailure): string {
  return "message" in failure && typeof failure.message === "string"
    ? failure.message
    : failure.kind;
}

export function startFailure(reply: Exclude<AgentStartReply, { kind: "Started" }>): AgentFailure {
  switch (reply.kind) {
    case "NotFound":
      return { kind: "notFound", program: reply.program, searched: reply.searched };
    case "SpawnFailed":
      return { kind: "spawnFailed", program: reply.program, message: reply.message };
    case "NoCheckout":
      return { kind: "checkoutFailed", message: "the checkout is gone" };
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

/** A request the agent did not answer with a result; `exit` is how the process ended, when it did. */
export function requestFailure(method: string, reply: Unanswered, exit: Exit | null): AgentFailure {
  switch (reply.kind) {
    case "error":
      return { kind: "refused", method, message: errorWords(reply) };
    case "closed":
      return { kind: "crashed", code: exit?.code ?? null, lastLog: exit?.lastLog ?? null };
    case "timedOut":
      return { kind: "refused", method, message: "no answer" };
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

const SESSION_NOT_FOUND = /session not found/iu;

/** omp answers "ACP session not found" for a session it no longer has (acp-agent.ts:1625). */
export function loadFailure(reply: Unanswered, exit: Exit | null): AgentFailure {
  if (reply.kind === "error" && SESSION_NOT_FOUND.test(errorWords(reply))) {
    return { kind: "sessionGone" };
  }
  return requestFailure("session/load", reply, exit);
}
