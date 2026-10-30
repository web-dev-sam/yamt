import { shallowRef, type ShallowRef } from "vue";

import type {
  ContinueMergeReply,
  LocalMerge,
  MergeRequestIid,
  MergeRequestSource,
  ResolveReply,
  SourceResult,
} from "../ipc";
import { attempt, type Problem } from "./problem";

export type RowReply =
  | { readonly kind: "resolve"; readonly reply: ResolveReply }
  | { readonly kind: "continue"; readonly reply: ContinueMergeReply };

export type RowActing =
  | { readonly kind: "running" }
  | { readonly kind: "replied"; readonly reply: RowReply };

export type RowActions = {
  readonly actions: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, RowActing>>>;
  readonly localMerge: Readonly<ShallowRef<LocalMerge>>;
  resolve(iid: MergeRequestIid): Promise<void>;
  continueMerge(iid: MergeRequestIid): Promise<void>;
  checkLocalMerge(): Promise<void>;
};

type Deps = {
  readonly source: MergeRequestSource;
  readonly report: (problem: Problem) => void;
};

type State = Deps & {
  readonly actions: ShallowRef<ReadonlyMap<MergeRequestIid, RowActing>>;
  readonly localMerge: ShallowRef<LocalMerge>;
};

async function asked(
  source: MergeRequestSource,
  kind: RowReply["kind"],
  iid: MergeRequestIid,
): Promise<SourceResult<RowReply>> {
  switch (kind) {
    case "resolve": {
      const result = await source.resolveMergeRequest(iid);
      return result.ok ? { ok: true, value: { kind, reply: result.value } } : result;
    }
    case "continue": {
      const result = await source.continueMergeRequest(iid);
      return result.ok ? { ok: true, value: { kind, reply: result.value } } : result;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function setActing(state: State, iid: MergeRequestIid, acting: RowActing | null): void {
  const actions = new Map(state.actions.value);
  if (acting === null) {
    actions.delete(iid);
  } else {
    actions.set(iid, acting);
  }
  state.actions.value = actions;
}

async function checkLocalMerge(state: State): Promise<void> {
  const outcome = await attempt(() => state.source.findLocalMerge());
  if (outcome.ok) {
    state.localMerge.value = outcome.value;
  } else {
    state.report({ action: "mergeRequests", step: "localMerge", cause: outcome.cause });
  }
}

async function act(state: State, kind: RowReply["kind"], iid: MergeRequestIid): Promise<void> {
  if (state.actions.value.get(iid)?.kind === "running") {
    return;
  }
  setActing(state, iid, { kind: "running" });
  const outcome = await attempt(() => asked(state.source, kind, iid));
  if (!outcome.ok) {
    setActing(state, iid, null);
    state.report({ action: "mergeRequests", step: kind, cause: outcome.cause });
    return;
  }
  setActing(state, iid, { kind: "replied", reply: outcome.value });
  await checkLocalMerge(state);
}

export function createRowActions(deps: Deps): RowActions {
  const state: State = {
    ...deps,
    actions: shallowRef<ReadonlyMap<MergeRequestIid, RowActing>>(new Map()),
    localMerge: shallowRef<LocalMerge>({ kind: "free" }),
  };
  return {
    actions: state.actions,
    localMerge: state.localMerge,
    resolve: (iid) => act(state, "resolve", iid),
    continueMerge: (iid) => act(state, "continue", iid),
    checkLocalMerge: () => checkLocalMerge(state),
  };
}
