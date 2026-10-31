# LineRangesEditorCorrectness

Agent output (`agent://LineRangesEditorCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesEditorCorrectness.md), collected 2026-10-31T12:36:14.089Z.

{
  "verdict": "fail",
  "checked": [
    "diffOrder formulas traced by hand against the brief (unchanged l+Σright.len, removed, added) and the board.ts values 201/203/204/205; placeBetween same index = onePlace(press); shownEnd clamps both ways; hand mutations M1–M4 accepted",
    "Drag: gutter returns true (CM preventDefault, node_modules cited); capture listeners removed with matching options; Escape preventDefault+stopPropagation; scroll recomputes; a null pointedLine keeps the end",
    "Browser tests fail if their feature goes: no scroll listener, so no recompute; no shownEnd, so the wave test ends on hidden right 26; no hover, so no tint; no Escape cancel, so a start. Tint expectations re-derived",
    "RK51: unchangedRuns+merged+byStarts ties pinned by the columnFolds tests; hiddenLeft len = end − first is right (Hidden.to = line(end).to)",
    "Rows and badges by place.end (tests); tint = drag+drafts+hover, stale hover dropped in showThreads; spans 0-based → doc.line(start+i+1), clipped at the end; selection mark stays over the tint (CM3)",
    "Stryker logs /tmp/le-pw/stryker1.txt and stryker2.txt read against the survivors file; tint colours read in every themes/*.css; no test file run"
  ],
  "findings": [
    {
      "file": "frontend/src/editor/theme.css",
      "line": 503,
      "severity": "block",
      "rule_id": "plan#148",
      "problem": "The tint paints var(--color-selection) as a background-image over chunk-band's background-color. light, webstorm-light/dark and atom-dark/light use an opaque selection colour (vscode-dark #276782dd), so a tinted removed or added line loses its difference colour there. That breaks #148's 'a layer over the difference colours'.",
      "fix": "Paint a translucent layer whatever the theme's alpha, e.g. linear-gradient(color-mix(in srgb, var(--color-selection) 40%, transparent) …) on both rules, and check a tinted removed/added line in light and webstorm-dark."
    },
    {
      "file": "frontend/src/editor/internal/threadDrag.ts",
      "line": 102,
      "severity": "block",
      "rule_id": "RK50",
      "problem": "No test proves #stop removes the listeners at release or destroy; Escape mid-drag only shows pointerup goes after a cancel. A keydown capture listener left behind would preventDefault+stopPropagation every later Escape, which the thread box's cancel (rangeKeys boxKeydown) and the menus need.",
      "fix": "In rangeThreads.browser.test.ts, after a completed drag and after controller.destroy() mid-drag, dispatch Escape on document.body and assert defaultPrevented is false; also assert that a further pointermove/pointerup starts nothing."
    },
    {
      "file": "frontend/src/editor/internal/threadDrag.ts",
      "line": 118,
      "severity": "should",
      "rule_id": "CM13",
      "problem": "#follow runs synchronously in both scrollers' scroll handlers. It reads layout (getBoundingClientRect, documentTop) and uses elementAtHeight before CodeMirror re-measures, so after a big wheel jump the end can come from estimated heights until the next pointermove. Later scroll features would copy this.",
      "fix": "Recompute through view.requestMeasure({ read }) (or one requestAnimationFrame shared by both columns) so the end is read after CodeMirror's measure, once per frame."
    },
    {
      "file": ".omp/run/mutants/LineRangesEditor.survivors.txt",
      "line": 8,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "'On lines this patch did not change' is not a VF7 (a)/(b)/(c) reason. It covers threadNumbers.ts:49 find(()=>true), so a badge press could toggle another line's threads with no test noticing, plus :32 and threadRows.ts:39. columnFolds.ts:62 is stale (killed in run 2). The :61-62 filter is equivalent, but its reason is false for the right column.",
      "fix": "Kill threadNumbers.ts:49 with a numberPress test that has two counted lines and a badge press on the second, drop the stale :62 entry, and restate :61-62 as 'right lookups come only for added lines'."
    }
  ]
}
