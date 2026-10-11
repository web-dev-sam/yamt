import type { Problem, ProblemCause } from "./problem";

type UnsupportedReason = Extract<ProblemCause, { kind: "Unsupported" }>["reason"];

function attempted(problem: Problem): string {
  switch (problem.action) {
    case "list":
      return "Could not list the conflicted files";
    case "open":
      return `Could not open ${problem.path}`;
    case "finish":
      return `Could not mark ${problem.path} as resolved`;
    case "take":
      return `Could not resolve ${problem.path} with one side`;
    case "reset":
      return `Could not reset ${problem.path}`;
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

export function problemText(problem: Problem): string {
  const { cause } = problem;
  switch (cause.kind) {
    case "Git":
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
    case "Unexpected":
      return `${attempted(problem)}: ${cause.message.trim()}`;
    default: {
      const _exhaustive: never = cause;
      return _exhaustive;
    }
  }
}
