# LocalConflictsPageCorrectness

Agent output (`agent://LocalConflictsPageCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsPageCorrectness.md), collected 2026-11-02T18:47:19.008Z.

{
  "verdict": "pass",
  "checked": [
    "Slice rule (mergeRequests.ts:107-167) traced by hand: shown set at first load start and refresh swap; buffering cleared on every ok end; failed loads drop. Tests fail if any branch is removed",
    "Channel core.js:137-146 can run end+checked in one task before ended(); checked then lands in buffer or rows (shown===load), correct either way. Design §3 accepts the refresh flicker",
    "Open risk accepted: a checked iid is the same MergeRequestIid as an already-branded page row, so it is unreachable (decision 19). Worst case: console error, stalled channel, no problem shown",
    "Survivors on unchanged lines only: data 9,17,46,62,80-86,98; index.ts:158; mergeRequests.ts:168; readiness.ts:89 no-cov default. The 217 one was killed in the rerun (616/114)",
    "Kept: fixtureMergeRequests.ts:46 is VF7(a) (SCRIPTS read only via hasOwn/keys l.72,83). LOCAL_CHECKED 90-93 is a #732 const artefact, pinned exactly by the ?mr=local and data tests in just check",
    "Tests fail with the feature removed (tauri after-end, buffered swap, older dropped, failed refresh, 1000 not 999 ms). rowAction is the only other readiness user (#150). Fixture and real-app evidence match"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequests.test.ts",
      "line": 486,
      "severity": "nit",
      "problem": "The failed-refresh test.each never checks `live.problems`, but the brief says no report call for any of these cases. A report added for a dropped checked row would pass here (it would still be caught elsewhere). Nothing gets harder as the app grows.",
      "fix": "Assert `live.problems` holds only the load's own list problem (none for the `failed` end, one `step: \"list\"` for the IPC failure)."
    }
  ]
}
