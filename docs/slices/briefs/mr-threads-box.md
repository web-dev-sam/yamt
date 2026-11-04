# Slice mr-threads-box — the turn rule, the box's rows and refresh, Shift and the pinned box (wires the window)

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: B1–B6, C1, C2, C6 (in the window), C10 (the box's side), C11, D1; the
  core and WebKit acceptance.
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.2 (which side computes), §1.3 (panel, Shift, pinned),
  §1.4, §3.1 rows #179, #183, §4 items 1, 4, 5, 8, 10–13.
- Proposed plan §2 #179, #183; RK59, RK61, RK71, RK72, RK73.

Runs in wave 8, after `mr-threads-panel`. **This slice wires the window**: its WebKit and real-app run is the feature's
first end-to-end proof.

## Target

**Owned:**

- `frontend/src/mergeRequests/**` (the core: `internal/discussions.ts` (+ test), `internal/reviewOrder.ts` (+ test),
  `index.ts`, `AGENTS.md`)
- `frontend/src/ui/MergeRequestDiscussions.vue`, `frontend/src/ui/MergeRequestDiscussions.test.ts` (new, SSR)
- `frontend/src/ui/useHoverBox.ts` (+ `.test.ts`)
- `frontend/src/ui/mergeRequestsShown.ts`, `frontend/src/ui/mergeRequestsText.ts` (+ `.test.ts`)
- `frontend/src/ui/AGENTS.md`

**Read-only:** everything else.

- `ui/MergeRequestThread*.vue`, `ui/MergeRequestReplyField.vue`, `ui/mergeRequestThreadText.ts`: `mr-threads-panel`'s;
  mount the panel as contracted there.
- `ui/mergeRequestThread.ts`, `ui/mergeRequestDiscussions.ts`, `ui/mergeRequests.ts`: the state slice's.
- `ui/useShiftHeld.ts` (`useShiftTaps`), `ui/typingTarget.ts` (`isTypingTarget`), `ui/CiStatusBox.vue` (the model),
  `ui/tooltip.ts`, `ipc/**`: use as they are. `ipc/fixtureMergeRequestDiscussions.test.ts:157` calls
  `reviewOrdered` with fixture rows that carry `author` already: keep the call compatible.
- `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** the panel's inside; Rust; resolved discussions beyond C10; a turn for a system note (RK61).

## Contract

Fixed; you may add, never change.

### The core (`mergeRequests/internal/discussions.ts`)

```ts
export type Mention = { readonly username: string; readonly name: string };
export type DiscussionNote = { …today; readonly mentions: readonly Mention[] };
export type TurnComment = { readonly author: Person | null; readonly mentions: readonly Mention[] };
export type OpenDiscussion = {
  readonly place: DiscussionPlace;
  /** Person comments before `last`, oldest first; the starter is earlier[0], else last. */
  readonly earlier: readonly TurnComment[];
  readonly last: DiscussionNote;
};
export type Turn =
  | { readonly kind: "viewer" }
  | { readonly kind: "author" }
  | { readonly kind: "person"; readonly username: string; readonly name: string }
  | { readonly kind: "waiting" }
  | { readonly kind: "open" };
export type TurnCounts = { readonly viewersTurn: number; readonly authorsTurn: number; readonly total: number };

/** Request B1–B3 for `viewer` (a username; null: no one — never the viewer's turn, design §4 item 11) on a merge
 *  request by `author` (a username; null: unknown). A deleted person (null author) is never the viewer, never the
 *  author and never mentioned (B6). */
export function turnOf(discussion: OpenDiscussion, viewer: string | null, author: string | null): Turn;
export function discussionTurns<D extends OpenDiscussion>(open: readonly D[], viewer: string | null,
  author: string | null): readonly TurnLine<D>[]; // B4: viewer's turn first, newest last comment first within each
export function turnCounts(open: readonly OpenDiscussion[], viewer: string | null, author: string | null): TurnCounts;
export function turnText(turn: Turn, viewer: Viewer): string;
// viewer → "Your turn" / "<name>'s turn" (viewerPossessive); author → "Author's turn"; person → "<name>'s turn";
// waiting → "Waiting for an answer"; open → "Open"
export function turnSummaryText(counts: TurnCounts, viewer: Viewer): string; // "N of M wait(s) for you/<name>"
```

**`turnOf`**, with `comments = [...earlier, last]`, `starter = comments[0].author`, `isViewer(p) = viewer !== null &&
p !== null && p.username === viewer`, `isAuthor(p) = author !== null && p !== null && p.username === author`:

1. **B1** — `isViewer(last.author)`: viewer ≠ author → `author`; viewer = author → `waiting` when `isAuthor(starter)`
   or the starter is deleted (design §4 item 12), else `person(starter)`.
2. **B2** — else, `viewer !== null` and any of: `isViewer(starter)` (B2.1); a comment whose author is not the viewer
   mentions the viewer (B2.2); `viewer === author` (B2.3); the viewer wrote any comment (B2.4 — with B1 false, someone
   else answered after) → `viewer`.
3. **B3** — else the first of: the last comment's first mention whose username is not its writer's → `author` when
   that is the author (design §4 item 1), else `person` (B3.1); `!isAuthor(last.author)` → `author` (B3.2, a deleted
   writer included); a starter who is a person and not the author → `person(starter)` (B3.3); `open` (B3.4).

**`reviewOrder.ts`** (B5): `reviewOrdered`'s rows type gains `readonly author: { readonly username: string } | null`;
"waiting on the author" is `turnCounts(…, reviewer, row.author?.username ?? null).authorsTurn`; the tooltip
sentence (`:75-78`) stays, now exact.

### The hover rule (`ui/useHoverBox.ts`)

```ts
type HoverBoxParts = {
  readonly area: () => HTMLElement | null;
  readonly opener: () => HTMLElement | null;
  readonly box: MaybeRefOrGetter<HTMLElement | null>;
  /** While true (a side panel is open): leaving with the pointer or focus, a window blur and a scroll outside never
   *  close the box; a `pointerdown` outside the area closes it (C2, RK73). Absent: today's rule. */
  readonly pinned?: () => boolean;
};
```

The pointer-down listener is on `document`, capture, active only while open and pinned. When the pin ends, nothing
closes by itself (focus is back on the row).

### The box (`ui/MergeRequestDiscussions.vue`)

- **Rows** keyed by `discussion.id`, each a `<button>` with `data-discussion-id`, `aria-keyshortcuts="Shift"`, tooltip
  "Shift: show the thread" (C1); a click opens the last comment's page as today (`aria-disabled` without one, design
  §4 item 13). The shown row has `aria-current="true"` and `bg-row-selected` (C1). Its turn words are
  `turnText(turnOf(d, viewer.username, row.author?.username ?? null), viewer)`; a marked (resolved) row shows a check
  (Lucide `check`), muted, "Resolved" instead (C10).
- **Header**: the summary of the unmarked discussions (`turnSummaryText(turnCounts(…))`, B4), and at its right a
  refresh button (Lucide `refresh-cw`, tooltip "Reload discussions", spinning while `reloads.get(iid)` is `running`,
  D1); a failed reload replaces the summary with `discussionsFailedText(failure)` in the error colour, the rows kept
  (D2).
- **Shift** (C1, RK59): `watch(useShiftTaps(), …)`: the pointed row, else the focused one; nothing unless the box is
  open, that row has an id and `!isTypingTarget(document.activeElement)` → `showThread(row.iid, id)`.
- **Panel**: `<MergeRequestThread v-if="open && shownHere" :key="id" :iid :author :place :turn :anchor :now
  @close="threadClosed" />` inside the hover area (a DOM child, as `CiStatusBox.vue:183-190`), `anchor` the box's
  `useElementBounding` left/top. `threadClosed`: `closeThread()`, then focus the row's button (C2).
  `useHoverBox({ …, pinned: () => shownHere.value })`. `boxed` = (details not "off" and count > 0) **or** `shownHere`
  (design §4 item 10).
- **Closing**: `watch(open)` to false → `closeThread()` when shown here, then `boxClosed(iid)` (C10: marked rows leave,
  the count drops).
- Words in `mergeRequestsText.ts`: `RELOAD_DISCUSSIONS` "Reload discussions", `SHOW_THREAD_KEY` "Shift: show the
  thread", `RESOLVED` "Resolved".

## Change

1. The core: types, `turnOf`, `discussionTurns`, `turnCounts`, `turnText`, `turnSummaryText`, `reviewOrdered`; the
   tests by case name; `mergeRequests/AGENTS.md` rewritten for the new rule.
2. `useHoverBox.ts` `pinned` and its tests.
3. `MergeRequestDiscussions.vue`, `mergeRequestsText.ts`, `mergeRequestsShown.ts`; the SSR test.
4. `ui/AGENTS.md`: the box's rows, refresh, marks, Shift, the pinned box, the panel's mount.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches. Core cases (`discussions.test.ts`; viewer sam,
author dmitri unless named; the numbers are `briefs/mr-threads-fixtures.md`'s):

- `b1_the_viewer_wrote_last_so_it_is_the_authors_turn` (1), `b1_the_author_wrote_last_so_it_is_the_starters_turn`
  (13), `b1_the_author_started_and_wrote_last_so_it_waits` (14), `b1_a_deleted_starter_waits` — **own B1**
- `b2_the_viewer_started_it` (2), `b2_the_viewer_is_mentioned_by_someone_else_and_never_wrote` (3),
  `b2_a_mention_counts_after_the_viewer_answered` (4), `b2_the_viewer_is_the_author` (15),
  `b2_the_viewer_wrote_in_the_middle` (5) — **own B2**
- `b3_the_last_comment_mentions_someone` (6: "Ben Okafor's turn"), `b3_the_last_comment_is_not_the_authors` (7),
  `b3_the_author_answered_the_starter` (8: "Anna Berg's turn" — the owner check's case), `b3_only_the_author_wrote_so_it_is_open` (9),
  `b3_a_mention_of_the_author_is_the_authors_turn` (11), `b3_all_and_group_mentions_are_no_mentions` (12),
  `b3_a_self_mention_is_no_mention` (!90's d13: chiara mentions herself → "Author's turn") — **own B3**
- `b4_header_counts_only_the_viewers_turn_and_orders_them_first` — **owns B4**
- `b5_review_order_counts_authors_turns_as_waiting_on_the_author`, `b5_review_mode_speaks_for_the_reviewer` (ben: case
  6 → "Ben Okafor's turn") — **own B5**
- `b6_a_deleted_person_is_never_viewer_author_or_mentioned` (10 and a null viewer) — **owns B6**
- `no_viewer_is_never_the_viewers_turn` (design §4 item 11)
- `useHoverBox.test.ts`: `a_pinned_box_stays_when_the_pointer_and_focus_leave`, `a_pinned_box_ignores_an_outside_scroll`,
  `a_press_outside_closes_a_pinned_box`, `an_unpinned_box_keeps_todays_rule` (RK73)
- `MergeRequestDiscussions.test.ts` (SSR): `rows_are_buttons_keyed_by_id_with_the_shift_tip`,
  `a_marked_row_reads_resolved_and_leaves_the_count`, `the_refresh_button_has_its_tip`, `a_failed_reload_keeps_the_rows`

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just mutants HEAD`.

**Smoke — WebKit** (`just app-session start-fixture --name mtbox --diff --mr list --size 1600x1000`, the
merge-requests page; yamt Dark, then `--settings '{"theme":"light"}'`; paste `read` results, log lines, shot paths):

1. **B words.** !637's box: each row's words as the core cases (d01 "Your turn", d02 "Author's turn", d06 "Ben Okafor's
   turn", d08 "Anna Berg's turn", d09 "Open", …); the header "4 of 13 wait for you" (d01, d03, d04, d05: the B2 rows); !636's
   rows "Anna Berg's turn", "Waiting for an answer", "Your turn". Review mode as Ben Okafor: d06 reads "Ben Okafor's
   turn".
2. **C1 Shift.** Hover d01, tap Shift: the panel opens directly left of the box, tops aligned; d01 is marked; the log
   has one `fixture_thread { iid: 637, discussion: …01 }`. Hover d02, tap Shift: d02's thread replaces it. Click into
   the field, press Shift+a: an "A" is typed and no new `fixture_thread`. Tab to d03 and tap Shift: its thread.
3. **C2 What stays open.** Move the pointer far outside both: both stay. Click a link in a comment: a
   `fixture_page` line, both stay. Escape: the panel closes and focus is on its row; Escape again: the box closes.
   Reopen, Shift, press the panel's Close: the panel closes, the box stays. Reopen, Shift, click the list outside:
   both close.
4. **C6 Field.** Type 2 lines: 3 lines high; 8 lines: 8 high; 20 lines: 12 high, scrolling inside (`read` the
   textarea's rect each time). Close the box, reopen d01's thread: the text is still there; d02's field is empty.
5. **C10 Resolve.** On d02 press "Resolve thread": the button reads "Unresolve thread"; d02's row shows the check,
   muted, "Resolved"; the header count leaves it out; !637's count still reads 13. Close the box: !637's count reads
   12; reopen: d02 is gone.
6. **D1 Refresh.** Press "Reload discussions": the icon turns, the rows stay, then the new answer; the log has one
   `fixture_discussions { iids: 637 }` and no other row's. With d01's panel open, the refresh also logs a
   `fixture_thread`.
7. **C11 Off.** Settings → Discussion details "Off": no box and no panel on any row; "Load lazily": both work.
8. `shot` of the box with the panel open, dark and light.

**Smoke — real app**: `scripts/local-conflicts-repo.sh <scratch>/mtbox`, `cargo tauri build --debug --no-bundle`,
`just app-session start-app --name mtbox --diff --dir <scratch>/mtbox --glab mr-threads`; on !90: the B words as in the
fixtures table; Shift on d01 shows four comments with "Edited … by Dmitri Volkov"; "Add comment" with "Thanks" → the
fake glab log has one `POST …/discussions/0000…01/notes` with `stdin: {"body":"Thanks"}` and d01's row now reads
"Author's turn"; `just app-session stop mtbox`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK59, RK61, RK71, RK72, RK73),
`skill://verification`.
