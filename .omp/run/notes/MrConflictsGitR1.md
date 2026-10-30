# MrConflictsGitR1

Agent output (`agent://MrConflictsGitR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsGitR1.md), collected 2026-10-30T21:47:13.958Z.

{
  "summary": "#1999: `fetch.rs` now has one `pub(crate) run_without_prompts(command, verb, timeout) -> Result<Finished, String>` that refuses prompts, logs the argv, runs with the deadline and keeps the same error wording; `fetch` and `push_branch` only read the finished run, and `refuse_prompts` is now private. #2002: `checkout_branch`, `delete_branch`, `move_branch` and `merge_no_commit` pass `--end-of-options` before the name. #2000/#2001: the fetch test now needs the forced update, and a new test covers a merge that could fast-forward. AGENTS.md shows the new argv.",
  "files_changed": [
    "crates/gitio/src/fetch.rs",
    "crates/gitio/src/push.rs",
    "crates/gitio/src/branch.rs",
    "crates/gitio/tests/branch.rs",
    "crates/gitio/tests/fetch.rs",
    "crates/gitio/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "branch::merge_no_commit_stops_with_merge_head_when_it_could_fast_forward",
      "proves": "on main (an ancestor of local), merge_no_commit(\"local\") succeeds, MERGE_HEAD exists, HEAD unchanged; fails without --no-ff"
    },
    {
      "name": "branch::checkout_branch_reads_a_leading_dash_as_a_branch_name",
      "proves": "checkout_branch(\"-x\") checks out refs/heads/-x; round 1 got 'unknown switch `x''"
    },
    {
      "name": "branch::delete_branch_reads_a_leading_dash_as_a_branch_name",
      "proves": "delete_branch(\"-x\") deletes refs/heads/-x; round 1 got 'unknown switch'"
    },
    {
      "name": "branch::move_branch_reads_a_leading_dash_as_a_branch_name",
      "proves": "git refuses \"-x\" as a branch name ('-x' is not a valid branch name), not as an unknown switch, and the ref stays"
    },
    {
      "name": "branch::merge_no_commit_reads_a_leading_dash_as_a_revision",
      "proves": "merge_no_commit(\"-x\") merges refs/heads/-x: MERGE_HEAD is remote's commit"
    },
    {
      "name": "branch::checkout_branch_at_reads_a_leading_dash_as_a_branch_name",
      "proves": "-B's value \"-x\" is read as a name ('not a valid branch name'), so no --end-of-options is needed there; also passes on round 1"
    },
    {
      "name": "fetch::fetch_branches_writes_only_the_two_remote_tracking_refs (changed)",
      "proves": "refs/remotes/gitlab/remote starts at `local`, not an ancestor of the new head, and ends at head; fails without the `+`"
    }
  ],
  "smoke_evidence": [
    {
      "command": "(scratch copy, round-1 argv: no --end-of-options, no `+`) cargo nextest run -p yamt-gitio --no-fail-fast",
      "observed": "FAIL checkout_branch_reads_a_leading_dash_as_a_branch_name (status 129 \"error: unknown switch `x'\"), FAIL delete_branch_…, FAIL merge_no_commit_reads_a_leading_dash_as_a_revision, FAIL move_branch_…, FAIL fetch_branches_writes_only_the_two_remote_tracking_refs; Summary 191 tests run: 186 passed, 5 failed, 13 skipped"
    },
    {
      "command": "(scratch copy, only --no-ff removed) cargo nextest run -p yamt-gitio --no-fail-fast",
      "observed": "FAIL merge_no_commit_stops_with_merge_head_when_it_could_fast_forward: assertion failed: repo.git_path(\"MERGE_HEAD\").unwrap().exists(); Summary 191 tests run: 190 passed, 1 failed, 13 skipped"
    },
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-gitio (final code, scratch copy)",
      "observed": "Summary [1.633s] 191 tests run: 191 passed, 13 skipped"
    },
    {
      "command": "cargo clippy -p yamt-gitio --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.90s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0, no output"
    },
    {
      "command": "git --version; probe in /tmp: git checkout --quiet --end-of-options -x -- / branch -D --end-of-options -x / branch --force --end-of-options -x HEAD",
      "observed": "git version 2.56.0; checkout exit 0 with HEAD refs/heads/-x; -D exit 0; --force: \"fatal: '-x' is not a valid branch name\" (128). git takes --end-of-options in all four positions, so no method needed the precondition fallback"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (in the scratch copy target/r1/src): Found 7 mutants to test; 7 mutants tested in 35s: 5 caught, 2 unviable",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "My worktree's HEAD (cf43246) lists crates/local-merge as a workspace member, but that crate is not in the tree, so cargo fails when it loads the manifest. As Main agreed, I ran every cargo command and `just mutants HEAD` in a scratch copy under target/r1/src with that member and its dependency line removed. My patch does not change the root Cargo.toml, and I deleted the scratch copy afterwards.",
    "To show each test fails on round 1, I put round 1's argv back into my own branch.rs/fetch.rs for a while (no --end-of-options, no `+`; then no --no-ff), copied them into the scratch copy, ran the tests, and restored them. branch.rs is back to its exact earlier content (same hash #1EBE).",
    "Checked the other runs: checkout_branch_at passes the name as -B's value, which git reads as a name (test added; its doc comment cites gitcli(7)). set_upstream's config key starts with `branch.` and its remote comes from config. reset_keep and is_ancestor take Oids, and both fetches and the push already had --end-of-options. None needed the precondition fallback.",
    "For the docs keeper, files I don't own still show the old argv: docs/plan.md §2 #139 (`merge --no-ff --no-commit`), docs/slices/briefs/mr-conflicts-design.md steps 11/13 and §4.3 (`checkout --quiet <name> --`, `branch --quiet -D <branch>`, `branch --quiet --force <branch> <from>`), and docs/slices/briefs/mr-conflicts-git.md contract doc lines. Each should get `--end-of-options` before the name."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/tests/branch.rs:13",
      "risk": "NOT_A_BRANCH_NAME matches git's C-locale wording \"fatal: '-x' is not a valid branch name\" from git 2.56. A future git could reword it; LC_ALL=C is set, so the locale cannot change it."
    },
    {
      "location": "crates/gitio/src/branch.rs:20",
      "risk": "--end-of-options needs git ≥ 2.24 (checkout with `--` after it was checked on 2.56 only). The crate has no minimum-version check for these runs [INFERENCE: GitVersion may enforce a higher floor elsewhere]."
    }
  ]
}
