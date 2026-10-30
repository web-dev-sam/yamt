# MrConflictsGit

Agent output (`agent://MrConflictsGit`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsGit.md), collected 2026-10-30T21:29:49.331Z.

{
  "summary": "yamt-gitio now has the git commands a merge in the user's own checkout needs, public on `Repo`. repo.rs: `git_path` now public, `is_ancestor`, `has_tracked_changes`. fetch.rs: `fetch_branches`. New branch.rs: `checkout_branch_at`, `checkout_branch`, `set_upstream`, `delete_branch`, `move_branch`, `reset_keep`, `merge_no_commit`. New push.rs: `push_branch`, `PUSH_TIMEOUT`, two pure output readers. Fetches and push share one no-prompt helper, `refuse_prompts`. lib.rs and AGENTS.md updated.",
  "files_changed": [
    "crates/gitio/src/repo.rs",
    "crates/gitio/src/fetch.rs",
    "crates/gitio/src/lib.rs",
    "crates/gitio/src/branch.rs",
    "crates/gitio/src/push.rs",
    "crates/gitio/tests/branch.rs",
    "crates/gitio/tests/push.rs",
    "crates/gitio/tests/fetch.rs",
    "crates/gitio/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "fetch::fetch_branches_writes_only_the_two_remote_tracking_refs",
      "proves": "Remote has a configured +refs/heads/* refspec and a third branch: for-each-ref after = before + exactly gitlab/main and gitlab/remote (a forced update), and no FETCH_HEAD"
    },
    {
      "name": "fetch::fetch_branches_never_prompts",
      "proves": "the recorded upload-pack env holds GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=never, SSH_ASKPASS_REQUIRE=force, SSH_ASKPASS=false, LC_ALL=C"
    },
    {
      "name": "branch::checkout_branch_at_creates_fast_forwards_and_keeps_upstream",
      "proves": "-B creates the branch at a commit and checks it out, set_upstream writes remote/merge, a second -B fast-forwards and the branch.* config survives"
    },
    {
      "name": "branch::branch_force_keeps_the_upstream_config",
      "proves": "Measured: git branch --force keeps branch.<b>.remote/merge, so design §4.3's [INFERENCE] holds"
    },
    {
      "name": "branch::delete_and_move_refuse_a_branch_checked_out_in_another_worktree",
      "proves": "both return GitFailed and the branch does not move"
    },
    {
      "name": "branch::delete_branch_removes_the_branch_and_its_config",
      "proves": "-D removes the ref and its branch.* config"
    },
    {
      "name": "branch::checkout_branch_switches_head_and_the_worktree_to_the_branch",
      "proves": "checkout_branch moves HEAD and rewrites the worktree"
    },
    {
      "name": "branch::reset_keep_moves_the_checked_out_branch_and_refuses_a_change_in_the_way",
      "proves": "--keep moves the branch, refuses when a local change is in the way, and keeps that change"
    },
    {
      "name": "branch::is_ancestor_answers_both_ways_and_fails_on_an_unknown_commit",
      "proves": "true, false, and GitFailed{status 128} for an unknown commit"
    },
    {
      "name": "branch::has_tracked_changes_ignores_untracked_files_and_sees_staged_unstaged_and_unmerged",
      "proves": "untracked → false; unstaged, staged and unmerged → true"
    },
    {
      "name": "branch::merge_no_commit_stops_with_merge_head_on_conflicts_and_on_a_clean_merge",
      "proves": "conflict: not succeeded, 3 unmerged stages, MERGE_HEAD present; clean: succeeded, MERGE_HEAD present; HEAD unchanged in both"
    },
    {
      "name": "push::a_rejected_push_names_the_ref_and_reason / a_push_never_forces",
      "proves": "Err \"[rejected] (fetch first)\" and \"[rejected] (non-fast-forward)\"; the remote's main unchanged even with remote.origin.push=+refs/heads/main:refs/heads/main set"
    },
    {
      "name": "push::a_push_to_a_missing_remote_gives_gits_fatal_line",
      "proves": "Err \"fatal: 'nowhere' does not appear to be a git repository\""
    },
    {
      "name": "push: a_fast_forward_push_sends_only_the_branch_and_no_tag, the_push_runs_with_no_prompt…, a_push_that_gets_no_answer…",
      "proves": "Ok and only refs/heads/main on the remote (followTags=true and an annotated tag are ignored); the no-prompt env; the timeout message"
    },
    {
      "name": "push::tests (4 unit tests of rejection and failure_line)",
      "proves": "Pure porcelain and stderr readers: `!` line → summary + reason; ` ` and `=` lines → no rejection; another ref's `!` is ignored; first fatal:/error: line"
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-gitio",
      "observed": "Summary [   1.596s] 185 tests run: 185 passed, 13 skipped (every named acceptance test listed PASS, e.g. yamt-gitio::branch merge_no_commit_stops_with_merge_head_on_conflicts_and_on_a_clean_merge)"
    },
    {
      "command": "cargo clippy -p yamt-gitio --all-targets -- -D warnings",
      "observed": "Checking yamt-gitio v0.6.2 … Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.48s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0, no output"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 28 mutants tested in 2m: 26 caught, 2 unviable; no TypeScript changes",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Added tests the brief did not name, to kill mutants and pin behaviour: checkout_branch_switches_head…, delete_branch_removes_the_branch_and_its_config, reset_keep_moves…, a_fast_forward_push_sends_only_the_branch_and_no_tag, the_push_runs_with_no_prompt…, a_push_that_gets_no_answer_fails_at_its_deadline, and the 4 push.rs unit tests.",
    "tests/fetch.rs: I moved the existing no-prompt test's env recording and its check into two helpers, `recording_fetch_environment` and `assert_no_prompt_in`, which `fetch_branches_never_prompts` also uses. I also added a `bare` field to Fixture.",
    "fetch.rs: `fetch_without_refs` and `fetch_branches` both call one private `Repo::fetch`; behaviour is unchanged (#132, RK40). The no-prompt helper is named `refuse_prompts`.",
    "push_branch checks the porcelain `!` line before the exit status, so a rejected ref is reported even if git exited 0.",
    "Docs keeper, architecture §3.2 `impl Repo`: add rows for git_path (pub), is_ancestor, has_tracked_changes, fetch_branches, checkout_branch_at, checkout_branch, set_upstream, delete_branch, move_branch, reset_keep, merge_no_commit and push_branch with PUSH_TIMEOUT, each with its git command as in crates/gitio/AGENTS.md line 11.",
    "Docs keeper, project-map tree.md line 11 (crates/gitio): add branch (checkout -B, checkout, config branch.*, branch -D/--force, reset --keep, merge --no-ff --no-commit) and push (push --porcelain, PUSH_TIMEOUT); fetch gains fetch_branches and refuse_prompts.",
    "Docs keeper, risk register: RK40's owner adds `fetch_branches`, which writes only refs/remotes/<remote>/<b>. RK45 (design) owner: gitio push_branch, pinned by a_push_never_forces and a_rejected_push_names_the_ref_and_reason."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/src/push.rs:45-46",
      "risk": "No test reaches the 'git push failed: <status>' fallback: git always printed a fatal: line in my attempts. cargo-mutants made no mutant there."
    },
    {
      "location": "crates/gitio/src/branch.rs:10-13",
      "risk": "checkout -B has no `--end-of-options`, matching the contract's exact argv; a branch name starting with '-' would be read as an option. Callers must pass names git accepts as branches."
    }
  ]
}
