import type { Attempt } from "./attempt";
import type { Capabilities } from "./handshake";
import type { ServerDocs } from "./serverDocs";
import type { RestState, ServerState } from "./state";

export type Run =
  | { readonly kind: "idle"; readonly attempt: null; readonly state: RestState }
  | { readonly kind: "launching"; readonly attempt: null }
  | { readonly kind: "starting"; readonly attempt: Attempt }
  | {
      readonly kind: "running";
      readonly attempt: Attempt;
      readonly docs: ServerDocs;
      readonly capabilities: Capabilities;
    }
  | {
      readonly kind: "halting";
      readonly attempt: null;
      readonly done: Promise<void>;
      startAfter: boolean;
    };

export type Halting = Extract<Run, { readonly kind: "halting" }>;

export type Running = Extract<Run, { readonly kind: "running" }>;

export const STOPPED: Run = { kind: "idle", attempt: null, state: { kind: "stopped" } };

const STARTING: ServerState = { kind: "starting" };
const RUNNING: ServerState = { kind: "running" };
const STOPPING: ServerState = { kind: "stopping" };

export function stateOf(run: Run): ServerState {
  switch (run.kind) {
    case "idle":
      return run.state;
    case "launching":
    case "starting":
      return STARTING;
    case "running":
      return RUNNING;
    case "halting":
      return STOPPING;
    default: {
      const _exhaustive: never = run;
      return _exhaustive;
    }
  }
}
