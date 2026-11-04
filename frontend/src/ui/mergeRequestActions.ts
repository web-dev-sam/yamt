import { computed, shallowRef, watch, type ComputedRef, type ShallowRef } from "vue";

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

type Rows<V> = ShallowRef<ReadonlyMap<MergeRequestIid, V>>;

export function setRow<V>(rows: Rows<V>, iid: MergeRequestIid, value: V | null): void {
  const next = new Map(rows.value);
  if (value === null) {
    next.delete(iid);
  } else {
    next.set(iid, value);
  }
  rows.value = next;
}

export function claimRow<V extends { readonly kind: string }>(
  rows: Rows<V>,
  iid: MergeRequestIid,
  busy: V,
): boolean {
  if (rows.value.get(iid)?.kind === busy.kind) {
    return false;
  }
  setRow(rows, iid, busy);
  return true;
}

/** A row's box: its row's entry, asked whenever the box opens or loses the entry while open. */
export function useAskedRow<V>(box: {
  readonly rows: Readonly<Rows<V>>;
  readonly ask: (iid: MergeRequestIid) => void;
  readonly iid: () => MergeRequestIid;
  readonly open: () => boolean;
}): ComputedRef<V | undefined> {
  const load = computed(() => box.rows.value.get(box.iid()));
  watch([box.open, () => load.value === undefined], ([isOpen]) => {
    if (isOpen) {
      box.ask(box.iid());
    }
  });
  return load;
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
  if (!claimRow(state.actions, iid, { kind: "running" })) {
    return;
  }
  const outcome = await attempt(() => asked(state.source, kind, iid));
  if (!outcome.ok) {
    setRow(state.actions, iid, null);
    state.report({ action: "mergeRequests", step: kind, cause: outcome.cause });
    return;
  }
  setRow(state.actions, iid, { kind: "replied", reply: outcome.value });
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
