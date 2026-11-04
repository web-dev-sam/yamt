# Slice mr-review-mode-page — the review-mode button and picker, the sort icon, test data; wires the window

Feature: review mode on the merge-request page. Sources:

- Request `docs/slices/request-mr-review-mode.md`: rules 1, 2, 4, 6 (the failure tooltip), 7 (the button's presence),
  and the WebKit-fixture and real-app acceptance.
- Design `docs/slices/briefs/mr-review-mode-design.md` option A, §1.3, §1.6, §1.7, §1.9.
- Proposed plan §2 #165, #166; proposed RK62, RK63.

Needs `mr-review-mode-core` landed: the slice's `filters.review`, `choices.review`, `viewer`, `reviewSort`,
`review(who)`, the core words, `REVIEW_MODE` and `discussionsFailedText`. **Wires the window:** the last implementer
slice.

## Target

**Owned:**

- `frontend/src/ui/`:
  - New components: `MergeRequestReviewMode.vue` (the button and its picker) and `MergeRequestReviewSort.vue` (the sort
    icon).
  - `MergeRequestsView.vue`.
  - `menuKeys.ts`, `menuKeys.test.ts`.
  - `AGENTS.md`.
- `frontend/src/ipc/`: `fixtureMergeRequestDiscussions.ts`, `fixtureMergeRequestDiscussions.test.ts`,
  `fixtureMergeRequests.test.ts`, `AGENTS.md`.
- `tests/glab/mr-review-mode/**` (new scenario) and `tests/glab/README.md`.

**Read-only:**

- Everything else. In particular:
  - Everything `mr-review-mode-core` owns: `mergeRequests/**`, `ui/mergeRequestFilters.ts`, `ui/mergeRequestsShown.ts`,
    `ui/mergeRequests.ts`, `ui/mergeRequestDiscussions.ts`, `ui/MergeRequestDiscussions.vue`,
    `ui/mergeRequestsText.ts`, and their tests.
  - `ipc/fixtureMergeRequestData.ts` and its test.
  - `scripts/fake-glab/glab` (unchanged: it already serves `graphql-page-1.json` and
    `graphql-discussions-<iids joined by ->.json`, `scripts/fake-glab/glab:124-136`).
  - `crates/**`.
- The patterns to follow: `ui/MergeRequestFilter.vue` (opener, menu, narrowing box, `defineExpose`),
  `ui/useHoverMenu.ts`, `ui/tooltip.ts`, `ui/mergeRequestTitles.test.ts` (no `title` attribute).

**Non-goals:**

- Other sort choices.
- An "off" item in the picker (Clear filters turns review mode off, rule 2).
- Assigning reviewers, notifications.
- A reviewer not on any loaded merge request.
- Changing the core's order, words or stored form.
- Rust.

## Contract

Existing (from `mr-review-mode-core`, fixed):

- `useMergeRequests()` gives:
  - `filters` (with `review: ReviewFor | null`), `choices.review: readonly Choice<ReviewFor>[]`, and `review(who)`.
  - `viewer: ComputedRef<Viewer>`.
  - `reviewSort: ComputedRef<ReviewSort | null>` (`sorted { loading }` | `failed { iid, failure }`).
  - `discussionDetails`, `clearAll`.
- Core: `reviewSortedText(viewer, loading)`, `reviewFailedText(viewer, iid, reason)`, `filterName`, `NARROW_FROM`,
  `narrowed`, `Choice`, `ReviewFor`, `Viewer`, `reviewing`, `reviewOrdered`, `filtered`.
- `ui/mergeRequestsText.ts`: `REVIEW_MODE` ("Review mode"), `discussionsFailedText(failure, platform)`, `narrowLabel`,
  `narrowPlaceholder`.
- `useHoverMenu` / `useDropdownMenu`: `openFor`, `above`, `pointerEntered`, `pointerLeft`, `openerClicked`,
  `menuKey`, `dismiss`, `close`.

New here:

```ts
// ui/menuKeys.ts
export const MENU_ITEMS = "[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]";

// ui/MergeRequestReviewMode.vue
defineProps<{
  choices: readonly Choice<ReviewFor>[];
  active: boolean; // review mode on: the opener gets a set filter's border
  open: boolean;
  above: boolean;
}>();
defineEmits<{
  pick: [value: ReviewFor];
  openerClick: [];
  pointerEnter: [];
  pointerLeave: [];
  menuKey: [event: KeyboardEvent];
}>();
defineExpose({ opener, menu, narrowBox });

// ui/MergeRequestReviewSort.vue
defineProps<{ sort: ReviewSort; viewer: Viewer }>();
```

**`MergeRequestReviewMode.vue`** (rule 1):

- **Wrapper:** a `div` with `@pointerenter`/`@pointerleave` emits, as `MergeRequestFilter.vue:111-115`.
- **Opener:** `<button ref="opener" type="button" aria-haspopup="menu" :aria-expanded="open" v-tooltip="REVIEW_MODE"
  :aria-label="REVIEW_MODE">` holding Lucide `~icons/lucide/user-round-search` (`size-4`, `aria-hidden`) and no text
  (rule 1: an icon with a tooltip).
  - Classes as the filter opener (`:121`), with `border-primary` when `active`.
- **Menu:** `v-if="open"`, `ref="menu"`, the filter menu's container classes and `above` placement (`:139-145`),
  `@keydown` → `menuKey`.
  - Above `NARROW_FROM` choices, the filter's narrowing box: `narrowLabel(filterName("reviewer"))`,
    `narrowPlaceholder(filterName("reviewer"))`, reset on each opening.
  - Then `<ul role="menu" :aria-label="REVIEW_MODE">`. Each choice is
    `<button type="button" role="menuitemradio" :aria-checked="choice.state === 'included'">` with a `check` icon
    column (shown when included), the label, and the muted count, the filter item's layout without the minus column.
  - A click emits `pick(choice.value)`.

**`MergeRequestReviewSort.vue`** (rules 4, 6):

- `text`:
  - `sorted` → `reviewSortedText(viewer, sort.loading)`.
  - `failed` → `reviewFailedText(viewer, sort.iid, discussionsFailedText(sort.failure, navigator.platform))`.
  - An exhaustive `switch`.
- `<span role="img" v-tooltip="text" :aria-label="text" class="flex items-center px-1">` with
  `~icons/lucide/arrow-down-wide-narrow` (`size-4`, `aria-hidden`), `text-primary` when sorted and
  `text-problem-error` when failed.
- No `title` attribute anywhere (`mergeRequestTitles.test.ts`).

**`MergeRequestsView.vue`:**

- `useHoverMenu<ListFilter | "review">`.
  - `menu()`: a filter bar's menu, else the picker's.
  - `opener(which)`: the picker's opener for `"review"`, else `barOf(which)`.
  - `openerClick(which)`: focuses that part's `narrowBox` as today.
- **In the filter bar, after the three filters and before Clear filters:**
  - `<MergeRequestReviewMode v-if="discussionDetails === 'full'" ref="picker" :choices="choices.review"
    :active="filters.review !== null" :open="openFor === 'review'" :above …>` (rule 7: hidden with "lazy" and
    "off").
    - `@pick`: `requests.review(value)`, then `close()`, so focus returns to the opener.
    - The other events are as for a filter.
  - Then `<MergeRequestReviewSort v-if="reviewSort !== null" :sort="reviewSort" :viewer="viewer" />`.
- Clear filters is unchanged: `isFiltered` already counts `review`, and `clearAll` writes `NO_FILTERS`.

**Fixture `?mr=list` (`ipc/fixtureMergeRequestDiscussions.ts`)** (design §1.9):

- Discussion 1's last comment is by the row's first reviewer: `row.reviewers[0]?.person ?? null`, replacing `sam()`.
  Its place, text and time stay as they are.
- `DISCUSSIONS_FAILED_IID = 615`, replacing 633. `DISCUSSIONS_LOGGED_OUT_IID` stays 629.

**Scenario `tests/glab/mr-review-mode/`** (data only; shapes copied from `tests/glab/mr-discussions/`):

- The user is `sam` ("Sam Doe").
- `project.json` is a copy of `mr-discussions/project.json`.
- `graphql-page-1.json`:
  - One page, the last; `queryComplexity` 170 of 250; every row `diffHeadSha: null`, `headPipeline: null`, labels
    and assignees empty, `avatarUrl: null`.
  - Reviewers carry `mergeRequestInteraction { approved: false, reviewState: "UNREVIEWED" }`.

  | iid | title               | createdAt            | draft | author | reviewers | resolvable / resolved |
  | --- | ------------------- | -------------------- | ----- | ------ | --------- | --------------------- |
  | 97  | Card reminders      | 2026-11-03T09:00:00Z | no    | ben    | anna      | 1 / 0                 |
  | 96  | Board filters       | 2026-11-02T09:00:00Z | no    | ben    | sam, anna | 2 / 0                 |
  | 95  | Draft: Card archive | 2026-11-01T09:00:00Z | yes   | anna   | sam       | 1 / 0                 |
  | 94  | Week view           | 2026-10-31T09:00:00Z | no    | anna   | sam       | 1 / 0                 |
  | 93  | Export CSV          | 2026-10-30T09:00:00Z | no    | ben    | sam       | 2 / 0                 |
  | 92  | Swimlanes           | 2026-10-29T09:00:00Z | no    | sam    | anna      | 1 / 0                 |
  | 91  | Card colours v2     | 2026-10-28T09:00:00Z | no    | anna   | sam, ben  | 0 / 0                 |
  | 90  | Import Trello       | 2026-10-27T09:00:00Z | no    | anna   | ben       | 1 / 0                 |

- `graphql-discussions-97-96-95-94-93-92-90.json`:
  - The window asks every row with a count, in list order.
  - `queryComplexity` 58 of 250.
  - Each open discussion has `resolvable: true`, `resolved: false`, and one person's note with a page
    `https://gitlab.example/taskboard/taskboard/-/merge_requests/<iid>#note_<n>`.
  - !90 is absent from the answer (Rust answers that row `Failed`, as `mr-discussions`' !78):

  | iid | discussion: place, last comment's author                                 |
  | --- | ------------------------------------------------------------------------ |
  | 97  | Overview, anna                                                           |
  | 96  | (a) `src/board/filters.ts` line 4, ben; (b) Overview, sam (newer than a) |
  | 95  | Overview, anna                                                           |
  | 94  | `src/board/week.ts` line 12, anna                                        |
  | 93  | (a) `src/export/csv.ts` line 8, sam; (b) Overview, sam                   |
  | 92  | Overview, anna                                                           |

- `tests/glab/README.md`: one `mr-review-mode/` paragraph in the style of the others.

## Change

1. `menuKeys.ts` (+ test: an item with `menuitemradio` is stepped).
2. `MergeRequestReviewSort.vue`, `MergeRequestReviewMode.vue`, then `MergeRequestsView.vue`.
3. The fixture change and its tests.
   - Rewrite `both_turns_occur_for_sam_and_some_rows_wait_only` for the new data: on two-discussion rows, discussion 1
     is the first reviewer's and newer; for sam both a turn and a wait occur.
   - Add `the_review_orders_the_smoke_expects`: build the design's table (§1.9) with the core's `filtered(rows,
     reviewing(who), "sam")`, `reviewOrdered` over `fixtureDiscussions` and the five due dates, and expect exactly:
     - Me: `!618 !633 !623 !622 !638 !603 !608`, normal `!622 !618 !633 !623 !638 !608 !603`.
     - Anna: `!602 !622 !630 !612 !632 !617`, normal `!622 !602 !632 !630 !617 !612`.
     - Anna with Draft All: `!602 !622 !630 !627 !612 !632 !617 !606`.
     - Chiara: `failed` naming !615, rows `!638 !635 !630 !615 !614 !605`.
   - If a number differs, the data or the design is wrong: stop and report it; do not adjust the expectation to the
     data.
4. The scenario and its README paragraph.
5. `ui/AGENTS.md`: the button, the picker in the bar's hover menu, the sort icon, and the core slice's reported `ui/`
   lines. `ipc/AGENTS.md`: the fixture's discussion 1 and the failing iid.

## Acceptance

**Vitest:**

- `menuKeys.test.ts`: a radio item is stepped.
- The two fixture tests above.
- `mergeRequestTitles.test.ts` still green.

**Commands:**

- `pnpm -C frontend lint`, `typecheck`, `test` (the fences, PM10: the new components import no root): summary lines.
- `just map-check`: list its findings (the two components) for the docs keeper.

**WebKit smoke on the fixture.** Start with `just app-session start-fixture --name rmp --diff --mr list --size
1600x1000`. Before opening the page, store the due dates and reload:

```
read "localStorage.setItem('yamt.mergeRequests.dueDates', JSON.stringify({'/home/sam/taskboard/.git': {'618': '2026-11-04', '633': '2026-11-05', '623': '2026-11-05', '622': '2026-11-01', '602': '2026-11-06'}})); setTimeout(() => location.reload(), 0)"
```

Then click "Merge requests". Read a row order as the `!iid`s of the list's rows, top to bottom.

1. **Button.** A `user-round-search` button sits after the Label filter. Hovering it shows the tooltip "Review mode",
   and its menu opens on hover.
   - The menu lists "Me" first, then the Reviewer filter's people in that filter's order (compare with the Reviewer
     list), and no "None".
   - The arrow keys step through it.
2. **Pick Me.**
   - The menu closes and focus is on the button. The filters read "Reviewer: Me" and Draft "Ready", Assignee and Label
     are cleared, and the search text is kept (type `Card` before the pick in one run, then clear it).
   - The rows are `!618 !633 !623 !622 !638 !603 !608`.
   - The sort icon shows. Its tooltip (and `aria-label`) reads "Sorted for your review: due with your turn first,
     then fewest waiting on the author".
3. **Pick Anna Berg.**
   - Reviewer reads "Reviewer: anna", and the rows are `!602 !622 !630 !612 !632 !617`.
   - The tooltip reads "Sorted for Anna Berg's review: due with their turn first, then fewest waiting on the author".
   - !632's discussion box reads "1 of 2 waits for Anna Berg", with "Anna Berg's turn" and "Waiting for an answer".
4. **Change a filter.** Draft → All. The rows are `!602 !622 !630 !627 !612 !632 !617 !606`, and the icon stays.
5. **Reload** (`read "setTimeout(() => location.reload(), 0)"`), then open the page again.
   - Reviewer anna and Draft All are back, with the same order and the icon.
   - `localStorage` `yamt.mergeRequests.filters` holds `"review":"user:anna"` beside the four keys.
6. **Clear filters.**
   - Every row is back in the normal order (dated first), and the icon is gone.
   - !632's box reads "1 of 2 waits for you" and "Your turn".
   - The button no longer has the set border.
7. **Failure.** Pick Chiara Rossi. The rows are `!638 !635 !630 !615 !614 !605`, and the icon is in the error colour.
   Its tooltip reads "Not sorted for Chiara Rossi's review: the discussions of !615 could not be read." followed by the
   box's own words for !615.
8. **Load lazily.** With Anna picked: Settings → Discussion details → Load lazily → Back.
   - The button and the icon are gone; Reviewer anna and Ready stay; the rows are in the normal order.
   - Settings → Load fully → Back: the button is back, and the icon and the order are not.
9. `shot` with the picker open and with the icon's tooltip shown, in yamt Dark and yamt Light (Settings → Theme).

**Real app on the fake glab** (`skill://verification`, tauri shell):

1. Build: `scripts/local-conflicts-repo.sh <scratch>/rm`, `cargo tauri build --debug --no-bundle`.
2. Start: `just app-session start-app --name rm --diff --dir <scratch>/rm --glab mr-review-mode`.
3. Open the merge requests page.

Expected:

- The fake glab log has one discussions call with `iids=["97","96","95","94","93","92","90"]`.
- The picker lists Me, Anna Berg, Ben Okafor.
- **Me:** rows `!94 !91 !96 !93` (normal `!96 !94 !93 !91`).
  - Set !93's due date to 04.11.2026 through its calendar box: still `!94 !91 !96 !93` (a due row that is not
    sam's turn stays with the rest).
  - Draft → All: `!95 !94 !91 !96 !93`.
- **Anna Berg:** `!97 !96 !92` (since the threads turn rule, plan #179; before: `!96 !97 !92`). !96's box reads "0 of 2
  wait for Anna Berg".
- **Ben Okafor:** `!91 !90`, with the icon in the error colour and its tooltip naming !90.
- **Clear filters:** all 8 rows, `!93` first (dated), then newest first.
- **Reload and the setting:** as WebKit steps 5 and 8.
- `shot` in dark and light.
- Stop the session.

**Mutation:** `just mutants HEAD` in your workspace (SP11). The changed non-test `.ts` are `menuKeys.ts` and the
fixture.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://comment-policy`, `skill://verification`,
`skill://risk-register` (proposed RK62, RK63).
