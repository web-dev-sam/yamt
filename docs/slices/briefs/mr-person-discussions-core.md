# Slice mr-person-discussions-core — the five groups, held entries, the writers row and its fold, the person lines (pure core)

Feature: one person's discussions across every merge request. Sources:

- Request `docs/slices/request-mr-person-discussions.md` B2, C2, C3, D3, D4 and the acceptance's "Core tests" sentence.
- Design `docs/slices/briefs/mr-person-discussions-design.md` option A §2.4; proposed plan row #193, RK77.

Runs in round 1, in parallel with `mr-person-discussions-rust` and `mr-person-discussions-threads`. It wires no window.

Facts (given):

- `mergeRequests/` is framework-free and self-contained (PM3); `index.ts` is its only surface (`mergeRequests/AGENTS.md:3`).
- `internal/discussions.ts`: `OpenDiscussion` is structural (`place`, `earlier: TurnComment[]`, `last: DiscussionNote`;
  `:4-20`); `turnOf(discussion, viewer, author)` (`:114-124`) gives `{ kind: "viewer" }` for B2 with B1 false; private
  `isUser` (`:58-60`), `starterOf` (`:66-68`, `(earlier[0] ?? last).author`), `wroteIn` (`:80-82`). `Viewer` is
  `me { username | null }` | `person { username, name }` (`:38-40`).
- `internal/suggestions.ts:9-28`: `KnownPeople<P>` (`author`, `assignees`, `reviewers[].person`, `approvedBy`) and
  `peopleOnRow(row)` (exported).
- `internal/filters.ts:25, 43`: `Person { username, name }`, `ME_WORD` "Me"; `internal/people.ts` `displayName`.
- `internal/choices.ts:146-149`: `narrowed<V>(choices: readonly Choice<V>[], typed)` reads only `label`.
- `ui/mergeRequestsShown.ts:98-115`: the window's `keptInPlace(previous, next, held)` for rows by iid (it moves here;
  `mr-person-discussions-state` migrates its caller).

## Target

**Owned:**

- `frontend/src/mergeRequests/internal/personDiscussions.ts` (new), `…/personDiscussions.test.ts` (new)
- `frontend/src/mergeRequests/internal/keptInPlace.ts` (new), `…/keptInPlace.test.ts` (new)
- `frontend/src/mergeRequests/internal/discussions.ts` (export `starterOf` and `wroteIn`, no behaviour change)
- `frontend/src/mergeRequests/internal/choices.ts` (`narrowed` generic over `{ label }`, no behaviour change)
- `frontend/src/mergeRequests/index.ts`, `frontend/src/mergeRequests/AGENTS.md`

**Read-only:** everything else (`ui/mergeRequestsShown.ts` keeps its own copy until `mr-person-discussions-state`).

**Non-goals:** any state, DOM, measurement or words beyond those below; the first comment's text (the window's
`first`, not the core's).

## Contract

Fixed. You may add, never change.

```ts
// internal/keptInPlace.ts
/** A held item stays at its index in `previous`, taking its `next` version; the others fill the rest in `next`'s
 *  order; a held item missing from `next` is dropped. */
export function keptInPlace<T, K>(
  previous: readonly T[],
  next: readonly T[],
  held: ReadonlySet<K>,
  keyOf: (item: T) => K,
): readonly T[];

// internal/personDiscussions.ts
import type { KnownPeople } from "./suggestions";
/** Request C2, in this order. */
export type PersonGroup = "turn" | "started" | "wrote" | "reviewer" | "other";
export const PERSON_GROUPS: readonly PersonGroup[]; // ["turn", "started", "wrote", "reviewer", "other"]
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
/** C2: the first group that applies; `person` a username, null: "other" always. */
export function personGroupOf(discussion: OpenDiscussion, person: string | null, row: PersonRow): PersonGroup;
/** C1–C2: every discussion of every listed row, by group, then newest `last.createdAt` first; equal keys keep the input
 *  order (rows as listed, discussions as given). */
export function personEntries<D extends OpenDiscussion, R extends PersonRow>(
  listed: readonly { readonly row: R; readonly discussions: readonly D[] }[],
  person: string | null,
): readonly PersonEntry<D, R>[];

/** D3: the comments after the first, oldest first: `[...earlier.slice(1), last]` when `earlier` is non-empty, else []. */
export function laterWriters<P extends Person>(discussion: {
  readonly earlier: readonly { readonly author: P | null }[];
  readonly last: { readonly author: P | null };
}): readonly (P | null)[];
/** D4: all when `writers.length <= fits`; else the newest `max(fits − 1, 0)` shown and the rest `folded` (the "+N"
 *  takes the first slot). `fits` < 1 counts as 1. */
export function foldedWriters<P>(
  writers: readonly P[],
  fits: number,
): { readonly folded: readonly P[]; readonly shown: readonly P[] };

/** B2: a line of the person menu. */
export type PersonLine<P extends Person> = {
  readonly value: Viewer;
  readonly label: string;
  /** The person's picture holder; null for "Me" when no listed row or writer has the viewer. */
  readonly person: P | null;
  readonly chosen: boolean;
};
/** B2: "Me" first when `me` is not null (label ME_WORD), then every other username once from `peopleOnRow` of `rows`
 *  and the non-null `writers`, by displayName (localeCompare "en"); value `person { username, name: displayName }`;
 *  `chosen` the line equal to `chosen` (a person whose username is `me` is Me). */
export function personLines<P extends Person>(
  rows: readonly KnownPeople<P>[],
  writers: readonly (P | null)[],
  me: string | null,
  chosen: Viewer,
): readonly PersonLine<P>[];

// internal/choices.ts
export function narrowed<C extends { readonly label: string }>(choices: readonly C[], typed: string): readonly C[];
```

