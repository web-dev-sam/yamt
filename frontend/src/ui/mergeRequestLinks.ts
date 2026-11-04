import { shallowRef, type ComputedRef, type ShallowRef } from "vue";

import {
  log,
  type DescriptionLinks,
  type LinksReply,
  type MergeRequestIid,
  type MergeRequestSource,
} from "../ipc";
import { setRow, useAskedRow } from "./mergeRequestActions";
import { attempt, type Outcome, type ProblemCause } from "./problem";

export type LinksLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "read"; readonly links: DescriptionLinks }
  | { readonly kind: "refused"; readonly reply: Exclude<LinksReply, { readonly kind: "read" }> }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type Links = {
  /** Each asked row's links while this list stands; no entry: not asked since the list was last replaced. */
  readonly links: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, LinksLoad>>>;
  /** A row's links box opened, or its Retry: asks GitLab unless the row's entry is loading or read. */
  askLinks(iid: MergeRequestIid): void;
};
export type LinkQueue = Links & {
  /** The list was replaced: every entry, every queued ask and any answer in flight are dropped. */
  dropped(): void;
};

type Queue = {
  readonly source: MergeRequestSource;
  readonly entries: ShallowRef<ReadonlyMap<MergeRequestIid, LinksLoad>>;
  /** The asks not sent yet, the newest first. */
  queued: readonly MergeRequestIid[];
  running: boolean;
  generation: number;
};

function loadOf(outcome: Outcome<LinksReply>): LinksLoad {
  if (!outcome.ok) {
    return { kind: "failed", cause: outcome.cause };
  }
  const reply = outcome.value;
  return reply.kind === "read" ? { kind: "read", links: reply.links } : { kind: "refused", reply };
}

function loggedFields(
  iid: MergeRequestIid,
  outcome: Outcome<LinksReply>,
  ms: number,
): Record<string, string | number> {
  const reply = outcome.ok ? outcome.value : null;
  const { epics, issues, commits } =
    reply?.kind === "read" ? reply.links : { epics: [], issues: [], commits: [] };
  const hidden =
    epics.filter((epic) => epic.shown === null).length +
    issues.filter((issue) => issue.shown === null).length +
    commits.filter((commit) => commit.title === null).length;
  return {
    iid,
    kind: reply?.kind ?? "thrown",
    epics: epics.length,
    issues: issues.length,
    commits: commits.length,
    hidden,
    ms,
  };
}

async function send(queue: Queue): Promise<void> {
  const [iid, ...rest] = queue.queued;
  if (queue.running || iid === undefined) {
    return;
  }
  queue.queued = rest;
  queue.running = true;
  const { generation } = queue;
  const started = performance.now();
  const outcome = await attempt(() => queue.source.readLinks(iid));
  queue.running = false;
  const ms = Math.round(performance.now() - started);
  log.info("mergeRequests.links_read", loggedFields(iid, outcome, ms));
  if (generation === queue.generation) {
    setRow(queue.entries, iid, loadOf(outcome));
  }
  await send(queue);
}

function asked(queue: Queue, iid: MergeRequestIid): void {
  const kind = queue.entries.value.get(iid)?.kind;
  if (kind === "loading" || kind === "read") {
    return;
  }
  setRow(queue.entries, iid, { kind: "loading" });
  queue.queued = [iid, ...queue.queued];
  void send(queue);
}

function dropped(queue: Queue): void {
  queue.generation += 1;
  queue.entries.value = new Map();
  queue.queued = [];
}

export function linksOf(queue: LinkQueue): Links {
  return {
    links: queue.links,
    askLinks: (iid) => {
      queue.askLinks(iid);
    },
  };
}

export function useRowLinks(
  links: Links,
  iid: () => MergeRequestIid,
  open: () => boolean,
): ComputedRef<LinksLoad | undefined> {
  return useAskedRow({
    rows: links.links,
    ask: (asked) => {
      links.askLinks(asked);
    },
    iid,
    open,
  });
}

export function createLinks(deps: { readonly source: MergeRequestSource }): LinkQueue {
  const queue: Queue = {
    source: deps.source,
    entries: shallowRef<ReadonlyMap<MergeRequestIid, LinksLoad>>(new Map()),
    queued: [],
    running: false,
    generation: 0,
  };
  return {
    links: queue.entries,
    askLinks: (iid) => {
      asked(queue, iid);
    },
    dropped: () => {
      dropped(queue);
    },
  };
}
