# Slice mr-discussions-core — whose turn, the box's order and words

Feature: whose turn it is, per open discussion. Sources:
- Request `docs/slices/request-mr-discussions.md`: rules 2, 3, 5.
- Design `docs/slices/briefs/mr-discussions-design.md` option A, §1.3, §1.4, §1.8.
- Proposed plan §2 #163, #164.

Runs beside `mr-discussions-rust`. It needs nothing generated: the core declares its own structural types (PM3).

## Target

**Owned:**
- `frontend/src/mergeRequests/internal/discussions.ts` (new)
- `frontend/src/mergeRequests/internal/discussions.test.ts` (new)
- `frontend/src/mergeRequests/internal/relativeTime.ts`
- `frontend/src/mergeRequests/internal/relativeTime.test.ts`
- `frontend/src/mergeRequests/index.ts`
- `frontend/src/mergeRequests/AGENTS.md`

**Read-only:** everything else.
- `mergeRequests/internal/filters.ts`: its `Person`.
- `people.ts`: `displayName`.
- `ipc/**`, `ui/**`, `docs/**`.

**Non-goals:**
- Loading, the setting, the box's markup and its loading or failure words (state and page).
- The review order and review mode's words (`request-mr-review-mode.md`).
- Skipping bots (design open question 1).

## Contract

Fixed; you may add, never change. Exported from `mergeRequests/index.ts`:

```ts
// The window's domain types are assignable to these (ipc's carry `page` and a `picture` too).
export type DiscussionPlace =
  | { readonly kind: "overview" }
  | { readonly kind: "file"; readonly path: string; readonly line: number | null };
export type DiscussionNote = {
  readonly author: Person | null;   // filters.ts Person
  readonly createdAt: number;       // ms since 1970
  readonly text: string;            // the raw body
};
export type OpenDiscussion = { readonly place: DiscussionPlace; readonly last: DiscussionNote };

/** "viewer": the last comment is not the viewer's (an unknown author too), so it is the viewer's turn; "waiting":
 *  the viewer wrote it and waits for an answer (request rule 3). */
export type Turn = "viewer" | "waiting";
export type TurnLine<D extends OpenDiscussion> = { readonly discussion: D; readonly turn: Turn };
export type TurnCounts = { readonly viewersTurn: number; readonly waiting: number };

/** Each discussion with its turn for `viewer` (a username; null: nobody, so every one is the viewer's turn): the
 *  viewer's turn first, then the rest; within each, the newest last comment first; equal times keep `open`'s order. */
export function discussionTurns<D extends OpenDiscussion>(
  open: readonly D[],
  viewer: string | null,
): readonly TurnLine<D>[];
/** How many are `viewer`'s turn and how many wait on others (review mode's order uses both). */
export function turnCounts(open: readonly OpenDiscussion[], viewer: string | null): TurnCounts;

export const DISCUSSIONS_LABEL = "Open discussions";
export const UNKNOWN_AUTHOR = "Someone";
/** "Your turn" | "Waiting for an answer". */
export function turnText(turn: Turn): string;
/** "2 of 5 wait for you", "1 of 5 waits for you", "1 of 1 waits for you", "0 of 3 wait for you"; no discussion →
 *  "No open discussions". */
export function turnSummaryText(counts: TurnCounts): string;
/** "Overview" | "src/board/card.ts:4" | "src/board/card.ts" (no line). */
export function placeText(place: DiscussionPlace): string;
/** The author's display name (`displayName`), or `UNKNOWN_AUTHOR`. */
export function noteAuthorName(author: Person | null): string;
/** The text trimmed, its first 3 lines (any of \n, \r\n), at most 280 characters (code points, never half a
 *  surrogate pair); when anything was left out, cut there, end-trimmed, plus "…". Plain text, never markup. */
export function noteExcerpt(text: string): string;
/** "just now" under a minute, else "3 hours ago" (Intl, the units of createdAgo). */
export function agoText(time: number, now: number): string;
```

`createdAgo(createdAt, now)` keeps its words ("created just now", "created 3 hours ago") and is built on `agoText`
(one unit table).

## Change

1. `relativeTime.ts`: `agoText`, and `createdAgo` built on it; tests for both.
2. `discussions.ts`: the types, `discussionTurns`, `turnCounts` and the words; tests.
3. `index.ts` exports; `AGENTS.md`: the discussions paragraph (the turn rule, order, words, excerpt).

## Acceptance

Vitest (`pnpm -C frontend test -- src/mergeRequests`), each test named for the bug it catches, at least:
- `the_viewers_own_last_comment_is_waiting_any_other_is_the_viewers_turn` (viewer `sam`; an author `anna`; an unknown
  author → viewer's turn)
- `a_reviewer_other_than_me_gets_the_turns_from_their_side` (the same discussions for `anna`)
- `a_null_viewer_has_every_turn`
- `the_viewers_turn_comes_first_then_newest_first_within_each`
- `equal_times_keep_gitlabs_order`
- `the_counts_add_up_to_the_open_discussions`
- `the_summary_counts_words_singular_and_plural` (the five cases of the Contract)
- `a_file_place_reads_path_and_line_or_path_alone`
- `the_excerpt_keeps_three_lines_and_cuts_with_an_ellipsis` (four lines; 300 characters on one line; an emoji at the
  cut; `\r\n`; leading blank lines)
- `markup_and_capitals_stay_as_typed` (`**x**`, `<b>X</b>`, `&amp;`)
- `an_unknown_author_is_someone`
- `ago_text_uses_the_largest_whole_unit_and_just_now`
- `created_ago_keeps_its_words`

Commands:
- `pnpm -C frontend lint`, `typecheck`, `test` (PM3, the core importing no other `src/` module, is checked by the
  oxlint overrides and `frontend/scripts/fences.test.ts`): summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://comment-policy`, `skill://verification`.