### Rules

**`personGroupOf` (design §2.4).** `author = row.author?.username ?? null`.

1. `"turn"`: `turnOf(discussion, person, author).kind === "viewer"`.
2. `"started"`: `starterOf(discussion)` is the person (`isUser`).
3. `"wrote"`: `wroteIn(discussion, person)`.
4. `"reviewer"`: some `row.reviewers[].person.username === person`.
5. `"other"`.

A deleted writer (null author) is never the person. `starterOf`/`wroteIn` are imported from `./discussions`, never copied.

## Change

1. Export `starterOf` and `wroteIn` from `discussions.ts` (internal only; `index.ts` does not re-export them).
2. Write `keptInPlace.ts` and `personDiscussions.ts` per the Contract; `narrowed` generic.
3. Re-export from `index.ts`: `keptInPlace`, `PersonGroup`, `PERSON_GROUPS`, `PersonRow`, `PersonEntry`, `personGroupOf`,
   `personEntries`, `laterWriters`, `foldedWriters`, `PersonLine`, `personLines`.
4. Tests below.
5. `mergeRequests/AGENTS.md`: one paragraph "One person's discussions (request `docs/slices/request-mr-person-discussions.md`
   B2, C2–C3, D3–D4, design `briefs/mr-person-discussions-design.md` option A §2.4, plan §2 #193)" naming each function and
   its rule in the words above, and that `keptInPlace` is shared by the rows and the entries.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches (RK77):

- `personDiscussions.test.ts`, over hand-built discussions with sam (Me), anna, ben, chiara on rows authored by dmitri:
  - `the_persons_turn_is_group_one_for_the_viewer_and_for_another_person`: the same discussions, `person` "sam" and "anna":
    each case lands in `turn` as B2 says (wrote in it, mentioned, the author), never when the person wrote the last comment.
  - `started_is_the_starter_whose_turn_it_is_not`: anna starts and writes last → `started` for anna.
  - `wrote_is_a_later_comment_whose_turn_it_is_not`.
  - `reviewer_is_a_reviewer_who_never_wrote` and `a_non_reviewer_is_never_reviewer` (an assignee or approver only → `other`).
  - `every_other_discussion_is_other` and `a_null_person_puts_everything_in_other`.
  - `a_deleted_writer_is_never_the_person`.
  - `groups_come_in_c2_order_and_newest_last_comment_first_inside_each`.
  - `equal_times_keep_the_rows_order_then_gitlabs`.
  - `the_writers_are_every_comment_after_the_first_oldest_first`: one comment → []; Anna, Markus, Erin → [Markus, Erin]; a
    person writing twice shows twice.
  - `the_fold_keeps_the_newest_writers`: 6 writers, fits 4 → folded the oldest 3, shown the newest 3; fits ≥ 6 → none folded;
    fits 0 or 1 → shown none, folded all.
  - `person_lines_list_me_first_then_everyone_once_by_name`: rows' authors, assignees, reviewers, approvers and writers
    with repeats and nulls; a chosen person is marked; a chosen `person` whose username is `me` marks Me; no Me line when
    `me` is null.
- `keptInPlace.test.ts`: `a_held_item_keeps_its_index_and_takes_its_new_version`, `the_others_fill_in_next_order`,
  `a_held_item_gone_from_next_is_dropped`, `nothing_held_is_next`.
- The existing `choices.test.ts` passes unchanged (`narrowed`).

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused` (the new exports have no user until
`mr-person-discussions-state`; if `unused` flags them, report the line in `deviations_from_brief`, do not add a fake user);
`just mutants HEAD` (paste its line; `mergeRequests/` is not mutated, VF7).

## Skills

`skill://ts-conventions`, `skill://risk-register` (RK71, RK77 as proposed in the design §3), `skill://verification`.
