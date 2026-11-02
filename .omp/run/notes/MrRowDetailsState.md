# MrRowDetailsState

Agent output (`agent://MrRowDetailsState`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsState.md), collected 2026-11-02T20:59:47.913Z.

{
  "summary": "Rows now carry people with one picture address each (uploaded → convertFileSrc over `yamt-picture`, Gravatar passed as sent, none → null), coloured labels, approvers and `mayRerequest`. `rerequestReview` exists on the source (tauri + fixture). The store has three-state `click`, due dates kept per repository (dropped only on a `loaded` end) with dated rows first, and re-request asks whose `requested` reply rewrites that row's reviewers in `rows` and in a buffering refresh. The fixture has authors, review states, a stack of 4, zero-size !635 and data: pictures.",
  "files_changed": [
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/mergeRequestDomain.test.ts",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/fixtureMergeRequestData.test.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts",
    "frontend/src/ui/mergeRequestDueDates.ts",
    "frontend/src/ui/mergeRequestDueDates.test.ts",
    "frontend/src/ui/mergeRequestRerequests.ts",
    "frontend/src/ui/mergeRequestRerequests.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestFilters.ts",
    "frontend/src/ui/mergeRequestFilters.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestDomain: an_uploaded_picture_is_the_scheme_address_of_the_username…, a_gravatar_picture_is_rusts_address_unchanged, no_picture_is_null",
      "proves": "Each picture kind maps to the one address for the author, assignees, reviewers and approvers. A null author stays null."
    },
    {
      "name": "mergeRequestDomain: approvedBy order; label colours and mayRerequest pass through; a requested reply's reviewers get pictures",
      "proves": "Approvers keep their order, colours and null colours pass through, mayRerequest passes through both ways, and the reply's reviewers are converted (other replies are passed by identity)."
    },
    {
      "name": "tauriMergeRequests: the_uploaded_picture_address_is_convertFileSrc_of_the_username_and_the_scheme; rerequestReview calls the command",
      "proves": "A listed page runs convertFileSrc(username, \"yamt-picture\"). The command gets (iid, username) and the reply is converted. Refusals and IPC failures pass through."
    },
    {
      "name": "mergeRequestDueDates: set/change/clear exact JSON; a_date_survives_a_new_instance_over_the_same_storage; keep_only_drops_the_others_and_keeps_other_repositories",
      "proves": "The exact `{repo:{iid:\"YYYY-MM-DD\"}}` JSON. Dates survive a reload. keepOnly keeps other repositories and removes a repository left with no date. Keeping every date writes nothing."
    },
    {
      "name": "mergeRequestDueDates: unreadable entries are dropped (6 kinds); no repository; a storage that throws",
      "proves": "Unreadable entries are dropped. With no repository nothing is read (a stored \"null\" key included) and writes are ignored. A write error warns mergeRequests.due_dates_storage_failed."
    },
    {
      "name": "mergeRequestRerequests: second click while running asks once; requested calls replaced and clears; refusal stays until dismissed; failure reports",
      "proves": "Asks are per row and per reviewer. Dismissing removes refusals but keeps running asks, and only for that row. The next ask replaces a refusal. A failure reports rerequestReview and keeps the row's other asks."
    },
    {
      "name": "mergeRequests: a_complete_load_drops_due_dates…, a_cut_or_failed_load_keeps_every_due_date (5 ends), dated_rows_come_first_in_shown_rows",
      "proves": "keepOnly runs on a first load and on a swapped-in refresh, but not on cut, glab or IPC failures. Dated rows come first, soonest first with ties newest first, filtered, and a cleared date puts its row back."
    },
    {
      "name": "mergeRequests: a_rerequest_reply_replaces_that_rows_reviewers_in_rows_and_in_a_buffering_refresh; reply after a load's end; refused",
      "proves": "replaced writes `rows` and the running refresh's buffer, so the swap keeps the new reviewers. Other rows are unchanged, and a refusal writes no rows."
    },
    {
      "name": "mergeRequests: shift_click_excludes_and_the_filter_is_stored_with_not; today's filter tests over click/state",
      "proves": "A shift-click stores `not:me`. With Label frontend it shows !639 !627 !623 !619 !607 !603, and a plain click turns the exclusion off."
    },
    {
      "name": "mergeRequestFilters: today's stored JSON reads as included; an excluded value is stored with not:",
      "proves": "The old JSON reads as included Held values. The exact JSON is pinned for excluded values next to included ones, and it reads back."
    },
    {
      "name": "fixtureMergeRequestData: the_owners_example_keeps_six_rows; !635 size zero; stack of 4; cycles; label colours; no address outside data:",
      "proves": "filtered gives the six iids. Stack rows 638…606: no assignee as reviewer, 3 states, dmitri a done reviewer where re-requestable. Authors, approvers, mayRerequest, CSS colour names, data: pictures."
    },
    {
      "name": "fixtureMergeRequests: re-requesting %s's review on !638 answers after 1,000 ms; never-listed → notReviewer; second-page row",
      "proves": "dmitri gets refused (exact message), ben notReviewer, and chiara requested with her state back at requested and pictures converted. Each ask is logged. Rows on the second page are found too."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  254 passed (254)\n      Tests  3682 passed (3682)  (palette.test and fences included)"
    },
    {
      "command": "pnpm -C frontend lint; echo LINT_EXIT=$?",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\nLINT_EXIT=0 (prints no summary line)"
    },
    {
      "command": "pnpm -C frontend typecheck | grep 'error TS'",
      "observed": "Only the page slice's three files: MergeRequestFilter.vue(122,35),(126,33) 'checked' not on Choice; MergeRequestRow.vue(47,58),(131,40),(136,41) 'approvals' not on MergeRequestRow; MergeRequestsView.vue(121,27) 'toggle' not on MergeRequests."
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. Finished … on 707 files"
    },
    {
      "command": "pnpm -C frontend exec vitest run src/ipc src/ui/mergeRequest src/ui/problem",
      "observed": "Test Files  37 passed (37)  Tests  822 passed (822)"
    },
    {
      "command": "hand mutant: fixtureMergeRequestData.ts LABEL_COLORS frontend background \"steelblue\"→\"\", vitest fixtureMergeRequestData.test.ts, reverted",
      "observed": "× label colours are CSS colour names, and docs has none — Tests 1 failed | 8 passed. So the module-level constant survivors are gate-covered; the hash after the revert is the original."
    },
    {
      "command": "just mutants HEAD (final)",
      "observed": "All files 87.15; mergeRequestDueDates 100, mergeRequestFilters 100, mergeRequestRerequests 98.25 (1 no-cov), mergeRequests 99.44 (1 survivor on an unchanged line), mergeRequestDomain 97.18 (2 no-cov), tauriMergeRequests 98.08, fixtureMergeRequests 92.55, fixtureMergeRequestData 55.63 (static)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: Stryker on 11 changed files, 1105 killed, 151 survived, 12 no-cov (most of them on lines this slice did not touch). Changed-line survivors found from the JSON report.",
    "survivors": [
      "src/ipc/fixtureMergeRequestData.ts:38-78 literals in PNG_DATA, PEOPLE, REFUSING_REVIEWER, LABEL_COLORS, REVIEW_STATES — gate-covered: module-level, not re-run under vitest (#732). Pinned by tests; a hand mutant fails the colours test.",
      "src/ipc/fixtureMergeRequests.ts:68 REFUSED_REREQUEST \"\" — gate-covered: a module-level constant (#732); the exact text is asserted in the dmitri case.",
      "src/ipc/tauriMergeRequests.ts:17 PICTURE_SCHEME \"\" — gate-covered: module-level (#732); the test asserts the constant and the converted address.",
      "src/ipc/mergeRequestDomain.ts:104 default branch NoCoverage — equivalent: the `never` exhaustiveness arm cannot be reached.",
      "src/ui/mergeRequestRerequests.ts:69 `?? []` → `[\"Stryker was here\"]` NoCoverage — equivalent: a string entry's `ask.kind` is undefined, so it is filtered out and the row is still removed."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "createRerequests returns the named type `Rerequests` (in mergeRequestRerequests.ts), structurally the same as the contract's Pick<MergeRequests,…>. It is named there to avoid an import cycle. `RerequestAsk` is defined there too and re-exported from ui/mergeRequests.ts as the contract asks.",
    "mergeRequests.ts would pass the 300-line and 40-line caps, so filterActions (now `click`), `choicesOf` and the `Choices`/`FilterActions` types moved into mergeRequestFilters.ts (owned). The due-date order lives in DueDates as the added method `datedFirst(rows)` (core byDueDate), and `write` is a top-level function in mergeRequestDueDates.ts.",
    "State gains `repository` (one computed shared by the filters and the due dates) and `running: Load | null`, so `replaced` can find a buffering refresh.",
    "Fixture: `fixtureUploadedPicture` stands in for convertFileSrc: sam (uploaded) → tiny PNG; ben (uploaded) → data:…AAAA, like Rust's 404; anna is gravatar with the PNG data: address. The reviewer-less count drops from 14 to 13 because index 18 is a stack row. dmitri's refusal is checked before reviewer membership.",
    "problemText.test.ts edited (it names the steps).",
    "Docs keeper: tree.md rows for ui/mergeRequestDueDates.ts and ui/mergeRequestRerequests.ts. state.md: due dates (key yamt.mergeRequests.dueDates; writers setDueDate and keepOnly on a loaded end), re-request asks (createRerequests), and rerequestsOf.replaced as a new rows writer. Arch/ipc-contract: rerequestReview, PICTURE_SCHEME.",
    "pnpm -C frontend unused (knip) reports the contracted exports Label, Person (ipc/index.ts and mergeRequestDomain.ts) and RerequestAsk (ui/mergeRequests.ts). The page slice's .vue files are their importers."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequests.ts:299",
      "risk": "The file is at 299 of 300 lines. Any later addition must split it; I could not create a new file outside Owned."
    },
    {
      "location": "frontend/src/ui/mergeRequestDueDates.ts datedFirst",
      "risk": "It widens ReadonlyMap<MergeRequestIid,…> to ReadonlyMap<number,…> (method bivariance) because core byDueDate's dueOf takes a plain number. It is sound but relies on TS method-parameter bivariance."
    },
    {
      "location": "frontend/src/ipc/fixtureMergeRequests.ts rerequestReply",
      "risk": "Each fixture re-request rebuilds 500 rows to find its iid. That is cheap but O(n) per ask, in fixture mode only."
    }
  ]
}
