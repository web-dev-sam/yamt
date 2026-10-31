# LineRangesEditorBoundary

Agent output (`agent://LineRangesEditorBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesEditorBoundary.md), collected 2026-10-31T12:33:18.709Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: only frontend/src/editor/** changed (foldRuns.ts in Owned). RangeEvents, NumberPress, ThreadHosts({views,columns,hovered}), showTint/threadTint match the Contract.",
    "Edges: diffOrder, threadTint, threadDrag and columnFolds import only internal siblings and ipc. No cycle, no vue/@tauri/ui (PM2/3/5). threadDrag does not copy IconDrag (drag.ts:51-116).",
    "#148: strip-midpoint column, other-column fallback (textLineAt + pressedLine), Escape preventDefault+stopPropagation in capture, no auto-scroll. Only the menus have window-capture keydown.",
    "#126/#145: columnChanges keeps drafts, merges overlapping/touching runs, never joins across a difference (columnFolds.ts:69-100); runs still renewed only at open and on toggle.",
    "Accepted deviations: pointedLine unexported (TS16), ThreadDrag reads hiddenLeft, ColumnChange unbranded LineSpan, stale hover dropped (range.ts:207), RowPlace rename, constructor split.",
    "AGENTS.md :19/:21 updated. tree.md:176-178 and state.md lack the new files and the tint/drag/hover state: the docs keeper's job (orchestrate §6)."
  ],
  "findings": [
    {
      "file": "frontend/src/editor/theme.css",
      "line": 503,
      "severity": "block",
      "rule_id": "DR1",
      "problem": "In five themes --color-selection is opaque (webstorm-dark #214283, webstorm-light/light #a6d2ff, atom-dark #3e4451, atom-light #e5e5e6), so the background-image tint fully covers .chunk-band's background-color and tinted removed/added lines lose their colour. This contradicts plan #148 ('the tint is a layer over the difference colours').",
      "fix": "Paint a translucent layer whatever the theme, e.g. color-mix(in srgb, var(--color-selection) <N>%, transparent) in the gradient, or add a per-theme translucent --color-thread-tint; the orchestrator picks the alpha."
    },
    {
      "file": "frontend/src/editor/internal/diffOrder.ts",
      "line": 28,
      "severity": "block",
      "problem": "segments() makes a second walk over the differences that decides whether a line is inside a difference and what an unchanged line's partner is (lineIn, placeSpans, unchangedRuns). threadAnchor.ts linePlace already owns that rule, which AGENTS.md:19 calls 'the one rule … to its partner line'. A change to the partner rule now has to be made twice.",
      "fix": "Keep one walk: give each Segment its Difference and rebuild linePlace/anchorAt on diffOrder's segments (or the reverse), so the partner and inside-a-difference rules exist in one function."
    },
    {
      "file": "frontend/src/editor/range.ts",
      "line": 72,
      "severity": "should",
      "rule_id": "principles §2",
      "problem": "#tinted copies each column's tintField so that #tint can skip a dispatch. If anything else ever dispatches showTint, the copy goes stale and the controller skips a needed dispatch: two sources of truth for one fact.",
      "fix": "Export a reader (e.g. tintOf(state) from threadTint.ts) and compare against views[column].state, then delete #tinted."
    },
    {
      "file": "frontend/src/editor/AGENTS.md",
      "line": 19,
      "severity": "should",
      "problem": "The doc says the pointer's column is 'the one whose half of the window it is in', but pointedLine splits at the midpoint between the two columns (the strip's half, plan #148). With resized columns that is not the window's half, so a reader following the doc gets the rule wrong.",
      "fix": "Say: 'the column on the pointer's side of the strip's middle'."
    },
    {
      "file": "frontend/src/editor/internal/threadTint.ts",
      "line": 60,
      "severity": "nit",
      "problem": "mergedSpans repeats the overlap-or-touch union that columnFolds.ts:65-90 (end/joined/merged) applies per column. Nothing gets harder now; a third span-union user would find two copies to choose from.",
      "fix": "Move a joinSpans(a, b): LineSpan | null next to LineSpan in foldRuns.ts and build both merges on it."
    },
    {
      "file": "frontend/src/editor/internal/diffOrder.ts",
      "line": 163,
      "severity": "nit",
      "rule_id": "TS6",
      "problem": "placeSpans spells out Readonly<Record<Column, readonly LineSpan[]>>, the same shape threadTint.ts:14 names ColumnTint. Nothing gets harder beyond a second name to keep in sync.",
      "fix": "Declare the per-column span type once (diffOrder or foldRuns) and import it in threadTint.ts."
    }
  ]
}
