# LocalConflictsNoQuietBoundary

Agent output (`agent://LocalConflictsNoQuietBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsNoQuietBoundary.md), collected 2026-11-20T09:22:48.845Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: only Owned files touched. merge-requests reaches git only via gitio's `merge_tree_supported`/`merge_tree` (PM1). `MergeTreeRun`, `FIRST_WITH_QUIET` and the run kind are fully removed, no shim. Matches plan §2 #197.",
    "`require_merge_tree` rename accepted (RS16 names a guard-only call `require_*`; brief text kept). Stale `MergeTreeRun` docs (architecture 302/321/984, tree.md:27, merge-requests AGENTS.md) are in the docs-keeper deviations.",
    "#2567/#2568/#2569 fixed in fa441ab7: doc says 2.43 and cites gitattributes(5), git(1), 2.43.0 notes; the two attr.tree tests are gated on 2.43; core.attributesFile test is gated only on 2.38.",
    "Comments: merge_tree.rs:35 states the no-`--quiet` fact and cites the brief (CP1). The stderr comment drops 'both forms', right with one form left. No narration or TODO.",
    "[INFERENCE] git's Makefile installs `git` into exec-path, so the fake's real git should exist on macOS-15 CI. RS15 resolves git once in discover, so the child's PATH reaches the fake. Nothing was run.",
    "Growth: merge_tree.rs keeps one job and one builder; check.rs gains no job or state. The hard-coded '2.38' message copies FIRST_WITH_WRITE_TREE, but it predates these commits and the brief required it, so not reported."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/check/tests.rs",
      "line": 297,
      "severity": "should",
      "problem": "About 45 unix-only lines (shell-script git, `--exec-path`, PATH-only child) test a two-line gate and a message. The rest is PATH resolution and version parsing, which gitio already pins. Windows never runs it. Every future version gate will copy this third executable-script writer (after glab.rs `Fake` and `install_hook`).",
      "fix": "Make it `require_merge_tree(version: GitVersion)`, called as `require_merge_tree(repo.version().map_err(..)?)?` in `decided_rows`. Replace the 3 cfg(unix) items with a unit test on GitVersion 2.37; it kills the same mutant on every OS.",
      "rule_id": "principles §2"
    },
    {
      "file": ".omp/skills/risk-register/SKILL.md",
      "line": 66,
      "severity": "should",
      "problem": "RK52's detector column still names `a_quiet_merge_writes_no_object_and_leaves_refs_index_and_worktree_alone`, which this patch renamed. The docs-keeper list leaves the row out and no script checks detector names, so the risk points at a missing test (vision 3).",
      "fix": "Add a docs-keeper line changing the RK52 detector to `a_merge_leaves_refs_status_index_and_head_alone`.",
      "rule_id": "RK52"
    },
    {
      "file": "crates/gitio/tests/local_check.rs",
      "line": 160,
      "severity": "nit",
      "problem": "`attr_tree_is_honoured_from_git_2_43` tests a test-only helper against a constant declared ten lines above, pinning test scaffolding rather than behaviour. Nothing gets harder if it stays.",
      "fix": "Delete the test; the helper's doc and `FIRST_WITH_ATTR_TREE` already state the version."
    },
    {
      "file": "crates/gitio/AGENTS.md",
      "line": 13,
      "severity": "nit",
      "problem": "The paragraph calls it 'the no-object option' instead of `--quiet`, so searching for `--quiet` misses the rule that forbids it. Nothing else gets harder.",
      "fix": "Write 'never with `--quiet`, which git 2.50.1 was measured answering clean for a real conflict'."
    }
  ]
}
