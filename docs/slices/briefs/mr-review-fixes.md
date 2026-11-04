# Slice mr-review-fixes — the author's name, a marked discussions button, no Escape out of the list, review order

Feature: four owner fixes on the merge-request page. Source: request `docs/slices/request-mr-review-fixes.md` parts
A–D (rules A1–A2, B1–B3, C1–C2, D1–D5) and its Acceptance; D3's count is the owner's answer #2429. One slice:
the four parts share `MergeRequestDiscussions.vue`, the core's turn counts and `ui/AGENTS.md`, so splitting them
would make two owners of each. Visions: the turn rule and its words live once in the core (plan #163, #179); one
writer per state (§0). **This slice wires the window**: its commit starts the smoke pass.

Starts once `mr-fast-preview-panel`'s last round is committed (`475b87e3`): that slice also edits
`MergeRequestDiscussions.vue` (its reload button calls `refreshDiscussions`; with discussions Off the icon spins while
the shown thread `isBeingRead`), `MergeRequestDiscussionsBox.test.ts` and `ui/AGENTS.md`; keep its changes. Line
numbers below are of `f93d0020`; re-read before editing. While in `ui/AGENTS.md`, also fix the one line it left stale
(orchestrator, #2466): the thread re-read is `refreshed(iid, asked?)`, not `refreshed(iid)`.

## Target

**Owned:**

- `frontend/src/mergeRequests/internal/discussions.ts`, `discussions.test.ts`
- `frontend/src/mergeRequests/internal/reviewOrder.ts`, `reviewOrder.test.ts`
- `frontend/src/mergeRequests/index.ts`, `frontend/src/mergeRequests/AGENTS.md`
- `frontend/src/ui/MergeRequestDiscussions.vue`, `frontend/src/ui/MergeRequestDiscussionsBox.test.ts`
- `frontend/src/ui/MergeRequestsView.vue`
- a new `frontend/src/ui/MergeRequestsPage.test.ts` only if no existing page test can hold the Escape tests
- `frontend/src/ui/AGENTS.md`

**Read-only:** everything else. `ui/mergeRequestsShown.ts` calls `reviewOrdered` unchanged; `MergeRequestReviewSort.vue`
calls `reviewSortedText` unchanged; `ui/MergeRequestThread*.vue` takes its words from `MergeRequestDiscussions.vue`
(`panelWords`). `ipc/fixture*`: the fixture rows as they are. `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** request Non-goals; the normal list order; whose turn a discussion is (`turnOf` unchanged); a spoken or
tooltip text for the mark.

## Contract

Fixed; you may add, never change.

```ts
// mergeRequests/internal/discussions.ts
export type TurnCounts = {
  readonly viewersTurn: number;
  /** D3 (owner #2429): discussions with a comment (`earlier` or `last`) whose author is the viewer. */
  readonly viewerWrote: number;
  readonly total: number;
}; // `authorsTurn` removed (its only reader was the old order)

/** A1/A2: `author` is the merge request's author; "author" reads "<displayName(author)>'s turn", "Author's turn"
 *  when null. Every other kind as today. */
export function turnText(turn: Turn, viewer: Viewer, author: Person | null): string;

// mergeRequests/internal/reviewOrder.ts — signatures unchanged
export function reviewOrdered<R, F>(rows, reviewer, dueOf, detailsOf): ReviewOrder<R, F>; // D1–D4
export function reviewSortedText(viewer: Viewer, loading: number): string; // D5 words exactly
```

- D1–D4 as one comparator after `firstFailed`: `compareDays` of the two due days (dated before undated), then
  `viewersTurn` descending, then `viewerWrote` ascending, then the normal order (`byDueDate`'s newest first). `none` and
  `loading` read as zero counts (`NO_TURNS`).
- B1/B2: one `computed` of the read entry's unmarked discussions' `turnCounts` feeds both `readHeader`'s summary and the
  button's mark (`viewersTurn > 0`); the mark is the classes of the line's turn word (`:306`) on the opener button.
- C1/C2: `escapePressed` keeps only "an open filter menu closes"; `goBack` stays Back's click handler only; the
  `description`/`thread` early return goes with the branch it guarded.

## Change

1. Core: `turnText`'s author, `TurnCounts.viewerWrote`, `authorsTurn` gone, the D1–D4 comparator, D5 words.
2. `MergeRequestDiscussions.vue`: `turnText(turn, viewer.value, props.row.author)` at both calls; the shared counts and
   the mark.
3. `MergeRequestsView.vue`: Escape as C1/C2.
4. `mergeRequests/AGENTS.md` (Discussions, Review mode paragraphs) and `ui/AGENTS.md` (page, box, thread side: "the one
   after leaves the page" goes; the mark) say what is now true.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches:

- `the_authors_turn_names_the_author` — A1, and A2's "Author's turn" for a null author (existing "Author's turn"
  expectations become the name).
- `review_order_*` (`reviewOrder.test.ts`) — D1 soonest first with an overdue day above today's, a due row with nothing
  waiting above an undated row with three; D2 more waiting first within one day; D3 fewer written-in first within
  equal D1/D2; D4 newest first on a full tie; loading rows as 0/0; another reviewer (`AS_ANNA`) changes D2/D3; the
  failed case unchanged. The old "fewest waiting on the author" tests go (clean cutover).
- `turnCounts` counts `viewerWrote` from `earlier` and `last` authors, a mention alone not counting.
- D5 words for Me, a person, and with loading rows.
- `a_row_with_the_viewers_turn_has_a_marked_button` (`MergeRequestDiscussionsBox.test.ts`, fixture) — marked exactly
  when the header reads N ≥ 1; unmarked at 0; a discussion resolved in the box that was the only one unmarks it; review
  mode's reviewer moves the mark.
- `escape_never_leaves_the_page` — focus on Back, on the body, after a box closed by Escape, after a thread panel
  closed by Escape: the screen stays `mergeRequests`; `escape_still_closes_an_open_filter_menu`; Back's click leaves.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`, `sfc-order`; `just mutants HEAD`.

**Smoke (WebKit fixture, the wiring):** `just app-session start-fixture --name mrf --diff --mr list --size 1600x1000`,
open the merge-requests page: a box line of the author's turn reads "<name>'s turn"; the purple buttons are exactly
the rows whose box header says "N of M wait for you" with N ≥ 1; Escape with focus on Back and on the body leaves the
page shown; Back by Enter closes it. Review mode for Me and for another reviewer: give two rows due dates (the due-date
box), the order and the tooltip follow D1–D5. `shot` dark and light (light through Settings → Theme → yamt Light:
`start-fixture` has no `--settings` option, measured by `MrFastPreviewSmoke`).
`just app-session stop --name mrf`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK72: the box's resolved rows),
`skill://verification`.
