All 24 items are done, each with its test, plus the real-app `GIT_DIR` check. Every command the brief names passes. Four facts set by `git`, by tauri or by Rust's process API meant the code differs from the brief's wording; they are listed under deviations.

**summary**
- **The user's repository is left alone (item 1).** No `git` run on the clone and no agent process sees an inherited `GIT_DIR` or the five related variables (`GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_COMMON_DIR`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`). The list lives once in `yamt_gitio::Repo::REPOSITORY_VARIABLES`. The new `Repo::discover_from_folder` and `with_root` leave them out of every run. The agent is started through the new pipe function `Running::start_without`.
- **The AI's own refs count as changes (item 12, plan #122).** `CheckoutLook::Changed` gains `refs`, read with one `for-each-ref` through the new `Repo::branches_and_stash`.
- **The sweep never refuses a window (items 3, 6).** A pair folder with nothing to sweep is skipped without taking its lock. For a clean checkout the lock is held only for the look and the rename to `checkout.removing`; deletion happens after the lock is released. The sweep is now `Workspace::sweep_leftovers(&mut self, range_dir)`.
- **gitio (items 15–24).** One failure rule (`failure`, `run_to_success`). `git` is resolved once (`with_root`). One commit-id read (`oid_line`, `commit_revision`). The clone runs with `--no-tags --origin origin --config core.longpaths=true`. A partial-clone source is refused by name with the new `Error::PartialClone`.
- **The rest.** One pair-folder name rule in yamt-range (`PAIR_SEPARATOR`, `pair_right_commit`). `HostEvent` comes from the agent crate. `start_agent` is async. A program path like `bin/agent` is refused. `agent-echo` lost `huge` and `stderr`. The three agent test files share `tests/common/mod.rs`. All four AGENTS.md files are updated.

**files_changed**
- `crates/agent/AGENTS.md`
- `crates/agent/src/{lib,workspace,checkout,look,process,sweep}.rs`, `crates/agent/src/bin/agent-echo.rs`
- `crates/agent/tests/{checkout,process,sweep}.rs`, `crates/agent/tests/common/mod.rs` (new)
- `crates/gitio/src/{checkout,run,repo,abort_continue,lib}.rs`, `crates/gitio/tests/checkout.rs`, `crates/gitio/AGENTS.md`
- `crates/range/src/{lock,lib}.rs`, `crates/range/AGENTS.md`
- `crates/pipe/src/run.rs`, `crates/pipe/tests/lines.rs`, `crates/pipe/AGENTS.md`
- `src-tauri/src/ai.rs`, `src-tauri/src/commands.rs` (one line)

**tests_added**
- **agent `tests/checkout.rs`:**
  - `prepare_never_acts_on_the_repository_an_inherited_git_dir_names`, which runs `preparing_under_an_inherited_git_dir` in a child process with `GIT_DIR=<source>/.git`. It checks that the source's branches, remotes and HEAD are unchanged, that the look is `Clean`, and (unix) that an agent prints `GIT_DIR` unset and finds the checkout as its repository. It fails when `with_root` keeps the inherited variables (tried by hand).
  - `discard_without_a_checkout_succeeds`: discard before `prepare` and twice gives `Ok`.
  - unix `discard_that_cannot_rename_the_checkout_answers_remove_and_keeps_it`: `folder == checkout`, `a.txt` kept.
  - unix `discard_that_cannot_delete_the_checkout_answers_remove`: `folder` is `checkout.removing`.
  - `a_stash_alone_counts_as_changed_and_so_does_a_branch`: `refs == ["stash"]`, then `["ai-work"]`; `end` keeps the checkout.
  - `discard_removes_a_changed_checkout` now commits first (item 13).
- **agent `tests/process.rs`:** `a_relative_program_path_is_never_taken_from_the_reviewed_commit` copies the binary to `bin/agent` but never runs it, and expects `NotFound { searched: [] }`.
- **agent `tests/sweep.rs`:** `a_take_during_a_sweep_of_a_pair_with_nothing_to_sweep_succeeds` runs 200 `PairLock::take` calls while another thread sweeps, and checks that no `lock` file appears in an empty pair. It fails when the skip is removed (tried by hand).
- **range `lock.rs`:** `pair_right_commit_reads_the_right_commit_of_a_folder_take_made`.
- **gitio `tests/checkout.rs`:**
  - `a_clone_of_a_source_on_a_detached_head_holds_no_branch_and_checks_out`
  - `the_remote_is_origin_whatever_the_user_names_new_remotes`, which runs `cloning_under_another_default_remote_name` in a child process with `clone.defaultRemoteName=upstream`
  - `a_partial_clone_source_is_refused_by_name`
  - `#[cfg(windows)] a_path_past_max_path_under_the_checkout_folder_checks_out`
  - The status test now does a `git mv` and expects `D ` for the old path and `A ` for the new one.
  - The borrow test now tags the source first.
  - Replacing `--no-tags` and `--origin origin` by hand makes 2 tests fail.
- **pipe `tests/lines.rs`:** unix `start_without_leaves_the_named_variables_out_of_the_program_s_environment`.

