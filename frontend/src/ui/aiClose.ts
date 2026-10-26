import { log, type AgentSource } from "../ipc";
import type { Asking } from "./asking";
import { attempt, type Problem } from "./problem";
import type { Question } from "./question";

type CloseTarget = {
  readonly source: Pick<AgentSource, "checkoutChanges" | "discardCheckout">;
  readonly asking: Pick<Asking, "ask">;
  readonly report: (problem: Problem) => void;
};

async function changesQuestion(target: CloseTarget): Promise<Question | null> {
  const look = await attempt(() => target.source.checkoutChanges());
  if (!look.ok) {
    log.warn("ai.close_look_failed", { ...look.cause });
    return null;
  }
  const changes = look.value;
  switch (changes.kind) {
    case "Missing":
    case "Clean":
      return null;
    case "Changed": {
      const { folder, files, headMoved, refs } = changes;
      return { kind: "keepAiChanges", folder, files, headMoved, refs };
    }
    case "Unreadable":
      return { kind: "keepUnreadableCheckout", folder: changes.folder, message: changes.message };
    default: {
      const _exhaustive: never = changes;
      return _exhaustive;
    }
  }
}

/**
 * Whether the range window may close: a changed or unreadable checkout asks first.
 * A look that fails closes, since the shell removes the checkout at exit only when it is clean.
 */
export async function aiMayClose(target: CloseTarget): Promise<boolean> {
  const question = await changesQuestion(target);
  if (question === null) {
    return true;
  }
  const reply = await target.asking.ask(question);
  switch (reply) {
    case "yes":
      return true;
    case "dismissed":
      return false;
    case "no": {
      const discarded = await attempt(() => target.source.discardCheckout());
      if (!discarded.ok) {
        target.report({ action: "ai", step: "discard", cause: discarded.cause });
      }
      return discarded.ok;
    }
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}
