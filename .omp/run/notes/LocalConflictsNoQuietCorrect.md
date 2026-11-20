# LocalConflictsNoQuietCorrect

Agent output (`agent://LocalConflictsNoQuietCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsNoQuietCorrect.md), collected 2026-11-20T09:24:02.284Z.

{
  "verdict": "pass",
  "checked": [
    "Read-only, no test run. merge_tree: always plain --write-tree, Access::Write; attributes options kept exactly; exit 0/1 and stderr classification unchanged.",
    "RK52 holds: a_merge_leaves_refs_status_index_and_head_alone (local_check.rs:87) checks refs, status, index hash, HEAD. New objects allowed by plan #150 rule 6 / #197.",
    "2.37/2.38 boundary unit-tested (2.37 false; 2.38, 3.0 true). Stop text unchanged; check still stops before ls-remote/fetch (check.rs:133).",
    "VF7 met. NoQuiet: 9 mutants, 8 caught, 1 unviable, none kept; child test kills require_merge_tree->Ok(()). R1: src change is doc-only, tests/ not mutated.",
    "Deviations accepted: require_merge_tree rename per RS16 (open.rs, start.rs precedent); docs-keeper lines. Open risks accepted: macOS exec-path [INFERENCE]; <2.38 vacuous runs predate this.",
    "R1 fixed: #2567/#2568 doc says 'before 2.43' with man-page/release-note sources (merge_tree.rs:36-39). #2569: attr.tree tests :172/:201 gated on 2.43; attributesFile test :184 not."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/check/tests.rs",
      "line": 297,
      "severity": "should",
      "rule_id": "principles-2",
      "problem": "About 45 Unix-only lines (a shell-script fake git found through `git --exec-path`, PATH replaced, an ignored child test) only check what a GitVersion literal would: the guard's choice and its message; gitio already unit-tests the 2.38 boundary. As the app grows, the next version guard will copy this harness, and Windows goes untested.",
      "fix": "Make `require_merge_tree(version: GitVersion) -> Result<(), String>` (caller passes `repo.version().map_err(..)?`), test it with GitVersion 2.37, and delete git_reporting_2_37, OLD_GIT_TEST and both child tests."
    },
    {
      "file": "crates/gitio/tests/local_check.rs",
      "line": 87,
      "severity": "should",
      "rule_id": "vision-3",
      "problem": "Nothing tests plan #197's rule 'never --quiet': on the CI gits, adding `--quiet` back to merge_tree's args passes every test, because both forms agree on these fixtures. The brief's 'no assertion about objects' removed the one cheap detector. As the app grows, a well-meant re-optimisation can bring back the bug the owner saw.",
      "fix": "Orchestrator's call: in a_merge_leaves_refs_status_index_and_head_alone, assert `count-objects -v` changed (the doc comment's 'leaves the merge's objects unreferenced'), citing plan #197."
    },
    {
      "file": ".omp/skills/risk-register/SKILL.md",
      "line": 66,
      "severity": "should",
      "rule_id": "RK52",
      "problem": "RK52's detector still names `a_quiet_merge_writes_no_object_and_leaves_refs_index_and_worktree_alone`, which this patch renamed, and the implementer did not list it for the docs keeper. As the app grows, a reader following the register finds no RK52 detector (same kind as the RK58/RK59 wrong-name findings).",
      "fix": "Docs keeper: replace it with `a_merge_leaves_refs_status_index_and_head_alone`."
    }
  ]
}
