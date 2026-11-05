# Slice mr-person-discussions-view — the Discussions button, the view, its entries, the person menu; wires the window

Feature: one person's discussions across every merge request. Sources:

- Request `docs/slices/request-mr-person-discussions.md` A1–A2, B2–B3, C3–C4, D1–D4, E1–E5, F1–F2 and the acceptance's
  WebKit sentence.
- Design `docs/slices/briefs/mr-person-discussions-design.md` option A §2.3, §2.6, §2.8 (Decisions taken); proposed plan
  rows #193–#194, RK73, RK77.

Runs in round 4, after `mr-person-discussions-state`. **This slice wires the window**: both the compare and the range
window host `MergeRequestsView.vue` (`CompareApp.vue:96`, `RangeApp.vue:153`), so A2 needs no host change.

Facts (given):

- The slice gives (after `state`): `personView: ComputedRef<PersonViewShown | null>` (`person`, `entries`
  (`PersonEntryShown`: `row`, `discussion`, `group`, `turn`, `resolved`), `loading`, `failures`, `people`, `counts`,
  `reloading`), `openPersonView`, `leavePersonView`, `pickPerson`, `expandEntry`, `collapseEntry`, `retryRow`,
  `refreshPersonView`; and (after `threads`) `threads`, `expanded`, `writing`, `isWritable`, `MergeRequestThreadBody.vue`
  (`placement="inline"`, emits `cancel`, `focusHost`) and `MergeRequestThreadButtons.vue`.
- `OpenDiscussion.first: { createdAt, body: Description }` (after `ipc`); the starter is `(earlier[0] ?? last).author`.
- Core: `laterWriters`, `foldedWriters(writers, fits)`, `turnText(turn, viewer, author)`, `turnSummaryText(counts,
  viewer)`, `placeText`, `noteAuthorName`, `agoText`, `dateTimeText` (`DD.MM.YYYY, HH:MM`), `PersonLine`.
