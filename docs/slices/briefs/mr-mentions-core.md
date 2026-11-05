# Slice mr-mentions-core — where a mention word is, and who the list shows in which order (pure core)

Feature: `@` completion in comment fields. Sources:

- Request `docs/slices/request-mr-mentions.md`, rules 1, 2 and 4, and the acceptance's "Core tests" sentence.
- Design `docs/slices/briefs/mr-mentions-design.md` option A, §2.1 (the word), §2.2 (the order, who is known) and §2.7 (the edit). Proposed plan rows #191 and #192, RK76.

Runs in round 1, in parallel with `mr-mentions-search`. It wires no window.

Facts (given):

- `mergeRequests/` is framework-free and self-contained (PM3). `index.ts` is its only surface (`mergeRequests/AGENTS.md:3`).
- `internal/suggestions.ts:21-28` has `peopleOnRow(row: KnownPeople<P>)`, which returns the author (when not null), assignees, reviewers' `person`, and approvers (`approvedBy`), in that order. It is not exported. `KnownPeople<P>` is at `:9-14`.
- `internal/filters.ts` exports `Person` (`username`, `name`). `internal/people.ts:38-40` has `displayName`.
- GitLab's `@` list shows 10 lines (`gfm_auto_complete.js` `limit: 10`). Its sort puts members whose `"<NameWithoutSpaces> <username>"` contains the query first-by-starts-with (facts note §4, `.omp/run/notes/PlanScoutMentionFacts.md`).
- `internal/choices.ts:146-149` `narrowed` matches a label by containment only. That is a different rule, so do not reuse it.

## Target

**Owned:**

- `frontend/src/mergeRequests/internal/mentions.ts` (new), `frontend/src/mergeRequests/internal/mentions.test.ts` (new)
- `frontend/src/mergeRequests/internal/suggestions.ts` (export `peopleOnRow` only; no behaviour change)
- `frontend/src/mergeRequests/index.ts`
- `frontend/src/mergeRequests/AGENTS.md`

**Read-only:** everything else.

**Non-goals:**

- Groups, `@all`, `#`/`!`/`~`/`%`/`:` references (request non-goals).
- Any DOM, timer or state. The window's `ui/` owns the field, the search and the list (later slices).

## Contract

Fixed. You may add to it, but never change it.

```ts
// mergeRequests/internal/mentions.ts, exported through index.ts
import type { Person } from "./filters";
import type { KnownPeople } from "./suggestions";

/** GitLab's `@` list shows 10 lines (gfm_auto_complete.js `limit: 10`, request rule 2). */
export const MENTION_LINES = 10;

/** The mention being typed: `text[start]` is "@"; `typed` is the text between it and the caret; `end` (≥ the
 *  caret) is where the word's characters stop. */
export type MentionWord = { readonly start: number; readonly end: number; readonly typed: string };

/** Request rule 1. `caret` is a UTF-16 index (a textarea's `selectionStart`); null: the caret is in no mention word. */
export function mentionWordAt(text: string, caret: number): MentionWord | null;

/** The merge request's people for a field (rule 2): `row`'s author, assignees, reviewers, approvers (suggestions'
 *  `peopleOnRow`), then the non-null `writers`, each username once, in that order; a null `row`: the writers only. */
export function knownMentions<P extends Person>(
  row: KnownPeople<P> | null,
  writers: readonly (P | null)[],
): readonly P[];

/** Rule 2's lines: `known` matching `typed`, then `found` matching it; inside each, starts-with before contains (order
 *  kept); each username once (the first wins); at most MENTION_LINES. A blank `typed`: every known person, no found. */
export function mentionLines<P extends Person>(
  known: readonly P[],
  found: readonly P[],
  typed: string,
): readonly P[];

/** Rule 4: replace the whole word with "@<username> " (one space). */
export type MentionEdit = { readonly from: number; readonly to: number; readonly insert: string };
export function mentionEdit(word: MentionWord, username: string): MentionEdit;
```

### Rules

**`mentionWordAt` (design §2.1).**

