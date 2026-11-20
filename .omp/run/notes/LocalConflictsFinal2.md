# LocalConflictsFinal2

Agent output (`agent://LocalConflictsFinal2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsFinal2.md), collected 2026-11-20T09:31:40.996Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (HEAD 26952d8a)",
      "observed": "Ran the whole chain, map-check included, and it exited with EXIT=0 in 75.2 s. The last lines show golden: all 10 cases 'ok' (language-tools-script-setup … vueuse-use-magic-keys). sfc-order ran. hooks-test: 'ℹ tests 18 ℹ pass 18 ℹ fail 0'.",
      "pass": true
    },
    {
      "recipe": "cargo test -p yamt-gitio --test local_check -- --nocapture",
      "observed": "'test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.12s'. The 15 tests include merge_tree_is_clean_for_disjoint_changes_and_conflicts_for_the_same_line, an_untracked_gitattributes_in_the_working_tree_does_not_clean_a_conflict, the_users_attributes_file_does_not_clean_a_conflict, a_gitattributes_committed_in_the_first_commit_still_applies, attr_tree_is_honoured_from_git_2_43 and merge_tree_of_a_partial_clone_fails_on_a_blob_it_lacks_instead_of_fetching_it. EXIT=0.",
      "pass": true
    },
    {
      "recipe": "cargo test -p yamt-merge-requests check::",
      "observed": "'test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 211 filtered out; finished in 0.15s'. The 12 tests include check::tests::a_row_is_sent_only_when_the_merge_changes_its_readiness, after_a_failed_fetch_only_rows_whose_two_commits_are_local_stay, a_failed_merge_comes_back_as_its_error and the_check_stops_on_a_git_older_than_2_38. The other test binaries filtered every test out and ran 0. EXIT=0.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.1, pnpm 12.0.0, Linux 7.3.4-arch1-2 x64. The tree is at 26952d8a, and the only uncommitted change is .omp/run/slices.json, the orchestrator's file. As the brief said, no WebKit or real-app recipe was run. Each command ran once and nothing failed, so no reruns were needed."
}
