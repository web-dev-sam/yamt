import { byCountThenLabel, peopleOf } from "./choices";
import type { Person } from "./filters";
import { displayName } from "./people";

/** GitLab's autocomplete answers at most 20 (`Autocomplete::UsersFinder::LIMIT`); the empty field shows as many. */
export const SUGGESTED_PEOPLE = 20;

/** A row's people as the suggestions read them; the window's `MergeRequestRow` fits it. */
export type KnownPeople<P extends Person> = {
  readonly author: P | null;
  readonly assignees: readonly P[];
  readonly reviewers: readonly { readonly person: P }[];
  readonly approvedBy: readonly P[];
};

export type Suggestion<P extends Person> =
  /** The viewer: `person` is their entry on `row` or a loaded row when there is one, else null (initials). */
  | { readonly kind: "me"; readonly username: string; readonly person: P | null }
  | { readonly kind: "known"; readonly person: P };

function peopleOnRow<P extends Person>(row: KnownPeople<P>): readonly P[] {
  return [
    ...(row.author === null ? [] : [row.author]),
    ...row.assignees,
    ...row.reviewers.map((reviewer) => reviewer.person),
    ...row.approvedBy,
  ];
}

/**
 * What the empty add field offers for `group` of `row` (rule 2), each username once, at most SUGGESTED_PEOPLE:
 * 1. Me, when `me` is not null.
 * 2. `row`'s own people: its author, assignees, reviewers, then approvers, in that order.
 * 3. Every other person on `rows` (authors, assignees, reviewers, approvers), most rows holding them in `group` first
 *    (the count rule of `choices.ts` `peopleOf`), then by display name (`byCountThenLabel`).
 * People already in `group` are kept: the page marks them.
 */
export function peopleSuggestions<P extends Person>(
  rows: readonly KnownPeople<P>[],
  row: KnownPeople<P>,
  group: "assignees" | "reviewers",
  me: string | null,
): readonly Suggestion<P>[] {
  const own = new Map<string, P>(peopleOnRow(row).map((person) => [person.username, person]));
  const counts = peopleOf(rows, group);
  const loaded = new Map<string, P>(
    rows.flatMap(peopleOnRow).map((person) => [person.username, person]),
  );
  const others = [...loaded.values()]
    .filter((person) => !own.has(person.username))
    .map((person) => ({
      person,
      label: displayName(person),
      count: counts.get(person.username)?.count ?? 0,
    }))
    .toSorted(byCountThenLabel)
    .map(({ person }) => person);
  const known = [...own.values(), ...others]
    .filter((person) => person.username !== me)
    .map((person): Suggestion<P> => ({ kind: "known", person }));
  const viewer: readonly Suggestion<P>[] =
    me === null
      ? []
      : [
          {
            kind: "me",
            username: me,
            person: own.get(me) ?? others.find((person) => person.username === me) ?? null,
          },
        ];
  return [...viewer, ...known].slice(0, SUGGESTED_PEOPLE);
}

/** The text GitLab is asked for: trimmed, one leading "@" dropped, trimmed again; "" means the empty field. */
export function searchedText(typed: string): string {
  const trimmed = typed.trim();
  return (trimmed.startsWith("@") ? trimmed.slice(1) : trimmed).trim();
}
