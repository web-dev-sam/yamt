# MrConflictsAppCorrectness

Agent output (`agent://MrConflictsAppCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsAppCorrectness.md), collected 2026-10-30T22:26:26.532Z.

{
  "verdict": "pass",
  "checked": [
    "RK45: a push needs Committed (take_committed), else NoOperation with the state kept. Pushed→Finished; Failed or panic→Committed. Tests: push_*, a_rejected_push_* (Committed, GitLab tip unchanged), refuses_unless_* (Held, Finished).",
    "RK44: find_live runs before the worker; restore only after git's abort succeeds. The window is destroyed only with no leftovers. Committed answers MergeFinished, so no abort after commit. A concurrent call gets GitRunning.",
    "RK47: startup opens the session read-only, then claims; a held claim exits 2 with the brief's sentence. merge() drops the claim after window::run (accepted). Test covers a claim held by the test and one held by an earlier startup.",
    "Continue (rule 9) checks find_live, iid, then window_is_open, then the start; resolve uses target.root (== repository root). Recording and failing starts tested; Ended for !23 and after merge --abort. Tests never spawn.",
    "Implementer risks accepted: the push stays Running ≤120 s, and close waits only after run_return (window.rs:89), as continue does. The HEAD-moved swap is valid (is_live checks head). Destroy is NOT RUN; the state it reads is asserted.",
    "Survivors: :66 and :82 are killed by `just test` on the macOS/Windows CI runners. The TS survivors are on unchanged lines. Bindings at a94e4af include branchCheckedOut. I ran no tests; no block depended on one."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrConflictsApp.survivors.txt",
      "line": 4,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The kept survivor second_window.rs:86 (Windows `detach` → ()) is called gate-covered, but no recipe kills it ('the Unix twin is pinned' fits none of VF7 (a)/(b)/(c)). The :66 reason does not name its killing test. If it stays, a later edit that drops the Windows detach goes unnoticed (RK42's owner); nothing else gets harder.",
      "fix": "Restate the :66 reason as killed on macOS/Windows CI by outside_an_appimage_a_second_yamt_starts_from_this_binary. Record :86 as a real gap in RK42's row, or add a Windows-only test showing the child outlives the parent's console."
    },
    {
      "file": "src-tauri/src/merge/merge_request_tests.rs",
      "line": 122,
      "severity": "nit",
      "problem": "The leftovers test checks only the count and the first kind. 6bd0fa8 (before this commit) fixes the pair as [returnRefused, branchCheckedOut], so the app's JSON for the second leftover is not pinned. Nothing gets harder as the app grows.",
      "fix": "Compare `aborted[\"leftovers\"]` with the full JSON array: returnRefused to develop, then { kind: \"branchCheckedOut\", branch: DUE_DATES }. Match the message by prefix or drop it before comparing."
    }
  ]
}
