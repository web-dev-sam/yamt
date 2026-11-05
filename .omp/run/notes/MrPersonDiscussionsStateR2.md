# MrPersonDiscussionsStateR2

Agent output (`agent://MrPersonDiscussionsStateR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsStateR2.md), collected 2026-11-05T15:11:13.082Z.

{
  "summary": "A Reload of the person view (and a list refresh) no longer re-sorts everything: held becomes the expanded set and the order counter is left alone, so `keptInPlace` keeps each expanded entry at its index in the order last shown while collapsed entries re-sort by C2. Cause of p6 jumping ahead of p1: the old refresh re-sorted from scratch while p3 was still listed. p3 had sam's comment, so it rose to \"wrote\" and pushed p1 to 40, and p1 was then held at 40. A new test replays the `?mr=list` sequence. The viewLeft/wantRows doc comments are reworded (#2521).",
  "files_changed": [
    "frontend/src/ui/mergeRequestPersonView.ts",
    "frontend/src/ui/mergeRequestPersonView.test.ts",
    "frontend/src/ui/mergeRequestDiscussions.ts"
  ],
  "tests_added": [
    {
      "name": "a_reload_keeps_the_expanded_entry_at_its_index_and_re_sorts_the_collapsed_ones",
      "proves": "?mr=list, Me: expand p1 and p3, comment on p3, resolve, collapse p3, Reload. p1 stays at 39; 38..41 = 637:13, p1, p6, p7; the order equals MES_ORDER without p3. With the old refresh p1 lands at 40."
    },
    {
      "name": "a_closed_view_neither_refreshes_nor_expands (extended)",
      "proves": "Closed view: a 2nd list refresh, Reload, pick and expand leave personView null and ask/read nothing. Kills the `if (true)` mutants in `reheld` and `pickPerson`."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run src/ui/mergeRequestPersonView.test.ts (old refresh restored for a moment: picked(...) in place of reheld)",
      "observed": "× a_reload_keeps_the_expanded_entry_at_its_index_and_re_sorts_the_collapsed_ones — Expected 39, Received 40 at `expect(indexOf(P1)).toBe(39)`. This is the verifier's #2523/#2527 p1idx=40."
    },
    {
      "command": "pnpm -C frontend exec vitest run src/ui/mergeRequestPersonView.test.ts (fixed)",
      "observed": "Tests  22 passed (22)"
    },
    {
      "command": "pnpm -C frontend fmt:check && typecheck && lint && test && unused",
      "observed": "All matched files use the correct format; vue-tsc -b clean; oxlint+eslint no errors; Test Files 310 passed (310), Tests 4652 passed (4652); knip clean"
    },
    {
      "command": "debug replay over ?mr=list, reading the order after each 200 ms step (test since removed)",
      "observed": "Without p3's comment, the old code also kept p1 at 39. The bug needs p3 to change group (sam's comment, which is what the verifier sent in B9). The verifier confirmed nothing was sent on p1 or p6."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 98.85% score: 257 killed, 1 survived, 2 no coverage (mergeRequestDiscussions.ts 66/0/2, mergeRequestPersonView.ts 191/1/0)",
    "survivors": [
      "frontend/src/ui/mergeRequestPersonView.ts:282 `orders += 1` → `-= 1` — equivalent: `order` is only compared for equality and every value is still distinct. The line is unchanged by this round.",
      "frontend/src/ui/mergeRequestDiscussions.ts:76 NoCoverage on the exhaustive `default: never` arm — equivalent: types make it unreachable. Unchanged line; this round only touched doc comments in this file."
    ]
  },
  "acceptance_not_run": [
    "I did not repeat the WebKit B10 replay (`?mr=list` in app-session). The unit test drives the same slice and fixture through the verifier's exact steps and fails on the old code exactly as they saw (p1 at 40). The verifier's B10 re-run is the WebKit check."
  ],
  "deviations_from_brief": [
    "`rowsReplaced` (a list refresh) now follows the same C3 rule as the view's Reload: held becomes the expanded set, with no fresh sort. C3 says \"the view is refreshed\", and that thread must not move either.",
    "The `pickPerson` helper (`resorted`) is now inlined in `pickPerson`, because the file went over the 300-line cap. A pick still re-sorts everything (B2).",
    "Docs outside Owned still say `order` rises on refresh/rowsReplaced: docs/slices/briefs/mr-person-discussions-state.md:111,126,138-141 and mr-person-discussions-design.md:272-274. The docs keeper should change them to: refresh and rowsReplaced set held = expanded with no new order; only open and pick raise `order`."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestPersonView.ts:200-206 (reheld) via rowsReplaced",
      "risk": "A list refresh drops every entry first (`replaced`), so an expanded entry leaves the order and comes back when its row reads. It is then held at its index in a list only partly loaded, and rows that load later and sort above it do not move it. The old code behaved the same."
    },
    {
      "location": "frontend/src/ui/mergeRequestPersonView.ts:233-245 (refresh)",
      "risk": "When the Reload is pressed, a collapsed entry that was resolved here re-sorts at once (p3 can jump to \"wrote\"). It disappears only when its row's answer lands, so it shows briefly at its new place."
    }
  ]
}
