# MrFastPreviewPanelR1

Agent output (`agent://MrFastPreviewPanelR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewPanelR1.md), collected 2026-11-04T22:42:38.968Z.

{
  "summary": "Refresh/Retry are now `loadList(state, askAgain)`: `listing` turns loading (button disabled and spinning) at the press, then the ask runs, then the list. The reload button calls the queue's `reloadDiscussions(iid, askFirst)`. It marks the row running (or loading) at once, runs the ask and the thread re-read, then sends the read. A press while the row is marked asks nothing, and a drop during the ask sends nothing. The window slice no longer has the non-asking `reloadDiscussions`. The fixture's project calls sit in `projectScript`. Docs reworded.",
  "files_changed": [
    "frontend/src/ui/mergeRequestsList.ts",
    "frontend/src/ui/mergeRequestsRefresh.ts",
    "frontend/src/ui/mergeRequestsRefresh.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/mergeRequestDiscussionRows.ts",
    "frontend/src/ui/mergeRequestThread.ts",
    "frontend/src/ui/mergeRequestReload.test.ts",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "refresh_shows_loading_at_the_press_while_the_ask_is_held (mergeRequestsRefresh.test.ts, SSR of MergeRequestsView)",
      "proves": "Right after refresh(), with the ask held, the Refresh button is disabled and spinning and no list call has started. Once the ask answers, exactly one list follows and the spinner stops."
    },
    {
      "name": "refresh_asks_gitlab_again_before_listing (extended)",
      "proves": "With the ask held, listing is {loading, first:false} at the press and stays that way. A second refresh while held makes no second ask. A failed ask is logged and the list still loads."
    },
    {
      "name": "one load at a time (extended)",
      "proves": "A Refresh pressed during a show's load asks nothing (calls stay [listMergeRequests])."
    },
    {
      "name": "Retry / Refresh-of-empty / failure-cleared tests (reordered)",
      "proves": "Loading, or the failure cleared, is visible synchronously after refresh(), before any await."
    },
    {
      "name": "a_pressed_reload_runs_at_once_and_reads_after_its_ask",
      "proves": "The queue marks the row running at the press; a repeat press asks no second time; the read is sent only after the ask resolves."
    },
    {
      "name": "a_pressed_reload_of_a_row_without_an_entry_loads_at_once_and_asks_once",
      "proves": "A row with no entry becomes loading at once with no read; a second press asks nothing; one read follows the ask."
    },
    {
      "name": "a_pressed_reload_dropped_while_its_ask_runs_reads_nothing",
      "proves": "Switching to Off during the ask (the queue's generation is raised) means no read is sent afterwards."
    },
    {
      "name": "the_discussions_reload_button_asks_gitlab_again (rewritten)",
      "proves": "Through the slice with a held ask: the row runs at the press, a repeat press makes no ask, and no discussions or thread read happens until the ask answers; then one of each. A submit's reload makes no ask."
    },
    {
      "name": "the_refresh_button_has_its_tip_and_spins_at_the_press (box SSR)",
      "proves": "The box's reload icon has animate-spin while the ask never answers."
    },
    {
      "name": "the_window_slice_offers_no_reload_that_skips_the_ask",
      "proves": "The slice has refreshDiscussions and no reloadDiscussions key."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check (after oxfmt on the new test); unused; sfc-order",
      "observed": "vue-tsc -b clean; oxlint --type-aware and eslint clean; 'All matched files use the correct format.'; knip clean; check-sfc-order clean"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 301 passed (301); Tests 4500 passed (4500)"
    },
    {
      "command": "just app-session start-fixture --name mfp --diff --mr list --open-mr --size 1600x1000; MutationObserver on [data-refreshes-list] plus a console.info capture; click Refresh",
      "observed": "First DOM change after the click: {disabled:true, spin:true, logs:1}, the one log being 'mergeRequests.fixture_ask_again {}'. Then fixture_discussions for the swapped rows and {disabled:false, spin:false} 28 ms later."
    },
    {
      "command": "hover '13 open discussions' (!637); observer on the 'Reload discussions' button; click it",
      "observed": "First DOM change: {spin:true, logs:['mergeRequests.fixture_ask_again {}']}, before any read. Then fixture_discussions {iids:'637'}, discussions_read, discussions_reloaded {iid:637}; the spin stops at 400 ms."
    },
    {
      "command": "just app-session stop --name mfp",
      "observed": "stopped webdriver and vite; folder removed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (Stryker, 7 TS files): 1001 killed, 2 timeout, 28 survived, 6 no cov, 3 errors; mergeRequestsRefresh.ts 100%; the new reload/loadList lines have no survivors",
    "survivors": [
      "fixtureMergeRequests.ts:43 SCRIPTS={} — wiring: module-level, run once at import under vitest (#732); 'a script finds the project…' expects found",
      "fixtureMergeRequests.ts:44-53 true→false — equivalent: isScript reads Object.hasOwn, never the values",
      "fixtureMergeRequests.ts:60,66,67,71,72 module consts — wiring: module-level (#732), lines unchanged",
      "fixtureMergeRequests.ts:179 kind!=='merging'→false — equivalent: free has no iid, so undefined!==iid is true",
      "fixtureMergeRequests.ts:146, mergeRequestDiscussionRows.ts:60, mergeRequestDiscussions.ts:175 never-defaults (no cov) — equivalent: unreachable",
      "mergeRequestDiscussions.ts:89 []→['Stryker'] — equivalent: only checked against numeric iids",
      "mergeRequestDiscussions.ts:150 []→['Stryker'] — equivalent: a string in unhovered never matches an iid",
      "mergeRequestDiscussions.ts:141 generation+=1→-=1 — equivalent: generation is only compared for equality",
      "mergeRequests.ts:139 kind==='done'→true — equivalent: loading has no at (NaN>=x false); notLoaded already loads",
      "mergeRequests.ts:209 search ''→'Stryker' — equivalent: show() writes '' before the page exists",
      "mergeRequestsList.ts:110 rowsReplaced([])→['Stryker'] — equivalent: a string row has no openDiscussions",
      "mergeRequestThread.ts:85 current!==null→true — equivalent: isShown is false when thread is null",
      "mergeRequestThread.ts:124 current===null→false — equivalent: same isShown",
      "mergeRequestThread.ts:222 ''→'Stryker' / cond→false — equivalent: no thread, so write() returns; get(undefined)??'' is ''"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Owned for this round (granted) beyond the brief: mergeRequestsList.ts, mergeRequestDiscussions.ts (+test), mergeRequestDiscussionRows.ts; also edited mergeRequestReload.test.ts and the new mergeRequestsRefresh.test.ts (both in slices.json).",
    "`reloadDiscussions` moved off the window-facing `Discussions` type onto `DiscussionQueue`, as `reloadDiscussions(iid, askFirst?)`. `discussionsOf` returns `Discussions`, and `useRowDiscussions` takes Pick<'discussions'|'askDiscussions'>. The `rowDiscussions` wrapper is gone from State: `createRefreshes` uses `discussionQueue` + `threadsRefreshed`. This replaces the finding's wrapper and Omit idea.",
    "A press on a row whose entry is `loading` now does nothing (the 'already marked' guard). Before, it moved that row to the front of the queue.",
    "The shown thread's re-read now runs after the ask (inside askFirst), not at the press: it asks GitLab too.",
    "Line cap 300: loggedFields moved to mergeRequestDiscussionRows.ts. fixtureMergeRequests.ts `MergeRequestScript` is now `keyof typeof SCRIPTS` (TS6), and fixtureProject merged into projectScript.",
    "Docs keeper: tree.md:286 ('discussionsOf … but reloadDiscussions'), state.md:84-85 and architecture.md:1611 still describe the slice wrapper and `queued`; tree.md needs mergeRequestsRefresh.ts and the moved loggedFields."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestDiscussions.ts:212-235",
      "risk": "During a pressed reload's ask, the row is marked but not in `queued`. If a mode switch to lazy happens during the ask, a `loading` entry stays until the ask answers, then gets sent. Tests cover the Off drop; the lazy switch during an ask is not tested."
    },
    {
      "location": "WebKit smoke",
      "risk": "The fixture's ask answers at once, so the smoke shows the spinner arriving before the list or read, not a long held ask. The held case is proven only in the unit tests (mergeRequestsRefresh.test.ts, mergeRequestReload.test.ts)."
    }
  ]
}