**smoke_evidence**
- `cargo fmt --check` → exit 0
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished`, no warnings
- `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → `Finished`, no warnings
- `cargo test -p yamt-gitio -p yamt-range -p yamt-agent -p yamt-app -p yamt-pipe` → every suite `ok`:
  - agent checkout 17 passed / 1 ignored, process 9, sweep 5
  - yamt-app 126 passed / 2 ignored, cli 5
  - gitio: lib 40, checkout 8 / 1 ignored, abort_continue 5 / 7 ignored, diff 12, glab 11, operations 26, repo 19, and the rest `ok`
  - pipe lib 25, lines 20
  - range lib 12, listing_answers 3, lock 3, range 11
- `just arch-check` → `arch-check: ok`
- **Real-app `GIT_DIR` check:**
  - Setup: `scripts/range-repo.sh /tmp/rv-agent-check/repo`, then an `origin` remote added to it.
  - Before: `refs/heads/feature 9c1ba3f…`, `refs/heads/main 4378055…`, `origin https://example.invalid/r.git`, HEAD `refs/heads/main` at `4378055…`.
  - Start: `GIT_DIR=/tmp/rv-agent-check/repo/.git just app-session start-app --name rvai --binary /tmp/rv-agent-check/yamt-ai --range main...feature --repo /tmp/rv-agent-check/repo`. The app process's environment held `GIT_DIR=/tmp/rv-agent-check/repo/.git`; its command line was `yamt --ai --diff=main...feature --repo …`.
  - `read 'window.__TAURI_INTERNALS__.invoke("prepare_checkout")'` → `{"kind":"Ready","folder":"…/range/repo-b1e838bca4888ced/531ea52…-9c1ba3f…/checkout"}`
  - After: the repository's branches, remote, HEAD and status are identical to before. In the checkout, HEAD is `9c1ba3f…`, `for-each-ref` prints nothing and `remote` prints nothing. `checkout_changes` → `{"kind":"Clean"}`.

**deviations_from_brief**
- **The pipe change was added to Owned by Main.** `Running::start_without(.., removed: &[&str])`, with `start` calling it with `&[]`, plus its pipe test and `crates/pipe/AGENTS.md`. Item 1's "agent's environment" could not be done otherwise: `std::env::remove_var` is unsafe in edition 2024.
- **`crates/gitio/src/lib.rs` was added to Owned by Main** for the one `Error::PartialClone { root }` variant. Its message reaches the window whole as `CheckoutReply::Failed { message }`: `yamt_agent::Error::Git` is `transparent` and `prepare` sends `error.to_string()`: "`<root>` is a partial clone: a shared clone of it cannot check out the files it never fetched". No frontend code reads `CheckoutReply` yet.
- **`src-tauri/src/commands.rs:60` was added to Owned by Main:** `ai::start_agent::<tauri::Wry>`. To be async, `start_agent` takes the window (as `prepare_checkout` does), which makes it generic.
- **Partial-clone detection checks more than `extensions.partialClone`.** Measured: `git clone --filter=blob:none` in git 2.56 sets only `remote.origin.promisor=true`. So a promisor remote also counts.
- **The gitio list of variables is an associated constant, `Repo::REPOSITORY_VARIABLES`**, so it is public without a new `pub use`.
- **`clone_shared_into` no longer joins a relative `into`.** That was boundary-review nit 6; its doc now says "absolute folder".
- **New public read `Repo::branches_and_stash`.** Item 12's `for-each-ref` had to go through gitio.
- **The agent environment check is part of item 1's child test, not a separate process test.** A child process with `GIT_DIR` set cannot build the fixture repository itself.
- **The real-app check needed workarounds.** `app-session` has no `--ai` flag, so I used `--binary` pointing at a small `/tmp` wrapper that adds `--ai`. The frontend at this commit fails typecheck in `src/ui/rangeThreads.ts` (another slice's work), so I built it with `vite build --mode tauri` and then `cargo tauri build --debug --no-bundle` with an empty `beforeBuildCommand`. I also ran `pnpm install` in this worktree.

**open_risks**
- **A forked child can briefly keep a lock file open.** A `git` started by another thread can keep the lock file's descriptor until it execs, so `PairLock` can be refused for a moment. I saw `try_hold_answers_none_while_another_lock_holds_the_pair_and_takes_it_once_released` fail once in about 16 runs. It already shared a test binary with a git-spawning test (`open.rs`); my new test in `crates/range/src/lock.rs` adds another. The same race could make the new sweep test (`crates/agent/tests/sweep.rs`) flaky in rare cases.
- **Two removers of `checkout.removing` can overlap.** A tolerated race leaves a leftover that the next sweep or `prepare` deletes; files are never lost. See `remove_if_present` and `set_aside` in `crates/agent/src/checkout.rs`.
- **The Windows long-path test has never been run.** CI's Windows job will be its first run (`crates/gitio/tests/checkout.rs`, the `#[cfg(windows)]` test).
- **Bindings need regenerating.** `CheckoutLook::Changed.refs` changes them, and the doc comment on `refs` will appear in `bindings.ts`.