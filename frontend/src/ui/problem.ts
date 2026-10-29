import type { ShallowRef } from "vue";

import {
  log,
  type Column,
  type KeyProblem,
  type OperationKind,
  type SourceFailure,
  type SourceResult,
  type TabId,
} from "../ipc";

type Unexpected = { readonly kind: "Unexpected"; readonly message: string };

type KeysUnread = {
  readonly kind: "Keys";
  readonly path: string;
  readonly problems: readonly KeyProblem[];
};

export type ProblemCause = SourceFailure | Unexpected;

export type ThreadStep =
  | "list"
  | "add"
  | "note"
  | "queue"
  | "unqueue"
  | "edit"
  | "delete"
  | "check"
  | "send"
  | "session"
  | "answer";

export type AiAttempt = "ask" | "diff" | "discard";

export type Problem =
  | { readonly action: "list"; readonly cause: ProblemCause }
  | {
      readonly action: "abort" | "continue";
      readonly operation: OperationKind;
      readonly cause: ProblemCause;
    }
  | { readonly action: "close" }
  | {
      readonly action: "stopped";
      readonly operation: OperationKind | null;
      readonly message: string;
    }
  | {
      readonly action: "open" | "finish" | "save" | "take" | "reset";
      readonly path: string;
      readonly cause: ProblemCause;
    }
  | { readonly action: "settings"; readonly cause: ProblemCause | KeysUnread }
  | { readonly action: "tabs" | "openRange" | "search"; readonly cause: ProblemCause }
  | { readonly action: "loadTab"; readonly name: string; readonly cause: ProblemCause }
  | { readonly action: "threads"; readonly step: ThreadStep; readonly cause: ProblemCause }
  | { readonly action: "ai"; readonly step: AiAttempt; readonly cause: ProblemCause }
  | {
      readonly action: "saveTab";
      readonly tab: TabId;
      readonly column: Column;
      readonly name: string;
      readonly cause: ProblemCause;
    };

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly cause: ProblemCause };

type Target = { readonly problem: ShallowRef<Problem | null> };

export type EndsStop = { nextStop(end: { readonly kind: "outside" }): Promise<void> };

export function unexpected(error: unknown): Unexpected {
  return { kind: "Unexpected", message: error instanceof Error ? error.message : String(error) };
}

export async function attempt<T>(call: () => Promise<SourceResult<T>>): Promise<Outcome<T>> {
  try {
    const result = await call();
    return result.ok ? result : { ok: false, cause: result.failure };
  } catch (error) {
    return { ok: false, cause: unexpected(error) };
  }
}

function settingsFields(cause: ProblemCause | KeysUnread): Record<string, string | number> {
  return cause.kind === "Keys" ? { kind: cause.kind, path: cause.path } : { ...cause };
}

function stoppedFields(problem: Extract<Problem, { action: "stopped" }>): Record<string, string> {
  return { operation: problem.operation ?? "none", message: problem.message };
}

export function logProblem(problem: Problem): void {
  const event = `store.${problem.action}_failed`;
  switch (problem.action) {
    case "list":
    case "tabs":
    case "openRange":
    case "search":
      log.error(event, { ...problem.cause });
      return;
    case "abort":
    case "continue":
      log.error(event, { operation: problem.operation, ...problem.cause });
      return;
    case "close":
      log.info("store.close_refused", { reason: "git_running" });
      return;
    case "stopped":
      log.info("store.stopped", stoppedFields(problem));
      return;
    case "settings":
      log.error(event, settingsFields(problem.cause));
      return;
    case "open":
    case "finish":
    case "save":
    case "take":
    case "reset":
      log.error(event, { path: problem.path, ...problem.cause });
      return;
    case "loadTab":
    case "saveTab":
      log.error(event, { name: problem.name, ...problem.cause });
      return;
    case "threads":
    case "ai":
      log.error(event, { step: problem.step, ...problem.cause });
      return;
  }
}

export function report(target: Target, failure: Problem): void {
  logProblem(failure);
  target.problem.value = failure;
}

export async function reportFailure(
  target: Target & EndsStop,
  failure: Extract<Problem, { readonly cause: ProblemCause }>,
): Promise<void> {
  if (failure.cause.kind === "StopMovedOn") {
    logProblem(failure);
    await target.nextStop({ kind: "outside" });
    return;
  }
  report(target, failure);
}

export function clearProblemAbout(target: Target, path: string): void {
  const problem = target.problem.value;
  if (problem !== null && "path" in problem && problem.path === path) {
    target.problem.value = null;
  }
}
