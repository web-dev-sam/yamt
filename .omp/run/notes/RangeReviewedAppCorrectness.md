# RangeReviewedAppCorrectness

Agent output (`agent://RangeReviewedAppCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedAppCorrectness.md), collected 2026-11-19T09:39:32.235Z.

{
  "verdict": "pass",
  "checked": [
    "#2541 test (range/tests.rs) can fail: with REVIEWED_FOLDER = \"range\" or the pair folder, reviewed_file's read_dir(app/reviewed) panics and range/<repo key>/ gains a 2nd dir, so pair_folders ≠ [pair_dir]. Reasoned from code, not run",
    "Mutation: 33 mutants (11 caught, 22 unviable, 0 missed), no survivors kept, so no VF7 reasons to check. merge_request_marks' iid>0 and empty-project checks are pinned by the args refusal cases",
    "Acceptance tests fail without their feature: RK42 needs MergeRequest marks; keeps_the_mark fails if keyed by commit; two_MR fails if iid dropped or MR mapped to side names; newer-file test fails if the store is never opened",
    "manage_range_in: pair lock → list → ReviewedStore → ThreadStore; a refusal returns before app.manage and before open_and_wait (window.rs:113-121). side_names gives Commit{id} for typed ids, so plain --diff=<sha>..<sha> is not refused",
    "From<yamt_reviewed::Error> matches the contract arm for arm; ipc_error tests pin each serialised kind/path/message. Generated bindings in 7c06866c match the brief's names (listReviewed, FileReview, ReviewMark, SinceReview)",
    "Open risks and deviations accepted: leaking mock-app state; since test counts diffs only (shape is core's); tests moved to range/tests.rs; AGENTS.md line 1 left stale for the docs keeper; args.rs over 400 lines before this slice"
  ],
  "findings": [
    {
      "file": "src-tauri/src/reviewed/tests.rs",
      "line": 89,
      "severity": "should",
      "rule_id": "R-review-key",
      "problem": "Every --review-of test window uses the same PROJECT. A review_of that dropped `project` (two projects' !1 sharing marks) passes every app test. Nothing else builds on this beyond the one-line field move in range.rs:review_of.",
      "fix": "Give two_merge_request_reviews_do_not_share_marks a 4th open: same iid 1 under another project, which lists [] too."
    },
    {
      "file": "src-tauri/src/range.rs",
      "line": 66,
      "severity": "nit",
      "problem": "ReviewedStore::open may rewrite reviewed.json (pruning unlisted marks) before ThreadStore::open refuses a broken threads.json. So a refused window has already written a file. The outcome is the same as the next successful open, so nothing gets harder.",
      "fix": "Open ThreadStore before ReviewedStore, so every refusal happens before any write."
    }
  ]
}
