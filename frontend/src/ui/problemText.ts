import { keyLabel, type KeyProblem } from "../ipc";
import { ACTION_NAMES } from "./keyText";
import { continueAction, operationName } from "./operationText";
import type { Problem, ProblemCause } from "./problem";

type CausedProblem = Exclude<Problem, { action: "stopped" | "close" }>;

type UnsupportedReason = Extract<ProblemCause, { kind: "Unsupported" }>["reason"];

const AT_POSITION = /^(.*) at line (\d+) column (\d+)$/s;
const BYTES_PER_MIB = 1_048_576;

const OPERATION_STATE_WORDS: Readonly<
  Record<"StopMovedOn" | "GitRunning" | "MergeFinished" | "NoOperation", string>
> = {
  StopMovedOn: "The operation moved on; the list is being read again.",
  GitRunning: "Git is still running; try again when it is done.",
  MergeFinished: "The operation is finished.",
  NoOperation: "Git has no operation to continue or abort.",
};

const FIXED_REASONS: Readonly<
  Record<"NoConfigFolder" | "MergeAborted" | "UnknownTab" | "WorkerStopped", string>
> = {
  NoConfigFolder: "this system has no config folder to keep it in.",
  MergeAborted: "the merge was aborted.",
  UnknownTab: "that tab was closed.",
  WorkerStopped: "yamt's worker stopped; try again.",
};

function attempted(problem: CausedProblem): string {
  switch (problem.action) {
    case "list":
      return "Could not list the conflicted files";
    case "open":
      return `Could not open ${problem.path}`;
    case "finish":
      return `Could not mark ${problem.path} as resolved`;
    case "save":
      return `Could not save ${problem.path}`;
    case "take":
      return `Could not resolve ${problem.path} with one side`;
    case "reset":
      return `Could not reset ${problem.path}`;
    case "settings":
      return "Could not use the settings file";
    case "abort":
      return `Could not abort the ${operationName(problem.operation)}`;
    case "continue": {
      const { verb, object } = continueAction(problem.operation);
      return `Could not ${verb.toLowerCase()} ${object}`;
    }
    case "tabs":
      return "Could not update the tabs";
    case "loadTab":
      return `Could not load ${problem.name}`;
    case "saveTab":
      return `Could not save ${problem.name}`;
    default: {
      const _exhaustive: never = problem;
      return _exhaustive;
    }
  }
}

function unsupportedBecause(reason: UnsupportedReason): string {
  switch (reason) {
    case "Binary":
      return "it is a binary file";
    case "NonUtf8":
      return "it is not UTF-8 text";
    case "TooLarge":
      return "it is larger than 8 MiB";
    case "LocalDeleted":
      return "it was deleted in your branch";
    case "RemoteDeleted":
      return "it was deleted in theirs";
    case "Symlink":
      return "it is a symbolic link";
    case "Submodule":
      return "it is a submodule";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

// serde_json ends a syntax error with " at line L column C" (serde_json src/error.rs Display).
function brokenText(path: string, message: string): string {
  const found = AT_POSITION.exec(message.trim());
  const [, what = message.trim(), line, column] = found ?? [];
  const where = line === undefined ? "" : ` at line ${line}, column ${column}`;
  return `The settings file ${path} has an error${where}: ${what}. Fix it or choose another file.`;
}

function keyProblemText(path: string, problem: KeyProblem, platform: string): string {
  switch (problem.kind) {
    case "unreadable": {
      const name = ACTION_NAMES[problem.action];
      return `The settings file ${path} gives ${name} the key "${problem.text}", which yamt cannot read; ${name} keeps its default keys.`;
    }
    case "twice": {
      const [keeps, loses] = problem.actions.map((action) => ACTION_NAMES[action]);
      return `The settings file ${path} gives ${keyLabel(problem.key, platform)} to both ${keeps} and ${loses}; only ${keeps} uses it.`;
    }
    default: {
      const _exhaustive: never = problem;
      return _exhaustive;
    }
  }
}

function causedText(problem: CausedProblem, platform: string): string {
  const { cause } = problem;
  switch (cause.kind) {
    case "Git":
    case "Unexpected":
      return `${attempted(problem)}: ${cause.message.trim()}`;
    case "UnknownPath":
      return `${attempted(problem)}: ${cause.path} is not one of the conflicted files.`;
    case "Unsupported":
      return `${cause.path} cannot be shown in the editor: ${unsupportedBecause(cause.reason)}.`;
    case "WriteFailed":
      return `${attempted(problem)}: writing ${cause.path} failed: ${cause.message.trim()}`;
    case "NotAFile":
      return `${attempted(problem)}: ${cause.path} is not a regular file on disk; nothing was written`;
    case "ReadFailed":
      return `${attempted(problem)}: reading ${cause.path} failed: ${cause.message.trim()}`;
    case "SettingsBroken":
      return brokenText(cause.path, cause.message);
    case "NotAbsolute":
      return `${attempted(problem)}: ${cause.path} is not an absolute path; start it with / or ~/.`;
    case "NoConfigFolder":
    case "MergeAborted":
    case "UnknownTab":
    case "WorkerStopped":
      return `${attempted(problem)}: ${FIXED_REASONS[cause.kind]}`;
    case "StopMovedOn":
    case "GitRunning":
    case "MergeFinished":
    case "NoOperation":
      return OPERATION_STATE_WORDS[cause.kind];
    case "Keys":
      return cause.problems.map((each) => keyProblemText(cause.path, each, platform)).join(" ");
    case "ColumnTooLarge":
      return `${attempted(problem)}: a column holds up to ${cause.limit / BYTES_PER_MIB} MiB.`;
    default: {
      const _exhaustive: never = cause;
      return _exhaustive;
    }
  }
}

export function problemText(problem: Problem, platform: string): string {
  if (problem.action === "close") {
    return "Git is still running; close yamt when it is done.";
  }
  if (problem.action !== "stopped") {
    return causedText(problem, platform);
  }
  const who = problem.operation === null ? "Git" : `The ${operationName(problem.operation)}`;
  return `${who} stopped: ${problem.message.trim()}`;
}
