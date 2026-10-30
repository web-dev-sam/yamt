import type { Readiness } from "./readiness";

export type LocalMerge =
  | { readonly kind: "free" }
  | { readonly kind: "merging"; readonly iid: number; readonly windowOpen: boolean };

export type ActionRow = {
  readonly iid: number;
  readonly readiness: Readiness;
  readonly fromFork: boolean;
};

type ActionState =
  | { readonly kind: "enabled" }
  | { readonly kind: "running" }
  | { readonly kind: "disabled"; readonly hover: string };

export type RowAction =
  | { readonly kind: "none" }
  | { readonly kind: "resolve"; readonly label: string; readonly state: ActionState }
  | { readonly kind: "continue"; readonly label: string; readonly state: ActionState };

const ENABLED: ActionState = { kind: "enabled" };
const RUNNING: ActionState = { kind: "running" };

function disabled(hover: string): ActionState {
  return { kind: "disabled", hover };
}

function continueState(windowOpen: boolean, running: boolean): ActionState {
  if (windowOpen) {
    return disabled("Its merge window is already open");
  }
  return running ? RUNNING : ENABLED;
}

function resolveState(row: ActionRow, localMerge: LocalMerge, running: boolean): ActionState {
  if (row.fromFork) {
    return disabled("Resolving a fork's merge request is not supported");
  }
  if (localMerge.kind === "merging") {
    return disabled(`The merge of !${localMerge.iid} is not finished in this repository`);
  }
  return running ? RUNNING : ENABLED;
}

export function rowAction(row: ActionRow, localMerge: LocalMerge, running: boolean): RowAction {
  if (localMerge.kind === "merging" && localMerge.iid === row.iid) {
    return {
      kind: "continue",
      label: `Continue merging !${row.iid}`,
      state: continueState(localMerge.windowOpen, running),
    };
  }
  if (row.readiness.kind !== "conflicts") {
    return { kind: "none" };
  }
  return {
    kind: "resolve",
    label: `Resolve conflicts of !${row.iid}`,
    state: resolveState(row, localMerge, running),
  };
}
