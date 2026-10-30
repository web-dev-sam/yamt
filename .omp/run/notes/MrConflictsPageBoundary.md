# MrConflictsPageBoundary

Agent output (`agent://MrConflictsPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsPageBoundary.md), collected 2026-10-30T23:12:49.234Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: every patched file is in Owned except ui/mergeRequestActions.ts, which was accepted. The tree.md rows and state.md row 60 (actions, localMerge) are left to the docs keeper.",
    "Boundaries: mergeRequests/internal/* import only each other (PM3). ui reaches them only through index (PM5/TS8). mergeRequestActions.ts, MergeRequestRow.vue and MergeRequestReadiness.vue import no window root or lsp/ (PM10).",
    "Mirrored types in mergeRequests/ (Readiness, BlockedReason, LocalMerge, ChangeSize) follow the ListedRequest/CiStatusName pattern. A new ipc variant would fail typecheck at MergeRequestRow/Readiness call sites.",
    "State: createRowActions is the only writer of actions and localMerge. localMerge is read at show(), on window focus while the view is mounted (v-if) and after every reply. VU7/VU12 hold; no comments added.",
    "Deviations accepted: rowReplyText reuses openReplyText (design §4.5: same sentences, one source); readiness tones follow CiStatusBox LOOKS; the fixture's 1 s continue pause and 'all but !624 set the merge' match the brief.",
    "A failed findLocalMerge is reported (the brief's 'source failure → report' path) and keeps the old value. Plan §2 #138/#143 are not contradicted; the rowAction order matches design §2; TS17 tables are Readonly<Record>."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestActions.ts",
      "line": 60,
      "severity": "should",
      "problem": "setActing and act's 'running → return' guard copy setOpening and openChanges's 'fetching → return' guard (mergeRequests.ts:163, :174). A third per-row action would copy the same map write and guard a third time.",
      "fix": "Move one keyed-map write (e.g. `withRow(map, iid, value | null)`) into mergeRequestActions.ts or a small shared helper, and use it from both setOpening and setActing."
    },
    {
      "file": "frontend/src/ui/AGENTS.md",
      "line": 49,
      "severity": "should",
      "problem": "The merge window's facts (question.ts/questionText.ts, Abort with `mergeRequest` written only by listing.ts, pushing.ts, and line 51's push problem) sit inside the page's 'Merge-request conflicts' paragraph. Line 31 still names listing.ts the only writer of just files, operation and sideNames, so someone reading listing.ts's paragraph misses a state it now writes.",
      "fix": "Move those sentences into their own merge-window paragraph, and add `mergeRequest` to line 31's list of what listing.ts writes."
    }
  ]
}
