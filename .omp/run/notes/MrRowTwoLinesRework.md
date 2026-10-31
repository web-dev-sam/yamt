# MrRowTwoLinesRework

Agent output (`agent://MrRowTwoLinesRework`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowTwoLinesRework.md), collected 2026-10-31T08:50:31.969Z.

{
  "summary": "Each separator on a merge-request row's details line is now plain text, `{{ \" · \" }}`. There are no aria-hidden `mx-1` spans any more. The tags meet with no whitespace between them (oxfmt keeps the `</span\\n>` form), so Vue's condense mode adds no extra space and drops none. In WebKit, copying the line gives `!32 · created 1 day ago · +75 −12 · 5 files`. A row without a size ends after the age.",
  "files_changed": [
    "frontend/src/ui/MergeRequestRow.vue"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend run fmt:check; run lint; run typecheck; test",
      "observed": "All matched files use the correct format (686 files); oxlint --type-aware && eslint --max-warnings 0 printed no findings; vue-tsc -b printed no errors; Test Files 244 passed (244), Tests 3411 passed (3411)"
    },
    {
      "command": "scripts/mr-conflict-repo.sh /tmp/mrrow-rework; cargo tauri build --debug --no-bundle; just app-session start-app --name mrrow --diff --dir /tmp/mrrow-rework --glab mr-conflicts; click 'Merge requests'; read textContent of p.text-xs",
      "observed": "\"!32 · created 1 day ago · +75 −12 · 5 files\" … \"!27 · created 3 days ago\" (all 11 rows: single spaces around every ·, none dangling)"
    },
    {
      "command": "just app-session shot --name mrrow /tmp/mrrow-rework-list.png",
      "observed": "List of 11 rows. Line 2 reads e.g. '!32 · created 1 day ago · +75 −12 · 5 files'; every gap looks the same width; '!27 · created 3 days ago' has no trailing separator."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'no Rust changes since HEAD', 'no TypeScript changes since HEAD' (.vue is not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The separators touch the tags with no whitespace between them (`</span\\n>{{ \" · \" }}<span`) instead of sitting on lines of their own. Condense mode would turn line breaks there into extra spaces, or drop them before `<template>`."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:108-112",
      "risk": "No unit test pins the details text. It was checked only in WebKit. Reformatting the tags back onto separate lines would bring the double or missing spaces back without any test failing."
    }
  ]
}
