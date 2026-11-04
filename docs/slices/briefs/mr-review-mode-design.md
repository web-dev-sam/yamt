# Review mode: the next merge request to review, for me or any reviewer — design

Request: `docs/slices/request-mr-review-mode.md` (rules 1–7 settled; this design closes its three "to be measured"
points and refines only details a rule names). It builds on the discussions feature (`request-mr-discussions.md`,
design `briefs/mr-discussions-design.md`, plan §2 #162–#164, RK60–RK61). Base commit `5fce6e10`.

Facts come from the tree at `5fce6e10`, cited `file:line`. The discussions design's measurements are cited
"discussions design §n". Anything not observed is marked `[INFERENCE]`.

## 1. The request's open points, measured

### 1.1 Where the order lives: the `mergeRequests/` core, over the shown rows

- **The normal order today.**
  - `merged` keeps the list newest first, ties by iid (`mergeRequests/internal/order.ts:6-19`).
  - `byDueDate` puts dated rows first, soonest first, equal days newest first; the rest keep their order
    (`order.ts:21-40`).
  - The shown rows are `datedFirst(searched(filtered(rows, filters, me), search))` (`ui/mergeRequestsShown.ts:35-38`).
    `datedFirst` is `byDueDate` over the stored dates (`ui/mergeRequestDueDates.ts:75-78`).
- **The review order is one more pure function beside it: `reviewOrdered` in a new `mergeRequests/internal/reviewOrder.ts`.**
  1. It first puts the rows in the normal order (`byDueDate`, the same function `datedFirst` calls). So rule 3.3
     ("ties keep the normal order") holds by construction, and there is one definition of the normal order.
  2. Then it does one stable sort with two keys:
     - the group: due with at least one discussion that is the reviewer's turn first (rule 3.1);
     - inside the second group, the number of discussions waiting on the author (rule 3.2), fewest first.
  3. Inside the first group no key is needed: the normal order already puts the soonest day first and equal days
     newest first.
  - `Array.prototype.toSorted` is stable (ECMA-262 requires a stable sort since ES2019; `toSorted` uses the same
    comparison) `[INFERENCE: spec, not measured]`. The tests pin every tie (§2 A, tests).
- **The counts reuse the turn rule.** `turnCounts(open, viewer)` (`mergeRequests/internal/discussions.ts:51-57`)
  takes any username. `viewersTurn` is "the reviewer's turn" and `waiting` is "the reviewer waits for the author"
  (`turnOf`, `discussions.ts:33-35`). No second turn rule.
- **The core stays self-contained (PM3).** It sees each row's details through a structural `ReviewDetails<F>`:
  none | loading | read { discussions } | failed { failure: F }. `F` is the window's own failure value, passed
  through untouched, so the core never knows `DiscussionLoad`. This is the same pattern as the structural
  `OpenDiscussion` (`discussions.ts:4-12`).

### 1.2 How the stored filter words gain the order and the person

- **Stored today** (plan §2 #134/#155):
  - `yamt.mergeRequests.filters` = `{ [repository]: { assignee, reviewer, label, draft } }` through `storedRecord`.
    The entries are opaque `unknown` there (`ui/windowStorage.ts:51-67`).
  - `filtersFrom` reads exactly those four keys with `Reflect.get` and ignores any other key
    (`mergeRequests/internal/stored.ts:77-88`).
  - `set` removes the entry when nothing is filtered (`ui/mergeRequestFilters.ts:57-61`).
  - Clear filters writes `NO_FILTERS` (`mergeRequestFilters.ts:78-80`).
- **New: a fifth key, `review`, in the same entry:**
  - `"me"` or `"user:<username>"`, the person words of #134, read by the existing `personFrom`. `"none"` and junk
    read as off.
  - It is written only while review mode is on, so an entry without review mode is byte-for-byte today's form:
    ```json
    {
      "/home/sam/taskboard/.git": {
        "assignee": [],
        "reviewer": ["user:anna"],
        "label": [],
        "draft": "ready",
        "review": "user:anna"
      }
    }
    ```
- **An older yamt still reads it.** Its `filtersFrom` reads the four keys and drops `review` (`stored.ts:77-88`).
  - It shows Reviewer = anna and Ready, in the normal order.
  - Its next filter change writes the entry without `review`, so the order is off from then on, for both versions.
    Nothing becomes unreadable.
- **In the window's state, `review` is a fifth field of `Filters`** (`ReviewFor | null`; `ReviewFor` is `PersonValue`
  without "None"). This gives rule 2's behaviour without new code:
  - Every edit spreads the filters (`clicked`, `withDraft`, `cleared`, `filters.ts:147-169`), so a filter change keeps
    the order.
  - `NO_FILTERS` gains `review: null`, so Clear filters clears the order.
  - `isFiltered` counts `review`, so Clear filters shows (`MergeRequestsView.vue:161-168`) and the entry is kept
    (`mergeRequestFilters.ts:57-61`) while only the order is set.
  - Choosing a person is `reviewing(who)`: Reviewer = who (included), Draft = ready, nothing else (rule 2). The search
    is separate state (`ui/mergeRequests.ts:88`), so it stays.

### 1.3 The reviewer picker: a second opener of the bar's one hover menu

- **The bar has one `useHoverMenu<ListFilter>`** (`MergeRequestsView.vue:59-63`): at most one list open by
  construction, plus hover, pin and the 300 ms close (plan §2 #155, `ui/useHoverMenu.ts`).
  - A picker with its own dropdown could be open at the same time as a filter list. #155 rejected exactly that
    ("one dropdown per filter (two open at once …)").
  - So the picker joins the same menu: `useHoverMenu<ListFilter | "review">`, with `menu()` and `opener()` extended
    to the picker's elements.
- **The Reviewer filter's own list is not the picker.**
  - Its items are `menuitemcheckbox` buttons whose click and Shift-click include or exclude
    (`MergeRequestFilter.vue:156-185`). A second action per item would need a button inside a button, or a mode.
  - Rule 1 asks for a button of its own that "asks for whom".
- **The picker's list is derived from the Reviewer filter's choices.** That is `personChoices(rows, "reviewers", …)`:
  Me, then None, then the people by count, then by name (`choices.ts:98-102`). The picker takes that list without
  None (core `reviewChoices`). "Me" is first and the rest are "as that filter lists them" by construction (vision 2).
  - Items are `menuitemradio`, the chosen one `aria-checked`.
  - `MENU_ITEMS` (`ui/menuKeys.ts:1`) gains `[role=menuitemradio]`, so the arrow keys and first-item focus
    (`useDropdownMenu.ts:79-117`) reach them.
  - Above `NARROW_FROM` (8) choices, the same narrowing box as a filter appears, with its words
    (`narrowLabel("Reviewer")`).
  - A pick closes the menu with focus back on the opener (`close`, `useDropdownMenu.ts:38-45`).
  - There is no "off" item: rule 2 makes Clear filters the way out.

### 1.4 Rows moving while the user reads (rule 6): at once, at most once per answer

- **The details map is written once per answer:** `settle` builds the next map and assigns it once
  (`ui/mergeRequestDiscussions.ts:73-97`, the write at `:95`). One call runs at a time (`:99-114`). So a computed
  order moves rows at most once per glab call.
- **How often that happens:**
  - Fixture `?mr=list`: one answer every 400 ms, 10 rows each (`fixtureMergeRequestDiscussions.ts:20-21`). Its 40
    rows (`fixtureMergeRequests.ts:62-63`) have about 26 rows with a count, so 3 answers in about 1.2 s.
  - Real: 20 rows per call, 4.47 s per call on gitlab-org/gitlab (discussions design §1.1). A typical project needs
    one or two calls `[INFERENCE, discussions design §1.1]`.
  - The largest list (500 rows, all with discussions) needs about 25 calls, ≈ 2 min.
- **At a Refresh's swap, and when the page is opened again after 30 s** (`mergeRequests.ts:113-118`, `:183-186`),
  every entry is dropped and asked again (`mergeRequestDiscussions.ts:241-244`; #162, discussions rule 7). In review
  mode every row then sorts "as none" until its answer comes, so rows move back over those seconds.
- **Decision: move at once.** The order is a `computed` over the entries: one source of truth, no second state
  (vision 2). Rule 6 says "move once they arrive".
  - While any shown row is loading, the sort icon's tooltip adds how many rows are still loading and that they move
    when their details arrive.
  - Freezing the order until the queue is idle is option C below; it is rejected.

### 1.5 Whose turn follows the mode (rule 5)

- One derived value, `viewerOf(review, me, rows)`: `Viewer = me { username | null } | person { username, name }`.
  - Review mode off, or "Me", or a person whose username is `me` → `me`.
  - Otherwise → `person`, with the display name of that reviewer on the first loaded row that has them, else the
    username (`displayName`, `people.ts`).
- The discussions box (`MergeRequestDiscussions.vue:30,51,57,73`, today `me`) and the review order read the same
  `viewer`. Clear filters sets `review` to null, so the box speaks for the logged-in user again.
- **Words** (discussions rule 3: "Your turn" / "<name>'s turn" in review mode):
  - `turnText(turn, viewer)` → "Your turn" or "Anna Berg's turn"; waiting stays "Waiting for an answer".
  - `turnSummaryText(counts, viewer)` → "2 of 5 wait for you" or "2 of 5 wait for Anna Berg".
  - Today the only caller of both is `MergeRequestDiscussions.vue` (grep).

### 1.6 Failure (rule 6) and the icon's tooltip (rule 4)

- **A failed row.** When any shown row's details are refused or failed, the list keeps the normal order, and the
  tooltip names the first such row and why. Rule 6 read literally: a single failed row has no defined place in a
  review order. Open question 1 offers the alternative.
- **The reason** reuses the box's own words: `glabRefusalText(answer)` for a refusal, `problemText` at step
  `discussions` for an IPC failure (`MergeRequestDiscussions.vue:65-89`).
  - The two-branch choice moves into `ui/mergeRequestsText.ts` `discussionsFailedText(failure, platform)`. It then
    has two users: the box header and the sort icon.
  - The platform is read in the component, as every `problemText` caller does (`navigator.platform`,
    `ProblemBar.vue:11`).
- **The tooltip's words**, from the core:
  - "Sorted for your review: due with your turn first, then fewest waiting on the author"
  - "Sorted for Anna Berg's review: due with their turn first, then fewest waiting on the author"
  - The loading suffix: " (the discussions of 3 merge requests are still loading; they move when they arrive)".
  - "Not sorted for Chiara Rossi's review: the discussions of !615 could not be read. <reason>"
- **The icon** is Lucide `arrow-down-wide-narrow` (present in `@iconify-json/lucide`, checked), in the primary colour,
  in the error colour on failure. It is a `role="img"` span with `v-tooltip` and `aria-label`, because the page
  forbids `title` (plan §2 #154; `mergeRequestTitles.test.ts`).
- **The button** is Lucide `user-round-search` (present), with the tooltip and accessible name "Review mode". While
  the order is on it has the border of a set filter.

### 1.7 Only with details loaded fully (rule 7)

- The setting reaches the slice as `discussionDetails: () => DiscussionDetails` (`mergeRequests.ts:75`), and
  `discussionDetails` is already on the slice (`mergeRequestDiscussions.ts:28`).
- **The gate sits in the remembered filters:** `createRememberedFilters(repository, reviewable, storage)`.
  - `filters` reads `review` as null while `reviewable()` is false, so neither the order nor the viewer can use it.
  - When `reviewable()` turns false with a stored `review`, the entry is written once without it. The order is off
    (it does not come back with "Load fully"), and Reviewer and Draft stay.
- **The button** is shown only when `discussionDetails === "full"`. The icon shows only while the slice's
  `reviewSort` is not null.
- **Edge `[INFERENCE]`.** If the setting changes while the window has no project yet, `set` writes nothing
  (`mergeRequestFilters.ts:53-56`). The gate still hides the order, and a later "Load fully" would bring that stored
  order back. This is rare: the settings load and `findProject` both run at window start.

### 1.8 No Rust change

Every input already reaches the window:

- Each row's open discussions with the last person's author, for every listed row under "Load fully"
  (`read_discussions`, #162; `listed` queues every row with a count, `mergeRequestDiscussions.ts:116-134`).
- Each row's reviewers (`MergeRequestRow.reviewers`, #151; `passes`, `filters.ts:84-96`).
- Due dates are local (#156, `mergeRequestDueDates.ts`), and so are the filters (#134).
- The setting is already in the slice (`mergeRequests.ts:75`).

So there is no new IPC command, no type crossing IPC, and no `just bindings`.

The real-app acceptance needs **data only**: the `mr-discussions/` scenario has no reviewers on any row
(`tests/glab/mr-discussions/graphql-page-1.json:21,44,67,94,117`). A new folder `tests/glab/mr-review-mode/` is served
by the unchanged fake (`scripts/fake-glab/glab:124-136`: `graphql-discussions-<iids joined by ->`, `graphql-page-1`).

### 1.9 Test data that exercises rule 3

- **Fixture `?mr=list` today:**
  - `openDiscussions = index % 3` (`fixtureMergeRequestData.ts:221`), drafts every 7th (`:210`), reviewers
    by `reviewers(index)` (`:170-181`).
  - Discussion 0's last author is the next row's author; discussion 1's is always sam
    (`fixtureMergeRequestDiscussions.ts:70-88`).
  - Two problems follow:
    - !633 (`DISCUSSIONS_FAILED_IID`, `:17`) is one of sam's reviewed rows, so "Me" would always fail (rule 6).
    - Discussion 1 being sam's means no other reviewer ever waits, so rule 3.2 has no other-reviewer case.
- **Change (page slice):**
  - Discussion 1's last comment is by the row's first reviewer (every row with two discussions has reviewers:
    `index % 3 === 2`, and `:177` gives none only at `index % 3 === 0`).
  - `DISCUSSIONS_FAILED_IID` becomes 615 (index 25: one reviewer, chiara, one discussion, not a draft).
- **Expected orders with the due dates** 618 → 04.11.2026, 633 → 05.11.2026, 623 → 05.11.2026, 622 → 01.11.2026,
  602 → 06.11.2026 (computed from the formulas above; the page slice pins them in a test):

  | reviewer, Draft Ready | normal order                       | review order                            |
  | --------------------- | ---------------------------------- | --------------------------------------- |
  | Me (sam)              | !622 !618 !633 !623 !638 !608 !603 | !618 !633 !623 !622 !638 !603 !608      |
  | Anna Berg             | !622 !602 !632 !630 !617 !612      | !602 !622 !630 !612 !632 !617           |
  | Anna Berg, Draft All  | —                                  | !602 !622 !630 !627 !612 !632 !617 !606 |
  | Chiara Rossi          | !638 !635 !630 !615 !614 !605      | unsorted: !615 failed                   |
  - Me's order covers soonest first (!618 before the older-created !633), the equal-day tie (!633 before !623), a
    due row without the reviewer's turn sorting with the rest (!622), and fewest waiting (!608 last).
  - Anna's order covers waiting for another reviewer (!632, !617 last).
  - Under the turn rule of `request-mr-threads.md` (plan §2 #179, B5: the rest ordered by fewest waiting on the
    author), `ipc/fixtureMergeRequestDiscussions.test.ts` `the_review_orders_the_smoke_expects` pins the review
    orders Me !622 !618 !633 !638 !603 !623 !608, Anna Berg !622 !630 !612 !602 !632 !617, Anna Berg with Draft All
    !622 !630 !627 !612 !606 !602 !632 !617, and Chiara Rossi unsorted (!615 failed); the normal orders are the
    table's. Soonest first is !622 !618 !633; a due row without the reviewer's turn sorting with the rest is !623 for
    Me and !602 for Anna; fewest waiting on the author last is !608 for Me and !632 !617 for Anna. No row covers the
    equal-day tie: !623 is no longer Me's turn, so it does not tie with !633.

- **Real app, `tests/glab/mr-review-mode/`** (user sam; reviewers sam, anna, ben): see the page brief's table. The
  expected review orders are Me !94 !91 !96 !93, Anna !96 !97 !92, and Ben unsorted (!90 absent from the answer).

## 2. Options

The options differ in where review mode is held and when the order is computed.

### Option A — review mode is a field of the remembered filters; the core orders the shown rows at once (recommended)

**Data structures (first):**

```ts
// mergeRequests/ (core)
type ReviewFor = Exclude<PersonValue, { kind: "none" }>; // me | person
type Filters = { assignee; reviewer; label; draft; review: ReviewFor | null };
type StoredFilters = { assignee; reviewer; label; draft; review?: string }; // "me" | "user:<username>", only while on
type Viewer =
  | { kind: "me"; username: string | null }
  | { kind: "person"; username: string; name: string };
type ReviewDetails<F> =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "read"; discussions }
  | { kind: "failed"; failure: F };
type ReviewOrder<R, F> =
  | { kind: "sorted"; rows: readonly R[]; loading: number }
  | { kind: "failed"; rows: readonly R[]; row: R; failure: F }; // rows in the normal order
// ui/
type DiscussionFailure = Extract<DiscussionLoad, { kind: "refused" | "failed" }>;
type ReviewSort =
  | { kind: "sorted"; loading: number }
  | { kind: "failed"; iid: MergeRequestIid; failure: DiscussionFailure };
// Shown gains viewer, reviewSort; Choices gains review; FilterActions gains review(who)
```

**Flow:**

1. A pick calls `review(who)`, which sets `reviewing(who)`; the remembered filters store it.
2. `shownOf` computes, once per change: `passing = searched(filtered(…))`, then either `datedFirst(passing)` or
   `reviewOrdered(passing, viewer.username, dueOf, detailsOf)`.
3. `shownRows` and `reviewSort` are both read off that one result.

**Files:**

- Core: `filters.ts`, `stored.ts`, `choices.ts`, `discussions.ts`, new `reviewOrder.ts`, `index.ts` (+ tests,
  `AGENTS.md`).
- State: `ui/mergeRequestFilters.ts`, `ui/mergeRequestsShown.ts`, `ui/mergeRequests.ts`, `ui/mergeRequestDiscussions.ts`
  (one type), `ui/mergeRequestsText.ts`, `ui/MergeRequestDiscussions.vue` (viewer, shared failure text) (+ tests).
- Page: new `ui/MergeRequestReviewMode.vue` and `ui/MergeRequestReviewSort.vue`, `ui/MergeRequestsView.vue`,
  `ui/menuKeys.ts`, the fixture's discussions, the new scenario.

**Risks:**

- Rows jump at every Refresh's swap while the details come again (§1.4). This is visible, never wrong, and the
  tooltip says it.
- An older yamt drops the order at its next write (§1.2). This is the intended reading.
- The setting changing before the project is known can leave a stored order that "Load fully" brings back (§1.7).
- One failed row unsorts the whole list (open question 1).

**Tests:**

- Core: rule 3 each step, ties in both groups, a reviewer other than Me, loading rows as none and counted, a failed
  row (normal order, first failed named), `reviewing`, edits keep `review`, `NO_FILTERS` drops it, `isFiltered`, the
  stored word (written only while on; the four old keys unchanged; "none" and junk read as off), the picker's list,
  `viewerOf`, every new word.
- State: rule 7 gate and the single write; the order moves when an answer arrives; Clear filters gives the normal
  order and the viewer `me`; a new slice on the same storage reads the order back.
- WebKit fixture and real app per the request's acceptance.

**Visions:**

- 2: one stored entry, one writer (`set`); the picker derived from the Reviewer choices; one viewer for box and order;
  one normal order.
- 4: `ReviewFor` cannot be "None"; sum types for viewer, details and order.
- 5: no new module for state, no dependency, no IPC.
- 1: the rule is one readable function.

### Option B — a review-mode state module with its own stored key; the picker inside the Reviewer checklist

**Data structures:**

- `ui/mergeRequestReviewMode.ts` owns `yamt.mergeRequests.reviewMode = { [repository]: "me" | "user:<username>" }`
  through a second `storedRecord`, with `reviewer: ComputedRef<ReviewFor | null>` and `set`/`clear`.
- `Filters` is unchanged. Clear filters calls `filters.clearAll()` and `reviewMode.clear()`. The View's "filtered"
  becomes `isFiltered(filters) || reviewer !== null`.
- The picker is an extra icon button on each person item of `MergeRequestFilter.vue` for the Reviewer filter.

**Files:** as A, plus the new module and its test, `MergeRequestFilter.vue` (a second action per item), and no change
to `stored.ts`.

**Risks:**

- Two writers for one user action, and two keys per repository that can disagree (a crash between the two writes, or
  an older yamt clearing filters but not the order). #155 rejected a second key for the same reason.
- An interactive element inside a `menuitemcheckbox` button is invalid ARIA; the list's click and Shift-click
  semantics (rule 7 of row-details) gain a third gesture.
- Rule 1's "button … asks for whom" becomes an icon inside another control.

**Tests:** as A, plus the two-key consistency (clear both, an older yamt clearing one).

**Visions:** it keeps the stored filter form untouched (a weak 2), but costs 2 (two sources for "is anything set"), 1
and 5 (a second module, a second gesture).

### Option C — A's storage, but a frozen order recomputed only when the details are complete

**Data structures:** A's, plus `reviewSnapshot: ShallowRef<readonly MergeRequestIid[] | null>`, written by a watch
when no shown row is `loading` (and on a pick or a filter change). `shownRows` puts the rows in the snapshot's order,
and rows not in it follow in the normal order.

**Files:** as A, plus the snapshot writer in `ui/mergeRequestsShown.ts` and its tests.

**Risks:**

- A second state with a watch as its writer: the order can disagree with the details shown in the box (vision 2).
- On the largest list the first review order appears only after ≈ 2 min (§1.4), meanwhile the normal order with a
  loading icon.
- It goes against rule 6's "move once they arrive".

**Tests:** as A, plus snapshot timing (a pick while loading, a refresh swap, a filter change while loading).

**Visions:** it calms the screen (a usability gain no vision names), but costs 2 and 1.

## 3. Recommendation

**Option A.**

- Review mode is what the request says it is: filters plus an order, cleared and remembered with the filters. Its
  stored form is today's plus one key that older yamt ignores.
- The order is one pure function over data that already exists, and the picker is one more opener of the menu the
  bar already has.
- No Rust, no IPC, no new dependency.

**Cost:**

- Core and state: about 22 files (≈ 12 test or doc files), ≈ 1,000 changed lines `[INFERENCE]`.
- Page: about 12 files (two new components, the view, `menuKeys`, the fixture's discussions, an 8-row scenario),
  ≈ 600 lines `[INFERENCE]`.
- One signature change ripples beyond the core: `turnText`/`turnSummaryText` gain the viewer, and `Filters` gains a
  field. That is why the core slice also owns the state files, the box and two test literals (§4).
- Rows jump back at each Refresh while the details come again (open question 2).

## Shared edits (no slice owns them; DR5: the orchestrator records the rows)

### Proposed plan §2 rows

| #   | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Rejected alternatives & why                                                                                                                                                                                                                                                                                  | Vision     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 165 | **Review mode: one reviewer's order, stored with the filters** (owner #2194, #2198–#2199; request `docs/slices/request-mr-review-mode.md`; design `briefs/mr-review-mode-design.md` option A; reopens #151's "no sort choice" for this one order; amends #134/#155's stored entry). `Filters.review: ReviewFor \| null` (Me or a person, never None), stored as a fifth key `review` (`"me"` / `"user:<username>"`) in the same `yamt.mergeRequests.filters` entry, written only while on (an older yamt reads its four keys and drops the order at its next write). A pick replaces every filter with Reviewer = that person and Draft = ready (`reviewing`); the search stays; edits keep the order; Clear filters (`NO_FILTERS`) drops it. Core `reviewOrdered` over the shown rows: the normal order (`byDueDate`), then one stable sort: due with at least one discussion that is the reviewer's turn first, the rest by fewest waiting on the author; not-arrived details count as none and rows move at each answer; a failed shown row keeps the normal order and the icon's tooltip names it and why (`discussionsFailedText`, shared with the box). `viewerOf(review, me, rows)` is the one viewer of the box and the order ("Anna Berg's turn", "… wait for Anna Berg"). Only with "Load fully": `review` reads as null otherwise, and leaving "full" writes the entry once without it, filters kept. The picker is a second opener of the bar's one `useHoverMenu` (`menuitemradio`, the Reviewer filter's choices without None, narrowed from 8); the sort icon Lucide `arrow-down-wide-narrow` with the tooltip; the button `user-round-search` "Review mode". | A second stored key and state module (two writers for Clear filters; #155 rejected a second key); the picker inside the Reviewer checklist (its items toggle include/exclude; a control inside a menu item); an order frozen until all details arrive (≈ 2 min on 500 rows, a second state, against rule 6). | 2, 4, 1, 5 |
| 166 | **Defaults decided with the review-mode design** (orchestrator, OR13; the owner may veto): any failed shown row keeps the whole list in the normal order; the tooltip for another reviewer says "their turn" and adds "(the discussions of N merge requests are still loading; they move when they arrive)" while rows load; the picker has no "off" item (Clear filters); Me's words stay "your"; the fixture's second discussion is the row's first reviewer's and its failing row is !615.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                                                                                                                                                                                                                                                            | 1          |

### Proposed risks (`skill://risk-register`, next free id RK62)

| id   | risk                                                                                                                                              | owner                                                                                                                                                        | proving test                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK62 | the review order or its viewer used while discussion details are not loaded fully, or an older yamt unable to read the filters the new one stores | `ui/mergeRequestFilters.ts` (the `reviewable` gate and the one write on leaving "full") + `mergeRequests/` `stored.ts` (`review` a fifth key, only while on) | `leaving_load_fully_turns_the_review_order_off_and_keeps_its_filters`, `the_stored_form_keeps_the_four_fields_older_yamt_reads`, WebKit step "Load lazily" |
| RK63 | a row whose details failed sorted as if nothing waited on the reviewer (a wrong "next to review")                                                 | `mergeRequests/` `reviewOrder.ts` `reviewOrdered`                                                                                                            | `a_failed_row_keeps_the_normal_order_and_is_named`, WebKit step "Chiara"                                                                                   |

### Docs keeper (once, after the page slice)

- `docs/architecture.md`:
  - §5.1: the remembered filters row (`review`, the `reviewable` gate, the fifth key); the shown-list row
    (`reviewOrdered`, `viewer`, `reviewSort`); the hover-menu row (`ListFilter | "review"`).
  - §5.4: the review-mode button, picker and sort icon in the bar; `shownRows` is either `datedFirst` or
    `reviewOrdered`.
- `.omp/skills/project-map/tree.md`: `mergeRequests/internal/reviewOrder.ts`, `ui/MergeRequestReviewMode.vue`,
  `ui/MergeRequestReviewSort.vue`, and the changed descriptions (`mergeRequestsShown`, `mergeRequestFilters`,
  `MergeRequestDiscussions`, `menuKeys`). `state.md`: `filters.review`, written only through the remembered filters'
  `set`.
- The `AGENTS.md` lines the slices report in `deviations_from_brief` (`frontend/src/mergeRequests`, `frontend/src/ui`,
  `frontend/src/ipc`).
- No ipc-contract change (no IPC). `tests/glab/README.md` belongs to the page slice.

## 4. Slice graph

The request proposed core → page. Measured (§3 cost): the core's signature changes (`Filters.review`, the viewer in
the turn words) break `ui/MergeRequestDiscussions.vue`, `ui/mergeRequestFilters.test.ts` and
`ipc/fixtureMergeRequestData.test.ts`, and rule 5 changes the same box. So the core slice also owns the window state
and the box. Each slice then leaves `pnpm typecheck` green on its own, with no known red step. The page slice is
components, wiring and data.

| wave | brief                                                                                          | owner       | needs                                   | beside              |
| ---- | ---------------------------------------------------------------------------------------------- | ----------- | --------------------------------------- | ------------------- |
| 1    | `mr-review-mode-core.md` (core + state + the box's viewer)                                     | web-impl    | —                                       | —                   |
| 2    | `mr-review-mode-page.md` (button, picker, sort icon, fixture data, scenario; wires the window) | web-impl    | core                                    | —                   |
| 3    | docs keeper                                                                                    | docs-keeper | page                                    | verify's smoke pass |
| 3    | `mr-review-mode-verify.md`                                                                     | verifier    | page (smoke); docs (final `just check`) | docs keeper         |

## 5. Open questions for the owner

Each is decided as written (row #166), and the owner may veto:

1. **One unreadable merge request unsorts the whole list.** If one reviewed merge request's discussions cannot be read
   (more than 1,000 discussions, or a batch timing out), that reviewer's list stays in the normal order and the icon
   says which one failed. The alternative is to sort the readable ones and put unreadable ones last, but those might
   be the most urgent.
2. **Rows jump at every Refresh in review mode.** A Refresh (and reopening the page after 30 s) drops all discussion
   details and loads them again (discussions rule 7). Until each answer arrives its rows sort "as if none". That is
   about 5 s per 20 merge requests on a busy GitLab. Should yamt instead keep the old details until the new ones
   arrive? That would change the discussions feature's "a refresh drops them" rule.
