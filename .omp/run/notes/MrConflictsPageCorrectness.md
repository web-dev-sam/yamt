# MrConflictsPageCorrectness

Agent output (`agent://MrConflictsPageCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsPageCorrectness.md), collected 2026-10-30T23:13:00.297Z.

{
  "verdict": "pass",
  "checked": [
    "Row rule (rowAction.ts:48-63) matches design §2: Continue on the merging iid whatever readiness; windowOpen before running; no button unless conflicts; fork > another merge > running. Order swaps fail rowAction.test.ts.",
    "Words in readiness.ts, size.ts and mergeRequestsText.ts:155-234 match §2/§4.5 Texts, each pinned by a test (both alreadyMerging forms, gitRefused ±leftovers); refused is false only for started/opened.",
    "localMerge is read at show (mergeRequests.ts:139), after each reply (mergeRequestActions.ts:90) and on focus while mounted. A failed read keeps the value and reports it; a click while running sends nothing. mergeRequests.test.ts:625-751.",
    "Risks accepted: the read-before-claim race is named harmless in design §4.2:316-319 and the focus read heals it; focus-only re-read is §4.5. Survivors fixture:144 and rowAction:48 are truly equivalent (a); never arms are (b).",
    "Fixture replies 640/632/624/616/other, local merge after started/windowFailed only, continue opened→windowOpen true, other iid ended: all tested. tauriResolve catches swapped commands. Shots in /tmp/mrc-shots/ exist.",
    "Accepted before review: mergeRequestActions.ts, ddc7ffd problem steps, #2029, the continue pause. No targeted test run: no block depends on one."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrConflictsPage.survivors.txt",
      "line": 4,
      "severity": "should",
      "rule_id": "promote",
      "problem": "The FIXTURE_TARGET and WINDOW_FAILED_MESSAGE survivors (fixtureMergeRequests.ts:62-63) are kept as (c) 'wiring'. They are module-level constants that tests assert, so they are #732 static false survivors (b), not wiring. This is the same mislabel as #1943, #2006 and #2027. Growth: triage cannot trust survivor labels without re-deriving them.",
      "fix": "Relabel both as '(b) #732 static artefact: killed by fixtureMergeRequests.test.ts's !640/!616 rows asserting \"main\" and \"yamt: not found\"'."
    },
    {
      "file": ".omp/run/mutants/MrConflictsPage.survivors.txt",
      "line": 1,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The run reports 17 survived and 18 no coverage, but the file accounts for only 4 survivors and 5 no-coverage. The other 13 + 13 are not listed and not marked as being on unchanged lines. Reading the changed lines, I found no unkilled branch, but nobody can confirm that from the evidence. Growth: later verify briefs re-triage unlisted survivors.",
      "fix": "List the remaining survivors as file:line mutation, or state that they lie on lines older than b8aeae1 (e.g. openReplyText and listFailureText arms)."
    }
  ]
}
