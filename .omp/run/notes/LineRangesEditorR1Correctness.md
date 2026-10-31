# LineRangesEditorR1Correctness

Agent output (`agent://LineRangesEditorR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesEditorR1Correctness.md), collected 2026-10-31T12:56:51.726Z.

{
  "verdict": "pass",
  "checked": [
    "#2073: theme.css:503 tint is color-mix 45% over the band. Pixel test (light, webstorm-dark) needs tinted removed/added ≠ tinted unchanged; old opaque rule gave equal pixels.",
    "#2074: #stop clears the frame and 6 listeners; destroy calls #drag.destroy. Escape tests after release and mid-drag destroy fail on a leaked keydown capture. Leaked move/up/blur are no-ops.",
    "#2075: scroll/move queue one rAF. CM onScroll measures synchronously (view dist:7236-7241), so the comment holds. Test: 0 sync dispatches, then end 18. Release recompute proven: heldDrag+release in one task gives ACROSS.",
    "threadAnchor unchanged (checked by hand): last segment with seg[col] ≤ line = old loop, incl. pure insertions/removals, adjacent diffs, negative lines. New test kills the filter mutant (right 0/5). No import cycle.",
    "#2076: kept survivors meet VF7(a) (diffOrder :32 :102/105/115 :160-162, threadTint :28 :91, each reason checked). stryker-r1c: 0 left in threadNumbers/threadRows/threadAnchor.",
    "The other 10 r1c survivors (columnFolds 149-181, foldRuns:56) are on lines from commits before this feature. The #tinted copy is gone (reads tintOf); joinSpans has 2 users. No test run."
  ],
  "findings": []
}
