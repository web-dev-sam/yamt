# MrThreadsStateUi

Agent output (`agent://MrThreadsStateUi`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateUi.md), collected 2026-11-04T15:40:47.995Z.

{
  "summary": "The window now holds the reload and thread state for the open-discussions box. The queue reloads one row (`reloads`, D1/D2), keeps a resolved mark on a row until its box closes, and sets the row's count through the slice's one row patcher `withRow`. New `mergeRequestThread.ts` holds the one shown thread, a generation counter against stale answers, the reply texts per discussion, one write at a time (a non-refused failure reads the thread again) and the preview. The slice's reload and list refresh re-read the shown thread (D3, C2). Seven new problem steps.",
  "files_changed": [
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/mergeRequestDiscussionRows.ts",
    "frontend/src/ui/mergeRequestThread.ts",
    "frontend/src/ui/mergeRequestThread.test.ts",
    "frontend/src/ui/mergeRequestPreview.ts",
    "frontend/src/ui/mergeRequestReload.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts",
    "frontend/src/ipc/index.ts"
  ],
  "tests_added": [
    {
      "name": "queue: a_reload_keeps_the_rows_until_its_answer, a_reload_sets_the_rows_count, a_failed_reload_keeps_the_rows_and_says_why",
      "proves": "D2: the entry is unchanged until the answer; open → read, no marks, counted(iid, n), one discussions_reloaded line; refused/ipc → entry kept, `reloads` holds why, no count, nothing re-asked"
    },
    {
      "name": "queue: a_reload_goes_first_and_once, a_reload_answered_in_part_stays_asked_until_its_answer",
      "proves": "A reload goes first among the queued iids, once, on the one `send` path, and stays asked until an answer names it"
    },
    {
      "name": "queue: a_reload_after_a_refresh_is_dropped (RK72), a_reload_without_an_entry_asks_like_a_hover_and_off_asks_nothing",
      "proves": "replaced clears reloads and drops an answer in flight; a row without an entry is asked like a hover; 'off' asks nothing"
    },
    {
      "name": "queue: switching_to_lazy_keeps_a_waiting_reload, a_reload_in_flight_while_switching_to_lazy_keeps_the_rows (+ _sent_before_lazy_keeps_it_asked)",
      "proves": "A switch to lazy never drops a reload or its row"
    },
    {
      "name": "queue: a_resolved_row_stays_until_the_box_closes_then_the_count_drops, an_unresolved_row_loses_its_mark",
      "proves": "C10/RK72: a marked row stays until boxClosed, then leaves, and counted(iid, rest) runs; resolved=false removes the mark"
    },
    {
      "name": "queue: a_thread_answer_replaces_its_discussion_in_the_box, _for_no_such_row_or_discussion_changes_nothing, closing_a_box_without_marks_changes_nothing",
      "proves": "C8.3: replaced in place, order kept; an unknown, loading or unmarked row is left untouched and nothing is counted"
    },
    {
      "name": "thread: each_open_reads_the_thread_afresh, a_failed_read_retries",
      "proves": "C5: loading first, a fresh read on each open, none for the thread already shown; failed/refused shown in the panel; Retry reads again"
    },
    {
      "name": "thread: an_answer_for_a_thread_no_longer_shown_changes_only_the_box, an_old_read_of_the_same_thread_never_reaches_the_panel",
      "proves": "RK67/RK72: an older read only calls threadRead and never changes the panel, even for the same discussion shown again"
    },
    {
      "name": "thread: texts_are_kept_per_discussion_until_sent",
      "proves": "C6: each discussion keeps its own text; a sent reply clears only the text that was sent, not text typed meanwhile"
    },
    {
      "name": "thread: a_second_send_while_one_runs_sends_nothing, a_refused_send_keeps_the_text_and_reads_nothing",
      "proves": "C8: one write at a time in the window; a blank text, no text or no thread sends nothing; refused → failed state, text kept, no re-read"
    },
    {
      "name": "thread: a_failed_send_reads_the_thread_again_before_another_send",
      "proves": "RK33: failed/notLoggedIn/ipc → failed state plus a re-read; sends stay blocked until the re-read answers"
    },
    {
      "name": "thread: submit_publishes_then_reloads_the_thread_and_the_row, a_failed_submit_keeps_the_drafts_pending",
      "proves": "C9: sent → re-read plus reloadDiscussions(iid); a failure leaves drafts pending with no row reload; a refused submit reads nothing"
    },
    {
      "name": "thread: resolve_sends_no_text_and_rereads",
      "proves": "C10: resolve/unresolve send no text, keep it, and re-read; the box gets the resolved flag"
    },
    {
      "name": "thread: a_blank_preview_is_empty_without_a_call, a_preview_failure_keeps_the_text, typing_while_a_preview_loads_drops_its_answer (+2 more)",
      "proves": "C7: a blank text gives 'empty' with no call; loading → read/refused/failed; typing goes back to writing and drops a stale answer, as does a closed panel"
    },
    {
      "name": "thread: the_thread_logs_carry_no_text_names_or_ids, refreshed_rereads_only_the_shown_merge_request",
      "proves": "The exact thread_read/thread_write/preview_read fields with ms (no text or discussion id); refreshed(iid|null) re-reads only a matching shown thread"
    },
    {
      "name": "slice: a_reload_reads_the_shown_thread_again, a_thread_resolved_elsewhere_reads_resolved_and_keeps_its_text",
      "proves": "D3 over the ?mr=list fixture: a reload of the shown thread's merge request reads it again (another row's reload does not); a resolved thread reads resolved, keeps its text, and the row count drops"
    },
    {
      "name": "slice: a_list_refresh_rereads_the_shown_thread, withRow_patches_the_buffer_of_a_buffering_refresh, a_resolve_in_the_panel_marks_the_row_until_the_box_closes",
      "proves": "C2: the swap after a refresh re-reads the panel; a reload count lands in rows and in the buffered refresh; a panel resolve marks the row until boxClosed lowers the count"
    },
    {
      "name": "problemText.test: a failed merge-request call at %s says what failed (7 new steps)",
      "proves": "The exact words for thread/reply/draft/resolveThread/unresolveThread/submitReview/preview"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b (no errors)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" (no findings)"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. (FMT_OK)"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "$ knip --include exports,types (no findings)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  294 passed (294) / Tests  4415 passed (4415)"
    },
    {
      "command": "pnpm exec vitest run src/ui/mergeRequestThread.test.ts src/ui/mergeRequestReload.test.ts src/ui/mergeRequestDiscussions.test.ts src/ui/mergeRequests.test.ts",
      "observed": "Tests  151 passed (151)"
    },
    {
      "command": "Smoke in the window",
      "observed": "none in the window, by the brief (no component reads the new state yet). The slice-level tests run over createFixtureCompareSource(log, \"?mr=list\", {})."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 9 TS files, 948 mutants: 917 killed, 16 survived, 11 no coverage, 4 errors (no Rust changes)",
    "survivors": [
      "mergeRequestThread.ts:84 patch `current !== null` → true / || — equivalent: with no thread isShown is already false; the check is only there for TS narrowing",
      "mergeRequestThread.ts:123 reread `current === null` → false — equivalent: isShown is false when no thread is shown; the check is only there for TS narrowing",
      "mergeRequestThread.ts:213 sendReply `discussion === undefined ? \"\"` → false / \"Stryker\" — equivalent: with no thread, write() returns before any call",
      "mergeRequestDiscussions.ts:96 settle `: []` → [\"Stryker was here\"] — equivalent: a string is never an iid in `unhovered`",
      "mergeRequestDiscussions.ts:157 becameLazy `: []` → [\"Stryker\"] — equivalent: a string is never a queued iid",
      "mergeRequestDiscussions.ts:148 dropped `generation += 1` → -= 1 (old line) — equivalent: values still never repeat, and only equality is compared",
      "mergeRequestDiscussions.ts:240-241 discussionsOf threadRead wrapper (NoCoverage) — wiring: forwards to the queue's threadRead, which the queue tests cover",
      "mergeRequestDiscussions.ts:182, mergeRequestDiscussionRows.ts:61 exhaustive `default: never` (NoCoverage) — equivalent: unreachable by type",
      "ipc/index.ts:211/215, mergeRequests.ts:138/208, problemText.ts:171/181/196 — not changed lines (only re-export lines in index.ts and lines next to the edits were touched)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Split approved by Main (max-lines 300): new ui/mergeRequestDiscussionRows.ts holds DiscussionLoad, DiscussionFailure, Reload, Discussions, loadOf, answerKind, the entry writers threadRead/boxClosed and useRowDiscussions; mergeRequestDiscussions.ts re-exports them, so importers are unchanged.",
    "Split approved by Main: new ui/mergeRequestPreview.ts holds the Preview type and readPreview (call + log). Preview is not re-exported from mergeRequestThread.ts, as Main preferred.",
    "Contract wording: createThreads returns `refreshed` as a readonly property `(iid) => void`, not a method, so mergeRequests.ts can destructure it without tsgolint unbound-method; callers call it the same way.",
    "discussionsOf(queue, reloaded) gains a second parameter: the slice passes threadsRefreshed, so the slice's reloadDiscussions re-reads the shown thread (D3) without overriding a member. Every member of the Discussions type is unchanged.",
    "Decided: threadRead for a discussion not in the read entry does nothing, mark included, so a mark is never left on a row the box no longer has (D3 after a reload).",
    "Decided: reloading a `loading` row moves it first, takes it out of `unhovered` and sets no `running` reload. Only a settled entry gets `running`, and only a reload answer calls `counted`. becameLazy keeps a waiting reload queued and its entry.",
    "Decided: one write at a time in the window, whatever thread is shown. A sent comment or draft clears the text only if it is still the text sent. After a write whose panel moved on, the re-read reaches only the box (threadRead), never the panel.",
    "Decided log kinds: discussions_reloaded/thread_read/thread_write/preview_read `kind` is the reply's kind (\"open\" for a reload's open answer) or the ipc cause kind; thread_read `comments` is 0 when nothing was read.",
    "ipc/index.ts re-exports added for first importers: DiscussionId, DiscussionThread, DiscussionThreadReply, DiscussionWriteReply, MarkdownPreviewReply, ReplyKind.",
    "Docs keeper, outside my globs: tree.md rows for ui/mergeRequestThread.ts, ui/mergeRequestDiscussionRows.ts, ui/mergeRequestPreview.ts; state.md rows for `thread`, `replyTexts`, `reloads` and the `resolved` marks (each with its one writer); plan §2 #183 and RK72 into risk-register.",
    "`just map-check` fails today on the ipc files and MergeRequestSource methods that mr-threads-state-ipc reported earlier (docs keeper)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestThread.ts:136-140 (show)",
      "risk": "A thread shown again while an earlier write still runs shows `sending: idle`. Its buttons do nothing until that write ends, because `writing` blocks them window-wide. The panel slice may want to disable them from a `writing` signal."
    },
    {
      "location": "frontend/src/ui/mergeRequestDiscussions.ts:209-222 (reload)",
      "risk": "A reload of a row with no entry, or a `loading` one, sets no `running` reload, so no spinner and no `counted`. This follows the brief ('as askDiscussions does'); the box slice must not expect `reloads` for such rows."
    },
    {
      "location": "frontend/src/ui/mergeRequestThread.ts:142-148 (setText)",
      "risk": "Clearing a sent text stores \"\" rather than removing the map entry; consumers should read `get(id) ?? \"\"`."
    }
  ]
}
