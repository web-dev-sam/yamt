import type * as Generated from "./bindings";
import type { Difference } from "./compareDomain";
import {
  isAgentRun,
  isCheckoutFolder,
  type AgentRun,
  type CheckoutFolder,
  type HostEvent,
  type SourceResult,
} from "./domain";

export type AgentCommand = {
  readonly program: string;
  readonly args: readonly string[];
  readonly homeFolders: readonly string[];
};

export type AgentStartReply =
  | Exclude<Generated.AgentStartReply, { kind: "Started" }>
  | { readonly kind: "Started"; readonly run: AgentRun };

export type CheckoutReady =
  | { readonly kind: "Ready"; readonly folder: CheckoutFolder }
  | { readonly kind: "Failed"; readonly message: string };

type Look = Generated.CheckoutLook;

type InFolder<K extends Look["kind"]> = Readonly<Omit<Extract<Look, { kind: K }>, "folder">> & {
  readonly folder: CheckoutFolder;
};

export type CheckoutChanges =
  | Exclude<Look, { kind: "Changed" | "Unreadable" }>
  | InFolder<"Changed">
  | InFolder<"Unreadable">;

export interface AgentSource {
  prepareCheckout(): Promise<SourceResult<CheckoutReady>>;
  startAgent(
    command: AgentCommand,
    onEvent: (event: HostEvent) => void,
  ): Promise<SourceResult<AgentStartReply>>;
  /** Fire and forget; the app frames the line and a failure is logged. */
  sendToAgent(run: AgentRun, message: string): void;
  /** Signals the run (the app kills it 2 s later); its `Exited` event always follows. */
  stopAgent(run: AgentRun): Promise<void>;
  checkoutChanges(): Promise<SourceResult<CheckoutChanges>>;
  discardCheckout(): Promise<SourceResult<null>>;
  diffTexts(old: string, next: string): Promise<SourceResult<readonly Difference[]>>;
}

function toFolder(path: string): CheckoutFolder {
  if (!isCheckoutFolder(path)) {
    throw new Error(`folder must be an absolute path, got ${path}`);
  }
  return path;
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

export function toCheckoutChanges(dto: Look): CheckoutChanges {
  switch (dto.kind) {
    case "Missing":
    case "Clean":
      return dto;
    case "Changed":
      return { ...dto, folder: toFolder(dto.folder) };
    case "Unreadable":
      return { ...dto, folder: toFolder(dto.folder) };
    default: {
      const _exhaustive: never = dto;
      return _exhaustive;
    }
  }
}
