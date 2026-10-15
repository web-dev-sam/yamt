import type { InstallHint, PackageManager, PythonManager, ServerState } from "../lsp";
import { projectLabel } from "./serverText";

type InstallStep = { readonly label: string; readonly command: string };

export type InstallText = {
  readonly reason: string | null;
  readonly steps: readonly InstallStep[];
  readonly notes: readonly string[];
  readonly otherWay: string | null;
  readonly comeBack: string;
};

export type FailureHelp = { readonly lead: string; readonly install: InstallText };

type ManagerCommands = { readonly project: string; readonly global: string };

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

const PYTHON_NOTES: Readonly<Record<PythonManager, readonly string[]>> = {
  uv: [],
  poetry: [
    "yamt looks in the project's .venv, which Poetry uses only with virtualenvs.in-project set to true.",
  ],
  pdm: [],
};

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
    notes: hint.manager === null ? [SAME_WITH_YOUR_MANAGER] : PYTHON_NOTES[hint.manager],
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

function failedWhileStarting(state: ServerState): boolean {
  switch (state.kind) {
    case "failed":
      return state.reason.kind !== "noHost" && state.reason.kind !== "outsideRepository";
    case "crashed":
    case "stopped":
    case "starting":
    case "running":
    case "stopping":
    case "notInstalled":
      return false;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function failureHelp(state: ServerState, help: InstallHint | null): FailureHelp | null {
  return help !== null && failedWhileStarting(state)
    ? { lead: "If it is not installed:", install: installText(help) }
    : null;
}
