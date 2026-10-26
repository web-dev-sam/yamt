**Verdict: fail.** All 24 items are fixed, each with a test that would fail without the fix. But regenerating the bindings broke the frontend's typecheck, and one mutation survivor is a real test gap.

- **New block 1:** item 12 added `refs` to `CheckoutLook.Changed`, but three frontend places still build `Changed` without it. Two of them (`fixtureAgent.ts:229`, `tauriAgent.test.ts:114`) no longer compile, so `just check` (`web-typecheck`) fails at HEAD. I worked this out by reading the code and did not run the typecheck.
- **Block 2 (from an earlier slice, not caused by this fix):** no test checks that an `--ai` window sweeps leftovers at start. It is the only thing that removes other pairs' clean leftovers.
- **Survivors:** of the 6, 5 can be dropped. The real gap is `sweep_while_held`, which is block 2.

```json
{
  "verdict": "fail",
  "items": [
    {"item": 1, "status": "fixed", "evidence": "`Repo::REPOSITORY_VARIABLES` (repo.rs:35) are removed from the clone command (checkout.rs:42 `without_repository_variables`) and from every run on the clone (`with_root`, `Lookup::Folder`). `look` uses `discover_from_folder` (look.rs:79) and the agent starts through `Running::start_without(…, REPOSITORY_VARIABLES)` (process.rs:38). Test `prepare_never_acts_on_the_repository_an_inherited_git_dir_names` runs in a child with `GIT_DIR=<source>/.git`. It compares the source's branches, `remote -v` and `symbolic-ref HEAD` before and after `prepare` (with the old bug the HEAD read fails, since HEAD would be detached), then checks `Clean`, and on unix that the agent sees `GIT_DIR` unset and the checkout as its top level. The implementer's real-app GIT_DIR check is in the notes."},
    {"item": 2, "status": "fixed", "evidence": "tests/checkout.rs: `discard_without_a_checkout_succeeds` (before `prepare`, then twice); unix `discard_that_cannot_rename_the_checkout_answers_remove_and_keeps_it` (0o555 pair folder, `folder == checkout`, a.txt kept, mode restored before the asserts); unix `discard_that_cannot_delete_the_checkout_answers_remove` (`sub` at 0o555, `folder == checkout.removing`). Traced: they kill set_aside's NotFound guard → true/false/!= and remove_if_present's NotFound guard → true."},
    {"item": 3, "status": "fixed", "evidence": "sweep.rs:13 skips a pair with `!checkout::has_any` before `try_hold`. `_held` is a binding in the match arm, so it drops at the end of the arm, before `remove_set_aside` at sweep.rs:24 (the delete runs after the lock is released). The `!folder.exists()` arm in remove_if_present covers a folder another remover deleted. Test `a_take_during_a_sweep_of_a_pair_with_nothing_to_sweep_succeeds`: 200 takes plus no `lock` file in the empty pair (deterministic once the sweep runs)."},
    {"item": 4, "status": "fixed", "evidence": "lib.rs:18 `pub use yamt_pipe::HostEvent;`. ai.rs:9 and tests/process.rs:12 import `yamt_agent::HostEvent`. No `yamt_lsp_host` left in ai.rs."},
    {"item": 5, "status": "fixed", "evidence": "range lock.rs: `PAIR_SEPARATOR` is used by `take` (lock.rs:28) and `pair_right_commit` (lock.rs:64). Unit test parses a folder made by `take`. `sweep.rs::right_commit` is gone. range AGENTS.md names try_hold, pair_folders and pair_right_commit. The agent fixtures now build pair folders through `PairLock::take` (common/mod.rs:50)."},
    {"item": 6, "status": "fixed", "evidence": "`Workspace::sweep_leftovers(&mut self, range_dir)` (workspace.rs:115) takes the own pair from `self.pair.folder`; ai.rs:71 calls it."},
    {"item": 7, "status": "fixed", "evidence": "`start`'s doc says it blocks up to about 3 s (workspace.rs:58). `start_agent<R>` is async through `blocking_reply` (ai.rs:117) and registered as `::<tauri::Wry>` in commands.rs:60, the same pattern as prepare_checkout."},
    {"item": 8, "status": "fixed", "evidence": "agent-echo has no `huge` or `stderr` left (grep finds no `HUGE`/`stderr`/`huge` in crates/agent)."},
    {"item": 9, "status": "fixed", "evidence": "tests/common/mod.rs holds `Fixture`, `pair_in` and `commit_of`; checkout.rs, process.rs and sweep.rs each `mod common;`."},
    {"item": 10, "status": "fixed", "evidence": "`checkout_folder` (checkout.rs:17) is used by look.rs:19, `made_or_reused` and `set_aside`."},
    {"item": 11, "status": "fixed", "evidence": "process.rs:24 refuses a non-absolute program with a separator. `a_relative_program_path_is_never_taken_from_the_reviewed_commit` copies the echo binary (mode kept) to checkout/bin/agent; without the guard `find` would return it and the reply would be `Started`. The copy is never run."},
    {"item": 12, "status": "fixed (Rust); frontend callers not migrated, see finding 1", "evidence": "`branches_and_stash` reads both kinds in one `for-each-ref` (gitio checkout.rs:87). `Changed.refs` is filled in look.rs. `a_stash_alone_counts_as_changed_and_so_does_a_branch` expects `[\"stash\"]` then `[\"ai-work\"]`, and `end` keeps the checkout."},
    {"item": 13, "status": "fixed", "evidence": "`discard_removes_a_changed_checkout` commits first (tests/checkout.rs:288)."},
    {"item": 14, "status": "fixed", "evidence": "`Workspace` doc (workspace.rs:20-21) says only the agent's own process is reaped."},
    {"item": 15, "status": "fixed", "evidence": "run.rs: private `failure` used by `run_accepting` and `run_to_success`. `Repo::abort`, `clone_shared_into` and `checkout_detached` call `run_to_success`. No copy left in checkout.rs."},
    {"item": 16, "status": "fixed", "evidence": "repo.rs `with_root` reuses `self.git`; the clone ends with `self.with_root(into.to_owned())`."},
    {"item": 17, "status": "fixed", "evidence": "`--no-tags` is in the argv. `the_clone_borrows_objects_and_keeps_no_refs_of_the_source` tags `v1` first, then expects an empty `for-each-ref`."},
    {"item": 18, "status": "fixed", "evidence": "`oid_line` is used by `oid_unless_silent` and `head_commit`; `commit_revision` is used by `commit_named` and `head_commit`."},
    {"item": 19, "status": "fixed", "evidence": "gitio AGENTS.md has a checkout.rs paragraph (methods, `run_to_success` without a deadline, `LC_ALL=C`, `Access::Read` status, no branch or tag, `REPOSITORY_VARIABLES`). The 'every other call' sentence now excludes the clone and the checkout."},
    {"item": 20, "status": "fixed", "evidence": "`--origin origin` is in the argv. `the_remote_is_origin_whatever_the_user_names_new_remotes` runs a child with GIT_CONFIG_COUNT and `clone.defaultRemoteName=upstream`. gitio's `git_command` does not clear GIT_CONFIG_*, so the setting reaches git; without the flag `remove_remote(\"origin\")` would panic."},
    {"item": 21, "status": "fixed (never run, as the implementer says)", "evidence": "`--config core.longpaths=true` is in the argv. `#[cfg(windows)]` test: about 49 + 180 + 161 characters, asserted > 260 before the clone."},
    {"item": 22, "status": "fixed", "evidence": "The status test runs `git mv renamed.txt moved.txt` and expects `D ` renamed.txt and `A ` moved.txt. Without `--no-renames` the second NUL record 'renamed.txt' fails to parse → UnexpectedOutput → test fails."},
    {"item": 23, "status": "fixed", "evidence": "`require_complete` checks `extensions.partialClone` or any `remote.*.promisor` true (the implementer measured that git 2.56 sets only the latter) and returns `Error::PartialClone { root }`. `a_partial_clone_source_is_refused_by_name` (file:// with `--filter=blob:none`) checks the root and that `into` does not exist. Without the check the clone would succeed and the test would fail."},
    {"item": 24, "status": "fixed", "evidence": "`a_clone_of_a_source_on_a_detached_head_holds_no_branch_and_checks_out`: `refs/heads` empty, `head_commit == remote`, a.txt is `remote`."}
  ],
  "survivors": [
    {"mutant": "crates/agent/src/checkout.rs:124:19 guard !folder.exists() → false", "verdict": "drop (a) equivalent on the mutated platform", "reason": "In the 1.99 std (sys/fs/unix.rs `remove_dir_all_recursive`), ENOENT is ignored for every child and for the final rmdir, and a root that is already gone is `NotFound`, caught by the arm above. A concurrent removal therefore never reaches this arm on unix. Only Windows delete-pending errors do, and no deterministic test can produce them."},
    {"mutant": "crates/agent/src/sweep.rs:46:5 replace logged with ()", "verdict": "drop (c)", "reason": "`logged` only calls `tracing::warn!` on Err and decides nothing; every caller ignores the outcome either way."},
    {"mutant": "src-tauri/src/ai.rs:65:5 replace sweep_while_held with ()", "verdict": "real gap → finding 2", "reason": "This call is the only place the app runs `sweep_leftovers` (the shell brief's contract line 'sweep_leftovers on a background thread at start'). No ai.rs test sees a leftover removed or a command waiting for the sweep. It already survived at 3d746d5."},
    {"mutant": "crates/gitio/src/checkout.rs:87:9 branches_and_stash → Ok(vec![])", "verdict": "drop (b) gate-covered", "reason": "`just test` (cargo nextest --workspace) runs the agent test `a_stash_alone_counts_as_changed_and_so_does_a_branch`; an empty list makes the look `Clean` instead of `Changed { refs: [\"stash\"] }`."},
    {"mutant": "crates/gitio/src/checkout.rs:87:9 → Ok(vec![String::new()])", "verdict": "drop (b) gate-covered", "reason": "Same test: refs `[\"\"]` ≠ `[\"stash\"]`."},
    {"mutant": "crates/gitio/src/checkout.rs:87:9 → Ok(vec![\"xyzzy\".into()])", "verdict": "drop (b) gate-covered", "reason": "Same test: refs `[\"xyzzy\"]` ≠ `[\"stash\"]`."}
  ],
  "findings": [
    {
      "severity": "block",
      "rule_id": "clean cutover (changed contract, callers not migrated)",
      "file": "frontend/src/ipc/fixtureAgent.ts",
      "line": 229,
      "problem": "Item 12 made `refs: string[]` required on `CheckoutLook.Changed` and 258a358 regenerated bindings.ts, but `fixtureAgent.ts:229` and `tauriAgent.test.ts:114` still build a `Generated.CheckoutLook` `Changed` literal without `refs`. Under tsconfig.app.json (`src/**/*.ts`, strict) both are missing-property errors, so `just check` (web-typecheck) fails at HEAD. Fixture mode also hands the window a `Changed` with no `refs`, and `fixtureAgent.test.ts:217` pins that shape.",
      "fix": "Add `refs: []` to the fixture literal at fixtureAgent.ts:229, the case at tauriAgent.test.ts:114 (or a non-empty example such as `[\"stash\"]`) and the expectation at fixtureAgent.test.ts:217. This is outside this round's Owned, so the orchestrator routes it to the agent-client slice or takes it itself."
    },
    {
      "severity": "block",
      "rule_id": "VF7 / SP5 (3.RV-ai-shell acceptance)",
      "file": "src-tauri/src/ai.rs",
      "line": 59,
      "problem": "No test notices if the `--ai` start sweep is dropped (mutant `sweep_while_held → ()` survives, as it did at 3d746d5). It is the only caller of `sweep_leftovers`, so a refactor could silently leave every crashed run's clean checkout and partial folders on disk for ever. This gap predates this round; the AI shell slice owns it, and ai.rs is Owned here.",
      "fix": "In ai.rs tests, use `open_range_window_in(repo(), data, Ai::On)` with `data/yamt/range/x-0123456789abcdef/a-b/checkout.partial` created beforehand. Then take `lock(&ai_state(&window))` (manage returns only once the sweep holds the state) and assert the partial is gone."
    }
  ],
  "checked": [
    "OR11: pwd equals the repository top level. I read the brief, all four reviews, the implementer's notes, the survivors file, `git diff ed179ba 8acdd72` for gitio/pipe/range/commands and the bindings diff 8acdd72..258a358, then every touched agent/gitio/range/ai.rs file as it is now.",
    "Deviations accepted: the `start_without` pipe addition (`start` delegates with `&[]`, behaviour unchanged for lsp-host; the unix test checks both directions). The `Error::PartialClone` message reaches the window through the transparent `Error::Git`. The promisor-key check (measured). `Repo::REPOSITORY_VARIABLES` as an associated constant. No join of a relative `into`. The public `branches_and_stash`. The agent environment check inside item 1's child test. The commands.rs `::<tauri::Wry>` line follows prepare_checkout's pattern.",
    "Nothing broken nearby in Rust: `Lookup::Environment` leaves `Repo::discover` and `command_as_user` unchanged for every existing caller. `Repo::abort`'s error is still `GitFailed { args, status, stderr }` built from the same argv. `failure` is shared by both runners.",
    "Sweep order: a clean checkout is looked at and renamed while `_held` lives. The delete after the lock tolerates a window's `prepare` deleting the same `.removing` at the same time: std ignores ENOENT, and the guard catches a folder that is already gone. The own pair is skipped by `folder == own`, and `sweep_leftovers` deletes only the own pair's partial and removing folders.",
    "Accepted residual: `set_aside_under_lock` still deletes another pair's `.partial`/`.removing` under its lock. Those exist only after a crash or after an exit during a delete, outside item 3's clean-checkout wording, so they are not a finding.",
    "Implementer open risk 1 (a forked child briefly holding a lock fd) accepted: `just test` runs nextest, one process per test, and the new sweep test's sweeping thread starts no git for the skipped pairs.",
    "Item 7: `send_to_agent`/`stop_agent` stay sync and can wait on the AiState mutex while an async start reaps (up to about 3 s). Before this round the start itself held the main thread, so this is no regression.",
    "Item 1 coverage: the clone itself, `remove_remote`, `checkout_detached`, `delete_branches_detaching_head`, `look` and the agent all leave out the six variables. `require_complete` reads the source's config under the environment, which is the same repository in the GIT_DIR=<source>/.git case.",
    "I ran no cargo, vitest or vue-tsc; the typecheck failure in finding 1 comes from reading bindings.ts:104-106 against the two literals. The only commands I ran were git log/diff and a sed of std's unix.rs."
  ]
}
```