- Page: `ui/MergeRequestsView.vue` — header (Back, age, Refresh), the filter row (`MergeRequestSearch`, three
  `MergeRequestFilter`s, `MergeRequestReviewMode`, `MergeRequestReviewSort`, Clear, Draft), the row list `<ul>` over
  `shownRows` (`:240-275`), `escapePressed` closes only a filter menu (`:101-107`, plan #189 C); filter menus run through
  `useHoverMenu` (`ui/useHoverMenu.ts`).
- `ui/MergeRequestMenu.vue` is `generic="V"` over `Choice<V>[]`; core `narrowed` is now generic over `{ label }` (after
  `core`); `ui/MergeRequestReviewMode.vue` shows its use (opener, `MergeRequestMenu`, `menuitemradio` lines).
- `ui/MergeRequestDiscussions.vue:112-118` (the Shift-tap watch: pointed or focused line, `isTypingTarget`),
  `:298-340` (a line's look: picture `size="box"`, name, muted ago, turn word with `TURN_MARK` when the viewer's turn,
  place). `MergeRequestPicture` takes `person: Person | null` (`:11`) and `size` row/stack/box (`size-6`/`size-5`).
- `ui/MergeRequestDescriptionBlocks.vue` draws a `Description`'s blocks (links open through the page, images lazy).
- Every hover text is `v-tooltip`, never `title` (`mergeRequestTitles.test.ts`, every `MergeRequest*.vue`).
- Lucide `messages-square`, `chevron-right`, `chevron-down`, `arrow-left`, `refresh-cw`, `check` exist.

## Target

**Owned:**

- `frontend/src/ui/MergeRequestsView.vue`
- `frontend/src/ui/MergeRequestPersonView.vue` (new), `frontend/src/ui/MergeRequestPersonEntry.vue` (new),
  `frontend/src/ui/MergeRequestPersonMenu.vue` (new), `frontend/src/ui/MergeRequestWriters.vue` (new)
- `frontend/src/ui/MergeRequestMenu.vue` (generic over `{ label }`; its two callers compile unchanged)
- `frontend/src/ui/mergeRequestsText.ts`, `frontend/src/ui/mergeRequestsText.test.ts`
- `frontend/src/ui/MergeRequestPersonView.test.ts` (new, SSR)

**Read-only:** everything else. `docs/**`, `.omp/skills/**`, `ui/AGENTS.md`: lines in `deviations_from_brief` (the docs
keeper writes them).

**Non-goals:** project-wide people search; writing as the selected person; starting, editing or deleting comments;
reactions; live updates; a second sort (request non-goals).

## Contract

Fixed. You may add, never change.

```ts
// ui/mergeRequestsText.ts
export const PERSON_VIEW = "Discussions";
export const PERSON_VIEW_TIP = "Every open discussion, for one person";
export const BACK_TO_LIST = "Back to list";
export const PERSON_MENU = "Whose discussions";
export const EXPAND_THREAD = "Show the whole thread";
export const COLLAPSE_THREAD = "Hide the thread";
/** F1: "Loading discussions — 12 of 27 merge requests". */
export function personLoadingText(answered: number, asked: number): string;
/** D4: the "+N" chip's tooltip, the folded writers oldest first: "3 more: Anna Berg, Ben Okafor, Someone". */
export function foldedWritersText(names: readonly string[]): string;
/** F2: "!615 Snooze a reminder — <discussionsFailedText(failure, platform)>". */
export function personFailureText(row: { iid: number; title: string }, text: string): string;

// ui/MergeRequestMenu.vue
// <script setup lang="ts" generic="C extends { readonly label: string }">
defineProps<{ choices: readonly C[]; name: string; open: boolean; above: boolean }>();
defineSlots<{ default(props: { shown: readonly C[] }): unknown }>();

// ui/MergeRequestPersonView.vue
defineProps<{ now: number; asking: boolean }>();
// ui/MergeRequestPersonEntry.vue
defineProps<{
  entry: PersonEntryShown;
  person: Viewer;
  now: number;
  expanded: boolean;
  thread: Thread | null;
}>();
defineExpose<{ focusChevron(): void }>();
// ui/MergeRequestPersonMenu.vue
defineProps<{ lines: readonly PersonLine<Person>[]; asking: boolean }>();
defineEmits<{ pick: [person: Viewer] }>();
// ui/MergeRequestWriters.vue
defineProps<{ writers: readonly (Person | null)[] }>();
```

### Rules (design §2.6, §2.8)

- **Page (A1).** A "Discussions" button (`messages-square`, `v-tooltip` `PERSON_VIEW_TIP`, `aria-pressed`) in the filter
  row right after the review-mode controls, disabled while no row is listed. Pressed: save the list `<ul>`'s `scrollTop`
  in component state, `openPersonView()`; the list's place shows `MergeRequestPersonView`. Pressed again or "Back to
  list": `leavePersonView()`, then after the list renders (`nextTick`) restore `scrollTop` and focus the Discussions
  button. The page header and the filter row stay.
- **Header.** "Back to list" (`arrow-left`, focused when the view opens), the person menu, a `role="status"` text —
  `personLoadingText` while `loading`, else `turnSummaryText(counts, person)` — and the reload button (`refresh-cw`,
  `RELOAD_DISCUSSIONS`, spinning while `reloading`, `refreshPersonView`). Under it each failure: `personFailureText` and
  Retry (`retryRow`), `role="alert"`. No entries and nothing loading: `turnSummaryText`'s "No open discussions".
- **Entry, collapsed (D1–D4).** The chevron button (`chevron-right`, `aria-expanded="false"`, `aria-label`
  `EXPAND_THREAD`); the starter's `MergeRequestPicture size="box"` and `noteAuthorName`, `agoText(first.createdAt, now)`
  with `v-tooltip` `dateTimeText(first.createdAt)`; `!<iid>` and the title, muted; `placeText(place)`, muted; the first
  comment's blocks in a `max-h-20 overflow-hidden` box (four `leading-5` lines); `MergeRequestWriters` over
  `laterWriters(discussion)` and, right of it, the turn word (`turnText(turn, person, row.author)`, `TURN_MARK` when the
  group is `turn`), or `check` + "Resolved" muted when `resolved`.
- **Entry, expanded (E3).** The chevron `chevron-down`, `aria-expanded="true"`, `COLLAPSE_THREAD`; the head with the turn
  word or Resolved at its right; `MergeRequestThreadButtons` and `MergeRequestThreadBody placement="inline"` for `thread`
  (author `row.author?.username ?? null`); the clamp and the writers row hidden. The body's `cancel` focuses the chevron
  (E5); `focusHost` focuses the entry.
- **Chevron (E2).** Click (or Enter/Space, native) toggles: `expandEntry(iid, id)` / `collapseEntry(id)`.
- **Shift (E1).** One `watch(useShiftTaps(), …)` in `MergeRequestPersonView`: the entry under the pointer
  (`pointerenter`/`pointerleave` on each entry's `li`), else the focused one (`focusin`/`focusout`), expands; already
  expanded: nothing; nothing while `isTypingTarget(document.activeElement)` (RK59, RK73). Each entry's `li` carries
  `aria-keyshortcuts="Shift"` and the `SHOW_THREAD_KEY` tooltip on its head.
- **Writers (D3, D4).** `useElementSize` of the row; `fits = floor((width + gap) / (picture + gap))` with the `box` size
  (20 px) and the row's gap; `foldedWriters(writers, fits)`; the `+N` chip first (`moreText`-style "+N", `v-tooltip`
  `foldedWritersText`), then the shown pictures oldest left, each with `v-tooltip` `noteAuthorName(writer)`. No writers:
  nothing rendered.
- **Person menu (B2).** An opener (the chosen line's picture and label) and `MergeRequestMenu` over `lines`
  (`menuitemradio`, picture + label, `aria-checked` for `chosen`, no count), its own `useHoverMenu`, and a window Escape
  listener that closes only this menu (not `defaultPrevented`, not while `asking`, then `preventDefault`). A pick emits
  `pick` and closes the menu.
- **Escape.** Nothing else in the view handles Escape; no Escape leaves the page (#189 C).

## Change

1. `mergeRequestsText.ts` words per the Contract, with tests.
2. `MergeRequestMenu.vue` generic.
3. The four new components per the Rules.
4. `MergeRequestsView.vue`: the button, the swap, the scroll keep.
5. `MergeRequestPersonView.test.ts` (SSR over the `?mr=list` fixture slice, the `MergeRequestDiscussionsBox.test.ts`
   setup).

## Acceptance

**Tests** (`pnpm -C frontend test`):

- `MergeRequestPersonView.test.ts`:
  - `an_entry_shows_its_starter_time_merge_request_place_and_first_comment` (D1, D2; the clamp class; the first comment's
    `<strong>`, `<code>`, link and image from p1).
  - `the_writers_row_lists_the_later_writers_oldest_first_and_none_for_a_single_comment` (D3).
  - `the_turn_word_reads_from_the_persons_side` (B3: "Your turn" for Me, "Anna Berg's turn" … for Anna).
  - `an_expanded_entry_shows_the_inline_thread_and_hides_the_clamp` (E3).
  - `two_expanded_entries_each_show_their_thread` (E4).
  - `failed_rows_show_one_line_each_with_retry` (F2).
  - `the_loading_line_counts_the_merge_requests` (F1).
- `mergeRequestsText.test.ts`: the three functions.
- `mergeRequestTitles.test.ts` passes (no `title`).

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just mutants HEAD`.

**Smoke (WebKit fixture, dark and light; the verifier repeats it in full):** `just app-session start-fixture --name mpv
--diff --mr list --open-mr --size 1600x1000`: Discussions → the view with "Loading discussions — n of N merge requests",
then Me's order as `mergeRequestPersonView.test.ts` pins it; p1's entry shows its formatted first comment cut at four
lines, Ben, Chiara, Dmitri's pictures and the turn word; p6 shows "+N" first; Shift over p1 expands it, Shift again does
nothing, the chevron collapses and expands; Back → the list at the same scroll. `shot` dark and light.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK41, RK59, RK73, RK77),
`skill://verification`.
