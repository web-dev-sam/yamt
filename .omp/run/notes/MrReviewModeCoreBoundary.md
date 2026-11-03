# MrReviewModeCoreBoundary

Agent output (`agent://MrReviewModeCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModeCoreBoundary.md), collected 2026-11-03T18:29:35.932Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all files in Owned except the accepted rowReplyText split (mergeRequestRowReplyText.ts+test, MergeRequestRow.vue); ui/mergeRequests.ts unchanged because State already has the new Listed fields (:75, :92, :274).",
    "PM3/PM10: the core files import only ./ siblings, no new cycle. The ui/mergeRequest* edges (Text→Discussions type and problemText; RowReplyText→Text, Actions, leftoverText) reach no window root and no lsp/.",
    "Contract: every new type and function matches the brief's signatures (core, Text, Filters, Shown); index.ts exports all of them.",
    "State: the filters have one writer, `set`; the gate and review(who) both go through it. viewer is derived; one computed gives shownRows and reviewSort. The box's failure header is now the shared discussionsFailedText.",
    "Accepted: rowReplyText split moved unchanged with its tests; ui/AGENTS.md lines in the notes; watch without immediate; ReviewSort typed in a test for knip. The !<iid> risk is an existing pattern (rowAction.ts:42,60).",
    "Decision record: the fifth stored key amends #134/#155 through the proposed #165; viewerOf follows #163. The doc comments are the Contract's own lines (CP2); TS3 default kept in headerOf; no TS7 swap risk."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/reviewOrder.ts",
      "line": 61,
      "severity": "should",
      "rule_id": "copied-decision",
      "problem": "The viewer's possessive (\"your\" / \"<name>'s\") is spelled in reviewName and again in discussions.ts:85 turnText. Line 74's local `turn` (\"your\"/\"their\") clashes with the Turn type. Any fix to how a reviewer is named must be made twice and can drift.",
      "fix": "Export one viewerPossessive(viewer) next to Viewer in discussions.ts. Use it in turnText (capitalised), reviewSortedText and reviewFailedText, and rename line 74's local to `whose`."
    },
    {
      "file": "frontend/src/ui/mergeRequestsShown.ts",
      "line": 64,
      "severity": "should",
      "rule_id": "copied-decision",
      "problem": "The due-day lookup (widen dates.value, then `due.get(iid) ?? null`) copies DueDates.datedFirst (mergeRequestDueDates.ts:76-77). A later change to how a row's day is read must be made twice, or the review order drifts from the normal order.",
      "fix": "Add DueDates.dueOf(iid) and use it in both datedFirst and ordered. mergeRequestDueDates.ts is read-only here, so route the change through the page slice or the orchestrator."
    },
    {
      "file": "docs/architecture.md",
      "line": 1891,
      "severity": "should",
      "problem": "Notes list only the tree.md additions. These lines are also stale now: architecture.md:1891 and tree.md:277 (rowReplyText), architecture.md:1803 (shownRows), state.md:70 (the filters' writers). The map-check \"ok\" predates tracking: no map file names reviewOrder or mergeRequestRowReplyText. If the docs keeper is told, nothing gets harder.",
      "fix": "Add these four stale lines and the two expected map-check findings to deviations_from_brief for the docs keeper."
    },
    {
      "file": "frontend/src/ui/mergeRequests.test.ts",
      "line": 1294,
      "severity": "nit",
      "problem": "The rig helper `reviewing(storage)` only finds the project and loads, yet it shares its name with the core's reviewing(who) and reads as turning review mode on. Nothing gets harder.",
      "fix": "Rename it `loadedRig(storage)`."
    }
  ]
}
