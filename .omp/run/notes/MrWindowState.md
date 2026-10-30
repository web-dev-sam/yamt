# MrWindowState

Agent output (`agent://MrWindowState`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrWindowState.md), collected 2026-10-30T14:19:53.619Z.

{
  "summary": "Both windows now have one merge-request slice each, created and registered through the seam mergeRequestsStore.ts, and both stores call findProject() at start-up. Also built: MergeRequestSource, which Compare and Range extend; the domain with MergeRequestIid/JobPage brands and createdAt in ms; a Tauri source using one Channel per load; the ?mr fixture scripts; the words; problem action mergeRequests; screen mergeRequests. Typecheck and lint fail only until B3's bindings land.",
  "files_changed": [
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/mergeRequestDomain.test.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/domain.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/CompareSource.ts",
    "frontend/src/ipc/RangeSource.ts",
    "frontend/src/ipc/tauriCompare.ts",
    "frontend/src/ipc/tauriRange.ts",
    "frontend/src/ipc/fixtureCompare.ts",
    "frontend/src/ipc/fixtureRange.ts",
    "frontend/src/ui/screen.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsStore.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problem.test.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts",
    "frontend/src/ui/compareStore.ts",
    "frontend/src/ui/compareStore.test.ts",
    "frontend/src/ui/rangeStore.ts",
    "frontend/src/ui/rangeStore.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestDomain.test: ms times, offset, unreadable time refused, iid/job-page brands, https-only pages, missingCommit shortId",
      "proves": "conversion brands values and refuses NaN times and non-https job pages, naming the field"
    },
    {
      "name": "fixtureMergeRequests.test: every ?mr script table; no ?mr → none, nothing logged; unknown logged; slow 1 s apart; per-iid open replies after 1 s; job logged",
      "proves": "each fixture script answers as named and existing fixture pages stay without a project"
    },
    {
      "name": "fixtureMergeRequests.test: the list holds every case; second load drops a label",
      "proves": "the 40 rows exercise every filter, CI status, None and the 'kept at 0' case"
    },
    {
      "name": "tauriMergeRequests.test: pages converted before end; unreadable page fails the load; iid/page passed; failures unchanged",
      "proves": "Channel wiring and the conversion failure reported instead of lost in the callback"
    },
    {
      "name": "mergeRequests.test: no reload before 30 s, reload at 30 s; one load at a time",
      "proves": "RECHECK_PAUSE_MS rule and no racing loads"
    },
    {
      "name": "mergeRequests.test: first load streams; reload keeps rows until end; failed reload keeps rows; stale pages dropped; late page of latest load counts",
      "proves": "slice paging rules incl. load id"
    },
    {
      "name": "mergeRequests.test: IPC failures (list/find/open/job/thrown) reported as mergeRequests problems",
      "proves": "an IPC failure is never silent"
    },
    {
      "name": "mergeRequests.test: openings fetching→opened/refused; failed open clears; job problem sentence",
      "proves": "open states per iid and job answers"
    },
    {
      "name": "mergeRequests.test: filters remembered via createRememberedFilters per repository; none without project; summary + cut",
      "proves": "filters, choices, summary, persistence"
    },
    {
      "name": "mergeRequests.test: seam throws before register; windowMergeRequests registers, reports to the bar",
      "proves": "one slice per window through the seam"
    },
    {
      "name": "mergeRequestsText.test: every ListEnd/OpenReply/JobOpened kind; glab words equal notLinedUpText's; LOADING/NONE",
      "proves": "no kind without a sentence; no drift from the Send button's words"
    },
    {
      "name": "compareStore/rangeStore.test: start-up finds the project, slice registered; failed lookup reaches the bar",
      "proves": "store wiring"
    },
    {
      "name": "problem/problemText.test: mergeRequests steps log and read",
      "proves": "problem action words and log line"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  233 passed (233)  Tests  3193 passed (3193)"
    },
    {
      "command": "pnpm -C frontend fmt:check / unused / sfc-order",
      "observed": "All matched files use the correct format.; knip --include exports,types: no findings; check-sfc-order: no findings"
    },
    {
      "command": "pnpm -C frontend lint (with the §6 binding shapes as a temporary declare-module in a test file, since removed)",
      "observed": "oxlint --type-aware && eslint: exit 0, no findings"
    },
    {
      "command": "pnpm -C frontend typecheck (same temporary augmentation)",
      "observed": "only tauriMergeRequests.ts(11,22,29,32) TS2339 commands.findGitlabProject/listMergeRequests/openMergeRequest/openJobPage missing + derived (13,29) TS2322/2345"
    },
    {
      "command": "pnpm -C frontend typecheck (bindings.ts as committed)",
      "observed": "every error is TS2694/TS2724 'bindings has no exported member GitLabProject|MergeRequestRow|MergeRequestPage|ListEnd|OpenReply|JobOpened|Pipeline|FailedJob|CiStatus|Person', the missing commands, or cascades (implicit any, ListedRequest mismatch, never arms)"
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node src/ui/mergeRequests.test.ts src/ipc/fixtureMergeRequests.test.ts",
      "observed": "Test Files 2 passed; Tests 48 passed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (web): 1406 killed, 0 timeout, 158 survived, 18 no cov; mergeRequests.ts 99.44%. A later test killed fixtureMergeRequestData.ts:80 (rerun clean)",
    "survivors": [
      "fixtureMergeRequestData.ts:3-68 literals in module constants (TITLES, PEOPLE, LABELS, PIPELINES, OPEN_REPLIES, messages) — wiring: static mutants not re-evaluated under the vitest runner (#732)",
      "fixtureMergeRequestData.ts:73-74 cycled() empty-list guard — equivalent: every table is non-empty",
      "fixtureMergeRequests.ts:33-42 SCRIPTS true→false — equivalent: membership is Object.hasOwn; also static (#732)",
      "fixtureMergeRequests.ts:51 LOADED literal — wiring: static (#732)",
      "fixtureMergeRequests.ts:113, mergeRequestsText.ts:19,48,68 never default arms — gate-covered: TS3 exhaustiveness checked by vue-tsc",
      "mergeRequests.ts:152 `listing.kind === \"done\" &&`→true — equivalent: listing.at is undefined otherwise, so the >= test on NaN is false; the narrowing is for TS"
    ]
  },
  "acceptance_not_run": [
    "typecheck/lint green with real bindings: B3's bindings.ts is not here yet. Every error names a binding type or command or follows from one, e.g. mergeRequestDomain.ts:5,15,26,28,30; tauriMergeRequests.ts:3,11,22,29,32. With §6 shapes stubbed, only commands.* remained."
  ],
  "deviations_from_brief": [
    "screen.ts gains settingsScreen(screen) for open/closeSettings, used by both stores. It was needed to keep compareStore.ts (300) and rangeStore.ts (299) under max-lines. store.ts (not mine) keeps its own copy and could use it.",
    "Both stores' startUp(state, besides: Promise<void>[]) now runs [settings.loadSettings(), mergeRequests.findProject()] beside openCompare/openRange. Settings and the lookup are now issued just before openCompare/openRange (all still run concurrently).",
    "mergeRequestsStore.ts adds windowMergeRequests(source, {screen, problem}): it creates and registers the slice and reports to the window's bar. Both stores call it, which keeps the stores small. The slice's seam tests live in mergeRequests.test.ts (no mergeRequestsStore.test.ts in Owned).",
    "Late pages: Tauri sends channel payloads over 1 KiB by fetch after its eval (tauri 2.12.1 channel.rs), so a page can arrive after the command resolves. The slice therefore keeps the latest load's pages after its end. Only an older load's pages are stale, and a failed reload never swaps in its buffer.",
    "A list IPC failure puts listing back as it was before the load. A failed first load clears its rows, so the next show retries. On a failed reload the rows stay. cut is kept apart from listing so the summary survives a failed reload.",
    "Words I chose: listEndText gives every kind a sentence (loaded, cut too). openReplyText(reply, iid) has one sentence per kind; its glab kinds use the Send button's words without the Refresh tail. Also jobOpenedText and the four mergeRequests step words. problemText now handles list/settings through FIXED_ATTEMPT_WORDS (renamed from WINDOW_ATTEMPT_WORDS), so attempted() stays within 40 lines.",
    "ipc/index.ts exports isMergeRequestIid (ui tests make iids). isJobPage only checks the https:// prefix; Rust's JobPage::built and its offered set stay the authority. missingCommit is read as short_id (MrOpenCommands confirmed) and becomes shortId in the domain.",
    "Fixture choices: open answers come after 1 s; slow sends pages 1 s apart; timeout ends at once with 'glab timed out'. The data has iids 640 down to 601; 639 alreadyOpen, 638 fetchFailed and 637 preparing, the rest opened. fixtureMergeRequests.ts has its own pause(): fixtureReview.ts's is private and not mine; suggest one exported pause in fixture.ts.",
    "project-map tree.md, ipc row: MergeRequestSource.ts (Compare/RangeSource extend it); mergeRequestDomain.ts (createdAt→ms, brands, toOpenReply); tauriMergeRequests.ts (one Channel per load); fixtureMergeRequests.ts (?mr=<script>; none without) + fixtureMergeRequestData.ts.",
    "tree.md ui row: mergeRequests.ts (createMergeRequests: the window's one MR slice) + mergeRequestsStore.ts (register/use/windowMergeRequests) + mergeRequestsText.ts; screen.ts adds settingsScreen. B3's lines: range_window.rs (second yamt, $APPIMAGE under an AppImage); scripts/fake-open/xdg-open (logs argv); range-repo.sh's bare fake GitLab.",
    "state.md row: the merge-request overview (project, rows, listing, filters, openings, jobProblem) is owned by ui/mergeRequests.ts. There is one slice per window, built by compareStore/rangeStore through windowMergeRequests and read via useMergeRequests(). Filters are written only through createRememberedFilters().set; screen 'mergeRequests' is set only by show().",
    "To typecheck against the §6 shapes, I put a temporary declare module \"./bindings\" in an owned test file and removed it afterwards. Outside the tree, one throwaway redirect wrote to /tmp/null."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/tauriMergeRequests.ts:22",
      "risk": "An unreadable page that arrives after the command resolves is dropped without a problem (the check runs only up to the reply)."
    },
    {
      "location": "frontend/src/ui/mergeRequests.ts:116",
      "risk": "If a reload ends before its pages arrive (late Tauri delivery), rows swap to empty and me to null until the late pages fill them, which is a brief flicker."
    },
    {
      "location": "frontend/src/ui/mergeRequests.ts:37",
      "risk": "The contract name Listing clashes with ipc's merge-window Listing (exported from ipc/index.ts); B5 must import the slice's Listing from ./mergeRequests."
    },
    {
      "location": "frontend/src/ipc/mergeRequestDomain.ts:28",
      "risk": "The domain assumes the bindings' missingCommit field is short_id. If B3 emits shortId, toOpenReply needs a one-line change."
    },
    {
      "location": "frontend/src/ui/compareStore.ts:300",
      "risk": "Both stores sit at about 297 of 300 lines; the next wiring there needs a split (new files outside this slice)."
    }
  ]
}
