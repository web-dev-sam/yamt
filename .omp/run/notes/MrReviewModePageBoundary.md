# MrReviewModePageBoundary

Agent output (`agent://MrReviewModePageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModePageBoundary.md), collected 2026-11-03T18:44:20.141Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 13 changed files are in Owned; read-only fixtureMergeRequestData.ts, the core, scripts/fake-glab and crates are untouched. The tests/glab/README.md table realignment comes from the post/format.ts oxfmt hook.",
    "PM10/PM2/PM3: both new components import only ../mergeRequests, ./mergeRequestsText, ./tooltip, ./mergeRequestsShown (type), ~icons. ipc tests import ../mergeRequests as fixtureMergeRequestData.test.ts does.",
    "Contract: props, emits and defineExpose({opener, menu, narrowBox}) match the brief; MENU_ITEMS gains menuitemradio; the view uses useHoverMenu<ListFilter|\"review\">, pick → review then close; v-if on discussionDetails and reviewSort.",
    "State: one bar menu (state.md row 82, plan #155 kept); filters written only via requests.review/clearAll; the picker's typed is local; no title attr (titles test globs MergeRequest*.vue); vTooltip + aria-label (#154).",
    "Deviations accepted: keyOf me/user:<username> (contract), map/tree/state lines to docs keeper, scenario statuses/notes. Open risk on menu() order accepted: one menu is open by construction (useDropdownMenu opened).",
    "Fixture: sam()/FIXTURE_ME/listed removed, no dead code left; DISCUSSIONS_FAILED_IID 615; ipc/ui AGENTS.md match the code (datedFirst/dueOf exist); scenario project.json equals mr-discussions'."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestReviewMode.vue",
      "line": 32,
      "severity": "should",
      "rule_id": "growth-copied-decision",
      "problem": "The narrowing wiring is copied from MergeRequestFilter.vue:62-79,139-155: `typed`, its reset-on-open watch, `narrows`/`shown`, the search input and the menu container classes. With this copy, any change to the narrowing box (focus, Escape, words) or a third narrowable menu has to be edited in each copy.",
      "fix": "In a follow-up that owns MergeRequestFilter.vue, move the box and its reset into one shared piece (e.g. a `useNarrowing(choices, open)` composable or a menu-shell component) that both menus use."
    },
    {
      "file": "frontend/src/ui/MergeRequestsView.vue",
      "line": 67,
      "severity": "nit",
      "problem": "The hover menu's `close` sits beside `requests.close` (which closes the page) in the same script. A reader of `pick` may take `close()` to mean leaving the page. Nothing gets harder as the app grows.",
      "fix": "Destructure it as `close: closeMenu` and call `closeMenu()` in `pick`."
    }
  ]
}
