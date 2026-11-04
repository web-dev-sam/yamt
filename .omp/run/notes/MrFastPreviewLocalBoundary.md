# MrFastPreviewLocalBoundary

Agent output (`agent://MrFastPreviewLocalBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewLocalBoundary.md), collected 2026-11-04T21:53:43.688Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 8 touched files are in Owned. The fixture, ui/, ipc/ and docs/ are untouched. The tree.md row is left to the docs keeper (design §5, slice 4).",
    "One owner: no trigger regex, GITLAB_DRAWN_LANGUAGES or \"commonMark\" call outside localPreview.ts (grep of frontend/src and scripts). fencedLines and fence share one private fenceAt: one fence rule.",
    "Reuse: the new exports (FENCE, LINE_BREAK, indentOf, isBlank) are all used by localPreview. S13 reads FENCE as the contract says. S2 uses indentOf's tab-to-4. fence() output is unchanged.",
    "A4: markdownDom.ts:117 still calls parseInline(text) in the default \"yamt\" mode. yamtAbility repeats the old canOpen/canClose expressions. The existing markdown tests only gain appended tests.",
    "Fences: localPreview imports only ../../ipc types and editor/internal siblings, with no vue or tauri. editor/index.ts adds one export. markdownFence covers only MarkdownView.",
    "Deviations accepted: the fixture marks code_hides_refs, fence_hides_refs and table_after_paragraph local:true, so the exemption stays and S12 stays off. The test-only export and the knip open risk are accepted."
  ],
  "findings": [
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 64,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "NESTING_LIMIT = 15 is a second literal for a number that depends on markdownTree's MAX_NESTING = 16 (design §1.2 N). If MAX_NESTING is lowered, deep quotes and emphasis come out flattened by the subset but still pass localPreview, and no test notices because the test's NESTED = 15 is hard-coded too.",
      "fix": "Write `const NESTING_LIMIT = MAX_NESTING - 1` (import it from ./markdownTree), and in localPreview.test.ts use `NESTED = MAX_NESTING - 1` as markdownBlocks.test.ts already does."
    },
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 78,
      "severity": "should",
      "rule_id": "TS17",
      "problem": "LINE_TRIGGERS (S3, S4, S6, S8, S9, S14, S15) and TEXT_TRIGGERS (T1–T6, line 67) are unnamed regex arrays. To match a failing test like 'S14 quick action' or an owner's 'drop S8' to its regex, a reader has to count array entries, and this gets harder as the corpus adds rules.",
      "fix": "Turn both into `Readonly<Record<…, RegExp>>` literals keyed by the rule (e.g. `{ parenItem, plusItem, longQuote, descriptionList, tabOrNul, quickAction, emptyItem }`) and iterate `Object.values`."
    },
    {
      "file": "frontend/src/editor/internal/localPreview.ts",
      "line": 194,
      "severity": "should",
      "problem": "`tableOf(Table) → DescriptionBlock` has the same name as markdownTable.ts's exported `tableOf(lines) → Table`, but converts in the opposite direction. `blocksOf` likewise clashes with markdownBlocks.ts:294's `blocksOf(lines)`. Grepping either name in editor/internal/ finds two unrelated meanings.",
      "fix": "Use names that say the output is GitLab's blocks, after the Rust reducer `described`: describedTable, describedRow, describedList, describedBlock(s), describedInline(s)."
    },
    {
      "file": "frontend/src/editor/internal/markdownInline.ts",
      "line": 146,
      "severity": "nit",
      "problem": "`codePointAt` returns a one-character string, while `String.prototype.codePointAt` returns a number. A reader who knows the built-in will misread `neighbour(codePointAt(...))`; nothing gets harder as the code grows.",
      "fix": "Rename the pair to charBefore and charAfter (or codePointStringAt)."
    }
  ]
}
