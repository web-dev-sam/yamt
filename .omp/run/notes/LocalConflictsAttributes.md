# LocalConflictsAttributes

Agent output (`agent://LocalConflictsAttributes`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsAttributes.md), collected 2026-11-20T08:57:50.572Z.

{
  "summary": "The local merge in Repo::merge_tree now reads attributes only from first's tree. It runs with -c attr.tree=<first>, -c core.attributesFile= and GIT_ATTR_NOSYSTEM=1, so a merge=union line in the working tree or the user's attributes file can no longer hide a real conflict. A .gitattributes committed in the target commit still applies. Three new tests in tests/local_check.rs cover this.",
  "files_changed": [
    "crates/gitio/src/merge_tree.rs",
    "crates/gitio/tests/local_check.rs"
  ],
  "tests_added": [
    {
      "name": "an_untracked_gitattributes_in_the_working_tree_does_not_clean_a_conflict",
      "proves": "An untracked 'a.txt merge=union' in the working tree leaves the same-line merge Conflicts on every supported run. Without the fix it gave [Clean, Clean]."
    },
    {
      "name": "the_users_attributes_file_does_not_clean_a_conflict",
      "proves": "core.attributesFile set in the repository's config to a file holding 'a.txt merge=union' is overridden, so the merge stays Conflicts. Without the fix it gave [Clean, Clean]."
    },
    {
      "name": "a_gitattributes_committed_in_the_first_commit_still_applies",
      "proves": "A union .gitattributes committed on first, with the checkout moved to remote (so the working tree lacks the file), makes the merge Clean. Without the fix it gave [Conflicts, Conflicts], so attributes really come from first's tree."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-gitio --test local_check   (with the fix)",
      "observed": "test an_untracked_gitattributes_in_the_working_tree_does_not_clean_a_conflict ... ok / test the_users_attributes_file_does_not_clean_a_conflict ... ok / test a_gitattributes_committed_in_the_first_commit_still_applies ... ok / test result: ok. 14 passed; 0 failed"
    },
    {
      "command": "cargo test -p yamt-gitio --test local_check   (fix temporarily removed: leading = [MERGE_TREE], no GIT_ATTR_NOSYSTEM; then restored)",
      "observed": "all three new tests FAILED; outcomes [Clean, Clean], [Clean, Clean], [Conflicts, Conflicts]; test result: FAILED. 11 passed; 3 failed"
    },
    {
      "command": "cargo test -p yamt-gitio",
      "observed": "every suite 'test result: ok', 0 failed (lib 64 passed, local_check 14 passed)"
    },
    {
      "command": "cargo clippy -p yamt-gitio --all-targets",
      "observed": "Checking yamt-gitio v0.7.1 ... Finished `dev` profile, no warnings"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 1 mutant to test; 1 mutant tested in 12s: 1 unviable (merge_tree -> Ok(Default::default()), MergeOutcome has no Default); 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The user's attributes file is set through the repository's own config (core.attributesFile), not GIT_CONFIG_GLOBAL, because gitio's Repo commands do not isolate global config (only the conflict-repo fixture's own git calls do). The brief gives this route as the fallback.",
    "GIT_ATTR_NOSYSTEM=1 has no test: a test cannot write the system gitattributes file. No mutant touches that line."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/tests/local_check.rs:167",
      "risk": "On git 2.38–2.41 (no attr.tree) the working-tree and committed-attributes tests would fail, since those git versions keep today's behaviour. That matches the brief's non-goal, but no version gate skips them."
    },
    {
      "location": "crates/gitio/tests/local_check.rs:154",
      "risk": "When supported_runs is empty (git before 2.38) the new tests pass without checking anything, like the existing merge tests. clippy rejected an assert!(!is_empty()) guard, so it was dropped."
    }
  ]
}
