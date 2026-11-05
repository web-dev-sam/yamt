# Slice mr-person-discussions-state — the person view's state: wanted rows through the one queue, the order, held entries

Feature: one person's discussions across every merge request. Sources:

- Request `docs/slices/request-mr-person-discussions.md` B1–B3, C1–C4, E4, F1–F2 and the acceptance's core sentence
  ("a held entry keeping its place") at the window's level.
- Design `docs/slices/briefs/mr-person-discussions-design.md` option A §2.4–§2.6, §2.8 (Decisions taken); proposed plan
  rows #193–#194, RK61 (amended), RK77.

Runs in round 3, after `mr-person-discussions-core`, `mr-person-discussions-threads` and `mr-person-discussions-ipc` are
committed (`ipc` last touched `mergeRequests.test.ts` and `mergeRequestDiscussions.test.ts`: only their discussion
literals). `mr-person-discussions-view` follows. It wires no window.

Facts (given):

- Queue (`ui/mergeRequestDiscussions.ts`): `send` one call at a time, every queued iid per call (Rust answers the first 10);
  `listed(rows)` only under "full" and only rows with `openDiscussions > 0` (plan #164); `asked` only under "lazy";
  `switched` → `dropped` under "off" (every entry gone), `becameLazy` under "lazy" (unsent queued iids dropped, the running
  call's iids put in `unhovered`, their answers dropped unless hovered since); `reload(queue, iid, askFirst?)` returns
  under "off" and for a row already reloading; `settle` sets `reloads` failures (`Reload`) and `counted`.
- `ui/mergeRequestDiscussionRows.ts`: `DiscussionLoad` (`loading` | `read { discussions, resolved }` | `refused` |
  `failed`), `DiscussionFailure`, `unmarkedOf`, `threadRead`, `boxClosed(entries, iid, counted)` (marks leave, count set).
- Threads (after `mr-person-discussions-threads`): `threads`, `expanded`, `expandThread(iid, id)`, `collapseThread(id)`,
  `writing`, `refreshed(iid | null, asked?)` (`threadsRefreshed` in the slice's State).
- Core (after `mr-person-discussions-core`): `personEntries`, `PersonEntry`, `PersonGroup`, `keptInPlace(previous, next,
  held, keyOf)`, `personLines`, `turnCounts`, `Viewer`, `viewerOf`.
- The slice (`ui/mergeRequests.ts`): `createState` builds the queue and threads (`discussingOf`), `rowsReplaced` drops the
  queue and re-reads threads; `createMergeRequests` spreads `shownOf(…)` (which gives `shownRows`, `viewer`), the
  refreshes (`createRefreshes`), the queue's `discussionsOf` and the threads; `show` sets the screen and empties the
  search; `close` sets the files screen.
- `ui/mergeRequestsShown.ts:98-115` holds the private `keptInPlace` for rows; `panelRow` (`:142`) reads `threads.thread`.
- `ui/mergeRequestsRefresh.ts`: private `askAgain(source)` (`:20-25`), `refreshDiscussions` (`:38-50`).
- Fixture `?mr=list` (after `mr-person-discussions-ipc`): the person cases p1–p7 on the rows `ipc` reported (defaults
  !626, !620, !621, !611), !637's thirteen and !636's three cases, !615 failing, !629 logged out, 10 rows per 400 ms call;
  tests build the slice over `createFixtureCompareSource(log, "?mr=list", {})` (`MergeRequestDiscussionsBox.test.ts:70`).

## Target

**Owned:**

- `frontend/src/ui/mergeRequestDiscussions.ts`, `frontend/src/ui/mergeRequestDiscussions.test.ts`
- `frontend/src/ui/mergeRequestDiscussionRows.ts` (only if a helper must be exported; no behaviour change)
- `frontend/src/ui/mergeRequestPersonView.ts` (new), `frontend/src/ui/mergeRequestPersonView.test.ts` (new)
- `frontend/src/ui/mergeRequests.ts`, `frontend/src/ui/mergeRequests.test.ts`
- `frontend/src/ui/mergeRequestsShown.ts` (its `keptInPlace` replaced by the core's; nothing else)
- `frontend/src/ui/mergeRequestsRefresh.ts` (export `askAgain`), `frontend/src/ui/mergeRequestsRefresh.test.ts`

**Read-only:** everything else (`mergeRequestThread.ts` is `threads`'; components are `view`'s). `docs/**`,
`.omp/skills/**`: lines in `deviations_from_brief` (the docs keeper writes `state.md`).

**Non-goals:** any component, word or DOM; changing the box's queue behaviour outside the four new entry points and the
one "off" reload rule below.

## Contract

Fixed. You may add, never change.

```ts
// ui/mergeRequestDiscussions.ts — added to DiscussionQueue
/** F1 (owner 2026-11-05): each iid without an entry gets `loading` and is queued last, whatever the setting; an iid in
 *  `unhovered` (a running call's, after a switch to "lazy") leaves `unhovered` instead of being asked again. */
wantRows(iids: readonly MergeRequestIid[]): void;
/** F2's Retry, first in the queue: a `refused`/`failed` entry becomes `loading`; a read entry whose reload failed is
 *  reloaded (entry kept). Any other iid: nothing. */
retryRows(iids: readonly MergeRequestIid[]): void;
/** C4: every iid marked at once (a read entry `reloads` running, no entry or a failed one `loading`), then `askFirst`,
 *  then all queued first in the given order; only in the generation it started in; an iid already reloading: nothing. */
reloadRows(iids: readonly MergeRequestIid[], askFirst: () => Promise<void>): void;
/** The person view left: unless the setting is "full", every queued iid not in the running call and not reloading loses
 *  its `loading` entry and leaves the queue (no call after Back); read entries stay. */
viewLeft(): void;
// and reloadDiscussions(iid, askFirst?) under "off": reloads a row that has an entry (the view's); none → nothing.

// ui/mergeRequestPersonView.ts
import type { PersonEntry, PersonLine, TurnCounts, Viewer } from "../mergeRequests";
export type PersonEntryShown = PersonEntry<OpenDiscussion, MergeRequestRow> & {
  /** Resolved from the view (the entry's mark, C3): shown "Resolved" until Back or a reload. */
  readonly resolved: boolean;
};
export type PersonFailure = { readonly row: MergeRequestRow; readonly failure: DiscussionFailure };
export type PersonViewShown = {
  readonly person: Viewer;
  readonly entries: readonly PersonEntryShown[];
  /** F1 over the shown rows with `openDiscussions > 0`; null once every one has an answered entry. */
  readonly loading: { readonly answered: number; readonly asked: number } | null;
  /** F2: each shown row whose entry is refused/failed, or whose reload failed, in the list's order. */
  readonly failures: readonly PersonFailure[];
  /** B2: personLines over the shown rows and every writer of their read discussions. */
  readonly people: readonly PersonLine<Person>[];
  /** For turnSummaryText: turnCounts of each row's unresolved discussions for the person, summed. */
  readonly counts: TurnCounts;
  /** A reload of a shown row is running (the header's icon spins). */
  readonly reloading: boolean;
};
export type PersonView = {
  /** null: the page shows its row list. */
  readonly personView: ComputedRef<PersonViewShown | null>;
  /** A1, B1: the person is the slice's `viewer` (Me, or review mode's reviewer); held empty. */
  openPersonView(): void;
  /** A1 Back: every expanded entry collapses, `boxClosed(iid)` for each row with resolved marks, `viewLeft()`, null. */
  leavePersonView(): void;
  /** B2: re-sorts everything (held becomes the expanded entries; the previous order is not kept). */
  pickPerson(person: Viewer): void;
  /** E1, E2: `expandThread` + held; already expanded: nothing. */
  expandEntry(iid: MergeRequestIid, discussion: DiscussionId): void;
  /** E2: `collapseThread`; the entry stays held. */
  collapseEntry(discussion: DiscussionId): void;
  /** F2. */
  retryRow(iid: MergeRequestIid): void;
  /** C4: one askGitLabAgain, `reloadRows` of every shown row with a count or an entry, then `threadsRefreshed(null)`;
   *  held becomes the expanded entries once the reloads are queued. */
  refreshPersonView(): void;
};
export function createPersonView(deps: {
  readonly source: MergeRequestSource;
  readonly me: Readonly<Ref<string | null>>;
  readonly viewer: Readonly<Ref<Viewer>>;
  readonly shownRows: Readonly<Ref<readonly MergeRequestRow[]>>;
  readonly queue: Pick<
    DiscussionQueue,
    "discussions" | "reloads" | "wantRows" | "retryRows" | "reloadRows" | "viewLeft" | "boxClosed"
  >;
  readonly threads: Pick<Threads, "expanded" | "expandThread" | "collapseThread">;
  readonly threadsRefreshed: (iid: MergeRequestIid | null, asked?: Promise<void>) => void;
}): PersonView & {
  /** The list was refreshed (rows replaced): held becomes the expanded entries. */
  readonly rowsReplaced: () => void;
};

// ui/mergeRequests.ts
export type MergeRequests = /* today's */ & PersonView;
// ui/mergeRequestsRefresh.ts
export async function askAgain(source: MergeRequestSource): Promise<void>; // today's private function, exported
```

### Rules (design §2.4–§2.6)

- **State:** one `ShallowRef<{ person: Viewer; held: ReadonlySet<DiscussionId>; order: number } | null>`; `order` rises on
  `openPersonView`, `pickPerson`, `refreshPersonView`, `rowsReplaced`, and an `Ordered` computed (as `shownOf`'s, over its
  previous value) applies `keptInPlace(previous, next, held, entry ⇒ entry.discussion.id)` only while `order` is the one
  the previous value was made under.
- **Entries:** `personEntries` over the shown rows (the list's order) whose entry is `read`, each row's `discussions`
  whole (resolved marks included, `resolved` from `entry.resolved`), `person = personView.person.username`.
- **Demand (F1, RK61):** a `watch` on the view, `shownRows` and `discussions`: while the view is open, `wantRows` of every
  shown row with `openDiscussions > 0` and no entry (the watch asks only for missing rows, so it never loops).
- `close()` (the page's Back to the files) calls `leavePersonView` first when the view is open; `show()` leaves the state
  null; `rowsReplaced` (a list Refresh) calls the view's `rowsReplaced`.
- `mergeRequestsShown.ts` uses the core `keptInPlace` with `row ⇒ row.iid` (clean cutover: its own copy goes).

## Change

1. The queue's four entry points and the "off" reload rule, per the Contract.
2. `mergeRequestPersonView.ts` per the Contract and Rules.
3. The slice: create the person view in `createMergeRequests` after `shownOf` (it needs `shownRows` and `viewer`), spread
   it in; `close`, `rowsReplaced` per the Rules; `askAgain` exported from `mergeRequestsRefresh.ts`.
4. `mergeRequestsShown.ts`: the core `keptInPlace`.
5. Tests below.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches:

- `mergeRequestDiscussions.test.ts` (RK61, RK70):
  - `the_view_asks_every_missing_row_under_each_setting`: "full" → nothing new for rows `listed` asked; "lazy" and "off" →
    every missing iid queued, one call at a time, 10 per call.
  - `a_wanted_row_in_flight_after_a_switch_to_lazy_is_kept_not_asked_again`.
  - `leaving_under_lazy_or_off_sends_nothing_more`: `viewLeft` with unsent iids → no further `readDiscussions`; the
    running call's answer lands; read entries stay.
  - `retry_asks_a_failed_row_again_and_reloads_a_failed_reload`.
  - `reload_rows_keeps_entries_until_answered_and_asks_once_first`.
  - `a_submit_under_off_reloads_a_row_the_view_read`.
- `mergeRequestPersonView.test.ts`, over the `?mr=list` fixture slice (fake timers):
  - `over_the_list_fixture_mes_order_is_pinned` and `…_annas_order_is_pinned`: after every row answered, the entries' ids
    and groups for Me and for Anna Berg equal a literal list in the test (the verifier reads these two lists); every group
    of C2 is present for each, and the p-cases land in the groups `ipc`'s table names.
  - `opening_starts_on_the_viewer_or_review_modes_reviewer` (B1).
  - `picking_anna_reorders_and_empties_held`.
  - `an_expanded_entry_keeps_its_place_when_its_discussion_changes` (C3): expand an entry, a thread answer moves its
    last comment (a reply) → same index; collapse → still the same index; `refreshPersonView` → it moves.
  - `a_resolved_entry_stays_marked_until_back_and_back_drops_it_and_counts` (C3, C10 via `boxClosed`).
  - `the_loading_counts_follow_the_answers` (F1: "12 of 27"-style `answered`/`asked`) and `a_failed_row_is_listed_with_its_failure`
    (F2: !615 and !629).
  - `back_collapses_every_entry_and_keeps_their_texts` (E4).
  - `two_entries_expand_and_one_write_runs_at_a_time` (E4, the threads' `writing` seen through the slice).
- `mergeRequests.test.ts`: `closing_the_page_leaves_the_view`, `a_list_refresh_keeps_the_view_open_and_loads_again`.
- `mergeRequestsRefresh.test.ts`: today's tests pass (`askAgain` exported, unchanged).
- The existing shown-rows held tests pass unchanged (`keptInPlace` moved).

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just mutants HEAD` (kill every
survivor on changed lines of `mergeRequestDiscussions.ts` and `mergeRequestPersonView.ts`). Paste Me's and Anna's pinned
lists in `smoke_evidence`.

## Skills

`skill://ts-conventions`, `skill://vue-conventions` (refs and watches outside components), `skill://risk-register` (RK61,
RK70, RK72, RK77), `skill://verification`.
