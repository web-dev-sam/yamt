# MrReviewFixesCorrectness

Agent output (`agent://MrReviewFixesCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesCorrectness.md), collected 2026-11-04T23:58:14.073Z.

{
  "verdict": "pass",
  "checked": [
    "reviewOrder.ts:41-55 comparator is correct alone (symmetric, total). Survivors :42/:43: no (dated, undated) call over 3000 pre-ordered arrays in node V8 or WebKitGTK jsc, so VF7(a) holds in the product engine",
    "Other survivors OK: :100 'inside'→'' gives the same text and fails vue-tsc; NO_TURNS is #732, killed by hand; discussions.ts 42–53/59/199/219 are unchanged lines kept by earlier slices",
    "reviewOrder tests d1×2, d2, d3, d4, another reviewer, rows' author, loading: hand-traced; each fails if D1 is dropped, a D2/D3 sign flips, or authorsTurn is used. Fixture and mergeRequests.test expectations fit D1–D4",
    "B1–B3: one counts computed feeds header and mark. Box test kills >=0 and >1 (zoe 0, 1 of 10, 0 of 9). Off drops entries (mergeRequestDiscussions.ts:172), so no mark. Lazy unread rows stay unmarked",
    "C1/C2: page tests fail on the old goBack branch. The other Escape owners take their own Escapes. A wrong keydown listener breaks the filter-menu test, so the order assumption fails loudly. Back's click: WebKit smoke only",
    "A1/A2: both turnText calls pass row.author; null gives Author's turn. viewerWrote ignores mentions (discussions.test). Docs updated. Deviations accepted: 2 test files, 2429 wording, new page test"
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/discussions.ts",
      "line": 147,
      "severity": "should",
      "problem": "\"The viewer wrote a comment in this discussion\" (`[...earlier, last].some(isUser(author, viewer))`) is now written twice: once in isViewersTurn's B2.4 (line 85) and once in turnCounts' D3. If what counts as \"wrote in\" changes, both copies must change together, or the purple turn and the review order will disagree.",
      "fix": "Extract `function wroteIn(discussion, viewer): boolean` and use it in both isViewersTurn (OR'd with the mention check) and turnCounts.viewerWrote."
    }
  ]
}
