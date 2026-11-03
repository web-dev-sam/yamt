# MrDiscussionsStateR1

Agent output (`agent://MrDiscussionsStateR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsStateR1.md), collected 2026-11-03T15:29:32.459Z.

{
  "summary": "The four findings are fixed. Under \"lazy\", rows that a call sent before the switch are kept only until that call settles. Rows its answer leaves out lose their entry and leave the queue, and hovering asks again. A row hovered while that call runs stays asked. A failed first load now drops the discussion details and the queue along with the rows. The slice gets only `discussions`, `discussionDetails` and `askDiscussions` through `discussionsOf(queue)`. The State field is renamed `discussionQueue`.",
  "files_changed": [
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestDiscussions.test.ts: switching_to_lazy_drops_unsent_asks_and_keeps_what_was_read (changed at the old :291)",
      "proves": "#2212: a prefix answer to the call made before lazy makes no further call. Its unanswered rows have no entry, and hovering one asks for it alone."
    },
    {
      "name": "mergeRequestDiscussions.test.ts: a_row_hovered_while_the_call_before_lazy_runs_stays_asked",
      "proves": "A row hovered while the call made before lazy runs stays loading and is sent again. Unhovered unanswered rows are dropped."
    },
    {
      "name": "mergeRequestDiscussions.test.ts: a_failed_call_before_lazy_drops_its_unhovered_rows",
      "proves": "If the call made before lazy fails, only the hovered row keeps a 'failed' entry. The others go, and a later hover asks again."
    },
    {
      "name": "mergeRequestDiscussions.test.ts: switching_back_to_full_before_the_call_settles_keeps_its_unanswered_rows_asked",
      "proves": "Switching lazy→full while the call runs puts its rows back: the unanswered rest is sent again."
    },
    {
      "name": "mergeRequests.test.ts: a_failed_first_load_drops_the_details_so_the_next_load_asks_its_rows_again",
      "proves": "#2213: after a page and a details failure, a failed first load leaves no entries. The next show asks for the open rows again, and they are loading."
    },
    {
      "name": "mergeRequests.test.ts: the_slice_holds_only_the_public_part_of_the_discussion_queue",
      "proves": "#2208: the slice has no `listed` or `replaced`, and askDiscussions through the slice still asks under \"lazy\"."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check; lint; typecheck; unused",
      "observed": "All matched files use the correct format. / `oxlint --type-aware && eslint …`, `vue-tsc -b` and `knip --include exports,types` printed no findings and exited 0"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  271 passed (271) / Tests  4066 passed (4066)"
    },
    {
      "command": "#2213 fails before: removed `state.discussionQueue.replaced([])` for one run, then `vitest run mergeRequests.test -t a_failed_first_load_drops`",
      "observed": "× a_failed_first_load_drops_the_details_so_the_next_load_asks_its_rows_again — AssertionError: expected 13 to be +0. Passes with the line put back."
    },
    {
      "command": "#2212 fails before: removed `queue.unhovered = sent` for one run, then `vitest run mergeRequestDiscussions`",
      "observed": "× switching_to_lazy_drops_unsent_asks_and_keeps_what_was_read, × a_row_hovered_while_the_call_before_lazy_runs_stays_asked, × a_failed_call_before_lazy_drops_its_unhovered_rows; Tests 3 failed | 18 passed. With the line put back: 156 passed."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 97.58% overall (322 killed, 6 survived, 2 no coverage); mergeRequestDiscussions.ts 96.62%, mergeRequests.ts 98.35%",
    "survivors": [
      "mergeRequestDiscussions.ts:88 `: []`→[\"Stryker was here\"] in answered — equivalent: no iid equals that string",
      "mergeRequests.ts:173 `replaced([])`→`replaced([\"Stryker was here\"])` — equivalent: listed() finds no openDiscussions > 0 on a string, so nothing is queued",
      "mergeRequestDiscussions.ts:145 `: []`→[\"Stryker was here\"] (function renamed, line otherwise unchanged) — equivalent: no iid equals that string",
      "mergeRequestDiscussions.ts:137 `generation += 1`→`-= 1` (unchanged line) — equivalent: any change of generation drops the old answer",
      "mergeRequestDiscussions.ts:167 exhaustive default, no coverage — equivalent: unreachable by the DiscussionDetails type (TS3)",
      "mergeRequests.ts:183 and :235 — not on changed lines (stale check, search default), as before this round"
    ]
  },
  "acceptance_not_run": [
    "#2209 is a rename only: no behaviour changes, so no test can fail before it. The rename passes typecheck.",
    "I did not run the #2208 test against the old code. [INFERENCE] It fails there, because `...state.discussions` spread `listed` and `replaced` onto the slice."
  ],
  "deviations_from_brief": [
    "`discussionsOf` takes the queue (`discussionsOf(queue: DiscussionQueue): Discussions`) and lives in mergeRequestDiscussions.ts, not in mergeRequests.ts as `discussionsOf(state)`. mergeRequests.ts was at 299 of its 300-line cap and would have gone over. Its askDiscussions is a wrapper, so no method is detached.",
    "To stay under the cap, createState now builds the queue inline (`discussionQueue: createDiscussions({ ...deps, mode, rows: () => rows.value })`) instead of in a local `const`. mergeRequests.ts is 300 lines.",
    "#2212: Queue gets `unhovered: Set<MergeRequestIid>`, the running call's iids at the switch to lazy. A hover takes one out; full, off and settle empty it. At settle, an unhovered iid missing from the answer loses its entry. On a failure that is all of them: dropped, not marked failed. `unsentDropped` is renamed `becameLazy`.",
    "Docs keeper, ui/AGENTS.md / state.md: the queue also owns `unhovered` (its only writer). Under lazy, a call made before the switch keeps only the rows hovered since, plus what it answers. A failed first load calls `replaced([])`. The slice exposes the queue through `discussionsOf`."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestDiscussions.ts:84-94 settle()",
      "risk": "A source failure under \"full\" still marks every queued iid 'failed', including the ones Rust would never have read past its 20-row limit (unchanged from round 1, outside these findings). Only under lazy are unhovered rows dropped instead."
    }
  ]
}
