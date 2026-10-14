import type { Diagnostic } from "./protocol";

export type ProblemSeverity = "error" | "warning" | "info" | "hint";

export type LinePosition = { readonly line: number; readonly character: number };

export type ServerProblem = {
  readonly from: LinePosition;
  readonly to: LinePosition;
  readonly severity: ProblemSeverity;
  readonly message: string;
  readonly source: string | null;
  readonly code: string | null;
};

const SEVERITIES: readonly ProblemSeverity[] = ["error", "warning", "info", "hint"];

export function toProblem(diagnostic: Diagnostic): ServerProblem {
  return {
    from: diagnostic.range.start,
    to: diagnostic.range.end,
    severity: SEVERITIES[Number(diagnostic.severity) - 1] ?? "error",
    message: diagnostic.message,
    source: diagnostic.source ?? null,
    code: diagnostic.code === undefined ? null : String(diagnostic.code),
  };
}
