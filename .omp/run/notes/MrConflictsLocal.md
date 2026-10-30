# MrConflictsLocal

Agent output (`agent://MrConflictsLocal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsLocal.md), collected 2026-10-30T21:49:55.123Z.

{
  "summary": "New crate `yamt-local-merge` (gitio only). It has the IPC types of design §4.6 and the record `<git dir>/yamt-merge-request.json` (format 1, written to a temp file, synced, renamed). It has `start` (§4.2's 13 steps), `restore` (§4.3 Abort steps 1–3), `find_live`, `local_merge`, `claim_window`/`window_is_open`, `LiveMerge::{view,iid,restore,committed}` and `push`. New `scripts/mr-conflict-repo.sh` builds the fixture repo with a fake GitLab. arch-check gains a local-merge rule and lists local-merge among yamt-app's allowed deps. 46 tests pass; arch-check is ok.",
  "files_changed": [
    "crates/local-merge/Cargo.toml",
    "crates/local-merge/AGENTS.md",
    "crates/local-merge/src/lib.rs",
    "crates/local-merge/src/record.rs",
    "crates/local-merge/src/start.rs",
    "crates/local-merge/src/restore.rs",
    "crates/local-merge/src/push.rs",
    "crates/local-merge/tests/local_merge/main.rs",
    "crates/local-merge/tests/local_merge/common.rs",
    "crates/local-merge/tests/local_merge/refusals.rs",
    "crates/local-merge/tests/local_merge/start.rs",
    "crates/local-merge/tests/local_merge/abort.rs",
    "crates/local-merge/tests/local_merge/locks.rs",
    "crates/local-merge/tests/local_merge/push.rs",
    "scripts/mr-conflict-repo.sh",
    "scripts/arch-check.sh",
    "Cargo.lock"
  ],
  "tests_added": [
    {
      "name": "refusals::{uncommitted_tracked_changes_…, staged_changes_…, another_operation_in_progress_refuses, a_failed_fetch_…, a_branch_that_already_contains_…}",
      "proves": "Rule 4: UncommittedChanges / Busy (rebase edit stop) / FetchFailed(\"fatal: 'nowhere' does not appear to be a git repository\") / AlreadyContains. Each leaves HEAD, refs/heads, status --porcelain=v1 and no record exactly as before."
    },
    {
      "name": "refusals::a_local_branch_with_its_own_commit_is_refused_and_nothing_changes (+ a_local_branch_that_diverged_is_refused_too)",
      "proves": "RK43: an ahead or diverged local branch gives LocalAhead. Nothing changes and the local commit stays."
    },
    {
      "name": "refusals::an_untracked_file_does_not_refuse, a_refused_checkout_changes_nothing_and_leaves_no_record",
      "proves": "An untracked file passes. A checkout git refuses gives GitRefused{git's 'error: … overwritten by checkout', left: []}, nothing changed, no record."
    },
    {
      "name": "start::a_missing_branch_is_created_tracking_gitlab_and_the_merge_stops_with_conflicts, the_record_names_what_abort_needs_…",
      "proves": "Rule 5: branch created at GitLab's tip, @{u} = origin/feature/due-dates, MERGE_HEAD = main, card.ts unmerged. The record JSON matches the contract field for field. find_live view/iid."
    },
    {
      "name": "start::a_branch_only_behind_is_fast_forwarded, a_branch_already_at_gitlabs_tip_is_unchanged_and_may_be_checked_out",
      "proves": "A branch only behind gives MovedFrom{7-char id} with no upstream written. A branch already at GitLab's tip gives Unchanged and return_to None."
    },
    {
      "name": "start::a_stale_has_conflicts_merges_clean_and_still_stops",
      "proves": "conflicts: false, MERGE_HEAD present, no unmerged entry, the record is live"
    },
    {
      "name": "start::an_untracked_file_the_merge_would_overwrite_puts_everything_back",
      "proves": "RK44: the merge refuses after the checkout. restore returns to the detached commit, deletes the created branch and its config, removes the record, and keeps the untracked file."
    },
    {
      "name": "start::the_merge_names_gitlabs_target_as_git_names_…, a_local_branch_named_like_the_remote_target_…",
      "proves": "MERGE_MSG reads 'Merge remote-tracking branch 'origin/main' into …'. A local branch `origin/main` does not change the merged commit (the full ref is used)."
    },
    {
      "name": "abort::{abort_after_a_restart_…, abort_moves_a_fast_forwarded_…, abort_on_the_branch_itself_…, abort_from_a_detached_head_…}",
      "proves": "Rule 7/RK44: a fresh find_live, git's merge abort, then restore → [] and the checkout equals the before snapshot (created branch deleted, branch -f, reset --keep, detached return)."
    },
    {
      "name": "abort::abort_keeps_a_branch_that_moved_after_the_merge_started, abort_leaves_head_where_the_user_moved_it",
      "proves": "RK43: [NotReturned{develop}, BranchKept] with the user's commit kept. HEAD left on main, created branch still deleted."
    },
    {
      "name": "abort::a_refused_return_is_listed_and_the_created_branch_kept, a_refused_move_back_is_listed",
      "proves": "ReturnRefused with git's 'error: Your local changes…' + BranchKept; BranchRefused when reset --keep refuses; the record is removed"
    },
    {
      "name": "locks::a_second_start_while_a_merge_is_in_progress_is_refused, a_start_while_another_holds_the_lock_is_refused",
      "proves": "RK46: a live record gives AlreadyMerging{Some(21)} with the record byte-identical. The lock held by another open handle gives AlreadyMerging{None}, and a start succeeds once it is dropped."
    },
    {
      "name": "locks::local_merge_is_merging_only_while_…, a_stale_record_is_dropped_…, an_unreadable_record_refuses_and_stays_untouched",
      "proves": "Rule 8: Free → Merging{21,false} → Free after a hand abort. A stale record is removed even by a refusing start. Garbage or format 2 gives RecordUnreadable and the file is unchanged; find_live → None."
    },
    {
      "name": "locks::local_merge_names_…_window_is_open, a_second_claim_fails_…, a_claim_waits_…, window_is_open_probe_never_turns_away_a_claim",
      "proves": "Rule 9/RK47: window_open follows a held claim. A second claim is None while the first is held and Some after it drops. The claim retries inside its 1 s. A looping probe thread never makes the claim give up."
    },
    {
      "name": "push::committed_removes_the_record_and_push_sends_only_the_branch",
      "proves": "Rule 6: committed() removes the record. push → Pushed. The bare repo's only changed ref is feature/clean = the merge commit ('Merge remote-tracking branch 'origin/main' …'). The checkout stays on the branch."
    },
    {
      "name": "push::a_rejected_push_leaves_gitlab_and_the_commit",
      "proves": "RK45: Failed{'[rejected] …'}. The bare branch stays at its own commit and the local merge commit is kept."
    },
    {
      "name": "record::tests (6 units) + lib::tests (2 units)",
      "proves": "is_live: the match and each mismatch. Round trip leaves no .tmp. Missing → None; a directory, newer format or garbage → Err. View short ids/return_to. JSON shapes (windowOpen, movedFrom). git_message."
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-local-merge --no-fail-fast",
      "observed": "Summary [   1.241s] 46 tests run: 46 passed, 0 skipped (every named §4.7 test listed PASS, e.g. abort::abort_after_a_restart_returns_to_develop_and_deletes_the_created_branch, locks::window_is_open_probe_never_turns_away_a_claim, push::a_rejected_push_leaves_gitlab_and_the_commit)"
    },
    {
      "command": "cargo clippy -p yamt-local-merge --all-targets -- -D warnings",
      "observed": "Checking yamt-local-merge v0.6.2 … Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.79s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0, no output"
    },
    {
      "command": "scripts/arch-check.sh",
      "observed": "arch-check: ok"
    },
    {
      "command": "scripts/arch-check.sh with yamt-range temporarily added to crates/local-merge/Cargo.toml (reverted afterwards)",
      "observed": "arch-check: yamt-local-merge depends on yamt-gitio only among yamt crates, and never on tauri, not: yamt-merge-core yamt-range / exit 1"
    },
    {
      "command": "bash -n scripts/mr-conflict-repo.sh && scripts/mr-conflict-repo.sh /var/tmp/yamt-mrc-local2",
      "observed": "syntax-ok / mr-conflict-repo: /var/tmp/yamt-mrc-local2 is on develop; GitLab holds main, develop, feature/due-dates, feature/clean and feature/merged. / Open its merge-request page with: / cd /var/tmp/yamt-mrc-local2 && yamt --diff"
    },
    {
      "command": "git -C /var/tmp/yamt-mrc-local2 branch -a; git --git-dir /var/tmp/yamt-mrc-local2/.git/fake-gitlab.git branch; git -C … for-each-ref refs/remotes | wc -l; git -C … remote -v",
      "observed": "* develop / main --- develop / feature/clean / feature/due-dates / feature/merged / * main --- 0 --- origin /var/tmp/yamt-mrc-local2/.git/fake-gitlab.git (fetch) / (push)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 91 mutants tested in 2m: 4 missed, 63 caught, 24 unviable; no TypeScript changes. The first run had 7 missed; the 3 lib.rs/record.rs:102 ones were killed by 2 new tests.",
    "survivors": [
      "crates/local-merge/src/record.rs:133:23 match guard NotFound → true — equivalent: remove() only decides whether a failed removal is logged as a warning; behaviour otherwise identical",
      "crates/local-merge/src/record.rs:133:23 match guard NotFound → false — equivalent: only adds a warning log line for an already-missing record",
      "crates/local-merge/src/record.rs:133:36 == → != — equivalent: same, only which removal failures are logged",
      "crates/local-merge/src/start.rs:209:27 guard name == full → true — equivalent: measured, `rev-parse --verify --symbolic-full-name` of an ambiguous name prints nothing (gitio → None), so after the fetch any Some is the remote-tracking ref"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Tests are one binary, tests/local_merge/{main.rs,common.rs,…}, not tests/common/mod.rs: with several test binaries, helpers unused in one of them warn dead_code, and clippy -D warnings plus allow_attributes=deny then fails.",
    "Step 13 merges `<remote>/<target>`, not `refs/remotes/<remote>/<target>`: git puts the rev as given into its message, and the full ref gave 'refs/remotes/origin/main', not the design's 'origin/main' (§4.2, real-app step 5). The full ref is still used when the short name is ambiguous (start.rs merge_name).",
    "Added Error::LockFailed{path, source} (claim_window's lock open) and #[serde(rename_all = \"camelCase\")] on the LocalMerge::Merging variant, so window_open serializes as windowOpen (specta-macros rc.25 reads variant rename_all).",
    "Decided: any git or io error before the checkout (discover, stop, git_path, opening the start lock, writing the record, a non-UTF-8 branch) is Refusal::GitRefused{message, left: []}. Refusal has no other variant for it.",
    "Decided: at restore, a created branch that is already gone gives no leftover. A created branch still checked out (its return failed or was skipped) is BranchKept, as §4.3's 'not checked out' condition says.",
    "scripts/mr-conflict-repo.sh writes a local user.name/user.email (yamt): git merge --no-commit and the commit need an identity, and the sandbox reads no user config (RK19). The fake GitLab's HEAD is set to main.",
    "Shared file: Cargo.lock gains the yamt-local-merge package entry, written by cargo; the orchestrator commits it.",
    "Docs keeper: architecture §7 and §3 plus PM1 text: 'yamt-local-merge depends on yamt-gitio only among yamt-*, never on tauri'; yamt-app's allowed list gains local-merge. project-map tree.md: a crates/local-merge row (lib/record/start/restore/push as in its AGENTS.md); scripts/mr-conflict-repo.sh row.",
    "Docs keeper: state.md row for the record <git dir>/yamt-merge-request.json, owned by yamt-local-merge. Written by start; removed by start (stale), restore and committed. The locks yamt-merge-request.lock and yamt-merge-window.lock, held by start and WindowClaim, are never removed.",
    "Docs keeper, risk register proving tests: RK43 refusals::a_local_branch_with_its_own_commit…, abort::abort_keeps_a_branch…; RK44 abort::abort_after_a_restart…, start::an_untracked_file_the_merge…; RK45 push::a_rejected_push…; RK46 locks::a_start_while_another…, a_second_start…; RK47 locks::a_second_claim…, window_is_open_probe…",
    "Added tests the brief did not name, to kill mutants or pin behaviour: staged_changes_refuse_too, a_local_branch_that_diverged…, a_refused_checkout…, a_branch_already_at_gitlabs_tip…, the two merge-name tests, a_refused_return…, a_refused_move_back…, abort_on_the_branch_itself…, a_claim_waits…, window_is_open_outside_a_repository_is_false, plus the units.",
    "Self-check: record.rs `hold` repeats crates/range/src/lock.rs `hold` (about 10 lines). local-merge may not depend on range (arch-check), so a shared copy would have to live in gitio, which this slice does not own."
  ],
  "open_risks": [
    {
      "location": "crates/local-merge/src/lib.rs:118-119",
      "risk": "The windowOpen rename relies on specta honouring a variant-level rename_all. A serde unit test pins the JSON, but bindings.ts is exported by the app slice and was not checked here."
    },
    {
      "location": "crates/local-merge/src/restore.rs:72-80",
      "risk": "A created branch still checked out after a failed or skipped return is reported as BranchKept ('changed after the merge started'). The return leftover listed before it explains the real cause, but the window's BranchKept wording is slightly off for this case."
    },
    {
      "location": "crates/local-merge/tests/local_merge/locks.rs:165",
      "risk": "Each window_is_open probe runs two git processes, so the probe holds the lock only briefly. The test proves the claim survives a probing thread but puts little contention on it."
    },
    {
      "location": "crates/local-merge/src/record.rs:128-137",
      "risk": "A failed record removal (permissions) is only logged. The record could then outlive its merge until the next start drops it as stale."
    }
  ]
}
