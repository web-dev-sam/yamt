# MrLinksState

Agent output (`agent://MrLinksState`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksState.md), collected 2026-11-04T02:06:51.545Z.

{
  "summary": "`readLinks(iid)` now exists on `MergeRequestSource`, in the app adapter and in the fixture (`linksScript`: !640 rich, !636 fails once, !634 logged out, others empty). `toLinksReply` brands every page through `isLinkedPage`. `ui/mergeRequestLinks.ts` queues asks one at a time, newest first; `dropped()` throws away late answers. The list calls `dropped()` beside `discussionQueue.replaced`. New problem step `links`.",
  "files_changed": [
    "frontend/src/ipc/descriptionDomain.ts",
    "frontend/src/ipc/descriptionDomain.test.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequestLinks.ts",
    "frontend/src/ipc/fixtureMergeRequestLinks.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/mergeRequestLinks.ts",
    "frontend/src/ui/mergeRequestLinks.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsList.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts"
  ],
  "tests_added": [
    {
      "name": "ui/mergeRequestLinks.test.ts only_a_hovered_row_is_asked",
      "proves": "RK70 rule 5: nothing is asked until askLinks, and a closed useRowLinks box asks nothing"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts a_box_opening_asks_and_shows_loading_then_the_answer",
      "proves": "opening a box asks once and shows loading, then read with the links"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts a_read_or_loading_row_is_never_asked_again",
      "proves": "reopening a box and calling askLinks while the entry is loading or read makes only one call"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts asks_run_one_at_a_time_newest_first",
      "proves": "while 640 runs, asks for 639 then 637 are sent as 637 then 639, one at a time"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts a_failure_is_asked_again_at_the_next_open",
      "proves": "a failed entry and a refused entry are asked again at the next open and by askLinks (Retry)"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts an_answer_after_a_refresh_is_dropped (+ an_ask_after_a_refresh_waits_for_the_call_in_flight)",
      "proves": "an answer that arrives after dropped() writes nothing; a new ask waits for the old call to settle, so only one call runs"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts a_box_left_open_across_a_refresh_asks_again",
      "proves": "after dropped(), an open box asks again and a closed box does not"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts a_refusal_is_refused_and_a_thrown_call_is_failed_with_its_cause",
      "proves": "a non-read reply becomes refused { reply }; a thrown call becomes failed with an Unexpected cause"
    },
    {
      "name": "ui/mergeRequestLinks.test.ts the_log_line_names_the_kind_and_counts_never_text",
      "proves": "links_read logs iid, kind (read/failed/thrown), the counts, hidden and ms; it never logs a title, a reference or an address"
    },
    {
      "name": "ui/mergeRequests.test.ts a_refresh_drops_every_rows_links / a_failed_first_load_drops_the_links / the_slice_holds_only_the_public_part_of_the_link_queue",
      "proves": "entries survive a running refresh and a failed one and are gone after the swap; a failed first load drops them; `dropped` is not on the slice"
    },
    {
      "name": "ipc/descriptionDomain.test.ts every_links_page_is_branded_and_a_non_http_one_fails (+ a_links_refusal_passes_unchanged)",
      "proves": "https and http pages pass at every position; ftp throws with its field path, including shown.parent.page; refusals pass unchanged"
    },
    {
      "name": "ipc/tauriMergeRequests.test.ts readLinks_calls_the_command_with_the_iid_and_brands_the_pages; readLinks in the failure table",
      "proves": "the command gets the iid and the reply is converted (a bad page throws); a source failure passes through unchanged"
    },
    {
      "name": "ipc/fixtureMergeRequestLinks.test.ts the_rich_row_holds_every_kind_of_line / the_failing_row_fails_once_then_reads / each_ask_is_logged_before_its_answer",
      "proves": "!640's exact lines, parents, closed and not-shown entries, and its 10 distinct pages; !636 fails once then reads; the log line comes first and the answer after 400 ms; !634 is refused every time"
    },
    {
      "name": "ui/problemText.test.ts row 'links'",
      "proves": "the links step reads \"Could not read the links: yamt's worker stopped; try again.\""
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b (exit 0, no diagnostics)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" (exit 0, no findings)"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. Finished in 1156ms on 795 files"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  288 passed (288)  Tests  4317 passed (4317)"
    },
    {
      "command": "pnpm -C frontend exec vitest run <the 6 touched test files>",
      "observed": "Test Files  6 passed (6)  Tests  250 passed (250)"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "Unused exported types (8): LinkedParent, LinkedEpic, LinkedIssue, LinkedCommit in src/ipc/descriptionDomain.ts:56-75 and src/ipc/index.ts:81-84; exit 1. These are Contract types that only the page slice will import, so they are kept (see deviations)."
    },
    {
      "command": "just app-session start-fixture --name mls --diff --mr list --open-mr --size 1600x1000; read innerText",
      "observed": "The page shows \"Merge requests … 40 of 40 merge requests\" with rows !640 Snooze a reminder, !639 … The screenshot /tmp/mls-page.png shows the page unchanged (no links button)."
    },
    {
      "command": "app-session read (console hook installed) → click Refresh → hover button.truncate nth 0..2 → read window.__seen",
      "observed": "Captured only info lines (mergeRequests.fixture_discussions / discussions_read ×3). Filtering out discussions leaves []: no fixture_links line, no warn, no error, no uncaught error or rejection. Then `stop --name mls` reported stopped and the folder removed."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 11 files, 1148 mutants, score 96.68%: 1046 killed, 1 timeout, 29 survived (2 on changed lines), 7 no coverage",
    "survivors": [
      "frontend/src/ui/mergeRequestLinks.ts:99 `generation += 1` → `-= 1` — equivalent: answers only compare their saved generation for equality, and any change to it drops them",
      "frontend/src/ui/mergeRequestLinks.ts:120 `load.value === undefined` → `!==` — equivalent: the watch fires when the boolean changes, and both polarities change at the same moments (same shape as useRowDiscussions)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The links types and `toLinksReply` live in `ipc/descriptionDomain.ts`, not `mergeRequestDomain.ts`. mergeRequestDomain.ts is at 258 lines and would pass the 300-line cap; the Goal grants descriptionDomain.ts. Their test is in descriptionDomain.test.ts, not mergeRequestDomain.test.ts. index.ts re-exports the types from there.",
    "Pages are branded with `isLinkedPage` (http or https), as the Goal requires and as Rust mints them (`WebPage::linked` in links/lookup.rs:174), not with `toWebPage` (https only) as the Contract doc comment says. So the test is named every_links_page_is_branded_and_a_non_http_one_fails. The shared guard `toLinkedPage(text, field)` now also backs `toLink`; the existing error text is unchanged.",
    "!636's first answer uses `TIMED_OUT` (\"glab timed out\", fixtureGitLab.ts), the description fixture's deadline line, in place of the brief's literal \"glab: a deadline line\". One constant per fact.",
    "The `kind` field of `links_read` is \"thrown\" for every non-ok outcome, including a SourceFailure such as WorkerStopped. That is the brief's literal two values; the cause kind is not logged.",
    "fixtureMergeRequests.ts got more than the spread line: a new `fixtureProject(script)` function now answers findGitLabProject (inline 5 lines → 1), because the spread pushed `createFixtureMergeRequests` to 41 lines, over max-lines-per-function.",
    "Extra tests beyond the brief: an_ask_after_a_refresh_waits_for_the_call_in_flight, the_slice_holds_only_the_public_part_of_the_link_queue, a_links_refusal_passes_unchanged, the_logged_out_row_is_refused_every_time, and `row !%i reads three empty groups`.",
    "knip (`pnpm unused`) flags LinkedParent, LinkedEpic, LinkedIssue and LinkedCommit (exported and re-exported). They are kept as the Contract requires; the page slice will import them. `just check` fails until then.",
    "Only ui/mergeRequests.test.ts hand-builds a MergeRequestSource, and it gained `readLinks`. No other test file needed it.",
    "For the docs keeper: architecture §4 `MergeRequestSource.readLinks`, §5.1 'merge requests: each row's links' (`ui/mergeRequestLinks.ts`, written only by its queue, cleared by `dropped()`), §5.4 step `links`. tree.md: `ipc/fixtureMergeRequestLinks.ts`, `ui/mergeRequestLinks.ts`. Note that the links types sit in descriptionDomain.ts."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/descriptionDomain.ts:56-189",
      "risk": "The file now holds two concepts, the description tree and its links lookup (TS11). A reviewer may ask for an own `linksDomain.ts`, but that file is not in Owned."
    },
    {
      "location": "frontend/src/ui/mergeRequestLinks.ts:66-84",
      "risk": "After dropped(), a new ask waits for the old generation's call to settle (up to glab's 20 s deadline) before it is sent. This keeps one call in flight (RK70) but can delay a fresh hover."
    },
    {
      "location": "frontend/src/ipc/index.ts:81-84",
      "risk": "`pnpm unused` (part of `just check`) fails on the four Linked* types until mr-links-page imports them."
    }
  ]
}
