import type { ShallowRef } from "vue";

import {
  log,
  type KeyProblem,
  type OperationKind,
  type SourceFailure,
  type SourceResult,
} from "../ipc";

type Unexpected = { readonly kind: "Unexpected"; readonly message: string };

type KeysUnread = {
  readonly kind: "Keys";
  readonly path: string;
  readonly problems: readonly KeyProblem[];
};

export type ProblemCause = SourceFailure | Unexpected;

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
  | { readonly action: "settings"; readonly cause: ProblemCause | KeysUnread };

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly cause: ProblemCause };

type Target = { readonly problem: ShallowRef<Problem | null> };

export type Relist = { refreshFiles(): Promise<void> };

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

export function logProblem(problem: Problem): void {
  const event = `store.${problem.action}_failed`;
  switch (problem.action) {
    case "list":
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
      log.info("store.stopped", {
        operation: problem.operation ?? "none",
        message: problem.message,
      });
      return;
    case "settings": {
      const { cause } = problem;
      const fields = cause.kind === "Keys" ? { kind: cause.kind, path: cause.path } : cause;
      log.error(event, { ...fields });
      return;
    }
    case "open":
    case "finish":
    case "save":
    case "take":
    case "reset":
      log.error(event, { path: problem.path, ...problem.cause });
      return;
    default: {
      const _exhaustive: never = problem;
      return _exhaustive;
    }
  }
}

export function report(target: Target, failure: Problem): void {
  logProblem(failure);
  target.problem.value = failure;
}

export async function reportFailure(
  target: Target & Relist,
  failure: Extract<Problem, { readonly cause: ProblemCause }>,
): Promise<void> {
  report(target, failure);
  if (failure.cause.kind === "StopMovedOn") {
    await target.refreshFiles();
  }
}

export function clearProblemAbout(target: Target, path: string): void {
  const problem = target.problem.value;
  if (problem !== null && "path" in problem && problem.path === path) {
    target.problem.value = null;
  }
}
