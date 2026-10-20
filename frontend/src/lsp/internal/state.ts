import type { StartReply } from "../../ipc";
import type { InstallHint, ServerKey, ServerSpec, SpecNote } from "./spec";

export type FailReason =
  | { readonly kind: "notFound"; readonly program: string; readonly searched: readonly string[] }
  | { readonly kind: "spawnFailed"; readonly message: string }
  | { readonly kind: "initializeFailed"; readonly message: string }
  | { readonly kind: "timedOut" }
  | { readonly kind: "exited"; readonly code: number | null }
  | { readonly kind: "noHost" }
  | { readonly kind: "outsideRepository"; readonly project: string };

export type ServerState =
  | { readonly kind: "stopped" }
  | { readonly kind: "starting" }
  | { readonly kind: "running" }
  | { readonly kind: "stopping" }
  | { readonly kind: "crashed"; readonly code: number | null }
  | { readonly kind: "failed"; readonly reason: FailReason }
  | { readonly kind: "notInstalled"; readonly hint: InstallHint };

export type ServerView = {
  readonly key: ServerKey;
  readonly name: string;
  readonly project: string;
  readonly state: ServerState;
  readonly help: InstallHint | null;
  readonly notes: readonly SpecNote[];
};

export type RestState = Extract<
  ServerState,
  { readonly kind: "stopped" | "crashed" | "failed" | "notInstalled" }
>;

export type StartFailure = Exclude<FailReason, { readonly kind: "noHost" }>;

export function stateAtRest(spec: ServerSpec, hasHost: boolean): RestState {
  if (!hasHost) {
    return { kind: "failed", reason: { kind: "noHost" } };
  }
  return spec.install === null ? { kind: "stopped" } : { kind: "notInstalled", hint: spec.install };
}

export function startFailure(reply: Exclude<StartReply, { kind: "Started" }>): StartFailure {
  switch (reply.kind) {
    case "NotFound":
      return { kind: "notFound", program: reply.program, searched: reply.searched };
    case "SpawnFailed":
      return { kind: "spawnFailed", message: reply.message };
    case "OutsideRepository":
      return { kind: "outsideRepository", project: reply.project };
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

export function failText(reason: StartFailure): string {
  switch (reason.kind) {
    case "notFound":
      return `Not found: ${reason.program} (searched ${reason.searched.join(", ")})`;
    case "spawnFailed":
      return `Could not start: ${reason.message}`;
    case "initializeFailed":
      return `Initialize failed: ${reason.message}`;
    case "timedOut":
      return "Stopped: the server did not answer initialize";
    case "exited":
      return reason.code === null
        ? "Stopped while starting: exited"
        : `Stopped while starting: exited with code ${reason.code}`;
    case "outsideRepository":
      return `The project folder ${reason.project} is outside the repository`;
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}
