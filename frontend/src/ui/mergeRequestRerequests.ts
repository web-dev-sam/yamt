import { shallowRef, type ShallowRef } from "vue";

import type { MergeRequestIid, MergeRequestSource, RerequestReply, Reviewer } from "../ipc";
import { setRow } from "./mergeRequestActions";
import { attempt, type Problem } from "./problem";

export type RerequestAsk =
  | { readonly kind: "running" }
  | {
      readonly kind: "refused";
      readonly reply: Exclude<RerequestReply, { readonly kind: "requested" }>;
    };

type Asks = ShallowRef<ReadonlyMap<MergeRequestIid, ReadonlyMap<string, RerequestAsk>>>;

export type Rerequests = {
  readonly rerequests: Readonly<Asks>;
  rerequestReview(iid: MergeRequestIid, username: string): Promise<void>;
  dismissRerequestRefusals(iid: MergeRequestIid): void;
};

type Deps = {
  readonly source: MergeRequestSource;
  readonly report: (problem: Problem) => void;
  readonly replaced: (iid: MergeRequestIid, reviewers: readonly Reviewer[]) => void;
};

function setAsk(
  asks: Asks,
  iid: MergeRequestIid,
  username: string,
  ask: RerequestAsk | null,
): void {
  const row = new Map(asks.value.get(iid));
  if (ask === null) {
    row.delete(username);
  } else {
    row.set(username, ask);
  }
  setRow(asks, iid, row.size === 0 ? null : row);
}

async function rerequestReview(
  deps: Deps,
  asks: Asks,
  iid: MergeRequestIid,
  username: string,
): Promise<void> {
  if (asks.value.get(iid)?.get(username)?.kind === "running") {
    return;
  }
  setAsk(asks, iid, username, { kind: "running" });
  const outcome = await attempt(() => deps.source.rerequestReview(iid, username));
  if (!outcome.ok) {
    setAsk(asks, iid, username, null);
    deps.report({ action: "mergeRequests", step: "rerequestReview", cause: outcome.cause });
    return;
  }
  const reply = outcome.value;
  if (reply.kind === "requested") {
    deps.replaced(iid, reply.reviewers);
    setAsk(asks, iid, username, null);
    return;
  }
  setAsk(asks, iid, username, { kind: "refused", reply });
}

function dismissRefusals(asks: Asks, iid: MergeRequestIid): void {
  const running = [...(asks.value.get(iid) ?? [])].filter(([, ask]) => ask.kind === "running");
  setRow(asks, iid, running.length === 0 ? null : new Map(running));
}

export function createRerequests(deps: Deps): Rerequests {
  const asks: Asks = shallowRef(new Map());
  return {
    rerequests: asks,
    rerequestReview: (iid, username) => rerequestReview(deps, asks, iid, username),
    dismissRerequestRefusals: (iid) => {
      dismissRefusals(asks, iid);
    },
  };
}
