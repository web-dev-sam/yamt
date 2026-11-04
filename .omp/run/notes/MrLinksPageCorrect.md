# MrLinksPageCorrect

Agent output (`agent://MrLinksPageCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksPageCorrect.md), collected 2026-11-04T02:24:01.158Z.

{
  "verdict": "fail",
  "checked": [
    "Works with state R1 e6e9e38b: useRowLinks now goes through useAskedRow, same behaviour (asks on open and on entry gone). LinksLoad, Linked* re-exports and linksOf spread are all present. Checked by reading, no typecheck run.",
    "RK70/RK41, page side: a row never hovered is never asked (watch not immediate). A failed entry is asked again on reopen, Retry calls askLinks, a refresh while open asks again. Only reply pages are opened.",
    "Accepted: Retry moving focus to the box. Without it the removed button leaves focusInside true and the box never closes. MergeRequestPeople.vue:187 does the same.",
    "Accepted: box staying open after a click is useHoverBox's existing focus rule, matching rule 1. Escape is prevented, so the description panel stays open. The copied glab sentences are fixed by the Contract.",
    "Tests fail if the feature breaks: group order, empty-group filter, parents only on issues, closed/notShown, Loading for undefined, failed flag. mergeRequestTitles.test.ts globs the new file.",
    "Survivors :113/:138 (empty never-typed default arms) are valid under VF7 (b): vue-tsc rejects falling off the end (TS2366). The column sits after info and before CI (MergeRequestRow.vue:200). @click.stop keeps clicks off the row."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestLinks.vue",
      "line": 116,
      "severity": "block",
      "problem": "A line button's accessible name runs its spans together: Vue's whitespace condensing drops the separators between the flex children, so the name is '#12Snooze a reminder', 'Old boardClosed' or 'design&2Not found or no access'. The implementer measured this with WebDriver. A screen-reader user hears the reference, the title and the Closed or not-found state as one word.",
      "fix": "Add a `label` field to LinkLine in mergeRequestLinkLines.ts, e.g. '#12 Snooze a reminder', '&4 Old board, Closed'. Bind it as the line button's `:aria-label` and assert it in a_line_keeps_its_reference_title_and_closed."
    },
    {
      "file": "frontend/src/ui/AGENTS.md",
      "line": 71,
      "severity": "should",
      "problem": "The description paragraph in this slice's own file still says the info column sits 'between the approvals and the CI box'. The links column now sits between them, so the guide contradicts the row and the next paragraph. Leaving it misleads whoever places the next column.",
      "fix": "Change it to 'between the approvals and the links column'."
    }
  ]
}
