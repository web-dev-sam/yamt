# MrRowTwoLinesCorrectness

Agent output (`agent://MrRowTwoLinesCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowTwoLinesCorrectness.md), collected 2026-10-31T08:47:31.225Z.

{
  "verdict": "fail",
  "checked": [
    "No dangling separator: the size's `·` sits with the size in `<template v-if=\"size !== null\">` (Row.vue:111-114); smoke shows !27 ends with the age. Titles unchanged: createdTitle, size.title, pageTitle = aria-label.",
    "Rules of 324e6109 intact: li keeps cursor-pointer + not-has-[[data-row-control]:hover]; data-row-control/@click.stop on CI box, action, Show Diff; button keeps cursor-pointer and @click.stop. Line 2 clicks bubble to openPage.",
    "Title hit area: self-start + max-w-full keeps the button at the title's own width and one line high, capped at the column (no stretch). Truncation: truncate on button and line 2 (smoke w86/sw128).",
    "Refusal/reply lines unchanged (li children, same classes); right columns keep w-12/w-7 + items-center (smoke colSets one value); text-xs is existing secondary size (OperationLabel, AiStep, SearchResults).",
    "Mutation: .vue only, no survivors, which the brief allows. Deviations accepted: narrowing via the <ul>, self-start. The separator open risk is not accepted (see finding).",
    "Compiled the template with @vue/compiler-sfc (node, no test run): the meta line's spans have no whitespace between them (condense mode; no override in vite.config.ts)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestRow.vue",
      "line": 109,
      "severity": "block",
      "problem": "Separators are aria-hidden `·` spans with mx-1 and no whitespace between spans. Copied text is '!32·created 1 day ago·+75 −12 · 5 files'. [INFERENCE] a screen reader gets '!32created 1 day ago+75…'. The gaps differ from sizeText's ' · ' on the same line, and the spans add a second separator convention next to the app's plain ' · '.",
      "fix": "Render each separator as plain text with spaces, as summaryLabel and operationText do, e.g. `{{ \" · \" }}` between the spans (no mx-1, no aria-hidden).",
      "rule_id": "principles-2"
    }
  ]
}
