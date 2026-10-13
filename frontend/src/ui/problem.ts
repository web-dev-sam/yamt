import type { ShallowRef } from "vue";

import { log, type SourceFailure, type SourceResult } from "../ipc";

type Unexpected = { readonly kind: "Unexpected"; readonly message: string };

export type ProblemCause = SourceFailure | Unexpected;

export type Problem =
  | { readonly action: "list"; readonly cause: ProblemCause }
  | {
      readonly action: "open" | "finish" | "take" | "reset";
      readonly path: string;
      readonly cause: ProblemCause;
    };

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly cause: ProblemCause };

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
  const where = problem.action === "list" ? {} : { path: problem.path };
  log.error(`store.${problem.action}_failed`, { ...where, ...problem.cause });
}

export function report(
  target: { readonly problem: ShallowRef<Problem | null> },
  failure: Problem,
): void {
  logProblem(failure);
  target.problem.value = failure;
}

export function clearProblemAbout(
  target: { readonly problem: ShallowRef<Problem | null> },
  path: string,
): void {
  const problem = target.problem.value;
  if (problem !== null && problem.action !== "list" && problem.path === path) {
    target.problem.value = null;
  }
}
