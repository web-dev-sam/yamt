# MrPersonDiscussionsThreads

Agent output (`agent://MrPersonDiscussionsThreads`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsThreads.md), collected 2026-11-05T13:39:58.123Z.

{
  "summary": "`ui/mergeRequestThread.ts` now holds every shown thread in one map, keyed by discussion. A thread stays in the map while the box's panel or an expanded entry shows it. Reads use a token per discussion; `writing` is the one window-wide lock and `isWritable` is the one rule. Every action takes the discussion id. The panel is split into the shell, `MergeRequestThreadBody.vue` (beside or inline) and `MergeRequestThreadButtons.vue`. The reply field emits `cancel`/`focusHost`. The panel looks and closes as before.",
  "files_changed": [
    "frontend/src/ui/mergeRequestThread.ts",
    "frontend/src/ui/mergeRequestThreadRecords.ts",
    "frontend/src/ui/mergeRequestThread.test.ts",
    "frontend/src/ui/MergeRequestThread.vue",
    "frontend/src/ui/MergeRequestThreadBody.vue",
    "frontend/src/ui/MergeRequestThreadButtons.vue",
    "frontend/src/ui/MergeRequestReplyField.vue",
    "frontend/src/ui/MergeRequestThreadPanel.test.ts",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/mergeRequestReload.test.ts"
  ],
  "tests_added": [
    {
      "name": "two_expanded_threads_read_and_write_apart",
      "proves": "Answers given in reverse order land in their own records; a comment on d02 sends d02's text and re-reads only d02; d01's record and text are untouched."
    },
    {
      "name": "one_write_at_a_time_across_threads",
      "proves": "While d01's send runs, `writing` is set and d02's send, resolve and submit send nothing; neither record is writable until the answer arrives, then d02 is."
    },
    {
      "name": "a_collapsed_threads_late_answer_is_dropped",
      "proves": "Collapsing while loading drops the record and the late answer does not bring it back; `threadRead` still gets the answer. Collapsing an entry that is not expanded does nothing."
    },
    {
      "name": "re_expanding_reads_afresh",
      "proves": "Collapse then expand gives a new `loading` and one more read; expanding an expanded entry changes nothing (same `expanded` set)."
    },
    {
      "name": "an_expansion_leaves_the_panel_alone",
      "proves": "With the panel on d01, expanding and collapsing d02 leaves `thread` the same object."
    },
    {
      "name": "the_panel_and_an_entry_share_one_thread",
      "proves": "The panel and an entry on d01 share one record with no second read. Closing the panel or collapsing the entry keeps it while the other shows it; it goes once neither does."
    },
    {
      "name": "the_text_outlives_a_collapse",
      "proves": "The reply text stays through a collapse and a re-expand (C6, E4)."
    },
    {
      "name": "refreshed_rereads_every_shown_thread_of_the_row",
      "proves": "`refreshed(iid)` re-reads the panel's and every expanded thread of that merge request and none of another; `refreshed(null)` re-reads all of them."
    },
    {
      "name": "the_inline_body_has_no_inner_scroller",
      "proves": "The inline body renders the comments and the field with no `overflow-y-auto`/`overscroll-contain` container (only the textarea scrolls); the beside body keeps today's classes."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused; test",
      "observed": "vue-tsc -b clean; oxlint+eslint clean; \"All matched files use the correct format.\"; knip no findings; \"Test Files 306 passed (306) / Tests 4579 passed (4579)\""
    },
    {
      "command": "just app-session start-fixture --name mpt --diff --mr list --open-mr --size 1600x1000; hover \"13 open discussions\" (!637); hover d01 row; press Shift",
      "observed": "dialog \"Thread: src/board.ts:12\" opened: right edge 1235 = box left 1235, 5 articles, the dialog has focus"
    },
    {
      "command": "click the reply field, type \"Thanks, done.\", click \"Add comment\" (console.info hooked via `read`)",
      "observed": "[info] mergeRequests.fixture_write {kind: \"comment\", iid: 637, discussion: \"…0001\"} once, then thread_write sent and thread_read comments: 5"
    },
    {
      "command": "click \"Resolve thread\"",
      "observed": "one more line: [info] mergeRequests.fixture_write {kind: \"resolve\", iid: 637, discussion: \"…0001\"}; button now \"Unresolve thread\"; focus stays in the textarea"
    },
    {
      "command": "type \"Looks **good**\", click Preview; shot target/shots/mpt-preview.png",
      "observed": "preview block holds <strong>good</strong>; the screenshot (dark theme) shows the panel left of !637's box with header Resolved, Open on GitLab, \"Submit review 2 pending\", Close"
    },
    {
      "command": "click Write (focus to the field), press Escape; then press Escape again",
      "observed": "first Escape: {dialog:false, focusedId:\"01\", page:true}; second Escape: {rows:0, page:true}, so the box closed and the page stayed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — mergeRequestThread.ts 160 killed / 3 survived / 3 errors, mergeRequestThreadRecords.ts 104 killed / 1 survived; 98.51%",
    "survivors": [
      "src/ui/mergeRequestThread.ts:180 `if (previous !== null)`→`if (true)` — gate-covered: vue-tsc rejects passing `DiscussionId | null` to `dropUnlessShown`",
      "src/ui/mergeRequestThread.ts:188 `if (previous !== null)`→`if (true)` — gate-covered: same type error",
      "src/ui/mergeRequestThread.ts:175 `panel.value === null ? null :`→`false ? null :` — gate-covered: `Map<DiscussionId>.get(null)` is a type error; it returns undefined → null at runtime",
      "src/ui/mergeRequestThreadRecords.ts:104 `lastToken += 1`→`-= 1` — equivalent: tokens stay unique either way"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "New file `ui/mergeRequestThreadRecords.ts` (granted by Main): the keyed owner was 373 lines, over max-lines 300. It holds the six record types, State, the record map, read tokens, read/reread and setText.",
    "`mergeRequestThread.ts` re-exports the six types, so no importer changes (precedent: `mergeRequestDiscussions.ts`). The types live in the lower file because `fences.ts` counts type imports as cycles.",
    "`frontend/src/ui/mergeRequestReload.test.ts` (granted by Main): only call sites changed — `setResolved(shown, true)` at :218 and `submitReview(shown)` at :250.",
    "For the docs keeper: `.omp/skills/project-map/tree.md` needs rows for `ui/mergeRequestThreadRecords.ts`, `ui/MergeRequestThreadBody.vue` and `ui/MergeRequestThreadButtons.vue` (PM6, `just map-check`).",
    "For the docs keeper: `state.md` rows 89–90 need the keyed threads, `expanded` and `writing`; `frontend/src/ui/AGENTS.md:63` still describes the single slot, the generation counter and `sendReply(kind)`.",
    "Left open by the brief, decided: `retryThread(d)` keeps the record's `sending` and `preview` and only sets the load back to loading (today it rebuilt the whole slot).",
    "Left open by the brief, decided: read tokens are never deleted when a record goes. A re-created record takes a newer token, so the map holds at most one number per discussion shown in the window's life, like `replyTexts`.",
    "Left open by the brief, decided: `reread` always takes a token. The `null` (\"box alone\") case is gone, which also removed equivalent mutants.",
    "`createThreads` keeps the Contract's inline deps type rather than reusing the records file's private `ThreadDeps`.",
    "Removed `a_thread_shown_during_another_threads_write_reports_it`: it tested the `show` trick the brief removes. `one_write_at_a_time_across_threads` pins the new rule."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestThreadRecords.ts:72-75 (recordOf)",
      "risk": "Records are keyed by discussion id only. If the same id is shown under two merge requests, the newer record replaces the older; the panel and an entry then share the newer one. Real GitLab ids are unique, so [INFERENCE] this never happens."
    },
    {
      "location": "frontend/src/ui/mergeRequestThread.ts:34-41",
      "risk": "The thread types are now defined in mergeRequestThreadRecords.ts and re-exported. A reviewer may want the types defined in mergeRequestThread.ts itself, but that needs a third file or a type cycle that `fences.ts` rejects."
    },
    {
      "location": "frontend/src/ui/MergeRequestThreadButtons.vue:37",
      "risk": "`ml-auto` stays on Open on GitLab, so the panel's DOM is unchanged; the inline host will also get the buttons pushed right."
    }
  ]
}
