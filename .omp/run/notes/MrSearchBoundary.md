# MrSearchBoundary

Agent output (`agent://MrSearchBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T08-37-08-403Z_01a1a08e-14b3-70d2-9e68-44d830b6bbca/MrSearchBoundary.md), collected 2026-11-03T08:56:38.216Z.

{
  "verdict": "pass",
  "checked": [
    "Fences: search.ts imports nothing (PM3); mergeRequestsShown.ts and MergeRequestSearch.vue import only vue, icons, ../ipc, ../mergeRequests, ./mergeRequestFilters, ./mergeRequestDueDates, ./mergeRequestsText, so no window root or lsp/ (PM10)",
    "Approved split accepted: shownOf holds shownRows=datedFirst(searched(filtered())), choices over all rows, summary and filter actions; the slice spreads it, no key clashes with RowActions/Rerequests; search has one writer",
    "Docs: state.md rows 69/70 (search written only by setSearch and show, never stored) and tree.md 268/273 name both new files; both AGENTS.md updated; brief's read-only files untouched",
    "MergeRequestSearch.vue: VU2 order, VU4 useTemplateRef, VU5 typed props/emits, events up; input classes match other fields (focus:border-primary); @mousedown.prevent+focus as in SearchPanel; no title, no comments",
    "Escape: fieldKey calls preventDefault only when it empties text, and the view's escapePressed skips prevented events, so a second Escape leaves the page; Clear filters (clearAll) leaves search alone",
    "VU15 reason for the sixth MR component is in deviations; the #12345 test form (palette fence) and type=text instead of search are accepted; the View gains one line and no new job"
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/search.ts",
      "line": 1,
      "severity": "nit",
      "problem": "`SearchedRequest` is exported from internal/search.ts but `index.ts` re-exports only `searched`. The brief says the core is exported from index.ts, and the sibling row types (`ListedRequest`, `ListedLabel`) are re-exported. As the app grows nothing gets harder, but outside callers can't name the type.",
      "fix": "Add `type SearchedRequest` to the `./internal/search` export line in `mergeRequests/index.ts`, or remove `export` from the type if it should stay private."
    }
  ]
}
