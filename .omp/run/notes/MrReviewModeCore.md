# MrReviewModeCore

Agent output (`agent://MrReviewModeCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModeCore.md), collected 2026-11-03T18:24:27.256Z.

{
  "summary": "Review mode now exists in the core, the stored filters and the discussions box. Core: `ReviewFor`, `Filters.review`, `reviewing`, a stored `review` word kept only while on, `reviewChoices`, `Viewer`/`viewerOf` and viewer turn words, and new `reviewOrder.ts` (order plus sorted/failed words). Window: `review` is ignored unless details are \"full\" and is cleared once when that turns off. Also `review(who)`, `Choices.review`, `viewer`, `reviewSort`. The box uses `viewer` and `discussionsFailedText`.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/filters.ts",
    "frontend/src/mergeRequests/internal/filters.test.ts",
    "frontend/src/mergeRequests/internal/stored.ts",
    "frontend/src/mergeRequests/internal/stored.test.ts",
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/mergeRequests/internal/discussions.test.ts",
    "frontend/src/mergeRequests/internal/choices.ts",
    "frontend/src/mergeRequests/internal/choices.test.ts",
    "frontend/src/mergeRequests/internal/reviewOrder.ts",
    "frontend/src/mergeRequests/internal/reviewOrder.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/mergeRequestFilters.ts",
    "frontend/src/ui/mergeRequestFilters.test.ts",
    "frontend/src/ui/mergeRequestsShown.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/mergeRequestRowReplyText.ts",
    "frontend/src/ui/mergeRequestRowReplyText.test.ts",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ipc/fixtureMergeRequestData.test.ts"
  ],
  "tests_added": [
    {
      "name": "reviewOrder: due_rows_…_soonest_first, equal_due_days_…_keep_newest_first, a_due_row_without_the_reviewers_turn_sorts_with_the_rest",
      "proves": "Rule 3.1: the first group is due rows with the reviewer's turn, in normal order, whatever their waiting counts; undated rows with a turn are not first."
    },
    {
      "name": "reviewOrder: the_rest_sort_by_fewest_waiting_on_the_author, ties_among_the_rest_keep_the_normal_order_due_first_then_newest",
      "proves": "Rules 3.2 and 3.3: the rest sort by fewest waiting; ties keep byDueDate's order."
    },
    {
      "name": "reviewOrder: another_reviewer_gets_their_own_turns_and_waits, an_unknown_author_counts_as_the_reviewers_turn",
      "proves": "sam and anna get different orders from the same rows; an unknown author is the reviewer's turn."
    },
    {
      "name": "reviewOrder: rows_not_arrived_sort_as_none_and_are_counted_loading, a_failed_row_keeps_the_normal_order_and_is_named",
      "proves": "Rule 6: loading rows sort as none and are counted (none rows are not); the first failed row in normal order is named, even after a loading row."
    },
    {
      "name": "reviewOrder: the sorted/loading/failed words tests",
      "proves": "The tooltip words for me and a person, loading 1 and 3, and failed, exactly as in the brief."
    },
    {
      "name": "filters: reviewing_replaces_…, a_filter_edit_keeps_the_review_order, no_filters_has_no_review_order, review_alone_counts_as_filtered",
      "proves": "Rule 2: reviewing sets Reviewer and Ready; edits keep review; NO_FILTERS is the exact literal; isFiltered counts review."
    },
    {
      "name": "stored: review_is_stored_…_only_while_on, the_stored_form_keeps_the_four_fields_…, a_review_word_none_or_junk_reads_as_off, round trips",
      "proves": "The fifth key is written only while on; the other keys are exactly today's, in today's order; \"none\", junk and non-strings read as off."
    },
    {
      "name": "choices: the_picker_lists_me_then_the_reviewer_filters_people_without_none",
      "proves": "The Reviewer list without None, in its order; only the chosen value is included; a held missing person keeps its place."
    },
    {
      "name": "discussions: the_turn_words_name_another_reviewer, viewer_of_a_person_who_is_me_is_me, viewer_name_is_the_display_name_else_the_username",
      "proves": "Rule 5: the words speak for the viewer; viewerOf picks me or the person's display name, else the username; the summary has singular and plural for a person."
    },
    {
      "name": "mergeRequestFilters: leaving_load_fully_…_keeps_its_filters (RK62), the_review_order_reads_as_off_…, review_sets_reviewer_and_ready_…",
      "proves": "Rule 7: one write drops review and keeps Reviewer and Ready; Load fully does not bring it back; the gate hides review while not full; review(who) stores the word."
    },
    {
      "name": "mergeRequestFilters: leaving_…_leaves_the_entry_as_written, turning_to_load_fully_writes_nothing_…",
      "proves": "The gate writes only on a true→false change with a stored review; any other entry stays byte-for-byte."
    },
    {
      "name": "mergeRequests: review_mode_orders_…_late_answer_moves_them, a_failed_row_…_reviewSort_failed, an_ipc_failure_names_the_first_row_…",
      "proves": "Slice rig: rows move when one answer arrives; a refused or IPC-failed row leaves the normal order, with reviewSort failed naming the first such row."
    },
    {
      "name": "mergeRequests: clear_filters_returns_…_viewer_me, the_viewer_follows_review_mode, review_mode_comes_back_on_a_new_slice_…",
      "proves": "Clear filters gives the normal order, viewer me, null sort and \"{}\"; the viewer follows the mode (lazy turns it off); a reload restores review mode."
    },
    {
      "name": "mergeRequestsText: discussionsFailedText for refused kinds and an IPC failure; REVIEW_MODE",
      "proves": "Refusals read glabRefusalText; an IPC failure reads problemText at step discussions."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && lint && test && fmt:check && unused && sfc-order",
      "observed": "vue-tsc clean; oxlint+eslint exit 0, no output; Test Files 273 passed (273), Tests 4127 passed (4127); \"All matched files use the correct format.\"; knip no findings; sfc-order clean."
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node scripts/fences.test.ts ; just map-check",
      "observed": "fences: Tests 52 passed (52). map-check: \"map-check: ok\", with no findings for the new reviewOrder.ts or mergeRequestRowReplyText.ts."
    },
    {
      "command": "just app-session start-fixture --name rmc --diff --mr list --size 1600x1000; step 1 write + reload; click \"Merge requests\"",
      "observed": "Rows !602 !622 !632 !630 !617 !612. Filter button \"Reviewer: anna\", pressed \"Ready\". Shot /tmp/rmc-step2.png (page): 6 of 40, !602 (06.11) above !622 (01.11)."
    },
    {
      "command": "step 3: hover !632's \"2 open discussions\" (--nth 1), read the box",
      "observed": "\"2 of 2 wait for Anna Berg … Anna Berg's turn src/board/column.ts … Anna Berg's turn Overview …\""
    },
    {
      "command": "step 4: click \"Clear filters\"; read rows and localStorage; hover !632's count (--nth 3)",
      "observed": "40 rows \"!622 !602 !640 !639 … !603 !601\"; filters \"{}\". Box: \"0 of 2 wait for you … Waiting for an answer\" ×2. Both last comments are by Sam Weller = me; see deviations."
    },
    {
      "command": "step 5: step 1 again, reload; Back → Settings → Load lazily → Back → Merge requests; then Load fully likewise",
      "observed": "Lazy: stored entry {assignee:[],reviewer:[\"user:anna\"],label:[],draft:\"ready\"} with no review; rows !622 !602 !632 !630 !617 !612; Reviewer: anna, Ready pressed. After Load fully: same order, still no review stored."
    },
    {
      "command": "step 6: write {reviewer:['me'],draft:'ready',review:'me'}, reload, open page, hover !633's count; stop --name rmc",
      "observed": "Rows !622 !638 !633 !623 !618 !608 !603: the normal order (dated first, then newest). review \"me\" is still stored. !633's box reads \"glab failed: glab timed out\". The session stopped (webdriver, vite)."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (10 changed .ts): 1112 killed, 32 survived, 24 no-cov, score 95.21%; mergeRequestFilters 100%, reviewOrder 98.65%, mergeRequestsShown 95.92%",
    "survivors": [
      "src/mergeRequests/internal/filters.ts:37-41 NO_FILTERS literal — gate-covered: module-level, not re-run under vitest (#732); web-test no_filters_has_no_review_order asserts the exact literal",
      "src/mergeRequests/internal/discussions.ts:32 WAITING_TEXT — gate-covered: module-level (#732); web-test the_turn_words_name_another_reviewer asserts it",
      "src/mergeRequests/internal/reviewOrder.ts:17 NO_TURNS — gate-covered: module-level (#732); web-test rows_not_arrived_sort_as_none_and_are_counted_loading relies on it",
      "src/ui/mergeRequestsShown.ts:56 {kind:\"none\"}→{}/{kind:\"\"} — equivalent: reviewOrdered reads only loading/read/failed, so anything else sorts as none",
      "src/ui/mergeRequestRowReplyText.ts:39,63,81 exhaustive default (no cov) — equivalent: unreachable by types; moved unchanged"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Main approved over IRC: mergeRequestsText.ts was at 299 of 300 lines. The row-reply words (rowReplyText and its helpers) moved unchanged to the new ui/mergeRequestRowReplyText.ts, with its test file. MergeRequestRow.vue's import now points there. Docs keeper: add it and internal/reviewOrder.ts to tree.md (map-check stayed ok).",
    "WebKit step 4: the brief expects \"2 of 2 wait for you\" and \"Your turn\" for !632. In today's fixture both of its last comments are by sam (me), so the turn rule gives \"0 of 2 wait for you\" and \"Waiting for an answer\". The viewer did return to me. [INFERENCE] The page slice's fixture change will alter this.",
    "WebKit step 5: Settings is hidden while the merge-request page is shown, so I went Back first. In step 1, `read` takes one expression, so the two setItem calls ran comma-joined.",
    "Decided: the gate watches reviewable() without `immediate`. It writes only on a true→false change, only when the raw entry holds a review, and only through `set`. Turning to full shows a review that was stored while not full (design §1.7 edge).",
    "ui/mergeRequests.ts needed no change: State already matches Listed's new fields.",
    "ReviewSort is used as a typed expectation in mergeRequests.test.ts, because knip flags a Contract export that has no importer yet.",
    "ui/AGENTS.md lines: createRememberedFilters(repository, reviewable, storage): review reads null while !reviewable(); turning false with a stored review writes the entry once without it. review(who) = reviewing(who); Choices.review = reviewChoices. Shown: viewer = viewerOf; one computed gives shownRows and reviewSort (null without review).",
    "ui/AGENTS.md lines, cont.: DiscussionFailure in mergeRequestDiscussions.ts; REVIEW_MODE and discussionsFailedText in mergeRequestsText.ts (box header and sort icon); rowReplyText in mergeRequestRowReplyText.ts; MergeRequestDiscussions.vue speaks for `viewer`.",
    "The .omp/run/slices.json change in the tree is not mine."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestFilters.ts:72-76",
      "risk": "The gate's watch lives as long as the slice and has no effect scope, like the queue's watches. If the setting turns off before the project is known, the stored review comes back with Load fully (design §1.7 edge)."
    },
    {
      "location": "frontend/src/mergeRequests/internal/reviewOrder.ts:56",
      "risk": "reviewFailedText spells \"!<iid>\" itself, because the core cannot import ui's mergeRequestReference. That is two spellings of one form."
    }
  ]
}
