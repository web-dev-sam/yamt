import type { ShallowRef } from "vue";

import type { MergeRequestIid, MergeRequestSource, OpenReply, WebPage } from "../ipc";
import { claimRow, setRow } from "./mergeRequestActions";
import { pageProblemText, type PageKind } from "./mergeRequestsText";
import { attempt, type Problem } from "./problem";

export type Opening =
  | { readonly kind: "fetching" }
  | { readonly kind: "refused"; readonly reply: Exclude<OpenReply, { readonly kind: "opened" }> };

export type Pages = {
  readonly pageProblem: Readonly<ShallowRef<string | null>>;
  openChanges(iid: MergeRequestIid): Promise<void>;
  openPage(clicked: PageKind, page: WebPage): Promise<void>;
  dismissPageProblem(): void;
};

type State = {
  readonly source: MergeRequestSource;
  readonly report: (problem: Problem) => void;
  readonly openings: ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>;
  readonly pageProblem: ShallowRef<string | null>;
};

async function openChanges(state: State, iid: MergeRequestIid): Promise<void> {
  if (!claimRow(state.openings, iid, { kind: "fetching" })) {
    return;
  }
  const outcome = await attempt(() => state.source.openMergeRequest(iid));
  if (!outcome.ok) {
    setRow(state.openings, iid, null);
    state.report({ action: "mergeRequests", step: "open", cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  setRow(state.openings, iid, reply.kind === "opened" ? null : { kind: "refused", reply });
}

async function openPage(state: State, clicked: PageKind, page: WebPage): Promise<void> {
  const outcome = await attempt(() => state.source.openPage(page));
  if (!outcome.ok) {
    state.report({ action: "mergeRequests", step: clicked, cause: outcome.cause });
    return;
  }
  state.pageProblem.value = pageProblemText(outcome.value, clicked);
}

export function pagesOf(state: State): Pages {
  return {
    pageProblem: state.pageProblem,
    openChanges: (iid) => openChanges(state, iid),
    openPage: (clicked, page) => openPage(state, clicked, page),
    dismissPageProblem: () => {
      state.pageProblem.value = null;
    },
  };
}
