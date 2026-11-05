import {
  isUser,
  starterOf,
  turnOf,
  wroteIn,
  type OpenDiscussion,
  type Turn,
  type Viewer,
} from "./discussions";
import { ME_WORD, type Person } from "./filters";
import { knownMentions } from "./mentions";
import { displayName } from "./people";
import { peopleOnRow, type KnownPeople } from "./suggestions";

/** Request C2, in this order. */
export type PersonGroup = "turn" | "started" | "wrote" | "reviewer" | "other";
export const PERSON_GROUPS: readonly PersonGroup[] = [
  "turn",
  "started",
  "wrote",
  "reviewer",
  "other",
];

/** What a group needs of a merge request. */
export type PersonRow = {
  readonly author: Person | null;
  readonly reviewers: readonly { readonly person: Person }[];
};
export type PersonEntry<D extends OpenDiscussion, R extends PersonRow> = {
  readonly row: R;
  readonly discussion: D;
  readonly group: PersonGroup;
  /** turnOf with the person as the viewer. */
  readonly turn: Turn;
};

/** B2: a line of the person menu. */
export type PersonLine<P extends Person> = {
  readonly value: Viewer;
  readonly label: string;
  /** The person's picture holder; null for "Me" when no listed row or writer has the viewer. */
  readonly person: P | null;
  readonly chosen: boolean;
};

function turnAsViewer(discussion: OpenDiscussion, person: string | null, row: PersonRow): Turn {
  return turnOf(discussion, person, row.author?.username ?? null);
}

function groupAfter(
  turn: Turn,
  discussion: OpenDiscussion,
  person: string | null,
  row: PersonRow,
): PersonGroup {
  if (turn.kind === "viewer") {
    return "turn";
  }
  if (isUser(starterOf(discussion), person)) {
    return "started";
  }
  if (wroteIn(discussion, person)) {
    return "wrote";
  }
  return row.reviewers.some((reviewer) => isUser(reviewer.person, person)) ? "reviewer" : "other";
}

/** C2: the first group that applies; `person` a username, null: "other" always. */
export function personGroupOf(
  discussion: OpenDiscussion,
  person: string | null,
  row: PersonRow,
): PersonGroup {
  return groupAfter(turnAsViewer(discussion, person, row), discussion, person, row);
}

/** C1–C2: every discussion of every listed row, by group, then newest `last.createdAt` first; equal keys keep the input
 *  order (rows as listed, discussions as given). */
export function personEntries<D extends OpenDiscussion, R extends PersonRow>(
  listed: readonly { readonly row: R; readonly discussions: readonly D[] }[],
  person: string | null,
): readonly PersonEntry<D, R>[] {
  return listed
    .flatMap(({ row, discussions }) =>
      discussions.map((discussion): PersonEntry<D, R> => {
        const turn = turnAsViewer(discussion, person, row);
        return { row, discussion, group: groupAfter(turn, discussion, person, row), turn };
      }),
    )
    .toSorted((a, b) => {
      const groups = PERSON_GROUPS.indexOf(a.group) - PERSON_GROUPS.indexOf(b.group);
      return groups === 0 ? b.discussion.last.createdAt - a.discussion.last.createdAt : groups;
    });
}

/** D3: the comments after the first, oldest first: `[...earlier.slice(1), last]` when `earlier` is non-empty, else []. */
export function laterWriters<P extends Person>(discussion: {
  readonly earlier: readonly { readonly author: P | null }[];
  readonly last: { readonly author: P | null };
}): readonly (P | null)[] {
  if (discussion.earlier.length === 0) {
    return [];
  }
  return [...discussion.earlier.slice(1), discussion.last].map((comment) => comment.author);
}

/** D4: all when `writers.length <= fits`; else the newest `max(fits − 1, 0)` shown and the rest `folded` (the "+N"
 *  takes the first slot). `fits` < 1 counts as 1. */
export function foldedWriters<P>(
  writers: readonly P[],
  fits: number,
): { readonly folded: readonly P[]; readonly shown: readonly P[] } {
  if (writers.length <= Math.max(fits, 1)) {
    return { folded: [], shown: writers };
  }
  const cut = writers.length - Math.max(fits - 1, 0);
  return { folded: writers.slice(0, cut), shown: writers.slice(cut) };
}

/** B2: "Me" first when `me` is not null (label ME_WORD), then every other username once from `peopleOnRow` of `rows`
 *  and the non-null `writers`, by displayName (localeCompare "en"); value `person { username, name: displayName }`;
 *  `chosen` the line equal to `chosen` (a person whose username is `me` is Me). */
export function personLines<P extends Person>(
  rows: readonly KnownPeople<P>[],
  writers: readonly (P | null)[],
  me: string | null,
  chosen: Viewer,
): readonly PersonLine<P>[] {
  const known = knownMentions(null, [...rows.flatMap(peopleOnRow), ...writers]);
  const mine: readonly PersonLine<P>[] =
    me === null
      ? []
      : [
          {
            value: { kind: "me", username: me },
            label: ME_WORD,
            person: known.find((person) => person.username === me) ?? null,
            chosen: chosen.kind === "me" || chosen.username === me,
          },
        ];
  const others = known
    .filter((person) => person.username !== me)
    .map((person) => ({ person, label: displayName(person) }))
    .toSorted((a, b) => a.label.localeCompare(b.label, "en"))
    .map(({ person, label }): PersonLine<P> => ({
      value: { kind: "person", username: person.username, name: label },
      label,
      person,
      chosen: chosen.kind === "person" && chosen.username === person.username,
    }));
  return [...mine, ...others];
}
