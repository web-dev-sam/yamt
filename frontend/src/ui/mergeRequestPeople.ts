import { shallowRef, type ShallowRef } from "vue";

import type {
  MergeRequestIid,
  MergeRequestPeople,
  MergeRequestSource,
  PeopleChange,
  PeopleChangeReply,
  PeopleSearchReply,
  Person,
} from "../ipc";
import { searchedText } from "../mergeRequests";
import { setRow } from "./mergeRequestActions";
import { attempt, type Outcome, type ProblemCause } from "./problem";

// GitLab's DEFAULT_DEBOUNCE_AND_THROTTLE_MS (app/assets/javascripts/lib/utils/constants.js), design §1.1.
export const SEARCH_PAUSE_MS = 250;

export type PeopleSearch =
  | { readonly kind: "empty" }
  /** Asked or waiting for the pause; `people` are the last answer's, still shown ([] at first). */
  | { readonly kind: "searching"; readonly text: string; readonly people: readonly Person[] }
  | { readonly kind: "found"; readonly text: string; readonly people: readonly Person[] }
  | {
      readonly kind: "refused";
      readonly text: string;
      readonly reply: Exclude<PeopleSearchReply, { kind: "found" }>;
    }
  | { readonly kind: "failed"; readonly text: string; readonly cause: ProblemCause };

