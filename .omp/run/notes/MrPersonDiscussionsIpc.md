# MrPersonDiscussionsIpc

Agent output (`agent://MrPersonDiscussionsIpc`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsIpc.md), collected 2026-11-05T14:00:49.491Z.

{
  "summary": "Every OpenDiscussion now has `first: FirstComment { createdAt (ms), body: Description }`. `toDiscussion` converts it with field paths, so rows and threads both get it. The fixture's `openDiscussion` fills it from `comments[0]`. Seven person cases p1–p7 (serials 17–23) live in a new `fixtureMergeRequestPersonCases.ts`, run through a generalised `scripted`, on !624, !628, !609 and !607, with counts in `OPEN_DISCUSSIONS`. All hand-built literals carry `first`; `ipc/AGENTS.md` describes the cases.",
  "files_changed": [
    "frontend/src/ipc/discussionDomain.ts",
    "frontend/src/ipc/discussionDomain.test.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
    "frontend/src/ipc/fixtureMergeRequestTurnCases.ts",
    "frontend/src/ipc/fixtureMergeRequestPersonCases.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/fixtureMergeRequestData.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/mergeRequestThread.test.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/mergeRequests.test.ts"
  ],
  "tests_added": [
    {
      "name": "discussionDomain.test.ts the_first_comment_converts_its_time_and_brands_its_links",
      "proves": "A bad first.createdAt throws with rows[2]…first.createdAt and thread.discussion.first.createdAt; an ftp link in first.body throws …first.body.link.page. The existing toRowDiscussions test pins the converted first (ms + branded page)."
    },
    {
      "name": "tauriMergeRequests.test.ts readDiscussions_calls… / each_thread_method_calls… (expected values)",
      "proves": "Rows and the thread carry `first` converted (Date.parse / Date.UTC times, link body)."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts every_discussion_starts_with_its_first_comment",
      "proves": "For every listed row, first equals the stored comments[0]'s time and body; p1's first time differs from its last."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts the_person_cases_have_their_writers_in_order",
      "proves": "p1 anna→ben→chiara→dmitri … p6 has 13 later writers (deleted users included), no mentions, ids …0017–…0023."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts the_person_cases_last_comments_are_at_distinct_hours_seventeen_to_twenty_three",
      "proves": "Last comments are 17..23 h old and first comments 48 h old, so no hour is shared across rows."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts p1_starts_with_a_formatted_six_line_comment_and_p2_with_a_plain_one",
      "proves": "p1's body: six paragraphs with bold, code, a link (page) and a 160 px width image. The other cases keep plain bodies."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts the_person_cases_fall_in_the_groups_the_design_names_for_sam_and_anna",
      "proves": "turnOf plus started/wrote give exactly the design table's groups for Me and Anna in p1–p7."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts the_listed_rows_give_sam_and_anna_each_a_reviewer_group_discussion",
      "proves": "Replaces the_person_case_rows_have_sam_and_anna_as_reviewers (Main's option 2): !638 gives sam a reviewer-group entry and !632 gives anna one."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts a_discussion_without_comments_throws_naming_it",
      "proves": "openDiscussion refuses an empty discussion and names it."
    },
    {
      "name": "fixtureMergeRequestData.test.ts the person case rows count their cases and are neither sam's nor anna's",
      "proves": "!624=3, !628=2, !609=1, !607=1; their authors are ben, chiara, ben and dmitri."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck / lint (exit codes)",
      "observed": "tc=0, lint=0 (vue-tsc -b, oxlint --type-aware, eslint .vue clean)"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. Finished in 1121ms on 840 files"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "$ knip --include exports,types — no findings"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 306 passed (306); Tests 4588 passed (4588). the_review_orders_the_smoke_expects passes unchanged."
    },
    {
      "command": "just bindings-check",
      "observed": "cargo run … export-bindings -- target/bindings-check.ts; diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts → empty diff, exit 0"
    },
    {
      "command": "pnpm -C frontend exec vitest run src/ipc/fixtureMergeRequestDiscussions.test.ts",
      "observed": "Tests 17 passed (17)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → no Rust changes; Stryker on 5 files: 521 killed, 407 survived, 4 no cov; discussionDomain.ts 100% (74/74)",
    "survivors": [
      "fixtureMergeRequestDiscussions.ts:154 `||`→`&&`, `false||…`, `…||false` — equivalent: first and last are both undefined exactly when comments is empty",
      "fixtureMergeRequestTurnCases.ts:205 `firstSerial + at`→`-` in inOrder — equivalent: 1−at===1 only at at=0; 14−at never reaches 1 over 3 cases",
      "fixtureMergeRequestTurnCases.ts:216 default `return null` removed — equivalent: undefined ?? personCases(seed) behaves the same",
      "fixtureMergeRequestTurnCases.ts:114 PERSON_FIRST_SERIAL `+`→`-` — wiring: module-level static, not re-evaluated under the vitest runner (#732)",
      "fixtureMergeRequestTurnCases.ts:125-129 RICH_CHANGES arrows / [] — wiring: module-level static (#732); d01 contents pinned by fixtureMergeRequestThreads tests",
      "fixtureMergeRequestPersonCases.ts:103 FORMATTED_FIRST [] / ()=>undefined — wiring: module-level static (#732); p1 test pins the body",
      "fixtureMergeRequestPersonCases.ts:23-99 FORMATTED_TEXT / PERSON_CASES literals — data, module-level static (#732); pinned by the writers/groups/hours tests",
      "fixtureMergeRequestData.ts:22-36 iid constants and OPEN_DISCUSSIONS — data, module-level static (#732); pinned by the counts tests",
      "other survivors in fixture*.ts are on unchanged pre-existing lines (static data)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Case rows are not the defaults. In fixtureRows(0,40), !626, !621 and !611 are authored by sam and !620 by anna. Rows used: !624 (p1–p3, ben's), !628 (p4–p5, chiara's), !609 (p6, ben's), !607 (p7, dmitri's). The verify brief should name these.",
    "No case row has sam or anna as reviewer; Main chose option 2. Making either a reviewer of a free row would change the anna-drafts order in the_review_orders_the_smoke_expects. Acceptance test the_person_case_rows_have_sam_and_anna_as_reviewers became the_listed_rows_give_sam_and_anna_each_a_reviewer_group_discussion (sam: !638, anna: !632).",
    "New file frontend/src/ipc/fixtureMergeRequestPersonCases.ts (ownership granted by Main): the cases would push fixtureMergeRequestTurnCases.ts past max-lines 300. tree.md needs a row: 'fixtureMergeRequestPersonCases.ts — the person view's fixture cases p1–p7 (PERSON_CASES, p1's formatted body, personCases(seed) through scripted)'.",
    "ipc/index.ts lists discussionDomain types one by one, but it is outside Owned (hook blocked). Needed: add `FirstComment,` to the `export type { … } from \"./discussionDomain\"` list (before `MarkdownPreviewReply`). knip passes without it.",
    "fixtureMergeRequestTurnCases.ts: `scripted(seed, scripts: Script[])` is exported and generalised. Script is { serial, said, hoursAgo, changes }; turnCases builds !637 and !636 with `inOrder`, behaviour unchanged. PERSON_FIRST_SERIAL, Seed and Script are exported. RICH_CHANGES became a Change[] attached to d01 only.",
    "fixtureMergeRequestDiscussions.ts seeded(): `turnCases(seed) ?? personCases(seed)`.",
    "Person cases end `serial` hours before now (17–23 h), so no last comment shares an hour with another row's or with !637/!636's.",
    "fixtureMergeRequestData.ts exports ANNA_CASES_IID, SAM_CASES_IID, FOLD_CASE_IID, OTHERS_CASE_IID.",
    "fixtureMergeRequestDiscussions.test.ts: the heavy existing tests now use one store per test instead of one per openOf call. Stryker's dry run timed out (5 s) on every_discussion_id_is_40_hex… and the change cuts seeding 3×. The expected TURN_CASES set now includes the case rows. The expected counts in fixtureMergeRequests.test.ts gain the four rows."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/fixtureMergeRequestPersonCases.ts:23-31",
      "risk": "FORMATTED_TEXT (the stored `text`) is a Markdown approximation of the body; the fixture never renders it (only `body` is shown), but a later script that re-renders text would lose the code/link/image."
    },
    {
      "location": "frontend/src/ipc/fixtureMergeRequestData.ts:22-36",
      "risk": "!624 is also LOGGED_OUT_LOG_IID for job logs and !609/!607 change from generated to scripted discussions. No smoke names them [INFERENCE from the brief's free-row list], but the ui smokes were not rerun in WebKit (none is in this slice's acceptance)."
    }
  ]
}
