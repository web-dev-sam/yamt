# MrDescriptionState

Agent output (`agent://MrDescriptionState`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionState.md), collected 2026-11-04T00:35:43.131Z.

{
  "summary": "Added `MergeRequestSource.readDescription` and `uploadedImage` (app: passed through unchanged / `convertFileSrc` over PICTURE_SCHEME), aliases for the description types, and fixture `fixtureMergeRequestDescriptions.ts` with !640 rich, !639 long, !637 empty, !636 fails on its first ask, !635 planted text, plus `hasDescription`. `ui/mergeRequestDescriptions.ts` holds the window's one panel: toggle, retry, close, imageAddress; the latest open wins (RK67); log line `mergeRequests.description_shown`. Spread into `MergeRequests`. New steps `description` and `link`, and PageKind `link`.",
  "files_changed": [
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/fixtureMergeRequestDescriptions.ts",
    "frontend/src/ipc/fixtureMergeRequestDescriptions.test.ts",
    "frontend/src/ipc/mergeRequestDomain.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/mergeRequestDescriptions.ts",
    "frontend/src/ui/mergeRequestDescriptions.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestDescriptions: opening_shows_loading_then_the_reply, each_open_asks_gitlab_again",
      "proves": "rule 7: Loading… then the reply; open, close, open makes two readDescription calls"
    },
    {
      "name": "mergeRequestDescriptions: a_second_toggle_of_the_same_row_closes, another_rows_toggle_replaces_the_panel_and_asks_afresh",
      "proves": "rule 2: a second click on the same row closes the panel; another row replaces it and asks again"
    },
    {
      "name": "mergeRequestDescriptions: an_answer_for_a_closed_or_replaced_panel_is_dropped",
      "proves": "RK67: an answer after a close, a replace or a newer ask is dropped and logs nothing"
    },
    {
      "name": "mergeRequestDescriptions: retry_asks_again_and_shows_the_new_answer, retry_with_no_panel_asks_nothing",
      "proves": "rule 7: Retry shows loading then the newest answer; with no panel open it asks nothing"
    },
    {
      "name": "mergeRequestDescriptions: a_refusal_is_refused_and_a_thrown_call_is_failed_with_its_cause",
      "proves": "each non-read reply becomes `refused` with the reply; a source failure and a thrown call become `failed` with their cause"
    },
    {
      "name": "mergeRequestDescriptions: image_address_is_the_scheme_for_an_upload_its_own_for_another_site_and_null_when_refused",
      "proves": "an upload's address comes from source.uploadedImage, a web image uses its own address, a refused one gives null"
    },
    {
      "name": "mergeRequestDescriptions: the_log_line_names_the_kind_and_counts_never_text",
      "proves": "the log line holds iid, kind, blocks (shown only) and ms, never the text"
    },
    {
      "name": "mergeRequests.test: a_refresh_keeps_the_open_description",
      "proves": "a list refresh, during the ask or after it, never writes `description` (same object kept)"
    },
    {
      "name": "tauriMergeRequests.test: readDescription_calls_the_command_with_the_iid_and_passes_the_reply_through, + failure-table row",
      "proves": "the app source calls the command with the iid and passes both the reply and an IPC failure through unchanged"
    },
    {
      "name": "tauriMergeRequests.test: uploadedImage_is_the_picture_scheme_address_of_the_key",
      "proves": "an upload's address is yamt-picture://localhost/<key>"
    },
    {
      "name": "fixtureMergeRequestDescriptions: the_rich_description_holds_every_element_of_rule_3",
      "proves": "!640 has every rule-3 element, in order and with its words; upload …01 loads and …02 is the broken picture"
    },
    {
      "name": "fixtureMergeRequestDescriptions: the_long_empty_and_planted_rows_answer_as_scripted",
      "proves": "!639 has 120 paragraphs, !637 has none, !635 has the three planted texts"
    },
    {
      "name": "fixtureMergeRequestDescriptions: the_failing_row_fails_once_then_reads, an_ask_is_logged_at_once_and_answered_after_400_ms",
      "proves": "!636 fails on its first ask in each source, then reads; each ask is logged at once and answered after 400 ms"
    },
    {
      "name": "fixtureMergeRequestDescriptions: every_listed_row_with_a_description_answers, a_row_without_a_description_is_scripted_as_such",
      "proves": "unscripted rows answer 'Description of !<iid>.'; !638, 631 and 624 have hasDescription false and read empty"
    },
    {
      "name": "problemText.test + mergeRequestsText.test new rows",
      "proves": "the words 'Could not read the description', 'Could not open the link' and the link kind's NOT_OFFERED sentence"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b  (no diagnostics, exit 0)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"  (no diagnostics, exit 0)"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. Finished in 1127ms on 780 files"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  283 passed (283)  Tests  4263 passed (4263)"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "Unused exported types (21): only the description aliases kept for the page slice (CellAlign, DescriptionBlock, DescriptionCell, DescriptionInline, DescriptionItem, DescriptionLink, DescriptionRow, HeadingLevel, ListNumbering, TaskBox, UploadKey in index.ts + mergeRequestDomain.ts); nothing else"
    },
    {
      "command": "just app-session start-fixture --name mds --diff --mr list --size 1600x1000; click 'Merge requests'; console hooked; Back, Merge requests, Refresh; read",
      "observed": "{\"errorsOrWarnings\":[],\"infos\":12,\"events\":[\"mergeRequests.fixture_discussions\",\"mergeRequests.discussions_read\"],\"summary\":\"40 of 40 merge requests\",\"describeButtons\":0}; shot /tmp/mds-page.png: page unchanged, no info button; session stopped"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 12 TS files, 1736 mutants: 1407 killed, 177 survived, 21 no coverage. Afterwards the two fixture survivors were killed (stryker on lines 89, 154-160: 21/21 killed)",
    "survivors": [
      "src/ipc/fixtureMergeRequestDescriptions.ts:16-21,28,31 StringLiteral/ArrayDeclaration (module-level consts) — gate-covered: module-level mutants are not re-evaluated under vitest (#732, justfile mutants note); the test pins each literal",
      "src/ipc/fixtureMergeRequestData.ts:41 BROKEN_PICTURE \"\" — gate-covered: module-level const (#732); my test pins its literal",
      "src/ui/mergeRequestDescriptions.ts:82 exhaustive default (NoCoverage) — equivalent: unreachable `never` arm",
      "Other survivors (fixtureMergeRequestData.ts rows, fixtureMergeRequests.ts 51-80/137/170, index.ts 186-190, tauriMergeRequests.ts:21, mergeRequests.ts:130/182, problemText.ts:173) are on lines I did not change"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`descriptionScript(log, LISTED_ROWS)`, not `(log)`. Like discussionsScript/peopleScript, it needs the listed rows so that a row with hasDescription false (!638, 631, …) reads empty instead of 'Description of !638.'",
    "!636's first answer reuses `TIMED_OUT` (\"glab timed out\") as the deadline line, not a new string. The fail-once state is a per-source Set of asked iids, not a count; `fixtureDescription(iid, firstAsk, listed)`",
    "hasDescription uses its own constants NO_DESCRIPTION_EVERY=7 and NO_DESCRIPTION_AT=2 (DRAFT_EVERY means something else). BROKEN_PICTURE is now exported for the new fixture",
    "tauriMergeRequests.ts: `uploadedImage` reuses `uploadedPicture` (its parameter renamed to `key`). Both description calls sit in `descriptionCalls()` like `peopleCalls()`, to keep the 40-line function cap",
    "ui/mergeRequests.ts: to keep createMergeRequests within 40 lines, pageProblem/openPage/dismissPageProblem moved into `pageOpenerOf(state)` (same members). File is 252 lines, so no wiring went into mergeRequestDescriptions.ts beyond createDescriptions",
    "knip flags 21 unused description type aliases (index.ts + mergeRequestDomain.ts), kept for mr-description-page as the brief allows",
    "Only the 3 literals the type check named lacked hasDescription: fixtureMergeRequestData.ts row(), mergeRequestDomain.test.ts ROW, tauriMergeRequests.test.ts ROW. mergeRequests.test.ts's rig source gained the readDescription/uploadedImage defaults"
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/mergeRequestDomain.ts:100 (DescriptionLink alias)",
      "risk": "`DescriptionLink.page` is a plain string (alias of the generated type, per the Contract), while `openPage` takes the branded WebPage and `isWebPage` accepts only https://. The page slice must narrow it; an http link Rust allows would fail that guard"
    },
    {
      "location": "frontend/src/ipc/fixtureMergeRequestDescriptions.ts:29",
      "risk": "The 'web' image is a data: PNG standing in for another site (offline). Rust only sends https for `web`, so the panel's handling of a real remote address is shown only in the app run"
    }
  ]
}
