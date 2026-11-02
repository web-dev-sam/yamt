# LocalConflictsCheckCorrectness

Agent output (`agent://LocalConflictsCheckCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsCheckCorrectness.md), collected 2026-11-02T18:36:26.520Z.

{
  "verdict": "pass",
  "checked": [
    "readiness_after matches design §2.1 for every status × outcome; the moved readiness() equals the deleted page.rs fold; page/tests.rs expectations unchanged.",
    "check.rs runs §2.2 steps 1–9 in order; headless rows run no git; `kept` cannot underflow; scenario sums are right: 5 pairs, 7 decided, 1 moving, 1 kept.",
    "RK52: untouched() checks refs, status, HEAD and FETCH_HEAD over two loads; row 44 pinned by moving/kept/remembered. src-tauri: page, end, checked×6; sends unlogged.",
    "Kept survivor check.rs:355 `<`→`<=` on elapsed() < limit: accepted as VF7 (a), differs only at an exact-nanosecond tie. The 2 timeouts (`running -=` hangs) count as caught.",
    "Open risks: answering after the check is design option A (window settles on end, tauriMergeRequests.ts:27-33). Timing margins wide except the 10 ms limit (nit). Panic and fetch: findings.",
    "Deviations accepted: finishing order (tests sort by iid), private Pair key, reused page::count, problem wording, docs-keeper lines. No test run: no block depended on one."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/check.rs",
      "line": 358,
      "severity": "should",
      "problem": "If a merge thread panics, its sender clone drops but the loop keeps its own `sender`, so `finished.recv()` (l.365) blocks forever. The command never answers and `merged` stays locked, so every later load's check hangs too. As the app grows, any new panic site in `merge_tree` would turn into a permanent hang rather than an error.",
      "fix": "In the spawned closure, send `panic::catch_unwind(AssertUnwindSafe(|| merge(pair))).unwrap_or_else(|_| Err(\"merge-tree panicked\".to_owned()))` so every started merge always sends exactly one result.",
      "rule_id": "R-open-1"
    },
    {
      "file": "crates/merge-requests/src/check.rs",
      "line": 261,
      "severity": "should",
      "problem": "No test makes the fetch fail: the `fetch: …` problem and the hand-off to `with_local_commits` are unproven, so a change to this path would go unnoticed. Only `with_local_commits` itself is unit-tested.",
      "fix": "Add a `load_with` test whose `between` removes the fork commit's loose object from the bare (the ref stays advertised). Assert 45 is not sent, `merges 4`, `kept 2`, and a problem starting with `fetch: `."
    },
    {
      "file": "src-tauri/src/merge_requests/tests.rs",
      "line": 316,
      "severity": "should",
      "problem": "`two_checked_lists_on_path_s_glab` would still pass if `list()` used a fresh `MergedPairs` each load. The shell's reuse of `state.merged` (rule 7, the reason the Mutex exists) is therefore unproven; only the crate test covers memory.",
      "fix": "Between the two loads, make re-merging impossible (e.g. delete the !45 commit's objects from the bare and the checkout). Then assert 45's `mergesCleanly` still arrives, which only the remembered pair can give."
    },
    {
      "file": "crates/merge-requests/src/check/tests.rs",
      "line": 136,
      "severity": "nit",
      "problem": "With a 10 ms limit, both threads must be spawned within 10 ms; on a loaded CI runner `started` can be 1 and the test flakes. Nothing else gets harder.",
      "fix": "Use a limit of about 50 ms (still well below `SLOW_MERGE`'s 150 ms) for the first `scheduled` call."
    }
  ]
}
