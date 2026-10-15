import type {
  FailReason,
  InstallHint,
  PackageManager,
  PythonManager,
  ServerSpec,
  ServerState,
} from "../lsp";
import type { FormatOutcome, ProblemCounts } from "./useMergeController";

export type DotKind = "running" | "busy" | "stopped" | "problem" | "warning";

export type ServerAction = "start" | "stop" | "restart";

type InstallStep = { readonly label: string; readonly command: string };

export type InstallText = {
  readonly reason: string | null;
  readonly steps: readonly InstallStep[];
  readonly notes: readonly string[];
  readonly otherWay: string | null;
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

const PIP: ManagerCommands = { project: "python -m pip install", global: "pipx install" };

const PYTHON_COMMANDS: Readonly<Record<PythonManager, ManagerCommands>> = {
  uv: { project: "uv add --dev", global: "uv tool install" },
  poetry: { project: "poetry add --group dev", global: PIP.global },
  pdm: { project: "pdm add -d", global: PIP.global },
};

const SAME_WITH_YOUR_MANAGER = "Or the same with your package manager.";

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

type NodeHint = Extract<InstallHint, { kind: "node" }>;

function reasonSentence(hint: NodeHint): string {
  switch (hint.reason.kind) {
    case "typescript":
      return `This project uses TypeScript ${hint.reason.version}, which needs the separate package ${hint.package}.`;
    case "eslint":
      return `eslint's language server is the separate package ${hint.package}.`;
    case "vue":
      return `This project uses Vue; its .vue files need the package ${hint.package} in this project.`;
    default: {
      const _exhaustive: never = hint.reason;
      return _exhaustive;
    }
  }
}

type HintParts = Pick<InstallText, "reason" | "steps" | "notes">;

const ALL_PROJECTS = "Or for all projects:";

function nodeParts(hint: NodeHint): HintParts {
  const commands = MANAGER_COMMANDS[hint.manager ?? "npm"];
  const here = {
    label: `In ${projectLabel(hint.folder)}:`,
    command: `${commands.project} ${hint.package}`,
  };
  const everywhere = { label: ALL_PROJECTS, command: `${commands.global} ${hint.package}` };
  return {
    reason: reasonSentence(hint),
    steps: hint.reason.kind === "vue" ? [here] : [here, everywhere],
    notes: hint.manager === null ? [SAME_WITH_YOUR_MANAGER] : [],
  };
}

function pythonParts(hint: Extract<InstallHint, { kind: "python" }>): HintParts {
  const folder = projectLabel(hint.folder);
  const commands = hint.manager === null ? PIP : PYTHON_COMMANDS[hint.manager];
  const here =
    hint.manager === null ? `In ${folder}, in the project's virtual environment:` : `In ${folder}:`;
  return {
    reason: null,
    steps: [
      { label: here, command: `${commands.project} ${hint.package}` },
      { label: ALL_PROJECTS, command: `${commands.global} ${hint.package}` },
    ],
    notes: hint.manager === null ? [SAME_WITH_YOUR_MANAGER] : [],
  };
}

function oneStep(command: string, notes: readonly string[]): HintParts {
  return { reason: null, steps: [{ label: "For all projects:", command }], notes };
}

function hintParts(hint: InstallHint): HintParts {
  switch (hint.kind) {
    case "node":
      return nodeParts(hint);
    case "python":
      return pythonParts(hint);
    case "rustup":
      return oneStep(`rustup component add ${hint.component}`, []);
    case "go":
      return oneStep(`go install ${hint.module}`, [
        "It goes to Go's bin folder (usually ~/go/bin), where yamt looks too.",
      ]);
    case "download":
      return oneStep(hint.command, hint.needs === null ? [] : [`Needs ${hint.needs}.`]);
    case "system":
      return {
        reason: null,
        steps: [],
        notes: [`Install ${hint.program} with your system's package manager.`],
      };
    default: {
      const _exhaustive: never = hint;
      return _exhaustive;
    }
  }
}

export function installText(hint: InstallHint): InstallText {
  const vue = hint.kind === "node" && hint.reason.kind === "vue";
  return {
    ...hintParts(hint),
    otherWay: vue ? null : `Or install it any other way that puts ${hint.program} on your PATH.`,
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
