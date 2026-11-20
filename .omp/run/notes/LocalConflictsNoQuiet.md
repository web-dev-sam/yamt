# LocalConflictsNoQuiet

Agent output (`agent://LocalConflictsNoQuiet`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsNoQuiet.md), collected 2026-11-20T09:19:31.174Z.

{
  "summary": "The local conflict check always runs the plain `git merge-tree --write-tree` and never passes `--quiet`. `MergeTreeRun` is gone; `merge_tree_supported(GitVersion)` (true from 2.38) replaces it, and `Repo::merge_tree(first, second, timeout)` runs with write access. In `check.rs` the version check `require_merge_tree` returns `Result<(), String>` and `merge_and_send` lost its run-kind parameter. The `local_check` tests run once each. A child-process test with a fake git reporting 2.37 pins the stop message.",
  "files_changed": [
    "crates/gitio/src/merge_tree.rs",
    "crates/gitio/src/lib.rs",
    "crates/gitio/tests/local_check.rs",
    "crates/gitio/AGENTS.md",
    "crates/merge-requests/src/check.rs",
    "crates/merge-requests/src/check/tests.rs"
  ],
  "tests_added": [
    {
      "name": "merge_tree::tests::git_before_2_38_cannot_merge_without_a_worktree / git_2_38_and_later_can_merge_without_a_worktree",
      "proves": "merge_tree_supported: 2.37 and 1.99 give false; 2.38 and 3.0 give true"
    },
    {
      "name": "local_check::a_merge_leaves_refs_status_index_and_head_alone",
      "proves": "the plain-form merge of a same-line conflict gives Conflicts and leaves refs, status, index and HEAD unchanged (replaces the quiet object test)"
    },
    {
      "name": "check::tests::the_check_stops_on_a_git_older_than_2_38 (+ ignored child a_git_reporting_2_37_cannot_merge_without_a_checkout)",
      "proves": "with a git on PATH that reports 2.37.1, require_merge_tree gives Err(\"git 2.37 cannot merge without a checkout (needs 2.38)\"); kills the require_merge_tree -> Ok(()) mutant"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-gitio -p yamt-merge-requests",
      "observed": "every test binary ok, e.g. 'test result: ok. 222 passed; 0 failed'; local_check: 'test result: ok. 15 passed; 0 failed' (git 2.56.1)"
    },
    {
      "command": "cargo test -p yamt-gitio --test local_check",
      "observed": "test merge_tree_is_clean_for_disjoint_changes_and_conflicts_for_the_same_line ... ok; test a_merge_leaves_refs_status_index_and_head_alone ... ok; test a_merge_past_its_deadline_is_a_timeout ... ok; test merge_tree_of_a_partial_clone_fails_on_a_blob_it_lacks_instead_of_fetching_it ... ok; attribute tests ok"
    },
    {
      "command": "cargo clippy -p yamt-gitio -p yamt-merge-requests --all-targets; cargo fmt --check -p yamt-gitio -p yamt-merge-requests",
      "observed": "Finished, no warnings or errors; fmt printed nothing"
    },
    {
      "command": "rg -n 'MergeTreeRun|--quiet' crates/gitio/src/merge_tree.rs crates/merge-requests/src",
      "observed": "crates/gitio/src/merge_tree.rs:35:    /// No `--quiet`: git 2.50.1 exited 0 on a content conflict the plain form reports (brief local-conflicts-no-quiet). (only hit)"
    },
    {
      "command": "cargo test -p yamt-merge-requests --lib check::",
      "observed": "test check::tests::the_check_stops_on_a_git_older_than_2_38 ... ok; test result: ok. 12 passed; 0 failed; 1 ignored"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 9 mutants tested in 72s: 8 caught, 1 unviable (the first run missed check.rs:156 require_merge_tree -> Ok(()); a new test kills it)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "check.rs: the version check is named `require_merge_tree`, not kept as `merge_tree_run`, because RS16 names a guard-only call `require_*`.",
    "check/tests.rs: added a test even though the brief only allowed edits there if it named removed items; it kills the require_merge_tree -> Ok(()) survivor (fake git on PATH reporting 2.37.1, child process).",
    "Docs keeper: docs/architecture.md:302 -> `pub fn merge_tree(&self, first: &Oid, second: &Oid, timeout: Duration) -> Result<MergeOutcome>; // merge-tree --write-tree (never --quiet: git 2.50.1 answered clean for a real conflict): ...; Access::Write, leaves unreferenced objects; no index, worktree or ref; no lazy fetch`",
    "Docs keeper: docs/architecture.md:321 -> `pub fn merge_tree_supported(version: GitVersion) -> bool; // --write-tree exists from 2.38 (FIRST_WITH_WRITE_TREE)`; :984 -> ``merge_tree_supported` (false -> stop, \"git X.Y cannot merge without a checkout (needs 2.38)\")`",
    "Docs keeper: .omp/skills/project-map/tree.md:27 -> ``merge_tree.rs` (`merge_tree` -> `MergeOutcome` Clean | Conflicts, `merge_tree_supported`: merge-tree --write-tree, never --quiet,`; crates/merge-requests/AGENTS.md:1 -> ``Repo::version` -> `merge_tree_supported` (false -> stop)`"
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/check/tests.rs:297",
      "risk": "The fake git finds the real binary at `$(git --exec-path)/git`; true on Arch and in standard installs, not checked on macOS."
    },
    {
      "location": "crates/gitio/tests/local_check.rs:47",
      "risk": "On git older than 2.38 the merge_tree tests return early without testing anything, as before."
    }
  ]
}
