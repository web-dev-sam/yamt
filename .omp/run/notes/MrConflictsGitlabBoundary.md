# MrConflictsGitlabBoundary

Agent output (`agent://MrConflictsGitlabBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsGitlabBoundary.md), collected 2026-10-30T21:43:56.308Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 26 changed files are inside Owned. No Cargo edge was added (PM1), and no new state needs a state.md row.",
    "Contract: the new types, the three row fields and prepare_resolve's signature match the brief; the page.rs fold matches the table, conflicts first (lib.rs:114-192, page.rs:289-350).",
    "prepare_resolve order matches the brief (resolve.rs:37-66). The `:` rule and OPENED have one copy (open.rs require_branch_name); is_from_fork is shared with page.rs.",
    "Deviations accepted: list.rs on logged_in_project keeps the removed match's mapping, so one auth fold serves three callers; merge_request_args has two users; the iid-33 file is in README; ResolveTarget derives as RangeToOpen.",
    "Docs: AGENTS.md covers the types, fold, queries and prepare_resolve; plan rows #138/#139 exist; the arch/tree/RK40 edits are listed for the docs keeper; comments cite sources (CP1).",
    "TS: fixture rows follow the brief's cycle (readiness by index%8, draft appended, fork at 1, no size at index%5==4); both test row literals gained the fields; no new export or import edge (TS8/TS16)."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/page.rs",
      "line": 311,
      "severity": "should",
      "rule_id": "RS16",
      "problem": "`merge_status(status) -> Readiness` is named for its input, not for what it returns, unlike its neighbours `ci_status -> CiStatus` and `blocked_reason -> BlockedReason`. A reader expects a MergeStatus value, so the name grows more confusing as more GitLab folds land in page.rs.",
      "fix": "Rename it `status_readiness` (and its call in `readiness`) so the name says it returns the status's Readiness."
    },
    {
      "file": "crates/merge-requests/tests/resolve.rs",
      "line": 28,
      "severity": "nit",
      "problem": "`Setup::new` copies the eight lines from tests/open.rs:34-46 that build scripts/range-repo.sh's repository at `rr`. A third integration test would make a third copy; nothing else gets harder.",
      "fix": "Move a `range_repo() -> TempDir` builder (with `rr` as one const) into the shared tests/fake_glab/mod.rs, and call it from both Setups."
    }
  ]
}
