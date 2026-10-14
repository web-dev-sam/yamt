import type { FailReason, InstallHint, PackageManager, ServerSpec, ServerState } from "../lsp";
import type { FormatOutcome, ProblemCounts } from "./useMergeController";

export type DotKind = "running" | "busy" | "stopped" | "problem" | "warning";

export type ServerAction = "start" | "stop" | "restart";

type InstallStep = { readonly label: string; readonly command: string };

export type InstallText = {
  readonly reason: string;
  readonly steps: readonly [InstallStep, InstallStep];
  readonly managerNote: string | null;
  readonly otherWay: string;
  readonly comeBack: string;
};

type ManagerCommands = { readonly project: string; readonly global: string };

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

const NPM: ManagerCommands = { project: "npm install -D", global: "npm install -g" };

const MANAGER_COMMANDS: Readonly<Record<PackageManager, ManagerCommands>> = {
  npm: NPM,
  pnpm: { project: "pnpm add -D", global: "pnpm add -g" },
  yarn: { project: "yarn add -D", global: "yarn global add" },
  yarnBerry: { project: "yarn add -D", global: NPM.global },
  bun: { project: "bun add --dev", global: "bun add -g" },
};

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

function reasonSentence(hint: InstallHint): string {
  switch (hint.reason.kind) {
    case "typescript":
      return `This project uses TypeScript ${hint.reason.version}, which needs the separate package ${hint.package}.`;
    case "eslint":
      return `eslint's language server is the separate package ${hint.package}.`;
    default: {
      const _exhaustive: never = hint.reason;
      return _exhaustive;
    }
  }
}

export function installText(hint: InstallHint): InstallText {
  const commands = MANAGER_COMMANDS[hint.manager ?? "npm"];
  return {
    reason: reasonSentence(hint),
    steps: [
      { label: `In ${projectLabel(hint.folder)}:`, command: `${commands.project} ${hint.package}` },
      { label: "Or for all projects:", command: `${commands.global} ${hint.package}` },
    ],
    managerNote: hint.manager === null ? "Or the same with your package manager." : null,
    otherWay: `Or install it any other way that puts ${hint.program} on your PATH.`,
    comeBack: "yamt finds it when you come back to this window.",
  };
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
