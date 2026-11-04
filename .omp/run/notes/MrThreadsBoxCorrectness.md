# MrThreadsBoxCorrectness

Agent output (`agent://MrThreadsBoxCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxCorrectness.md), collected 2026-11-04T16:30:07.741Z.

{
  "verdict": "fail",
  "checked": [
    "turnOf traced by hand vs B1–B3: B2's union matches the brief; B3.1 skips self-mentions; null writer handled. B6/no-viewer via isPerson. Each b*/b6 test fails without its rule; b5 [2,4,3,1] needs row.author.",
    "useHoverBox pinned: hideUnlessHeld covers pointer/focus/blur leaving; scroll guard; capture pointerdown only while open&&pinned (listen spy). Risk 3 accepted: window refocus fires focusin again [INFERENCE].",
    "SSR test checks 13 rows with words and order, '4 of 13', d02 aria-current+muted+check, '4 of 12', 13→12 after boxClosed, the spin, and a failed reload keeping its rows. Each assertion fails with its feature removed.",
    "C10 13→11 accepted: the fixture list count stays 13 while the store keeps d02 resolved, and boxClosed sets the count to the rest (mergeRequestDiscussionRows.ts:103). WebKit proves the watch(open)→boxClosed wire.",
    "Risk 2 accepted: a 768px panel cannot top-align with a box at 324 in a 1000px window; useBesidePlacement clamps it on screen. Risk 4 belongs to the unmount finding (Settings is its own screen, so the page unmounts).",
    "Survivors: discussions.ts:58 and useHoverBox.ts:131 are rightly (a). Constant/NO_TURNS (b) ok: tests assert each value. Exhaustive defaults unreachable. No test run: no block depends on one."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestReplyField.vue",
      "line": 208,
      "severity": "block",
      "rule_id": "RK73",
      "problem": "Pressing 'Resolve thread' (or Add comment/Add review) disables the pressed button. WebKit then moves focus to BODY with no focusout (seen in the box smoke), so the next Escape reaches the page and leaves the merge-request screen instead of closing the panel (C2 'Escape closes the panel first').",
      "fix": "Move focus to the field (the panel while Preview shows) before the pressed button disables, and add a verify step: Resolve, then Escape → the panel closes and focus is on its row."
    },
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 104,
      "severity": "block",
      "rule_id": "C11",
      "problem": "Only watch(open)→false closes the thread. If the page unmounts with the panel shown (Tab to Back + Enter, or Escape from BODY), `thread` stays set: mergeRequests.ts show/close never clear it. On return the row is boxed even with 'Off' (C11), hovering shows the panel without Shift, a refresh reads it again, and marked rows never leave (C10).",
      "fix": "Add onBeforeUnmount: if open, closeThread() when shownId !== null, then boxClosed(row.iid), as MergeRequestPeople.vue:120 does; add a verify step: panel open, Tab to Back + Enter, set Off, return → no box."
    },
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 55,
      "severity": "block",
      "rule_id": "RK73",
      "problem": "Traced by reading: with row A's panel pinned, hovering row B's count opens B's box. Shift over a B row shows B's thread and unmounts A's panel while it holds focus, with no focusout (useHoverBox.ts keepFocus comment). A's box stays open, unpinned, focusInside true, beside B's. Only a scroll outside closes it, and its marks stay.",
      "fix": "Watch shownId: when it turns null while open and `thread` now belongs to another iid (not via threadClosed), call the hover box's close() so focusInside resets and watch(open) runs closeThread/boxClosed."
    },
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 99,
      "severity": "should",
      "rule_id": "RK73",
      "problem": "The only evidence for the isTypingTarget guard is brief/verify step C1 'Shift+a in the field types A, no fixture_thread'. That step passes with the guard deleted, because useShiftTaps already drops a chord. So RK73's 'a Shift typed in the field switches the thread' is unproven. Growth: the register's proving column names a check that does not prove the risk.",
      "fix": "Change verify step 3 to a lone Shift tap with focus in the field and the pointer on another row: no new fixture_thread, and the panel keeps its discussion."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
      "line": 93,
      "severity": "should",
      "problem": "Under B5, each fixture row's lone comment is never the reviewer's turn. The three re-pinned orders (fixtureMergeRequestDiscussions.test.ts:255-264) keep !622 first. So the fixture no longer shows review mode's due-with-your-turn-first, soonest-first or equal-day tie (mr-review-mode-design.md:203-208), and a regression in `first` passes the test. Growth: review-mode smokes can't show the order.",
      "fix": "Give the due rows' fixture discussions (!618, !633, !623 for sam; !602 for anna) an earlier comment or a mention by the reviewer so the design table's orders return, then restore that test's expectations."
    },
    {
      "file": ".omp/run/mutants/MrThreadsBox.survivors.txt",
      "line": 6,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Three kept survivors give no VF7 reason: reviewOrder.ts:88, 92 and useHoverBox.ts:133 are kept as 'not changed/only moved', which (a)/(b)/(c) does not allow. They are in fact equivalent: viewerPossessive only checks at === 'start', and show() writes `at` before open turns true. Growth: none in code, but accepting 'only moved' lets real gaps on moved lines through.",
      "fix": "Restate the three as (a) equivalent, each with the reason above."
    }
  ]
}
