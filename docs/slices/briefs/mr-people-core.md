# Slice mr-people-core — the empty field's suggestions, the search text rule, one "Me"

Feature: people on a merge request. Sources:

- Request `docs/slices/request-mr-people.md`: rule 2 (the empty field offers Me first, then the people the page
  already knows; a person already in the group shows as already there).
- Design `docs/slices/briefs/mr-people-design.md` option A, §1.1 (leading "@"), §1.6 (suggestions), §1.8.
- Proposed plan §2 #169, #170.

Runs beside `mr-people-rust`; needs nothing.

## Target

**Owned:**

- `frontend/src/mergeRequests/internal/suggestions.ts` (new)
- `frontend/src/mergeRequests/internal/suggestions.test.ts` (new)
- `frontend/src/mergeRequests/internal/filters.ts`, `frontend/src/mergeRequests/internal/choices.ts` (the "Me" word, and
  sharing the count rule)
- `frontend/src/mergeRequests/internal/choices.test.ts`, `frontend/src/mergeRequests/internal/filters.test.ts` (only if
  a shared helper moves)
- `frontend/src/mergeRequests/index.ts`
- `frontend/src/mergeRequests/AGENTS.md`

**Read-only:** everything else. `ipc/**` and `ui/**` are the state and page slices'. `mergeRequests/` imports no other
`src/` module (PM3, `frontend/scripts/fences.ts`).

**Non-goals:**

- Searching GitLab, timers, any state (`mergeRequests/` is pure: `AGENTS.md:3`).
- Words other than "Me": the page's texts are `ui/mergeRequestsText.ts`.
- Which people are "already there" or working: the page computes that from the row and the slice's asks.

## Contract

Fixed; you may add, never change.

```ts
// internal/filters.ts — the one spelling of the viewer's word; valueWord (`filters.ts:203-204`) and choices.ts's
// meChoice (`choices.ts:65,67`) use it instead of their "Me" literals.
export const ME_WORD = "Me";

// internal/suggestions.ts
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

/**
 * What the empty add field offers for `group` of `row` (rule 2), each username once, at most SUGGESTED_PEOPLE:
 * 1. Me, when `me` is not null.
 * 2. `row`'s own people: its author, assignees, reviewers, then approvers, in that order.
 * 3. Every other person on `rows` (authors, assignees, reviewers, approvers), most rows holding them in `group` first
 *    (the count rule of `choices.ts` `peopleOf`, :41-57), then by display name (`byCountThenLabel`'s
 *    `localeCompare(…, "en")`, :26-28).
 * People already in `group` are kept: the page marks them.
 */
export function peopleSuggestions<P extends Person>(
  rows: readonly KnownPeople<P>[],
  row: KnownPeople<P>,
  group: "assignees" | "reviewers",
  me: string | null,
): readonly Suggestion<P>[];

/** The text GitLab is asked for: trimmed, one leading "@" dropped, trimmed again; "" means the empty field. */
export function searchedText(typed: string): string;
```

`index.ts` exports `ME_WORD`, `SUGGESTED_PEOPLE`, `peopleSuggestions`, `searchedText`, `type KnownPeople` and `type
Suggestion`. `Person` is the core's (`filters.ts:25`); `displayName` is `people.ts:38-40`.

## Change

1. `ME_WORD` in `filters.ts`, used by `valueWord` and `choices.ts`. Behaviour does not change: the existing
   `choices.test.ts` and `filters.test.ts` stay green.
2. Make the count rule and comparator shareable inside `internal/`: export `peopleOf` and `byCountThenLabel` from
   `choices.ts` (or move them to one internal file both import). Never copy them.
3. `suggestions.ts` and its tests.
4. `mergeRequests/AGENTS.md`: one paragraph on the suggestions and `searchedText`, citing request rule 2 and plan #169.

## Acceptance

- Vitest `suggestions.test.ts`, each test named for the bug it catches, at least:
  - `me_comes_first_with_their_picture_from_any_loaded_row`
  - `me_unknown_on_every_row_has_no_person` (`person: null`)
  - `no_me_entry_without_a_viewer`
  - `the_rows_own_people_follow_me_author_assignees_reviewers_approvers`
  - `others_are_ordered_by_rows_holding_them_in_the_group_then_by_name`: the same people order differently for
    "assignees" and "reviewers".
  - `each_username_appears_once` (me on the row too, a person in two groups)
  - `at_most_twenty_lines_me_included`
  - `people_already_in_the_group_stay_listed`
  - `searched_text_trims_and_drops_one_leading_at`: `"  @ben "` → `"ben"`, `"@"` → `""`, `"@@x"` → `"@x"`, `"a b"` stays.
- `choices.test.ts` and `filters.test.ts` unchanged and green. A grep for `"Me"` under `frontend/src/mergeRequests/`
  outside tests finds only `ME_WORD`'s line.
- `pnpm -C frontend lint`, `typecheck`, `test`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://verification`.
