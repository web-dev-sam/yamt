# MrConflictsGitCorrectness

Agent output (`agent://MrConflictsGitCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsGitCorrectness.md), collected 2026-10-30T21:33:00.422Z.

{
  "verdict": "fail",
  "checked": [
    "RK40: fetch_without_refs behaves as before. FETCH has the same 8 flags under a new name, it shares one private `fetch` body (same errors) with fetch_branches, and refuse_prompts is the only copy of the env (fetch.rs:72-83).",
    "Push: rejection() is checked before the exit status and matches only the 3-field line for our refspec. An exact-string assert in a_rejected_push_names_the_ref_and_reason catches the stderr 'To …'/'error:' line being shown instead. Accepted.",
    "a_push_never_forces fails with `+` or `--force`; --no-follow-tags and a refspec-less push are caught by the followTags/`unpushed` test; RK15: the deadline test asserts elapsed < HANG; RK19: git_ok sets init.defaultBranch=main.",
    "is_ancestor 0/1/128 pinned; untracked/unstaged/staged-only/unmerged pinned; -B keeps branch.* config and branch --force too (measured); delete/move refusal under a worktree pinned; reset --keep pinned.",
    "Open risks: the push.rs:45-46 fallback is accepted (only when git exits without a fatal:/error: line; the pure readers are unit-tested). The flagged -B is moot: `-B` takes its value even if it starts with '-'.",
    "Mutation: 28 mutants, 26 caught, 2 unviable, no survivors kept, so no VF7 reasons to check. cargo-mutants does not mutate string literals, so argv flags are only checked by the tests read above."
  ],
  "findings": [
    {
      "file": "crates/gitio/tests/fetch.rs",
      "line": 197,
      "severity": "block",
      "rule_id": "RK40",
      "problem": "refs/remotes/gitlab/* does not exist before the fetch (`expected` pushes both refs onto `before`), so the test passes if `+` is removed from fetch.rs:47, and the notes' 'a forced update' is not true. GitLab users routinely rebase an MR source onto an existing origin/<b>; without `+` design step 6 then fails.",
      "fix": "Before fetching, point refs/remotes/gitlab/remote at a commit that is not an ancestor of the bare's new `remote` head (e.g. the `local` commit). Expect it replaced by `head`."
    },
    {
      "file": "crates/gitio/tests/branch.rs",
      "line": 239,
      "severity": "should",
      "problem": "Both merges are between diverged branches, so the test passes without `--no-ff`. When HEAD is an ancestor of `rev` (a stale MR not refused by design step 9), the merge fast-forwards with no MERGE_HEAD. local-merge relies on that merge state but nothing pins it.",
      "fix": "Add a case: checkout_branch(\"main\") then merge_no_commit(\"local\"). Assert succeeded, MERGE_HEAD present and HEAD still main's commit."
    },
    {
      "file": "crates/gitio/src/branch.rs",
      "line": 17,
      "severity": "should",
      "rule_id": "RK15",
      "problem": "checkout_branch, delete_branch (-D is a flag), move_branch and merge_no_commit pass the name in a position where git parses a leading '-' as an option. Unlike fetch_branches' ':' precondition, this one is not documented, so MrConflictsLocal has no prompt to refuse such a GitLab name.",
      "fix": "State 'no name starts with '-'' as a documented caller-checked precondition on these four methods and in AGENTS.md. List it for the docs keeper and MrConflictsLocal's refusals, as was done for ':'."
    }
  ]
}
