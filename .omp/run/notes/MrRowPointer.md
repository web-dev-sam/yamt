# MrRowPointer

Agent output (`agent://MrRowPointer`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowPointer.md), collected 2026-10-31T08:27:10.847Z.

{
  "summary": "Over a merge-request row that opens a page, the hand cursor now shows everywhere: the empty space, the title, the CI box and Resolve/Continue/open changes when they are enabled. When the pointer is over one of the row's controls (marked `data-row-control`), only that button lights up (`bg-hover`) and the row does not. A disabled control shows the arrow, no highlight, and leaves the row unhighlighted. Click behaviour and focus rings are unchanged. No tests were added because this change lives only in a `.vue` file, which the test projects and `just mutants` don't cover.",
  "files_changed": [
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check && pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend test",
      "observed": "All matched files use the correct format; oxlint/eslint and vue-tsc -b no output; Test Files 244 passed (244), Tests 3411 passed (3411)"
    },
    {
      "command": "cargo tauri build --debug --no-bundle; scripts/mr-conflict-repo.sh /tmp/yamt-mrrow; just app-session start-app --name mrrow --diff --dir /tmp/yamt-mrrow --glab mr-conflicts; click 'Merge requests'; read getComputedStyle(..).cursor on row !32 and !22",
      "observed": "{row:pointer,rowMeta:pointer,title:pointer,ciBox:pointer,ciWrapperGap:pointer,resolve:pointer,openChanges:pointer,disabledAction(!22 Resolve):default,disabledActionHitTarget(span title \"Resolving a fork's merge request is not supported\"):default}"
    },
    {
      "command": "default dark: hover 'Open the changes of !32'; read backgrounds; shot /tmp/mrrow-dark-open-changes.png",
      "observed": "li rgba(0, 0, 0, 0), btn rgba(233, 228, 254, 0.08), li:hover true. Screenshot: only the open-changes button is tinted, the row is not."
    },
    {
      "command": "default dark: hover title 'Open !32 on GitLab: Board themes'; shot /tmp/mrrow-dark-title.png",
      "observed": "li rgba(233, 228, 254, 0.05), btn rgba(0, 0, 0, 0). Screenshot: the whole row is tinted, and no button is."
    },
    {
      "command": "default dark: hover disabled 'Resolve conflicts of !22'; hover 'Pipeline failed'",
      "observed": "disabled: li rgba(0, 0, 0, 0), btn rgba(0, 0, 0, 0), elementFromPoint SPAN cursor default. CI: li rgba(0, 0, 0, 0), ci rgba(233, 228, 254, 0.08), cursor pointer, popover cursor default"
    },
    {
      "command": "start-app --settings '{\"theme\":\"zed-dark\"}'; hover open changes of !32; shot /tmp/mrrow-zed-dark-open-changes.png",
      "observed": "--color-hover #363c46 = --color-row-hover #363c46; li rgba(0, 0, 0, 0), btn rgb(54, 60, 70). Screenshot: only the button is highlighted."
    },
    {
      "command": "zed-dark: hover title of !32; shot /tmp/mrrow-zed-dark-title.png",
      "observed": "li rgb(54, 60, 70), btn rgba(0, 0, 0, 0), title cursor pointer. Screenshot: only the row is highlighted."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD' / 'mutants: no TypeScript changes since HEAD' (.vue is not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Added `data-row-control` to the CI box, the action's title span and the open-changes span. The row highlight is `hover:not-has-[[data-row-control]:hover]:bg-row-hover`. The attribute goes on the wrappers because the disabled action keeps `pointer-events-none`, so the pointer hits its `<span :title>`. The row also stays unhighlighted over the CI box's popover.",
    "The CI box's buttons get the hand cursor from the row through `[&_button:enabled]:cursor-pointer` on the `CiStatusBox` root, which keeps `cursor-default` for the popover's text. `CiStatusBox.vue` itself is unchanged.",
    "No `MergeRequestRow.browser.test.ts`: the browser project in `frontend/vite.config.ts` (not owned) only runs `src/editor/**/*.browser.test.ts`, and a test that just checks class strings is ruled out by VF."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:136",
      "risk": "The CI failed-jobs buttons (enabled ones get the hand, disabled ones the arrow) were not observed: the CI box I hovered (!32's, 'Pipeline failed') listed no jobs, so the cursor there comes from the CSS rule alone."
    },
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:89",
      "risk": "I did not observe a row with `row.page === null` (no hand on the row, hand only on enabled buttons): every row in the scenario has a page. The `:class` binding is the same one as before."
    }
  ]
}
