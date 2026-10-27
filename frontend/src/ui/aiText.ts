import type { AgentFailure, EditDiff, FileEdit, StepStatus } from "../agent";
import type { ProblemCause } from "./problem";
import { problemText } from "./problemText";

export const THINKING_AND_STEPS = "Thinking and steps";
export const RUNNING_TEXT = "working…";
export const STOPPED_TEXT = "You stopped the AI.";
export const RETRY = "Retry";
export const LOADING_DIFF_TEXT = "Making the diff…";
export const TOO_LARGE_TEXT = "This edit is too large to show as a diff.";
export const NO_NEWLINE_TEXT = "\\ No newline at end of file";

export const LINE_ENDING_WORDS = { crlf: "CRLF line ending", lf: "LF line ending" } as const;

export const AI_SETTINGS_TEXT = {
  title: "AI",
  command: "Agent command",
  commandHint: "The command is split on spaces. It speaks the Agent Client Protocol.",
  message: "First message",
  messageHint: "Sent as the first message of a thread's conversation. Placeholders:",
  use: "Use",
  reset: "Default",
} as const;

export const YOLO_NOTE =
  "yamt allows the AI's commands, and its deletes and moves only inside its checkout. With omp's approval mode set to yolo, omp asks yamt nothing about deletes and moves, so they are allowed anywhere.";

export const STEP_STATUS_WORDS: Readonly<Record<StepStatus, string>> = {
  pending: "Waiting",
  running: "Running",
  done: "Done",
  failed: "Failed",
  noResult: "No result",
};

function crashedText(code: number | null, lastLog: string | null): string {
  const exit = code === null ? "" : ` (exit code ${code})`;
  const log = lastLog === null || lastLog.trim() === "" ? "." : `: ${lastLog.trim()}`;
  return `The AI stopped unexpectedly${exit}${log}`;
}

function notFoundText(program: string, searched: readonly string[]): string {
  const where = searched.length === 0 ? "" : ` (searched: ${searched.join(", ")})`;
  return `${program} was not found${where}. Set the Agent command in Settings.`;
}

/** One sentence per failure; `app` in the window's own problem words. */
export function failureText(failure: AgentFailure, platform: string): string {
  switch (failure.kind) {
    case "checkoutFailed":
      return `The AI's checkout could not be made: ${failure.message.trim()}`;
    case "notFound":
      return notFoundText(failure.program, failure.searched);
    case "spawnFailed":
      return `${failure.program} could not be started: ${failure.message.trim()}`;
    case "noCommand":
      return "The Agent command in Settings is empty.";
    case "crashed":
      return crashedText(failure.code, failure.lastLog);
    case "refused":
      return `The AI refused ${failure.method}: ${failure.message.trim()}`;
    case "sessionGone":
      return "omp no longer has this thread's conversation.";
    case "ended":
      return `The AI ended the turn: ${failure.reason}.`;
    case "busy":
      return "The AI is still answering in this thread.";
    case "app":
      return problemText({ action: "ai", step: "ask", cause: failure.failure }, platform);
    default: {
      const _exhaustive: never = failure;
      return _exhaustive;
    }
  }
}

export function diffFailureText(
  diff: Extract<EditDiff, { readonly kind: "appFailed" | "failed" }>,
  platform: string,
): string {
  const cause: ProblemCause =
    diff.kind === "appFailed" ? diff.failure : { kind: "Unexpected", message: diff.message };
  return problemText({ action: "ai", step: "diff", cause }, platform);
}

export function editTitle({ path, oldText }: FileEdit): string {
  return oldText === null ? `Created ${path}` : `Edited ${path}`;
}

export function refusedText(title: string): string {
  return `yamt refused: ${title} — outside the AI's checkout`;
}

export function moreLinesText(lines: number): string {
  return `${lines} more line${lines === 1 ? "" : "s"} not shown`;
}

export function skippedLinesText(lines: number): string {
  return `⋯ ${lines} unchanged line${lines === 1 ? "" : "s"}`;
}

export function unknownPlaceholderText(name: string): string {
  return `${name} is not a placeholder; it is sent as typed.`;
}
