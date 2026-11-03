import type { MergeRequestRow, PeopleGroup, Person } from "../ipc";
import { displayName, ME_WORD, peopleSuggestions, type Suggestion } from "../mergeRequests";
import type { NotDone, PeopleSearch, RowPeopleAsks } from "./mergeRequests";
import {
  NO_ONE_FOUND,
  peopleChangeText,
  peopleSearchText,
  SEARCHING_PEOPLE,
} from "./mergeRequestsText";

/** `working`: an add of this person to the group is queued or running. */
type PickState = "addable" | "already" | "working";

/** One line of the add field's list; `picture` is a person even for the viewer on no loaded row (initials). */
export type PickLine = {
  readonly username: string;
  readonly picture: Person;
  readonly label: string;
  readonly state: PickState;
};

/** `failed`: the note says why the search found nothing (a refusal or a thrown call), shown as an error. */
type PickNote = { readonly text: string; readonly failed: boolean };
export type PickList = { readonly lines: readonly PickLine[]; readonly note: PickNote | null };

export type PickInput = {
  readonly rows: readonly MergeRequestRow[];
  readonly row: MergeRequestRow;
  readonly group: PeopleGroup;
  readonly me: string | null;
  readonly search: PeopleSearch;
  readonly asks: RowPeopleAsks;
  readonly platform: string;
};

/** One group of one row's box, with that row's asks. */
export type GroupPlace = {
  readonly row: MergeRequestRow;
  readonly group: PeopleGroup;
  readonly asks: RowPeopleAsks;
  readonly platform: string;
};

export type PersonState = { readonly removing: boolean; readonly notices: readonly string[] };

type Shown = Omit<PickLine, "state">;

function usernamesIn(row: MergeRequestRow, group: PeopleGroup): readonly string[] {
  return group === "assignees"
    ? row.assignees.map((person) => person.username)
    : row.reviewers.map((reviewer) => reviewer.person.username);
}

function personShown(person: Person): Shown {
  return { username: person.username, picture: person, label: displayName(person) };
}

function suggestionShown(suggestion: Suggestion<Person>): Shown {
  if (suggestion.kind === "known") {
    return personShown(suggestion.person);
  }
  const { username, person } = suggestion;
  return { username, picture: person ?? { username, name: "", picture: null }, label: ME_WORD };
}

function shownOf(input: PickInput): {
  readonly shown: readonly Shown[];
  readonly note: PickNote | null;
} {
  const search = input.search;
  switch (search.kind) {
    case "empty":
      return {
        shown: peopleSuggestions(input.rows, input.row, input.group, input.me).map(suggestionShown),
        note: null,
      };
    case "searching":
      return {
        shown: search.people.map(personShown),
        note: { text: SEARCHING_PEOPLE, failed: false },
      };
    case "found":
      return {
        shown: search.people.map(personShown),
        note: search.people.length === 0 ? { text: NO_ONE_FOUND, failed: false } : null,
      };
    case "refused":
    case "failed":
      return {
        shown: [],
        note: { text: peopleSearchText(search, input.platform), failed: true },
      };
    default: {
      const _exhaustive: never = search;
      return _exhaustive;
    }
  }
}

/** The add field's list for `group`: the suggestions while the field is empty, else the search's people. */
export function pickList(input: PickInput): PickList {
  const { shown, note } = shownOf(input);
  const there = usernamesIn(input.row, input.group);
  function stateOf(username: string): PickState {
    const adding = input.asks.queue.some(
      (change) =>
        change.action === "add" && change.group === input.group && change.username === username,
    );
    if (adding) {
      return "working";
    }
    return there.includes(username) ? "already" : "addable";
  }
  return { lines: shown.map((line) => ({ ...line, state: stateOf(line.username) })), note };
}

function addableIndexes(lines: readonly PickLine[]): readonly number[] {
  return lines.flatMap((line, index) => (line.state === "addable" ? [index] : []));
}

export function firstAddable(lines: readonly PickLine[]): number | null {
  return addableIndexes(lines)[0] ?? null;
}

/** The highlight moved by `step` (1 down, -1 up) over the addable lines, wrapping; null when none is addable. */
export function steppedHighlight(
  lines: readonly PickLine[],
  current: number | null,
  step: number,
): number | null {
  const addable = addableIndexes(lines);
  const at = addable.findIndex((index) => index === current);
  const next = at === -1 ? (step > 0 ? 0 : addable.length - 1) : at + step + addable.length;
  return addable[next % addable.length] ?? null;
}

function linesKey(lines: readonly PickLine[]): string {
  return lines.map((line) => `${line.username} ${line.state}`).join("\n");
}

/** The highlight after the list was recomputed: kept while the lines and their states are the same, else the first
 *  addable line. */
export function keptHighlight(
  before: readonly PickLine[],
  after: readonly PickLine[],
  current: number | null,
): number | null {
  return linesKey(before) === linesKey(after) ? current : firstAddable(after);
}

/** How a notice names a person: their display name when the row names them anywhere, else `@username`. */
function noticeName(row: MergeRequestRow, username: string): string {
  const named = [
    ...(row.author === null ? [] : [row.author]),
    ...row.assignees,
    ...row.reviewers.map((reviewer) => reviewer.person),
    ...row.approvedBy,
  ].find((person) => person.username === username);
  return named === undefined ? `@${username}` : displayName(named);
}

/** The listed person a notice sits under: a remove's person while the group lists them, else null (the group). */
function noticeUnder(row: MergeRequestRow, notDone: NotDone): string | null {
  const { change } = notDone;
  return change.action === "remove" && usernamesIn(row, change.group).includes(change.username)
    ? change.username
    : null;
}

function noticesWhere(place: GroupPlace, under: string | null): readonly string[] {
  return place.asks.notDone
    .filter(
      (notDone) =>
        notDone.change.group === place.group && noticeUnder(place.row, notDone) === under,
    )
    .map((notDone) =>
      peopleChangeText(notDone, noticeName(place.row, notDone.change.username), place.platform),
    );
}

export function groupNotices(place: GroupPlace): readonly string[] {
  return noticesWhere(place, null);
}

export function personState(place: GroupPlace, username: string): PersonState {
  return {
    removing: place.asks.queue.some(
      (change) =>
        change.action === "remove" && change.group === place.group && change.username === username,
    ),
    notices: noticesWhere(place, username),
  };
}
