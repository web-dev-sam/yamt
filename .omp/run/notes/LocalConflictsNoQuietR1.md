# LocalConflictsNoQuietR1

Agent output (`agent://LocalConflictsNoQuietR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsNoQuietR1.md), collected 2026-11-20T09:26:42.449Z.

{
  "summary": "`require_merge_tree` now takes a `GitVersion`. `decided_rows` passes it `repo.version().map_err(|error| error.to_string())?`, and the error text is unchanged. The fake-git script, the `--exec-path` lookup, the PATH-only child and both child tests are gone. A plain unit test on every OS checks that 2.37 gives the exact message and 2.38 gives Ok. `a_merge_leaves_refs_status_index_and_head_alone` now also asserts that `git count-objects -v` changes, so it catches a re-added `--quiet` (plan §2 #197).",
  "files_changed": [
    "crates/merge-requests/src/check.rs",
    "crates/merge-requests/src/check/tests.rs",
    "crates/gitio/tests/local_check.rs"
  ],
  "tests_added": [
    {
      "name": "check::tests::the_check_stops_on_a_git_older_than_2_38 (rewritten as a pure unit test)",
      "proves": "GitVersion 2.37 → Err(\"git 2.37 cannot merge without a checkout (needs 2.38)\"); 2.38 → Ok(()). Runs on every OS."
    },
    {
      "name": "a_merge_leaves_refs_status_index_and_head_alone (extended)",
      "proves": "merge_tree writes the merge's objects (count-objects -v changes), which only the plain form does. Fails when --quiet is re-added (plan §2 #197)."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-gitio -p yamt-merge-requests",
      "observed": "every `test result: ok.` and no failures; check unit tests: `223 passed; 0 failed`, local_check: `15 passed; 0 failed`"
    },
    {
      "command": "cargo clippy -p yamt-gitio -p yamt-merge-requests --all-targets",
      "observed": "`Checking yamt-merge-requests v0.7.1 ... Finished dev profile` and no warnings"
    },
    {
      "command": "scratch copy under target/quiet-probe with merge_tree.rs args changed to `\"--write-tree\", \"--quiet\",`; cargo test -p yamt-gitio --test local_check (git 2.56.1)",
      "observed": "`test a_merge_leaves_refs_status_index_and_head_alone ... FAILED` / panicked at crates/gitio/tests/local_check.rs:103:5: assertion `left != right` failed, left and right both \"count: 9\\nsize: 36\\nin-pack: 0...\" / `test result: FAILED. 14 passed; 1 failed`. The copy was deleted afterwards."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 2 mutants to test; 2 mutants tested in 34s: 2 caught; no TypeScript changes",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "I ran the temporary --quiet check in a throwaway copy of the workspace under target/quiet-probe (since deleted), not by editing crates/gitio/src/merge_tree.rs in place: that file is outside Owned and the ownership hook blocks it. The test code, git and logic were the same."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/tests/local_check.rs:103",
      "risk": "The detector relies on `--quiet` writing no loose objects, which held on git 2.56.1. If some future git's `--quiet` started writing objects, the check would no longer catch a re-added `--quiet`."
    }
  ]
}
