# MrConflictsLocalR1

Agent output (`agent://MrConflictsLocalR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsLocalR1.md), collected 2026-10-30T22:00:14.901Z.

{
  "summary": "Three fixes. #2010: `merged` now aborts a merge that git stopped on another commit (stop has an operation but is not live) before the restore runs. #2011: a test with `core.warnAmbiguousRefs=false` kills the guard mutant at start.rs:212 (it was line 209). #2012: new `Leftover::BranchCheckedOut { branch }`. `delete_created`/`move_back` now return `Result<Option<Leftover>>`, and the refused-return test is pinned to `[ReturnRefused, BranchCheckedOut]`.",
  "files_changed": [
    "crates/local-merge/src/start.rs",
    "crates/local-merge/src/restore.rs",
    "crates/local-merge/src/lib.rs",
    "crates/local-merge/tests/local_merge/start.rs",
    "crates/local-merge/tests/local_merge/abort.rs"
  ],
  "tests_added": [
    {
      "name": "start::a_target_moved_between_the_fetch_and_the_merge_puts_everything_back",
      "proves": "A post-checkout hook moves refs/remotes/origin/main to develop. start refuses with left=[], the checkout (HEAD, refs/heads, status, record) is unchanged, and MERGE_HEAD is gone."
    },
    {
      "name": "start::a_local_branch_named_like_the_remote_target_does_not_change_what_is_merged_without_ambiguity_warnings",
      "proves": "With core.warnAmbiguousRefs=false and a local branch origin/main, MERGE_HEAD is GitLab's main. This kills the `if true` guard mutant in merge_name."
    },
    {
      "name": "abort::a_refused_return_is_listed_and_the_created_branch_kept_checked_out (renamed from …_created_branch_kept)",
      "proves": "A refused return lists [ReturnRefused, BranchCheckedOut] and no longer BranchKept."
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-local-merge --no-fail-fast",
      "observed": "Summary [   1.242s] 48 tests run: 48 passed, 0 skipped"
    },
    {
      "command": "same nextest with round-1 behaviour edited back in temporarily: no abort in merged, BranchKept for checked out, merge_name guard `if true` (all three reverted afterwards)",
      "observed": "48 tests run: 45 passed, 3 failed. a_refused_return_…_kept_checked_out panicked abort.rs:139. …without_ambiguity_warnings: unwrap on Err GitRefused { message: \"Auto-merging src/board/card.ts\", left: [ReturnRefused {… \"error: you need to resolve your current index first\" }, BranchKept {…}] }. a_target_moved_…: left: [ReturnRefused …, BranchKept …] right: []"
    },
    {
      "command": "cargo clippy -p yamt-local-merge --all-targets -- -D warnings",
      "observed": "Checking yamt-local-merge v0.6.2 … Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.78s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0 (fmt-ok)"
    },
    {
      "command": "scripts/arch-check.sh",
      "observed": "arch-check: ok"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 9 mutants to test … 9 mutants tested in 18s: 5 caught, 4 unviable"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 9 mutants tested in 18s: 5 caught, 4 unviable",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Item 2: the new test passes on round 1's real code, because the guard itself was right. What it catches is round 1's kept survivor (merge_name guard → `true`). I checked by applying that mutant by hand: the test fails. `just mutants HEAD` does not cover the guard line because it is unchanged, and the bash-guard hook refuses a narrower cargo-mutants run.",
    "Item 3: the NotReturned + BranchCheckedOut case cannot be reached without a race. NotReturned means HEAD is not on the branch at record.head, so the branch is either not checked out (it gets deleted) or has moved (BranchKept). A start whose returnTo is the branch itself never records Created. So no test for that pair.",
    "restore.rs: delete_created and move_back now return `Result<Option<Leftover>>` instead of a bool, so each case names its own leftover."
  ],
  "open_risks": [
    {
      "location": "crates/local-merge/src/start.rs:196",
      "risk": "The refusal message for an aborted merge of another commit is git merge's first output line (e.g. \"Auto-merging src/board/card.ts\"), which does not explain why. Round 1 already did this; out of scope."
    },
    {
      "location": "crates/local-merge/src/lib.rs:108",
      "risk": "The new Leftover variant changes the generated bindings. The app/frontend leftovers notice needs a `branchCheckedOut` case. Not my files: MrConflictsApp has been told."
    }
  ]
}
