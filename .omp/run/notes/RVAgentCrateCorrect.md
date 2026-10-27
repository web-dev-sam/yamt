**Verdict: fail.** I found 3 blocking and 5 should findings.

1. **The worst problem is outside this crate's own code.** If yamt starts with an absolute `GIT_DIR` in its environment, `prepare` deletes the user's own branches, moves their HEAD and removes their `origin`. I confirmed the git behaviour behind this with plain git in /tmp.
2. **Four of the 10 survivors are a real gap.** No test covers `discard` failing, which the close question (#111) relies on.
3. **The sweep's lock can wrongly refuse another window.** While the sweep checks another pair, a window starting on that pair is refused with "another yamt window shows a..b".

The rest holds up when traced by hand. The agent is reaped before every removal, `end` and the sweep remove only a clean checkout, and leftovers from a crash mid-prepare or mid-remove are cleaned. The rename is atomic, and a held pair is left alone.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "RK15",
      "file": "crates/gitio/src/checkout.rs",
      "line": 69,
      "problem": "gitio's `git_command` keeps an inherited `GIT_DIR`, so when yamt runs with an absolute one (a linked worktree's hook, `git --git-dir=/abs …` running a script), `Workspace::prepare` runs `delete_branches_detaching_head`, `remote remove origin` and `checkout --detach` against the user's repository. That deletes their branches, removes their origin and moves their HEAD and index. `look` then also reads the user's index. Measured in /tmp: with `GIT_DIR=/tmp/gdprobe/src/.git` exported, `git clone --shared --no-checkout` still made `partial/.git`, `rev-parse --show-toplevel` in the partial answered the partial (so `discover` and `own_repo` both accept it), and `for-each-ref refs/heads` listed the source's `keep` and `main`. A relative `GIT_DIR=.git` (what a plain `git --git-dir=.git` alias exports, also measured) is harmless. This is the first gitio caller that runs git in a second repository, and the agent process inherits the same variables, so its own `git commit` would land in the user's repository [INFERENCE]",
      "fix": "Remove `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_COMMON_DIR`, `GIT_OBJECT_DIRECTORY` and `GIT_ALTERNATE_OBJECT_DIRECTORIES` from every command run on the clone (`clone_shared_into`'s own `Repo::discover(&into)` included) and from the agent's environment. Add an agent test run through `yamt_conflict_repo::run_ignored_in_child` with `GIT_DIR=<source>/.git` that asserts the source's branches, its remote and its HEAD are unchanged after `prepare`."
    },
    {
      "severity": "block",
      "rule_id": "VF7",
      "file": "crates/agent/src/checkout.rs",
      "line": 58,
      "problem": "No test covers `discard`'s failure paths, yet #111's \"a failed removal shows a problem and stays open\" (`src-tauri/src/ai.rs:175`) depends on them. With the guard replaced by `true`, a rename that fails (pair folder not writable, a busy folder on Windows) answers `Ok`: the window closes as if it had discarded, and `end` then keeps the changed checkout. With `false` or `!=`, discarding a checkout that is already gone answers `Err(Remove)`, so the window cannot close. With line 87's guard replaced by `true`, a `checkout.removing` that cannot be deleted answers `Ok`. All four of these survivors are on these lines.",
      "fix": "Add to `tests/checkout.rs`: (1) `discard_without_a_checkout_succeeds` (discard twice, or before `prepare`, gives `Ok(())`); (2) under `#[cfg(unix)]`, `discard_that_cannot_rename_the_checkout_answers_remove_and_keeps_it` (pair folder at 0o555, expect `Err(Error::Remove { folder })` with `folder == checkout` and `a.txt` still there, permissions restored afterwards); (3) under `#[cfg(unix)]`, `discard_that_cannot_delete_the_checkout_answers_remove` (a `checkout/sub` holding a file at 0o555, expect `Err(Error::Remove { folder })` ending in `checkout.removing`). Use the 0o555 pattern of `settings/tests/relocate.rs:92`."
    },
    {
      "severity": "block",
      "rule_id": null,
      "file": "crates/agent/src/sweep.rs",
      "line": 16,
      "problem": "The sweep takes the lock of every pair folder ever opened, AI or not, and holds it through `git status` and `remove_dir_all` of a clean leftover. Under #115 a clean leftover can hold an ignored `node_modules`, and changed checkouts kept by \"Keep Changes\" are looked at again on every `--ai` start. Any range window that starts on that pair meanwhile gets `PairLock::take`'s `Locked` (\"another yamt window shows {left}..{right}\", `crates/range/src/lib.rs:152`), although no window shows it. No test covers a `take` racing a sweep.",
      "fix": "Before `try_hold`, skip pair folders that hold none of `checkout`, `checkout.partial` and `checkout.removing` (no lock taken and no `lock` file made). For a clean checkout, hold the lock only for the look and the rename to `checkout.removing`, and delete it after the lock is dropped; `prepare`'s `remove_leftovers` must then treat a `.removing` that vanishes mid-walk as done. Add a test that a `PairLock::take` started during a sweep of a pair with nothing to sweep succeeds."
    },
    {
      "severity": "should",
      "rule_id": "RK23",
      "file": "crates/agent/src/checkout.rs",
      "line": 35,
      "problem": "When `make` fails, the partial is removed, but when the rename fails a complete clone is left in `checkout.partial` until the next prepare. The rename can fail because `checkout` exists but is not a folder (ENOTDIR on unix), or on Windows because a freshly written tree may be held briefly by the indexer or antivirus [INFERENCE]. So `a_failed_prepare_leaves_no_partial_checkout` holds for one failure but not the other. Nothing gets harder to grow, but the failure leaves a whole clone on disk.",
      "fix": "On `Error::Rename`, call `remove_if_present(&partial)` (log the leftover, as the make-error branch does). Add a test where `checkout` is a regular file, expecting `Failed` and no `checkout.partial`."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/agent/src/process.rs",
      "line": 19,
      "problem": "`find(checkout, checkout, …)` resolves a program that contains a separator but is not absolute (for example `node_modules/.bin/omp`) as `checkout.join(program)` (`crates/pipe/src/program.rs` `find_with`). That runs a file from the commit under review, although the brief says \"no project entries: PATH, then the home entries\". This needs a non-default `agent.command`, so it is not a block. Any later caller that copies this call inherits it.",
      "fix": "In `start_in`, answer `NotFound { searched: [] }` (or `SpawnFailed` with a message) for a program that has a separator and is not absolute. Add a test with `program: \"bin/agent\"` and that file placed in the checkout."
    },
    {
      "severity": "should",
      "rule_id": "decision-record",
      "file": "crates/agent/src/look.rs",
      "line": 59,
      "problem": "Under #110's definition, a checkout counts as clean when the AI left work only in refs that HEAD does not name: `git stash`, or a branch it committed on and then left. `end` and the sweep then remove it, and that work is lost. The clone starts with no `refs/heads` (`delete_branches_detaching_head`), so any branch or `refs/stash` there is the AI's. This follows #110 to the letter; I route it as a decision question.",
      "fix": "Orchestrator or owner: amend #110 so that any `refs/heads/*` or `refs/stash` in the checkout counts as changed (shown like `head_moved`). If accepted, have `look` read them (one `for-each-ref`) and add a test where `git stash` alone gives `Changed`."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/agent/tests/checkout.rs",
      "line": 304,
      "problem": "No test removes a checkout that holds the AI's commits (git writes loose objects read-only). So the implementer's open risk about Windows `remove_dir_all` on read-only files is never exercised, though CI runs `just test` on Windows. The discard path that #111 relies on is unproven there.",
      "fix": "In `discard_removes_a_changed_checkout`, call `commit_everything(&checkout, …)` before `discard` (still asserting `Ok` and both folders gone), so the Windows CI job exercises it."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/agent/src/workspace.rs",
      "line": 117,
      "problem": "`stop_and_reap` reaps only the direct child (`yamt_pipe::run.rs` `stop_now` calls `child.kill`). Processes the agent started, such as a long build it runs, can outlive it [INFERENCE about omp]. They can write after `end`'s look found the checkout clean, or keep a handle that fails the Windows rename. #110's \"stopped before any removal by construction\" holds only for the agent itself.",
      "fix": "Route to `yamt-pipe`: start the run in its own process group on unix (`CommandExt::process_group(0)`, then `killpg` on stop) and in a job object on Windows. Until then, say in `Workspace`'s doc that only the agent process is reaped."
    }
  ],
  "survivors": [
    {"mutant": "agent-echo.rs:12:49 + → -", "verdict": "not droppable: a constant behind `huge`, which no yamt-agent test uses", "kill_or_drop": "resolved by boundary finding 6: delete `huge`, or write `yamt_pipe::MAX_MESSAGE_BYTES + 1` and add a test that sends `huge` and expects the drop Log and then `after`"},
    {"mutant": "agent-echo.rs:12:49 + → *", "verdict": "same as above", "kill_or_drop": "boundary finding 6"},
    {"mutant": "agent-echo.rs:12:42 * → +", "verdict": "same as above", "kill_or_drop": "boundary finding 6"},
    {"mutant": "agent-echo.rs:12:42 * → /", "verdict": "same as above", "kill_or_drop": "boundary finding 6"},
    {"mutant": "agent-echo.rs:12:35 * → +", "verdict": "same as above", "kill_or_drop": "boundary finding 6"},
    {"mutant": "agent-echo.rs:12:35 * → /", "verdict": "same as above", "kill_or_drop": "boundary finding 6"},
    {"mutant": "checkout.rs:58:23 guard → true", "verdict": "real gap (finding 2)", "kill_or_drop": "kill: unix `discard_that_cannot_rename_the_checkout_answers_remove_and_keeps_it`"},
    {"mutant": "checkout.rs:58:23 guard → false", "verdict": "real gap (finding 2)", "kill_or_drop": "kill: `discard_without_a_checkout_succeeds`"},
    {"mutant": "checkout.rs:58:36 == → !=", "verdict": "real gap (finding 2)", "kill_or_drop": "kill: `discard_without_a_checkout_succeeds` (and the unix rename test)"},
    {"mutant": "checkout.rs:87:23 guard → true", "verdict": "real gap (finding 2); not equivalent for `discard`, close to equivalent for the partial in `prepare` (an undeletable partial makes `git clone` fail anyway)", "kill_or_drop": "kill: unix `discard_that_cannot_delete_the_checkout_answers_remove`"}
  ],
  "checked": [
    "OR11: pwd equals `git rev-parse --show-toplevel`. crates/agent, range/lock.rs and gitio/checkout.rs are unchanged from 040cc47 to HEAD (git log and diff both empty).",
    "A changed checkout is never removed unasked: `end(self)` and the sweep both go through `remove_when_clean`, which removes only on `Clean`; `Missing`, `Changed` and `Unreadable` are no-ops. `prepare` deletes only `.partial` and `.removing`. `discard` is the one removal of a changed checkout, and the user asked for it (#111).",
    "The agent is stopped before any removal: `discard` and `end` call `stop_and_reap` (`agent.take()`, `stop`, `wait`, which joins the supervisor after the child is reaped and `Exited` sent) before `checkout::remove` and `remove_when_clean`. `discard_stops_the_agent_before_removing_the_checkout` fails if the order is swapped or `wait` is dropped: `hold` rewrites `a.txt` 300 ms after stdin closes, so the checkout would come back, and `exited_code` needs `Exited` already queued.",
    "Crash mid-prepare: a crash during clone, remote removal or checkout leaves only `checkout.partial`, which the next `prepare` deletes (`a_partial_checkout_left_by_a_crash_is_removed_before_prepare`) and the sweep deletes too (`a_clean_leftover_of_an_unheld_pair_is_removed`).",
    "Crash mid-remove: a crash after the rename leaves only `.removing`, deleted by the next `prepare` or sweep; a crash before it leaves a complete `checkout`. Both tests above cover the `.removing` case.",
    "The rename's atomicity: `partial` and `checkout` are siblings in one folder (same filesystem, `rename(2)` and `MoveFileExW` are atomic), and only the pair-lock holder makes them. Proven by reading only: a clone made directly in `checkout` that cleans up after a failure would pass every test, and I see no black-box test of the order short of injecting a crash.",
    "Sweep against a held pair: `a_leftover_of_a_held_pair_is_untouched` holds a second `PairLock` in the same process. flock and LockFileEx conflict between separate open files, so the test exercises a real refusal. `the_own_pair_keeps_its_checkout_and_loses_partial_and_removing_folders` would fail without the `folder == own` branch: `try_hold` would get `None` and the leftovers would stay. The `own` path matches: `ai.rs:51/71` passes `pair_folder`, the folder of the same `range_dir`. The lock is held through look and removal (`_held` lives for the whole arm), so no window can start on a pair while its checkout is removed.",
    "Windows paths: `own_repo` compares `fs::canonicalize` of both sides, so the `\\\\?\\` prefix, git's forward-slash `--show-toplevel` and 8.3 names compare equal [INFERENCE: no Windows run]. A program given as an absolute path (the tests' `CARGO_BIN_EXE`) is taken through `find`'s separator branch. `CheckoutLook.files` uses the OS separator (implementer's open risk 4, accepted as display only). `hold` closes its file before exit, so the discard test also holds where an open file blocks a rename. The read-only loose objects case is untested (finding 7).",
    "Changed means a status entry or HEAD moved: `an_edited_file_an_untracked_file_and_a_moved_head_each_count_as_changed` kills `files` forced empty and `head_moved` forced false. `an_ignored_file_alone_counts_as_clean` kills an added `--ignored` and checks that `end` removes it (#115). `head_commit` returns the full lowercase id, and the shell passes `range.compared().right.as_str()` (ai.rs:54), so the comparison is like for like.",
    "Unreadable: deleted `alternates` (status and `rev-parse` fail) and a missing `.git` inside an outer repository (`own_repo` refuses the outer one) are both kept by `end` and by the sweep (a real `try_hold` path) in the tests.",
    "Measured in /tmp: `git clone --shared --no-checkout` from a linked worktree works (alternates point at the main repository's `.git/objects`, status clean), so a range window opened from a worktree is fine (#107).",
    "Process tests: `start_while_an_agent_runs_stops_the_old_one_first` proves the reap happens before the new start (`Exited` code 0 already queued) and that `send` and `stop` with the old run are ignored. `a_missing_program_lists_path_and_the_home_entries` checks the exact order, PATH then home, with no project entries. `a_crashed_agent_reports_exited_once_with_its_code` checks that no second `Exited` comes after `discard`.",
    "Implementer open risks: 1 (copied folder-name format) is already a boundary block; 2 (Windows `remove_dir_all`) became finding 7; 3 (`start` blocking up to about 3 s) is already a boundary should; 4 is accepted above.",
    "Boundary findings are not repeated. Commands I ran: `pwd`/`git rev-parse`, git log/diff, and three throwaway git probes in /tmp (shared clone from a worktree; inherited absolute GIT_DIR; the GIT_* variables a git alias exports). I ran no cargo test or gate."
  ]
}
```