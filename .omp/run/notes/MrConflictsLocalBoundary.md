# MrConflictsLocalBoundary

Agent output (`agent://MrConflictsLocalBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsLocalBoundary.md), collected 2026-10-30T21:53:15.584Z.

{
  "verdict": "pass",
  "checked": [
    "Only owned files changed, plus cargo-written Cargo.lock (orchestrator commits it). Deps: gitio, serde, serde_json, specta, thiserror, tracing; dev: tempfile, conflict-repo. forbid(unsafe_code) as other libs.",
    "arch-check block matches merge-requests' (only yamt-(local-merge|gitio), no tauri) and yamt-app allows local-merge. tree.md, state.md, §7 and PM1 rows go to the docs keeper (DR5).",
    "§4.6 types, derives and signatures match. Accepted: Error::LockFailed (claim_window io). Accepted: variant rename_all on Merging; specta-macros rc.25 parses it (serde.rs:227) and a lib.rs unit pins windowOpen.",
    "Accepted: pre-checkout errors folded into GitRefused{left:[]}, as no other variant exists. Accepted: one test binary (brief named common; agent/tests precedent). Accepted: <remote>/<target> merge name, which fits plan #142.",
    "Accepted: record.rs hold copies range/lock.rs (8 std lines). arch-check forbids local->range and gitio's job is git I/O, so no crate can share it. The liveness rule is_live has one definition.",
    "State: the record is written only by record::write and removed only by start, restore and committed; lock files are never removed. lib.rs is 364 lines, record.rs 314 (RS6); RS13 consts; no wildcard arms or Rc/async."
  ],
  "findings": [
    {
      "file": "crates/local-merge/src/start.rs",
      "line": 204,
      "severity": "should",
      "rule_id": "CP1",
      "problem": "The merge_name doc states an external git fact (`merge` names the merged ref in its message exactly as given) with no source. As the app grows, a reader can no longer check why the short name is preferred.",
      "fix": "Cite the source in that comment: git builtin/merge.c `merge_name`, or the test `start::the_merge_names_gitlabs_target_as_git_names_…` that measured it."
    },
    {
      "file": "crates/local-merge/src/start.rs",
      "line": 190,
      "severity": "nit",
      "problem": "The three liveness checks (lib.rs:253-255, start.rs:48-50, start.rs:190-192) each read the same inputs: `stop()`, `current_branch()`, then `is_live`. If liveness gains an input, three call sites change instead of one; the compiler would still flag them.",
      "fix": "Add `record::is_live_in(repo, record) -> yamt_gitio::Result<bool>` and call it from find_live, drop_stale_record and merged, mapping its error as each does now."
    }
  ]
}
