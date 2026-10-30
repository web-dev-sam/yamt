# MrPageWebBoundary

Agent output (`agent://MrPageWebBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T19-31-04-168Z_01a18e4b-5568-7113-b48d-cb43e7b9c05a/MrPageWebBoundary.md), collected 2026-10-30T19:58:45.484Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 21 changed files match the brief's Owned globs, plus the approved problem.ts, problemText.ts and problemText.test.ts. bindings.ts is untouched (PM4). mergeRequests/** is unchanged.",
    "Clean rename: no JobPage, JobOpened, openJobPage, jobProblem, jobOpenedText, dismissJobProblem or fixture_job is left in frontend/, scripts/ or justfile. CiStatusBox keeps its job-only openJob emit: deviation accepted.",
    "PM10 holds: MergeRequestRow, CiStatusBox and MergeRequestsView gain no import of a window root or lsp/. WebPage is made only in domain.ts isWebPage; mergeRequestDomain toRow checks row.page through toWebPage, like a job's page.",
    "Vision 2: pageProblem is one field in mergeRequests.ts, written only by openPage and dismissPageProblem. There is one problem line in MergeRequestsView and one pageProblemText. A failed call goes through state.report.",
    "Contract (#137): openPage(WebPage) returns SourceResult<PageOpened>; index.ts exports WebPage, PageOpened. Fixture rows carry ORIGIN/-/merge_requests/<iid> and log fixture_page. AGENTS.md updated. hover:bg-row-hover is the lists' token.",
    "Accepted: the TS3 never-arm survivor (VF7). Old names in the docs are the docs keeper's. Text-selection and disabled-button risks go to the correctness lens. VU2 order, VU5 typed emits and VU6 handlers are fine."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestRow.vue",
      "line": 94,
      "severity": "block",
      "rule_id": "plan-137",
      "problem": "The `@click.stop` and `cursor-default` sit on the always-rendered w-7 slot, not on the CI box. On a row with no pipeline (the fixture's PIPELINES cycle includes null), that empty 28px slot shows an arrow cursor and a click there does nothing. Behaviour 1 and #137 say every click on the row opens the page except one on the CI box or the open-changes button.",
      "fix": "Move `cursor-default` and `@click.stop` from the wrapper span onto `<CiStatusBox v-if=… class=\"cursor-default\" @click.stop>`. Its single root span receives both as fallthrough, so the empty slot stays part of the row."
    },
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 186,
      "severity": "should",
      "problem": "PAGE_STEPS exists only because the new MergeRequestStep \"page\" is named differently from the PageKind \"mergeRequest\" it stands for. Both kinds are pages now, so a reader of `step: \"page\"` cannot tell which page failed. Each later page kind also needs a row in this table besides PageKind, NOT_OFFERED, MergeRequestStep and the step words.",
      "fix": "Rename the step \"page\" to \"mergeRequest\" in problem.ts, problemText.ts and the tests, write `step: clicked` (PageKind ⊂ MergeRequestStep) and delete PAGE_STEPS."
    },
    {
      "file": "frontend/src/ui/MergeRequestRow.vue",
      "line": 66,
      "severity": "should",
      "problem": "Open risk 1, not accepted: the inner span's `title` covers the whole button, so the brief's tooltip \"Open !N on GitLab\" practically never shows. With `aria-label` on a button, whose children are presentational, assistive technology no longer reads the MR's title at all. The brief's two lines (tooltip/name vs readable full title) collide; the orchestrator should settle which one wins.",
      "fix": "Raise it to the orchestrator as a product question. If the title should stay readable, drop `:aria-label` so the name is the title text, and keep the full-title tooltip; otherwise drop the span's `title`."
    },
    {
      "file": "frontend/src/ui/mergeRequestsText.ts",
      "line": 6,
      "severity": "nit",
      "problem": "PageKind is the store action's and the row emit's vocabulary, but it is declared in the words file, so \"where does PageKind come from\" leads to the text module (TS9/TS11). Nothing grows harder unless more non-text rules key on it.",
      "fix": "Leave it where it is unless the step rename above makes `Extract<MergeRequestStep, \"job\" | \"mergeRequest\">` in problem.ts the natural home."
    }
  ]
}