export type PeopleChangeFailure =
  | { readonly kind: "unchanged" }
  | {
      readonly kind: "refused";
      readonly reply: Exclude<PeopleChangeReply, { kind: "changed" | "unchanged" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type NotDone = { readonly change: PeopleChange; readonly why: PeopleChangeFailure };
/** One merge request's changes: `queue[0]` is the one GitLab is answering, the rest wait in order (rule 4);
 *  `notDone` the changes GitLab did not make, until the box closes (rule 6). */
export type RowPeopleAsks = {
  readonly queue: readonly PeopleChange[];
  readonly notDone: readonly NotDone[];
};

export type PeopleChanges = {
  readonly peopleSearch: Readonly<ShallowRef<PeopleSearch>>;
  readonly peopleAsks: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, RowPeopleAsks>>>;
  /** core searchedText(typed) "" → empty at once; else searching, asked SEARCH_PAUSE_MS after the last call. */
  searchPeople(typed: string): void;
  /** empty; a pending or running search's answer is dropped. */
  endPeopleSearch(): void;
  /** Queues `change` (an equal one already queued: nothing); settles when it is answered. */
  changePeople(iid: MergeRequestIid, change: PeopleChange): Promise<void>;
  /** Request rule 9 (the owner's answer, board item 2246): the rows whose people box is open. */
  readonly openPeopleBoxes: Readonly<ShallowRef<ReadonlySet<MergeRequestIid>>>;
  /** The box of row `iid` opened: the row stays shown while it is open. */
  peopleBoxOpened(iid: MergeRequestIid): void;
  /** The box of row `iid` closed (or unmounted while open): the row is released and its notDone dropped; its
   *  queue stays. */
  peopleBoxClosed(iid: MergeRequestIid): void;
};

type Deps = {
  readonly source: MergeRequestSource;
  readonly replaced: (iid: MergeRequestIid, people: MergeRequestPeople) => void;
};

type Asks = ShallowRef<ReadonlyMap<MergeRequestIid, RowPeopleAsks>>;

const EMPTY: PeopleSearch = { kind: "empty" };
const NO_ASKS: RowPeopleAsks = { queue: [], notDone: [] };

function shownPeople(search: PeopleSearch): readonly Person[] {
  return search.kind === "searching" || search.kind === "found" ? search.people : [];
}

function searchAnswer(text: string, outcome: Outcome<PeopleSearchReply>): PeopleSearch {
  if (!outcome.ok) {
    return { kind: "failed", text, cause: outcome.cause };
  }
  const reply = outcome.value;
  return reply.kind === "found"
    ? { kind: "found", text, people: reply.people }
    : { kind: "refused", text, reply };
}

function searchOf(
  source: MergeRequestSource,
): Pick<PeopleChanges, "peopleSearch" | "searchPeople" | "endPeopleSearch"> {
  const search = shallowRef<PeopleSearch>(EMPTY);
  let calls = 0;
  async function ask(text: string): Promise<void> {
    const sent = calls;
    const outcome = await attempt(() => source.searchPeople(text));
    if (sent === calls) {
      search.value = searchAnswer(text, outcome);
    }
  }
  let pause: number | undefined;
  function stop(): void {
    clearTimeout(pause);
    calls += 1;
  }
  return {
    peopleSearch: search,
    searchPeople: (typed) => {
      stop();
      const text = searchedText(typed);
      if (text === "") {
        search.value = EMPTY;
        return;
      }
      search.value = { kind: "searching", text, people: shownPeople(search.value) };
      pause = setTimeout(() => void ask(text), SEARCH_PAUSE_MS);
    },
    endPeopleSearch: () => {
      stop();
      search.value = EMPTY;
    },
  };
}

function samePerson(one: PeopleChange, other: PeopleChange): boolean {
  return one.group === other.group && one.username === other.username;
}

function setAsks(asks: Asks, iid: MergeRequestIid, row: RowPeopleAsks): void {
  setRow(asks, iid, row.queue.length === 0 && row.notDone.length === 0 ? null : row);
}

function failureOf(outcome: Outcome<PeopleChangeReply>): PeopleChangeFailure | null {
  if (!outcome.ok) {
    return { kind: "failed", cause: outcome.cause };
  }
  const reply = outcome.value;
  if (reply.kind !== "changed" && reply.kind !== "unchanged") {
    return { kind: "refused", reply };
  }
  return reply.kind === "changed" ? null : { kind: "unchanged" };
}

async function answer(
  deps: Deps,
  asks: Asks,
  iid: MergeRequestIid,
  change: PeopleChange,
): Promise<void> {
  const outcome = await attempt(() => deps.source.changePeople(iid, change));
  if (outcome.ok && (outcome.value.kind === "changed" || outcome.value.kind === "unchanged")) {
    deps.replaced(iid, outcome.value.people);
  }
  const why = failureOf(outcome);
  const row = asks.value.get(iid) ?? NO_ASKS;
  setAsks(asks, iid, {
    queue: row.queue.filter((queued) => queued !== change),
    notDone: why === null ? row.notDone : [...row.notDone, { change, why }],
  });
}

function changesOf(deps: Deps, asks: Asks): Pick<PeopleChanges, "changePeople"> {
  const lastTurns = new Map<MergeRequestIid, Promise<void>>();
  return {
    changePeople: (iid, change) => {
      const row = asks.value.get(iid) ?? NO_ASKS;
      if (
        row.queue.some((queued) => samePerson(queued, change) && queued.action === change.action)
      ) {
        return Promise.resolve();
      }
      setAsks(asks, iid, {
        queue: [...row.queue, change],
        notDone: row.notDone.filter((notDone) => !samePerson(notDone.change, change)),
      });
      const before = lastTurns.get(iid) ?? Promise.resolve();
      const turn = before.then(() => answer(deps, asks, iid, change));
      lastTurns.set(iid, turn);
      return turn;
    },
  };
}

function boxesOf(
  asks: Asks,
): Pick<PeopleChanges, "openPeopleBoxes" | "peopleBoxOpened" | "peopleBoxClosed"> {
  const open = shallowRef<ReadonlySet<MergeRequestIid>>(new Set());
  return {
    openPeopleBoxes: open,
    peopleBoxOpened: (iid) => {
      open.value = new Set(open.value).add(iid);
    },
    peopleBoxClosed: (iid) => {
      const left = new Set(open.value);
      left.delete(iid);
      open.value = left;
      setAsks(asks, iid, { queue: asks.value.get(iid)?.queue ?? [], notDone: [] });
    },
  };
}

export function createPeopleChanges(deps: Deps): PeopleChanges {
  const asks: Asks = shallowRef(new Map());
  return {
    ...searchOf(deps.source),
    peopleAsks: asks,
    ...changesOf(deps, asks),
    ...boxesOf(asks),
  };
}
