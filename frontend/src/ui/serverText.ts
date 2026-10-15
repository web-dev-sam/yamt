import type { FailReason, ServerSpec, ServerState, SpecNote } from "../lsp";
import type { FormatOutcome, ProblemCounts } from "./useMergeController";

export type DotKind = "running" | "busy" | "stopped" | "problem" | "warning";

export type ServerAction = "start" | "stop" | "restart";

export const ACTION_LABELS: Readonly<Record<ServerAction, string>> = {
  start: "Start",
  stop: "Stop",
  restart: "Restart",
};

export const SHOW_LOG = "Show log";

export const EMPTY_LOG = "Nothing logged yet.";

export const COPY = "Copy";

export const COPIED = "Copied";

export const BACK = "Back";

export const NOT_INSTALLED = "Not installed";

export const FROM_THE_LIST = "From the list";

export const FROM_THE_LIST_HINT = `"${FROM_THE_LIST}" fills both fields with a known server.`;

export function projectLabel(folder: string): string {
  return folder === "" ? "the repository root" : `${folder}/`;
}

export function serverLabel(spec: ServerSpec): string {
  return spec.install === null ? spec.name : `${spec.name} (${NOT_INSTALLED.toLowerCase()})`;
}

function failLine(reason: FailReason): string {
  switch (reason.kind) {
    case "notFound":
      return `Not found: looked in ${reason.searched.join(", ")}`;
    case "spawnFailed":
    case "initializeFailed":
      return `Could not start: ${reason.message}`;
    case "timedOut":
      return "Did not answer in time";
    case "noHost":
      return "Runs only in the app";
    case "outsideRepository":
      return "Its folder is outside the repository";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

export function stateLine(state: ServerState): string {
  switch (state.kind) {
    case "stopped":
      return "Stopped";
    case "starting":
      return "Starting…";
    case "running":
      return "Running";
    case "stopping":
      return "Stopping…";
    case "crashed":
      return state.code === null ? "Stopped: exited" : `Stopped: exited with code ${state.code}`;
    case "failed":
      return failLine(state.reason);
    case "notInstalled":
      return NOT_INSTALLED;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function dotKind(state: ServerState): DotKind {
  switch (state.kind) {
    case "running":
      return "running";
    case "starting":
    case "stopping":
      return "busy";
    case "stopped":
      return "stopped";
    case "crashed":
    case "failed":
      return "problem";
    case "notInstalled":
      return "warning";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function serverActions(state: ServerState): readonly ServerAction[] {
  switch (state.kind) {
    case "stopped":
      return ["start"];
    case "starting":
      return ["stop"];
    case "running":
      return ["stop", "restart"];
    case "crashed":
      return ["start", "restart"];
    case "failed":
      return state.reason.kind === "noHost" ? [] : ["start", "restart"];
    case "stopping":
    case "notInstalled":
      return [];
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function noteLine(note: SpecNote): string {
  switch (note.program) {
    case "tsc":
      return `Vue files get no type problems: TypeScript ${note.version} runs no plugins, and Vue needs TypeScript 6.`;
    case "tsgo":
      return "Vue files get no type problems: TypeScript's native preview (tsgo) runs no plugins, and Vue needs TypeScript 6.";
  }
}

export function formatNote(outcome: FormatOutcome | undefined): string | null {
  switch (outcome?.kind) {
    case "notRunning":
      return `Not formatted: ${outcome.server} is not running`;
    case "failed":
      return `Not formatted: ${outcome.server} failed: ${outcome.message}`;
    case "timedOut":
      return `Not formatted: ${outcome.server} did not answer in time`;
    case "changedMeanwhile":
      return `Not formatted: the Result changed while ${outcome.server} was formatting`;
    case "formatted":
    case "unchanged":
    case "noFormatter":
    case undefined:
      return null;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function problemsTitle({ errors, warnings }: ProblemCounts): string {
  return `${counted(errors, "error", "errors")}, ${counted(warnings, "warning", "warnings")}`;
}

export function logTitle(name: string): string {
  return `${name} log`;
}

export function logTime(at: number): string {
  return new Date(at).toLocaleTimeString("en-GB", { hour12: false });
}

export const YAMT_MARK = "yamt";