- Word characters are code points matching `/[\p{L}\p{N}_.-]/u`.
- Scan back from `caret` over word characters, by code point. The code point reached must be `@`, at index `start`.
- The character before `start` must be absent (`start === 0`), whitespace (`/\s/u`) or one of `(`, `[`, `{`.
- `typed = text.slice(start + 1, caret)`.
- `end` = `caret` plus the run of word characters after it.
- `caret` outside `0..text.length` → null.

**`mentionLines` (design §2.2).**

- `q = typed.toLowerCase()`.
- A person's terms are `name.replace(/\s+/gu, "").toLowerCase()` and `username.toLowerCase()`.
- **Starts:** either term starts with `q`. **Contains:** `` `${nameTerm} ${usernameTerm}` `` includes `q`. Otherwise no match.
- `typed.trim() === ""` → every known person, no found one.

**`mentionEdit`.** `{ from: word.start, to: word.end, insert: `@${username} ` }`.

## Change

1. Export `peopleOnRow` from `suggestions.ts`.
2. Write `mentions.ts` per the Contract.
3. Re-export it from `index.ts`, next to the suggestions block.
4. Write the tests below.
5. `mergeRequests/AGENTS.md`: one paragraph "Mentions (request `docs/slices/request-mr-mentions.md` rules 1, 2, 4, design `docs/slices/briefs/mr-mentions-design.md` option A §2.1–2.2, plan §2 #191–#192)". It names each function and its rule in the words above, and says that `knownMentions` reuses `peopleOnRow`.

## Acceptance

**Tests** (`mentions.test.ts`, `pnpm -C frontend test`), each named for the bug it catches:

- `a_word_starts_at_the_text_start_or_after_a_space_a_line_break_or_an_opening_bracket`: `@an`, `x @an`, `x\n@an`, `x\t@an`, `(@an`, `[@an`, `{@an`, each with the caret at the end → `{ start, end, typed: "an" }`.
- `an_at_after_a_letter_starts_no_word` (RK76): `a@b.c` with the caret after `b` and after `c`; `x@y`; `@@a`; `)@a` → null.
- `a_caret_inside_the_word_searches_the_text_before_it` (RK76): `@an|na x` (caret 3) → `{ start: 0, end: 5, typed: "an" }`.
- `a_space_or_a_caret_outside_ends_the_word`:
  - `@an |` → null;
  - the caret before the `@` → null;
  - a bare `@` with the caret after it → `typed: ""`, `end` 1.
- `a_name_with_an_accent_stays_one_word`: `@zoë` → `typed: "zoë"`. `@an.na-b_1` is one word.
- `known_people_come_before_found_people`: known `[ben, anna]`, found `[anna2, adam]`, typed `a` → the known matches first.
- `starts_with_comes_before_contains_in_each_group`: known `[Dana Scott @dscott, Anna Berg @anna]`, typed `an` → anna before dscott. The same holds inside found.
- `a_name_matches_without_its_spaces`: `annaberg` matches "Anna Berg". `berg` matches it as contains (no term starts with `berg`, since the name term is `annaberg`).
- `each_person_is_listed_once`: a username in both known and found shows once, at its known place.
- `at_most_ten_lines`: 8 known + 8 found matches → 10.
- `a_blank_text_lists_every_known_person_and_no_found_one`.
- `known_mentions_are_the_row_then_the_writers_each_once`: the author, assignees, reviewers, approvers, then writers with nulls and repeats → each username once in that order. A null row → the writers only.
- `the_pick_replaces_the_whole_word_and_adds_one_space` (RK76): `mentionEdit({ start: 4, end: 9, typed: "an" }, "anna")` → `{ from: 4, to: 9, insert: "@anna " }`.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`. `mergeRequests/` is not mutated (`skill://verification` VF7), so no `just mutants` survivors are expected there. Run `just mutants HEAD` anyway and paste its line.

## Skills

`skill://ts-conventions`, `skill://risk-register` (RK76 as proposed in the design §3), `skill://verification`.
