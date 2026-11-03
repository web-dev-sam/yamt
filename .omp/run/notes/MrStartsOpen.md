# MrStartsOpen

Agent output (`agent://MrStartsOpen`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsOpen.md), collected 2026-11-03T19:49:37.498Z.

{
  "summary": "Compare and range windows now open on their merge-request page at start when asked: in the app through `dataset.open === \"mergeRequests\"`, in the fixture through `?open=mergeRequests`. The page opens only once the project lookup returns `found`. With no project or a failed lookup the window stays on its files. The rule is in one place, `openAtStart` in `ui/startScreen.ts`, and `main.ts` hands each store a `WindowStart {theme, screen}`. app-session gains `start-app --mr` and `start-fixture --open-mr`.",
  "files_changed": [
    "frontend/src/ui/startScreen.ts",
    "frontend/src/ui/startScreen.test.ts",
    "frontend/src/main.ts",
    "frontend/src/ui/compareStore.ts",
    "frontend/src/ui/compareStore.test.ts",
    "frontend/src/ui/rangeStore.ts",
    "frontend/src/ui/rangeStore.test.ts",
    "frontend/src/ui/rangeSearch.test.ts",
    "frontend/src/ui/rangeThreads.test.ts",
    "frontend/scripts/app-session/startArgs.ts",
    "frontend/scripts/app-session/startArgs.test.ts",
    "frontend/scripts/app-session/args.ts",
    "frontend/scripts/app-session/args.test.ts",
    "frontend/scripts/app-session/start.ts"
  ],
  "tests_added": [
    {
      "name": "compareStore.test: a window started on %s with the fixture search %j opens on %s, its tabs listed (3 cases)",
      "proves": "mergeRequests+found opens the page and starts its load, and adoptList does not close it; files+found and mergeRequests+none stay on the tabs"
    },
    {
      "name": "compareStore.test: a window started on its merge-request page stays on its tabs when the project lookup fails",
      "proves": "after a failed lookup the window stays on files and the find problem is reported as before"
    },
    {
      "name": "rangeStore.test: a window started on %s with the fixture search %j opens on %s, its first file shown (3 cases)",
      "proves": "same three cases for the range window; the first file is still selected, but selecting it no longer sends the page back to files"
    },
    {
      "name": "rangeStore.test: a window started on its merge-request page stays on its files when the project lookup fails",
      "proves": "rule B3 for the range window: failed lookup → files, problem reported"
    },
    {
      "name": "startScreen.test: only the marker mergeRequests starts a window on its merge-request page",
      "proves": "startScreenOf maps only \"mergeRequests\" to the page; undefined, null, empty or other text map to files"
    },
    {
      "name": "args.test: start-app --mr reaches the app as its own --mr, only for the compare and range windows",
      "proves": "--mr parses, is refused with --repo and --fresh-repo, and appArgs appends --mr (also after --ai)"
    },
    {
      "name": "startArgs.test: start-fixture --open-mr opens the merge-request page at start, only with an --mr script",
      "proves": "adds &open=mergeRequests for diff and range; refuses --open-mr without --mr, and --mr in the merge window"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; typecheck; test; fmt:check; unused",
      "observed": "lint: oxlint + eslint, no output (clean); vue-tsc -b clean; Test Files 275 passed (275), Tests 4148 passed (4148); All matched files use the correct format; knip no output"
    },
    {
      "command": "just app-session start-fixture --name open --diff --mr list --open-mr; read; shot /tmp/mrstarts-open-diff.png",
      "observed": "\"?diff&mr=list&open=mergeRequests | … Back\\nMerge requests\\nRefresh … 40 of 40 merge requests … Snooze a reminder !640 …\". The screenshot shows the merge-request page with its rows; no click was made."
    },
    {
      "command": "just app-session start-fixture --name plain --diff --mr list; read",
      "observed": "\"?diff&mr=list | Tabs\\nCompare 1\\nAuto · Plain text\\nFormat\\n…Left\\nRight\" — the compare tabs, as before"
    },
    {
      "command": "just app-session start-fixture --name rng --range-case review --mr list --open-mr; shot /tmp/mrstarts-open-range.png",
      "observed": "\"?range=review&mr=list&open=mergeRequests\". The screenshot shows the range window's file list on the left and, in the main area, the Merge requests page reading 40 of 40 with rows."
    },
    {
      "command": "just app-session start-fixture --name bad --diff --open-mr",
      "observed": "app-session: start-fixture takes --open-mr only with --mr <script>; exit=1"
    },
    {
      "command": "scripts/mr-conflict-repo.sh /tmp/mrstarts-open-repo; cargo tauri build --debug --no-bundle; just app-session start-app --name mr --diff --dir /tmp/mrstarts-open-repo --glab mr-conflicts --mr; read; shot",
      "observed": "dataset {\"theme\":\"dark\",\"window\":\"compare\",\"open\":\"mergeRequests\"}; the page reads \"Back\\nMerge requests … 11 of 11 merge requests\\n\\nBoard themes !32 …\". The screenshot /tmp/mrstarts-open-app.png shows the page open at once."
    },
    {
      "command": "just map-check",
      "observed": "map-check: ok"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 747 killed, 25 survived, 150 no coverage (start.ts, untested as before); startScreen.ts 100%",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Main granted ownership of rangeSearch.test.ts and rangeThreads.test.ts for one mechanical change: createRangeStore(source, \"dark\", null) → (source, { theme: \"dark\", screen: \"files\" }, null) at 3 call sites.",
    "Decision: both stores take one `WindowStart {theme, screen}` (in ui/startScreen.ts) in place of `startTheme`. A third positional parameter would push compareStore.ts past max-lines 300 and createRangeStore past max-lines-per-function 40.",
    "StartScreen is `Extract<Screen[\"kind\"], \"files\" | \"mergeRequests\">`, which is the Contract's sum, derived from Screen (TS6).",
    "rangeStore: the screen reset moved from `show` into `showPath`, so selecting the first file at start no longer resets the screen. Side effect: Settings opened before openRange answers now stays open (before, it was closed).",
    "appArgs takes `{ ai, mr }` as an object (TS7: two booleans); start.ts passes the command.",
    "For ui/AGENTS.md (owned by MrStartsAge), suggested rule: \"`--mr` → `dataset.open` / `?open=mergeRequests`, read once in main.ts as `WindowStart.screen`; `openAtStart` (ui/startScreen.ts) opens the page after `findProject` answers found\".",
    "Docs keeper: add `ui/startScreen.ts` to project-map tree.md and `WindowStart` to state.md if needed (map-check already passes)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/startScreen.ts:15",
      "risk": "The page can open before openCompare/openRange answers. A failed window start then puts its problem bar on top of the open page, not on the files."
    },
    {
      "location": "frontend/src/ui/rangeStore.ts:240",
      "risk": "`show` no longer sets the screen to files. A future caller that expects selecting a file to leave the page has to go through showPath, which still resets it."
    }
  ]
}
