import type * as Generated from "./bindings";
import { isAgentRun, isCheckoutFolder, type AgentRun, type CheckoutFolder } from "./domain";

export type AgentCommand = {
  readonly program: string;
  readonly args: readonly string[];
  readonly homeFolders: readonly string[];
};

export type AgentStartReply =
  | { readonly kind: "Started"; readonly run: AgentRun }
  | { readonly kind: "NotFound"; readonly program: string; readonly searched: readonly string[] }
  | { readonly kind: "SpawnFailed"; readonly program: string; readonly message: string }
  | { readonly kind: "NoCheckout" };

export type CheckoutReady =
  | { readonly kind: "Ready"; readonly folder: CheckoutFolder }
  | { readonly kind: "Failed"; readonly message: string };

/** The AI's refs: Rust's `branches_and_stash` sends `%(refname:short)`, so `refs/stash` arrives as `stash`. */
type AiRefs = { readonly branches: readonly string[]; readonly stash: boolean };

export type CheckoutChanges =
  | { readonly kind: "Missing" }
  | { readonly kind: "Clean" }
  | {
      readonly kind: "Changed";
      readonly folder: CheckoutFolder;
      readonly files: readonly string[];
      readonly refs: AiRefs;
      readonly headMoved: boolean;
    }
  | { readonly kind: "Unreadable"; readonly folder: CheckoutFolder; readonly message: string };

const STASH = "stash";

function toFolder(path: string): CheckoutFolder {
  if (!isCheckoutFolder(path)) {
    throw new Error(`folder must be an absolute path, got ${path}`);
  }
  return path;
}

function toAiRefs(names: readonly string[]): AiRefs {
  return { branches: names.filter((name) => name !== STASH), stash: names.includes(STASH) };
}

export function fromAgentCommand(command: AgentCommand): Generated.AgentCommand {
  return {
    program: command.program,
    args: [...command.args],
    home_folders: [...command.homeFolders],
  };
}

export function toAgentStartReply(dto: Generated.AgentStartReply): AgentStartReply {
  if (dto.kind !== "Started") {
    return dto;
  }
  const { run } = dto;
  if (!isAgentRun(run)) {
    throw new Error(`run must be a non-negative safe integer, got ${run}`);
  }
  return { kind: "Started", run };
}

export function toCheckoutReady(dto: Generated.CheckoutReply): CheckoutReady {
  return dto.kind === "Ready" ? { kind: "Ready", folder: toFolder(dto.folder) } : dto;
}

export function toCheckoutChanges(dto: Generated.CheckoutLook): CheckoutChanges {
  switch (dto.kind) {
    case "Missing":
    case "Clean":
      return { kind: dto.kind };
    case "Changed": {
      const { files, refs, head_moved: headMoved } = dto;
      return {
        kind: "Changed",
        folder: toFolder(dto.folder),
        files,
        refs: toAiRefs(refs),
        headMoved,
      };
    }
    case "Unreadable":
      return { kind: "Unreadable", folder: toFolder(dto.folder), message: dto.message };
    default: {
      const _exhaustive: never = dto;
      return _exhaustive;
    }
  }
}
