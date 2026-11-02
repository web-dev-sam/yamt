# LocalConflictsGitioBoundary

Agent output (`agent://LocalConflictsGitioBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsGitioBoundary.md), collected 2026-11-02T17:55:21.890Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only Owned files changed. Cargo.toml unchanged; tempfile and yamt-conflict-repo were already dev-deps. No new crate edge (PM1).",
    "Contract: signatures, derives (MergeOutcome Hash, Oid Hash) and lib.rs re-exports match the brief. Accepted: `run_kind`; exit 1 + stderr → GitFailed (comment cites git 2.56, CP1).",
    "Reuse: merge_tree maps exits like is_ancestor (repo.rs:85-96) through `run`, Quiet→Read, Writing→Write; remote_refs uses run_without_prompts (RK40). 2.38/2.50 live only in merge_tree.rs.",
    "RS rules: no unwrap outside tests; remote_refs_in has 3 adapters (RS4); argv logged (RS15); ref names stay bytes (RS14); unit tests in bottom `mod tests`; `#![cfg(test)]` like siblings.",
    "State/docs: no gitio row in state.md. tree.md and architecture §3.2 lines are proposed in deviations as the brief asks. AGENTS.md covers each new item with its git command.",
    "Open risks: stderr-based Conflicts accepted (worst case a false error, never a false Clean); Duration::ZERO race accepted (test-only). The lazy-fetch risk becomes finding 3."
  ],
  "findings": [
    {
      "file": "crates/gitio/src/objects.rs",
      "line": 13,
      "severity": "should",
      "rule_id": "principles-3",
      "problem": "missing_commits is a second `cat-file --batch-check` runner beside blob.rs `blob_sizes`. It repeats the stdin build, the line-count check, the id-echo check and a byte-identical `unexpected`, and has already drifted: no `--buffer`, and git is spawned for an empty `ids`. A third batch-check caller would find two conventions.",
      "fix": "Add blob.rs to Owned in a follow-up. Extract one pub(crate) batch-check helper (ids + format → answer lines, `--buffer`, empty short-circuit) and make both parsers use it."
    },
    {
      "file": "crates/gitio/src/ls_remote.rs",
      "line": 33,
      "severity": "should",
      "problem": "The failure wording (`first_line(stderr)` else \"git <verb> failed: <status>\") is copied from fetch.rs:60-61, so the rule for a failed server run now lives in two places. The next server-talking run will copy it a third time.",
      "fix": "When fetch.rs is next owned, have run_without_prompts (or a sibling in fetch.rs) return the `Err` for a non-zero exit too, and use it from both fetch and remote_refs."
    },
    {
      "file": "crates/gitio/src/merge_tree.rs",
      "line": 63,
      "severity": "should",
      "rule_id": "RK52",
      "problem": "[INFERENCE] In a partial clone, merge-tree (reading blobs) and missing_commits' cat-file (absent commits) can lazily fetch from the promisor remote. That network run lacks the no-prompt environment, which breaks AGENTS.md's \"a run that talks to a server is one helper\" and RK52's no-prompt promise.",
      "fix": "Set `GIT_NO_LAZY_FETCH=1` on the merge_tree and missing_commits commands (git 2.45+; older gits ignore it), so an absent object fails as GitFailed instead of fetching."
    }
  ]
}
