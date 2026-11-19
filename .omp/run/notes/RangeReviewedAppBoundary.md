# RangeReviewedAppBoundary

Agent output (`agent://RangeReviewedAppBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedAppBoundary.md), collected 2026-11-19T09:39:20.701Z.

{
  "verdict": "pass",
  "checked": [
    "Contract kept: RangeToOpen.project/iid filled by prepare_open (open.rs:67-72); MarksOf + --review-of split at last `!`, iid>0, both refusal lines, USAGE (args.rs:121-198); range_arguments adds the flag; run_range gains marks",
    "range.rs manage_range_in: pair lock → list → ReviewedStore::open under <app_folder>/reviewed (sibling of range/, #2541 test) → threads; refusal via to_string before app.manage; RangeState.reviewed has one writer, reviewed.rs",
    "reviewed.rs follows review.rs: per-module `locked` helper (existing convention, 8 modules), list sync over in-memory marks(), mark/unmark/since through blocking_reply with the store locked only in the worker",
    "ipc_error From<yamt_reviewed::Error> uses only existing variants and matches yamt_compare's NewerFormat wording, as the brief asked; Range(e) delegates to From<yamt_range::Error>; covered by ipc_error/tests.rs",
    "Edges: yamt-reviewed.workspace = true (#2535/#2540), workspace dep present, arch-check allows yamt-app → yamt-reviewed (arch-check.sh:95); every touched file is in Owned; bindings.ts not in patch",
    "Deviations accepted: range tests moved to range/tests.rs (review/tests.rs pattern); a reviewed/ copy stands in for a reopen; architecture, ipc-contract, project-map, plan #195 left to the docs keeper/orchestrator"
  ],
  "findings": [
    {
      "file": "src-tauri/src/args.rs",
      "line": 202,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "args.rs grows from 439 to 540 lines, past RS6's 400. The same patch moved range.rs's tests out at 442 lines, so the 400-line split is now applied unevenly; each later flag pushes this file further over.",
      "fix": "Move the `mod tests` body to `src-tauri/src/args/tests.rs` (`#[cfg(test)] mod tests;`), as range.rs and review.rs already do."
    },
    {
      "file": "src-tauri/AGENTS.md",
      "line": 1,
      "severity": "should",
      "problem": "Line 1 still lists `RangeState { range, threads: Mutex<ThreadStore>, sending, _lock }`, the old start_range argv and a dependency list without `yamt_reviewed`. crates/merge-requests/AGENTS.md:1 still gives `RangeToOpen` (`root`, `spec`). Line 5 and line 17 now contradict them, and the docs keeper's §6 duties cover architecture and project-map, not AGENTS.md.",
      "fix": "Edit those phrases in place in both line-1 paragraphs (RangeState gains `reviewed: Mutex<ReviewedStore>`, argv gains `--review-of`, deps gain yamt_reviewed, RangeToOpen gains `project`, `iid`), or name AGENTS.md in the docs-keeper spawn."
    },
    {
      "file": "src-tauri/src/args.rs",
      "line": 168,
      "severity": "nit",
      "problem": "A second `--review-of` silently replaces the first, while a second `--diff=<range>` is refused (DIFF_TWICE). The parser now follows two rules for a repeated flag, and neither the brief nor a plan row records the choice. Nothing gets harder as the app grows.",
      "fix": "Refuse a second `--review-of` with a one-line message, as `--diff=` does, or record the replace rule in the proposed #195 row."
    }
  ]
}
