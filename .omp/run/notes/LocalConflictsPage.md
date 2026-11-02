# LocalConflictsPage

Agent output (`agent://LocalConflictsPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsPage.md), collected 2026-11-02T18:42:23.799Z.

{
  "summary": "The merge-request page now shows yamt's own conflict results as they arrive. `listMergeRequests` has a second callback, `onChecked`, which gets `checked` messages even after the load ended. `Readiness` has a new state, `mergesCleanly` (own words, muted dashed-ring icon). The slice puts a result into its own load's rows only (its buffer, or the rows while `shown` is that load) and drops any other. `?mr=local` sends !640, !638 and !635 1,000 ms after its end. The real app shows every row's words, before and after a refresh.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/readiness.ts",
    "frontend/src/mergeRequests/internal/readiness.test.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/MergeRequestReadiness.vue",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/mergeRequestDomain.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/fixtureMergeRequestData.test.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "readiness.test: a row yamt merged cleanly says so in its own words and icon, not ready's",
      "proves": "mergesCleanly has the brief's text and the circle-dashed-check icon, and both differ from ready's"
    },
    {
      "name": "tauriMergeRequests.test: a_checked_message_after_the_end_reaches_onChecked_converted, and a page after the end still reaches nobody",
      "proves": "a checked message after end reaches onChecked with its iid branded; a later page is still ignored"
    },
    {
      "name": "mergeRequests.test: a first load's checked row changes that row's readiness, also with the page closed, and nothing else",
      "proves": "a first load's result reaches rows, also after close(); other rows are unchanged; nothing is reported"
    },
    {
      "name": "mergeRequests.test: a refresh's checked row arriving while it is buffered lands in the swapped rows, and one after the swap in the rows",
      "proves": "a result in the buffer survives the swap; after the swap the refresh's results go to rows (load.buffering reset)"
    },
    {
      "name": "mergeRequests.test: an older load's checked row lands while its rows are shown and is dropped once a newer load's rows are",
      "proves": "`shown` ownership: once a newer load swaps in, an older load's late result is dropped"
    },
    {
      "name": "mergeRequests.test: a refresh ending failed / IPC failure never lets its checked rows touch the shown rows",
      "proves": "results of a failed buffered load, before or after its end, never change the shown rows"
    },
    {
      "name": "mergeRequests.test: a checked row with an iid that is not listed changes nothing and reports nothing",
      "proves": "an unknown iid is a no-op and is not reported"
    },
    {
      "name": "fixtureMergeRequests.test: ?mr=local sends its three checked rows 1,000 ms after its end, and ?mr=list none",
      "proves": "exactly 640/638/635 with their readiness, at 1,000 ms and not at 999; list sends none"
    },
    {
      "name": "mergeRequestDomain.test: a checked row keeps its iid and readiness / its iid is branded like a page's",
      "proves": "toCheckedRow keeps the values and refuses a bad iid, naming the field row.iid"
    },
    {
      "name": "fixtureMergeRequestData.test: each locally checked row is a listed row whose readiness the check changes",
      "proves": "every fixture result changes its row's GitLab readiness (Rust sends only changed rows)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend fmt:check; pnpm -C frontend unused",
      "observed": "oxlint --type-aware && eslint: no output (clean); vue-tsc -b: no output; \"All matched files use the correct format.\"; knip: no output"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  246 passed (246) / Tests  3496 passed (3496)"
    },
    {
      "command": "just app-session start-fixture --name lc --diff --mr local; click \"Merge requests\"; read readiness aria-labels at once",
      "observed": "[\"!640 => Has conflicts\",\"!638 => Ready to merge\",\"!635 => GitLab is still checking whether it can be merged\"]"
    },
    {
      "command": "sleep 1.5; read aria-label + class of the readiness span",
      "observed": "!640 => No conflicts (checked locally). GitLab has not checked the rest yet class=flex p-1 text-fg-muted; !638 => Has conflicts class=… text-problem-error; !635 => No conflicts (checked locally)… text-fg-muted"
    },
    {
      "command": "just app-session shot --name lc /tmp/lc-fixture.png; just app-session stop --name lc",
      "observed": "{\"file\":\"/tmp/lc-fixture.png\",\"source\":\"page\"}: !640 and !635 show the muted dashed-ring check, !638 the red conflict icon. Stopped (webdriver and vite stopped)."
    },
    {
      "command": "cargo tauri build --debug --no-bundle; scripts/local-conflicts-repo.sh /tmp/yamt-lc; just app-session start-app --name lc --diff --dir /tmp/yamt-lc --glab local-conflicts; open page",
      "observed": "!49 GitLab is still checking…; !48, !45, !43, !41 No conflicts (checked locally). GitLab has not checked the rest yet; !47 Has conflicts. Also blocked: discussions are unresolved; it is a draft; !46 Needs a rebase; !44 Ready to merge; !42 Has conflicts"
    },
    {
      "command": "just app-session click --name lc Refresh --role button; sleep 4; read labels",
      "observed": "The same nine labels, unchanged, after the refresh."
    },
    {
      "command": "grep \"local conflict check\" <session>/logs/tauri-driver.log",
      "observed": "18:37:30 INFO yamt_merge_requests::check: local conflict check summary=9 rows: 5 merges, 1 refs fetched, 0 remembered, 1 moving, 1 kept / 18:37:40 … 9 rows: 0 merges, 0 refs fetched, 7 remembered, 1 moving, 1 kept (one line per load)"
    },
    {
      "command": "just app-session shot --name lc /tmp/lc-app.png; just app-session stop --name lc",
      "observed": "/tmp/lc-app.png: nine rows; the dashed ring on !48, !45, !43, !41; the red conflict icon on !42 and !47. Stopped (tauri-driver, xvfb)."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (TS, 7 files): 616 killed, 114 survived, 7 no cov; ipc domain/tauri 100%; ui/mergeRequests.ts 1 survivor at l.168 (show's `stale`, not changed here)",
    "survivors": [
      "frontend/src/ipc/fixtureMergeRequests.ts:46 `local: true`→false — equivalent: SCRIPTS is a membership Record read only by Object.hasOwn; the value is never read",
      "fixtureMergeRequestData.ts:90-93 LOCAL_CHECKED literal mutants — gate-covered: module-level const that Stryker does not re-run (--ignoreStatic, #732), as READINESS l.80-86; pinned by the ?mr=local and data tests"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Docs keeper, architecture §4 l.980: `listMergeRequests(onPage: (page: MergeRequestPage) => void, onChecked: (row: CheckedRow) => void): Promise<SourceResult<ListEnd>>; // every page reaches onPage before the promise settles, and none after; onChecked gets this load's local results after it settled`",
    "Docs keeper, architecture §4 l.995-998: after 'an unreadable page fails the load' add '; a `checked` message goes to onChecked (`toCheckedRow`) whether or not the load ended'. Add `local` to the `?mr=<script>` list: list's rows and end, then 1,000 ms later !640/!635 mergesCleanly and !638 conflicts.",
    "Docs keeper, architecture §5.1 l.1075 (and the project-map state.md row): `rows` is also written by `checked`, but only for the load whose rows are shown (`shown`: set at a first load's start and at a refresh's swap; a buffering refresh writes its buffer); other results are dropped; close() changes nothing.",
    "Added mergeRequestDomain.test and fixtureMergeRequestData.test cases (both owned) beyond the named tests, to kill the mutants in toCheckedRow and LOCAL_CHECKED.",
    "Load.`buffered` (readonly) became mutable `buffering`, cleared at the end; State has a new non-ref field `shown: Load | null`. The rewritten callbacks and helper keep ui/mergeRequests.ts at 299 lines (cap 300)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/tauriMergeRequests.ts:31-33",
      "risk": "An unreadable checked row (bad iid) after the end throws inside the Channel callback; nothing catches it, unlike an unreadable page before the end. Rust generates the iid, so this is trusted (decision 19)."
    },
    {
      "location": "frontend/src/ui/mergeRequests.ts:296-299",
      "risk": "The file is at 299 of 300 lines. The next addition to the slice needs a split (e.g. load/received/ended/checked into their own file)."
    }
  ]
}
