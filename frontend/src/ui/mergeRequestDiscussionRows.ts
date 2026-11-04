import type { ComputedRef, ShallowRef } from "vue";

import type {
  DiscussionDetails,
  DiscussionId,
  DiscussionsAnswer,
  MergeRequestIid,
  OpenDiscussion,
  RowDiscussions,
} from "../ipc";
import { setRow, useAskedRow } from "./mergeRequestActions";
import type { Outcome, ProblemCause } from "./problem";

export type DiscussionLoad =
  | { readonly kind: "loading" }
  | {
      readonly kind: "read";
      readonly discussions: readonly OpenDiscussion[];
      /** Resolved through the panel since this answer: shown marked until the box closes (C10). */
      readonly resolved: ReadonlySet<DiscussionId>;
    }
  | {
      readonly kind: "refused";
      readonly answer: Exclude<DiscussionsAnswer, { readonly kind: "open" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type DiscussionFailure = Extract<DiscussionLoad, { readonly kind: "refused" | "failed" }>;
export type Answered = Exclude<DiscussionLoad, { readonly kind: "loading" }>;
/** A row's reload (D1): running, or why its answer was not taken (the old entry stays, D2). */
export type Reload = { readonly kind: "running" } | DiscussionFailure;
export type Discussions = {
  /** Each asked row's discussions while this list stands; no entry: not asked, or (count 0) none open. */
  readonly discussions: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>>;
  /** Settings' "Discussion details" in use. */
  readonly discussionDetails: ComputedRef<DiscussionDetails>;
  /** A count's box opened: with "lazy", asks this row first unless it has an entry; else nothing. */
  askDiscussions(iid: MergeRequestIid): void;
  readonly reloads: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, Reload>>>;
  /** A thread's answer (C8.3, C10): `discussion` replaces the entry's discussion with its id (none: nothing);
   *  `resolved` adds or removes its mark. Nothing for an entry that is not `read`. */
  threadRead(iid: MergeRequestIid, discussion: OpenDiscussion, resolved: boolean): void;
  /** C10: the box of `iid` closed: marked discussions leave its entry, and the row's count becomes the rest. */
  boxClosed(iid: MergeRequestIid): void;
};

export function loadOf(answer: DiscussionsAnswer): Answered {
  return answer.kind === "open"
    ? { kind: "read", discussions: answer.discussions, resolved: new Set() }
    : { kind: "refused", answer };
}

export function answerKind(load: Answered): string {
  switch (load.kind) {
    case "read":
      return "open";
    case "refused":
      return load.answer.kind;
    case "failed":
      return load.cause.kind;
    default: {
      const _exhaustive: never = load;
      return _exhaustive;
    }
  }
}

export function loggedFields(
  asked: number,
  outcome: Outcome<readonly RowDiscussions[]>,
  ms: number,
): Record<string, string | number> {
  if (!outcome.ok) {
    return { asked, failed: outcome.cause.kind, ms };
  }
  const refused = outcome.value.filter((row) => row.answer.kind !== "open").length;
  return { asked, answered: outcome.value.length, refused, ms };
}

type Entries = ShallowRef<ReadonlyMap<MergeRequestIid, DiscussionLoad>>;

export function threadRead(
  entries: Entries,
  iid: MergeRequestIid,
  discussion: OpenDiscussion,
  resolved: boolean,
): void {
  const entry = entries.value.get(iid);
  if (entry?.kind !== "read" || !entry.discussions.some((each) => each.id === discussion.id)) {
    return;
  }
  const marks = new Set(entry.resolved);
  if (resolved) {
    marks.add(discussion.id);
  } else {
    marks.delete(discussion.id);
  }
  const discussions = entry.discussions.map((each) =>
    each.id === discussion.id ? discussion : each,
  );
  setRow(entries, iid, { kind: "read", discussions, resolved: marks });
}

export function boxClosed(
  entries: Entries,
  iid: MergeRequestIid,
  counted: (iid: MergeRequestIid, count: number) => void,
): void {
  const entry = entries.value.get(iid);
  if (entry?.kind !== "read" || entry.resolved.size === 0) {
    return;
  }
  const discussions = entry.discussions.filter((each) => !entry.resolved.has(each.id));
  setRow(entries, iid, { kind: "read", discussions, resolved: new Set<DiscussionId>() });
  counted(iid, discussions.length);
}

export function useRowDiscussions(
  discussions: Pick<Discussions, "discussions" | "askDiscussions">,
  iid: () => MergeRequestIid,
  open: () => boolean,
): ComputedRef<DiscussionLoad | undefined> {
  return useAskedRow({
    rows: discussions.discussions,
    ask: (asked) => {
      discussions.askDiscussions(asked);
    },
    iid,
    open,
  });
}
