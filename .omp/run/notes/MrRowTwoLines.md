# MrRowTwoLines

Agent output (`agent://MrRowTwoLines`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowTwoLines.md), collected 2026-10-31T08:45:22.530Z.

{
  "summary": "A merge-request row is now two lines, like GitLab's list. Line 1 is the title alone (button or span, truncated, same hover title and accessible name). Line 2, under it at the same left edge in every row, is `!iid · created … · size`, muted and in `text-xs`. Its `·` separators are aria-hidden, there is no separator when the row has no size, and it truncates instead of wrapping. The fixed-width icon columns stay put and are centred against the two lines. The row's paragraph in ui/AGENTS.md says this.",
  "files_changed": [
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt && lint && typecheck && sfc-order && test",
      "observed": "oxfmt: 686 files, fmt:check 'All matched files use the correct format.'; lint exit 0; vue-tsc -b clean; sfc-order clean; vitest 'Test Files 244 passed (244) Tests 3411 passed (3411)'"
    },
    {
      "command": "scripts/mr-conflict-repo.sh /tmp/mrrow-repo; cargo tauri build --debug --no-bundle; just app-session start-app --name mrrow --diff --dir /tmp/mrrow-repo --glab mr-conflicts --size 1400x700; click 'Merge requests'; shot /tmp/mrrow-list.png",
      "observed": "Screenshot (WebKit, private display :3, dark theme): 11 rows. Each shows its title, then a muted smaller line under it, e.g. 'Board themes' over '!32 · created 1 day ago · +75 −12 · 5 files'. The icon columns line up vertically across all rows."
    },
    {
      "command": "app-session read: per row, the left of the !iid span, of the title and of each icon column, plus font sizes",
      "observed": "{\"rows\":11,\"iidLefts\":[262],\"titleLefts\":[262],\"colSets\":[\"1115,1175,1235,1275,1315,1355\"],\"titleFont\":\"13px\",\"line2Font\":\"12px\"}: one value each across all 11 rows."
    },
    {
      "command": "app-session read: last span of each row's second line",
      "observed": "The row without a size, !27, ends with 'created 3 days ago' (its line2 textContent is '!27·created 3 days ago'). Every other row ends with its size, e.g. '+75 −12 · 5 files'."
    },
    {
      "command": "app-session read: vertical centring, hover titles and truncation of row 1",
      "observed": "textMid 155.24 vs iconMid 155.23; btnTitle = aria-label 'Open !32 on GitLab: Board themes'; ageTitle 'Oct 29, 2026, 5:00 PM'; sizeTitle '75 lines added, 12 removed in 5 files'; line2 white-space 'nowrap', text-overflow 'ellipsis'"
    },
    {
      "command": "app-session read: set the list <ul> width to 390px, list the titles with scrollWidth > clientWidth; shot /tmp/mrrow-narrow.png",
      "observed": "Truncated titles: 'Draft: Calendar view' w86/sw128, 'Reminder sounds' w86/sw109, … The screenshot shows 'Board them…', 'Draft: Calen…' over '!32 · created…', and the icon columns are still aligned. At 470px only line 2 truncated ('!32 · created 1 day ago · +…')."
    },
    {
      "command": "app-session click 'Open !27 on GitLab: Reminder sounds'; cat glab/opened.log",
      "observed": "argv: https://gitlab.example/taskboard/taskboard/-/merge_requests/27 (clicking the title still opens the page)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD' / 'mutants: no TypeScript changes since HEAD' (the change is .vue only and was not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The list was narrowed by setting the <ul> width through app-session `read` (390px); the window was not resized. The brief allows narrowing 'the window (or the list)'.",
    "The `·` separators are aria-hidden spans with `mx-1`, so screen readers read the same parts as before; spacing does not depend on template whitespace.",
    "The title button gets `self-start max-w-full`, so its clickable width stays the title's own width, as before, and does not stretch across the column."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:109,112",
      "risk": "The separators use `mx-1` (4px each side). The ` · ` inside sizeText uses plain spaces (about 3px at 12px), so the gaps are about 1px wider. Copying the line as text gives '!32·created …' with no spaces."
    }
  ]
}
