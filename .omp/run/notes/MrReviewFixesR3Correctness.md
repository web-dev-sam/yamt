# MrReviewFixesR3Correctness

Agent output (`agent://MrReviewFixesR3Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesR3Correctness.md), collected 2026-11-05T00:41:23.148Z.

{
  "verdict": "pass",
  "checked": [
    "#2478 fixed: when boxed turns false while open, Discussions.vue:126 runs close(); then watch(open), boxClosedHere, discussionsBoxClosed end the hold. shownId is null, so closeThread doesn't run. WebKit run + control accepted.",
    "pointerInside risk, no hidden box: close() sets open false, and show() reopens whenever open is false and the opener exists. Stale flags can only stop a box closing, never stop it opening.",
    "pointerInside risk, real but narrow: after a mouse close, pointerInside may stay true [INFERENCE]. If the row's count rises again and it is opened and left by keyboard only, the box stays open and the row held until the pointer crosses it.",
    "Not an R3 regression: before R3 the same removal left the flags stale and open true. It is in useHoverBox.ts, outside this round, so RV8 leaves it out. Log for useHoverBox: reset both flags when the area is removed.",
    "#2477 test at Box.test.ts:362 would fail with the old thread.value read: keptInPlace returns a new array on every rerun, so toBe(before) fails. panelRow is a computed of an iid only.",
    "Survivors (3/3 listed): :92 if(true) is VF7 equivalent, since held.has(row.iid) never matches null. The two :62 mutants are unchanged since R1 and outside this round."
  ],
  "findings": []
}
