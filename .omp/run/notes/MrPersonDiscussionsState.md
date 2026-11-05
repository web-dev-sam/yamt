# MrPersonDiscussionsState

Agent output (`agent://MrPersonDiscussionsState`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsState.md), collected 2026-11-05T14:29:46.879Z.

{
  "summary": "The slice's state for the person view is done and the frontend recipes pass. The queue gains wantRows, retryRows, reloadRows, viewLeft, and under \"off\" it now reloads a row that has an entry. New `mergeRequestPersonView.ts` gives the view's state: open, leave, pick, expand, collapse, retry and refresh, plus held entries kept in place by the core `keptInPlace`. The slice creates the view and spreads it in; `close()` leaves the view first and a list refresh re-sorts it. `askAgain` is exported, and `mergeRequestsShown` now uses the core `keptInPlace`.",
  "files_changed": [
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/mergeRequestDiscussionQueue.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/mergeRequestPersonView.ts",
    "frontend/src/ui/mergeRequestPersonView.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsPages.ts",
    "frontend/src/ui/mergeRequestsShown.ts",
    "frontend/src/ui/mergeRequestsRefresh.ts",
    "frontend/src/ipc/index.ts"
  ],
  "tests_added": [
    {
      "name": "the_view_asks_every_missing_row_under_each_setting",
      "proves": "Under \"full\", wantRows adds nothing to what `listed` asked. Under \"lazy\" and \"off\" every missing iid is queued: one call at a time, 10 answered per call (27 open rows → 3 calls)."
    },
    {
      "name": "a_wanted_row_in_flight_after_a_switch_to_lazy_is_kept_not_asked_again; reload_rows_keeps_a_row_sent_before_a_switch_to_lazy",
      "proves": "An unhovered in-flight iid leaves `unhovered`: it is kept loading and asked in the next call, not dropped or double-queued."
    },
    {
      "name": "leaving_under_lazy_or_off_sends_nothing_more",
      "proves": "viewLeft under lazy/off drops the unsent queued rows; the running call still lands and read entries stay. Under \"full\" nothing is dropped."
    },
    {
      "name": "retry_asks_a_failed_row_again_and_reloads_a_failed_reload",
      "proves": "Refused/failed entries become loading; a failed reload is reloaded with its entry kept; a stale reload failure is cleared. A running reload or a read row changes nothing. Order is first, as given."
    },
    {
      "name": "reload_rows_keeps_entries_until_answered_and_asks_once_first; reload_rows_skips_a_row_answered_during_its_ask_…",
      "proves": "Rows are marked at once, one ask, then queued first in the given order. An already-reloading row is skipped. A row answered during the ask, or a dropped generation, queues nothing."
    },
    {
      "name": "a_submit_under_off_reloads_a_row_the_view_read",
      "proves": "Under \"off\", reloadDiscussions reloads a row that has an entry and sets its count; a row without an entry stays without one."
    },
    {
      "name": "over_the_list_fixture_mes_order_is_pinned / over_the_list_fixture_annas_order_is_pinned",
      "proves": "The entries' ids and groups equal the literal lists; all five C2 groups are present; p1–p7 land in the groups from ipc's table, for Me and for Anna Berg."
    },
    {
      "name": "opening_starts_on_the_viewer_or_review_modes_reviewer; picking_anna_reorders_and_empties_held",
      "proves": "B1: the view opens on Me or on review mode's reviewer. B2: picking Anna re-sorts, holds only the expanded entries, and drops a collapsed held entry."
    },
    {
      "name": "an_expanded_entry_keeps_its_place_when_its_discussion_changes (+ refresh / list-refresh variants)",
      "proves": "C3: a reply moves the entry's group but not its index, also after collapse. After refreshPersonView or a list refresh it moves. Refresh asks GitLab once, reloads the listed rows and re-reads the expanded thread."
    },
    {
      "name": "a_resolved_entry_stays_marked_until_back_and_back_drops_it_and_counts",
      "proves": "C3/C10: a resolved entry shows resolved and keeps its place, and the counts drop. Back calls boxClosed: the row's count falls by one and the entry is gone on reopen."
    },
    {
      "name": "the_loading_counts_follow_the_answers; a_failed_row_is_listed_with_its_failure; a_failed_reload_is_listed_…",
      "proves": "F1: loading goes 0/10/20 of 29, then null. F2: !629 (notLoggedIn) and !615 (failed) are listed in list order; failed reloads are listed, running ones are not. Retry re-asks."
    },
    {
      "name": "back_collapses_every_entry_and_keeps_their_texts; two_entries_expand_and_one_write_runs_at_a_time",
      "proves": "E4: Back collapses every entry and drops the threads but keeps the reply texts. Two entries expand at once, and a second send while one write runs sends nothing."
    },
    {
      "name": "counts, people writers, closed view, refresh at opening, count-0 row reload, switch to off",
      "proves": "Summed turn counts per person; writers appear in the people lines; a closed view does nothing; refresh marks rows before any read; a row with count 0 but an entry is reloaded; after \"off\" the view asks again."
    },
    {
      "name": "mergeRequests.test.ts: closing_the_page_leaves_the_view, a_list_refresh_keeps_the_view_open_and_loads_again, +2",
      "proves": "close() leaves the view; with the view closed it keeps the list's asks. A list refresh keeps the view open and asks every row again. viewLeft is wired. A row with a null author is counted."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && lint && fmt:check && unused",
      "observed": "vue-tsc -b: no errors; oxlint + eslint: no output; \"All matched files use the correct format.\"; knip --include exports,types: no findings"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  309 passed (309); Tests  4638 passed (4638). Includes mergeRequestsRefresh.test.ts and the shown-rows held tests, unchanged."
    },
    {
      "command": "Me's pinned list (mergeRequestPersonView.test.ts MES_ORDER, [iid, group, discussion serial])",
      "observed": "turn: 637/1,637/3,636/16,637/4,637/5,624/18(p2),633/63300,626/62601,626/62600,623/62300,621/62100,618/61800,611/61101,611/61100,606/60600; started: 636/15,628/20(p4),632/63200,627/62700,623/62301,617/61700,612/61200,608/60801,602/60200; wrote: 636/14,637/2,628/21(p5); reviewer: 638/63801,638/63800,608/60800,603/60300; other: 637/6..13,624/17(p1),624/19(p3),609/22(p6),607/23(p7),639/63900,635/63501,635/63500,632/63201,630/63000,620/62001,620/62000,617/61701,614/61401,614/61400,605/60501,605/60500,602/60201"
    },
    {
      "command": "Anna's pinned list (ANNAS_ORDER)",
      "observed": "turn: 636/14,637/2,637/8,624/17(p1),609/22(p6),635/63501,635/63500,630/63000,620/62001,620/62000,605/60501,605/60500,602/60200; started: 637/1,636/16,637/5,637/7,624/19(p3),632/63201,626/62600,621/62100,617/61701,611/61100,606/60600,602/60201; wrote: 637/3,637/6,624/18(p2); reviewer: 632/63200,627/62700,617/61700,612/61200; other: 636/15,637/4,637/9..13,628/20(p4),628/21(p5),607/23(p7),639/63900,638/63801,638/63800,633/63300,626/62601,623/62301,623/62300,618/61800,614/61401,614/61400,611/61101,608/60801,608/60800,603/60300"
    },
    {
      "command": "p-cases against ipc's table (rows !624 p1–p3, !628 p4–p5, !609 p6, !607 p7)",
      "observed": "Me: p1 other, p2 turn, p3 other, p4 started, p5 wrote, p6 other, p7 other. Anna: p1 turn, p2 wrote, p3 started, p4 other, p5 other, p6 turn, p7 other. All match ipc's table."
    },
    {
      "command": "just mutants HEAD (final run)",
      "observed": "747 mutants; ui 98.51% (727 killed, 9 survived, 2 no coverage); mergeRequestPersonView.ts 99.47% (1 survivor), mergeRequestDiscussions.ts 100% of covered, mergeRequestDiscussionQueue.ts 97.79%, mergeRequestsPages.ts 100%"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 747 mutants over 8 files; ui 727 killed / 9 survived / 2 no-cov; ipc/index.ts 4 survived / 1 no-cov (IN_APP lines, untouched)",
    "survivors": [
      "src/ui/mergeRequestPersonView.ts:279 orders += 1 → -= 1 — equivalent: each order only has to differ from the previous one; a falling counter is just as unique",
      "src/ui/mergeRequestDiscussionQueue.ts:73 [] → [\"Stryker was here\"] — equivalent: the set is only probed with iids (numbers); code moved verbatim",
      "src/ui/mergeRequestDiscussionQueue.ts:138 [] → [\"Stryker was here\"] — equivalent: same reason (moved from becameLazy)",
      "src/ui/mergeRequestDiscussionQueue.ts:127 generation += 1 → -= 1 — equivalent: generations are only compared for equality (moved code)",
      "src/ui/mergeRequestDiscussions.ts:86 exhaustive default (no coverage) — equivalent: unreachable `never` arm, unchanged line",
      "src/ui/mergeRequests.ts:141, mergeRequestsRefresh.ts:17, mergeRequestsShown.ts:63, :93 — not on changed lines (pre-existing survivors in unchanged code)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "New owned file ui/mergeRequestDiscussionQueue.ts (granted by Main): the Queue type and its primitives (send, settle, sentFirst, queuedLast, dropped, unsentDropped, marked, afterAsk), moved out because mergeRequestDiscussions.ts would have been ~387 lines (cap 300). Only mergeRequestDiscussions.ts imports it.",
    "New owned file ui/mergeRequestsPages.ts (granted by Main): findProject, openChanges, openPage and dismissPageProblem moved verbatim from mergeRequests.ts over a narrow state type, plus the `Pages` type. `Opening` moved here and is re-exported. Reason: the 300-line cap.",
    "mergeRequests.ts: createState(deps, viewReplaced) wires the view's rowsReplaced. New shownAndViewOf and screensOf helpers for the 40-line function cap. createPersonView receives { ...state, ...shown, queue } (same fields as the Contract's deps).",
    "Queue `listed` now goes through queuedLast, which also deletes the iid from `unhovered` (always empty under \"full\", so no behaviour change). becameLazy reuses unsentDropped (also viewLeft's). settle's filter now uses the shared isWaiting.",
    "My reading where the brief was open: retryRows/reloadRows make a refused or failed entry loading and clear a stale reload failure; after the ask, only the iids still waiting are queued; refreshPersonView shares one askAgain promise between reloadRows and threadsRefreshed(null, asked).",
    "My reading: leavePersonView calls boxClosed for every iid (it no-ops without marks); expandEntry and refreshPersonView do nothing while the view is closed; close() always calls the guarded leavePersonView.",
    "Docs keeper: tree.md rows for ui/mergeRequestDiscussionQueue.ts, ui/mergeRequestPersonView.ts and ui/mergeRequestsPages.ts. state.md: the person-view ref is owned by mergeRequestPersonView.ts; the queue entries gain writers wantRows/retryRows/reloadRows/viewLeft. ui/AGENTS.md: the queue file split.",
    "`just map-check` already fails on files from earlier slices (fixtureMergeRequestPersonCases.ts, personDiscussions.ts, MergeRequestThreadBody/Buttons.vue, mergeRequestThreadRecords.ts); my three new files need rows too.",
    "ipc/index.ts: added only FirstComment; its one importer is the test a_first_comment_reaches_the_entry until the view slice uses it."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestPersonView.ts:170-183 (orderedOf)",
      "risk": "keptInPlace runs against the computed's previous value. rowsReplaced raises `order` so a list refresh re-sorts even if nothing read personView in between; a lazily-reading component could still see one held frame."
    },
    {
      "location": "frontend/src/ui/mergeRequestDiscussions.ts reloadRows",
      "risk": "A row whose entry is loading and already in the running call is moved first after the ask, but that call's answer (from before the ask) is taken as fresh."
    },
    {
      "location": "frontend/src/ui/mergeRequestPersonView.ts demand watch",
      "risk": "The watch uses default (pre) flush, so wantRows fires one tick after open, a filter change or an \"off\" switch; components must not expect rows marked synchronously at open."
    }
  ]
}
