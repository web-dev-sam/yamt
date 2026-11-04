# MrFastPreviewPanelR2

Agent output (`agent://MrFastPreviewPanelR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewPanelR2.md), collected 2026-11-04T23:10:23.988Z.

{
  "summary": "Finding 2465 is fixed. With discussions Off, `refreshDiscussions` skips the queue, which reads nothing in Off. It marks the shown thread refreshing at the press, asks GitLab again, then reads the thread once; `threadsRefreshed(iid, asked)` awaits the ask before the read. A press while the thread `isBeingRead` (loading or refreshing) asks nothing. In Off the box's reload icon spins while that read runs. Lazy and full work as before.",
  "files_changed": [
    "frontend/src/ui/mergeRequestsRefresh.ts",
    "frontend/src/ui/mergeRequestThread.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequestPreview.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/mergeRequestReload.test.ts",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "with_discussions_off_the_reload_button_asks_then_rereads_the_shown_thread (mergeRequestReload.test.ts)",
      "proves": "Off, shown thread: another row's press asks nothing; a press makes the thread refreshing at once; a second press during the held ask asks nothing; then one thread read; a press during it asks nothing; no discussions read."
    },
    {
      "name": "with_discussions_off_a_reload_while_the_thread_loads_or_none_is_shown_asks_nothing (mergeRequestReload.test.ts)",
      "proves": "Off: a press while the shown thread is still loading, or with no thread shown, makes no ask and no extra read (kills the loading-guard and optional-chaining mutants)."
    },
    {
      "name": "with_discussions_off_the_shown_threads_reload_spins_at_the_press (MergeRequestDiscussionsBox.test.ts, SSR)",
      "proves": "Off with a shown thread: the reload icon has no spin before the press and has animate-spin right after it, with the ask held."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused; sfc-order",
      "observed": "vue-tsc -b clean; oxlint --type-aware and eslint --max-warnings 0 clean; 'All matched files use the correct format.'; knip clean; check-sfc-order clean"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 301 passed (301); Tests 4504 passed (4504)"
    },
    {
      "command": "just app-session start-fixture --name mfp2 --diff --mr list --open-mr --size 1600x1000; Settings → 'Off' (pressed); Back; Merge requests",
      "observed": "Discussion counts are plain SPANs and no 'Reload discussions' button exists (0). Opening Settings unmounts the page, which closes any shown thread."
    },
    {
      "command": "read: MergeRequestDiscussions instance setupState.mergeRequests.showThread(637, d1) (a thread still shown when Off arrives); hover '13 open discussions'",
      "observed": "[1 'Reload discussions' button, 'Thread: src/board.ts:12', icon class 'size-4' (no spin)]"
    },
    {
      "command": "MutationObserver on the icon and the thread's aria-busy plus a console.info capture; webdriver click 'Reload discussions'",
      "observed": "First change at the press: {spin:true, busy:'true', logs:1}, the one log being 'mergeRequests.fixture_ask_again {}'. Then fixture_thread {iid:637}, then thread_read {iid:637, kind:'read'}, then {spin:false, busy:'false'} 404 ms later. No fixture_discussions."
    },
    {
      "command": "JS: button.click(), then button.click() again 100 ms later, during the re-read",
      "observed": "logs: [fixture_ask_again, fixture_thread, 'second press', thread_read]: one ask and one thread read; the second press asked nothing"
    },
    {
      "command": "just app-session stop --name mfp2",
      "observed": "webdriver and vite stopped; folder removed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (Stryker, 4 TS files): 452 killed, 0 timeout, 7 survived, 0 no cov, 3 errors; mergeRequestPreview.ts 100%, mergeRequestsRefresh.ts 97.56%",
    "survivors": [
      "mergeRequestsRefresh.ts:17 load.kind==='read'→true — equivalent: only a read load has `refreshing`, so on any other load `load.refreshing` is undefined (falsy)",
      "mergeRequestThread.ts:123 current!==null→true — equivalent: isShown is false when thread is null (same as R1's :85/:124)",
      "mergeRequestThread.ts:84, :223 (x2), mergeRequests.ts:139, :209 — unchanged lines, kept with R1's reasons"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "WebKit check: the UI alone cannot reach 'Off, open a thread'. Opening Settings unmounts the page, which closes the thread, and in Off no box opens one. So Off was set in Settings and the thread shown via the slice's showThread (Vue dev instance): the state a settings reload on focus leaves. The press was a real webdriver click.",
    "Line cap 300 on mergeRequestThread.ts (it was at 299): `isBeingRead(load: ThreadLoad)` lives in mergeRequestsRefresh.ts, not next to ThreadLoad. MergeRequestDiscussions.vue imports it from there. Also `previewHere` now returns `empty` for a blank text, and the thread module's EMPTY const and blank branch are gone (same behaviour, its tests pass).",
    "MergeRequestDiscussions.vue: in Off the reload icon spins while the shown thread `isBeingRead`, the same rule as the no-ask guard. In lazy/full it still follows `reloads` `running`.",
    "`refreshed`/`threadsRefreshed` gained an optional `asked: Promise<void>`. `reread` is now async: it awaits `asked` only when one is given, so the other re-reads still start synchronously.",
    "Docs keeper: frontend/src/ui/AGENTS.md:65 is updated. AGENTS.md:63 still writes `refreshed(iid)` (now `refreshed(iid, asked?)`). tree.md should name `isBeingRead` in mergeRequestsRefresh.ts."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestsRefresh.ts:46-50",
      "risk": "The Off branch reads `discussionDetails()` at the press. If the mode leaves Off during the held ask, the thread is still read once after the ask, but the row is not reloaded. The queue's own switch handles the row, so this is [INFERENCE] harmless; it is not tested."
    },
    {
      "location": "frontend/src/ui/mergeRequestThread.ts:300",
      "risk": "The file is at exactly the 300-line cap, so the next change here needs a split."
    }
  ]
}
