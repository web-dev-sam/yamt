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

export type MergeRequestStep =
  | "find"
  | "list"
  | "open"
  | "job"
  | "mergeRequest"
  | "resolve"
  | "continue"
  | "localMerge";

export type Problem =
  | { readonly action: "list"; readonly cause: ProblemCause }
  | {
      readonly action: "abort" | "continue";
      readonly operation: OperationKind;
      readonly cause: ProblemCause;
    }
  | { readonly action: "push"; readonly branch: string; readonly cause: ProblemCause }
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
      readonly action: "mergeRequests";
      readonly step: MergeRequestStep;
      readonly cause: ProblemCause;
    }
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

function failureFields(
  problem: Exclude<Problem, { action: "close" | "stopped" }>,
): Record<string, string | number | boolean> {
  switch (problem.action) {
    case "list":
    case "tabs":
    case "openRange":
    case "search":
      return { ...problem.cause };
    case "abort":
    case "continue":
      return { operation: problem.operation, ...problem.cause };
    case "push":
      return { branch: problem.branch, ...problem.cause };
    case "settings":
      return settingsFields(problem.cause);
    case "open":
    case "finish":
    case "save":
    case "take":
    case "reset":
      return { path: problem.path, ...problem.cause };
    case "loadTab":
    case "saveTab":
      return { name: problem.name, ...problem.cause };
    case "threads":
    case "ai":
    case "mergeRequests":
      return { step: problem.step, ...problem.cause };
  }
}

export function logProblem(problem: Problem): void {
  if (problem.action === "close") {
    log.info("store.close_refused", { reason: "git_running" });
    return;
  }
  if (problem.action === "stopped") {
    log.info("store.stopped", stoppedFields(problem));
    return;
  }
  log.error(`store.${problem.action}_failed`, failureFields(problem));
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
