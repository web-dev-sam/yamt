All five fixes are in, and every acceptance command passes. Two things need your attention: `cargo mutants` reports 2 missed mutants that cannot be killed on Linux, and I could not delete the `mutants.out/` folder it left behind.

**summary**
- The fake glab is now run through a symlink `dir/glab` → `scripts/fake-glab/glab`. When one of its three variables is unset, the fake reads it from a `glab.env` file beside `$0`. No test runs a file it has just written any more, so the ETXTBSY failure cannot happen.
- The `NO_COLOR` / `GIT_TERMINAL_PROMPT` overrides and the closed stdin are now checked in a child process. The child starts with `NO_COLOR=0`, `GIT_TERMINAL_PROMPT=1` and stdin coming from a file that holds `leaked`, and the test asserts the exact log.
- The fake no longer makes up stderr. For an error body without a string `"message"` and no `post-<n>.err`, it exits 2 with `fake glab: no recorded stderr for this body`.
- There is one `REV_PARSE`: it is `pub(crate)` in `repo.rs` and imported in `names.rs`.
- The PATH lookup has its own module, `crates/gitio/src/program.rs` (`program_in`, `is_runnable` and their four unit tests). `repo.rs` and `glab.rs` import it.

**files_changed**
- `crates/gitio/src/program.rs` (new)
- `crates/gitio/src/repo.rs`, `crates/gitio/src/names.rs`, `crates/gitio/src/glab.rs`, `crates/gitio/src/lib.rs`
- `crates/gitio/tests/glab.rs`
- `scripts/fake-glab/glab`
- `tests/glab/README.md`
- `tests/glab/runner/post-5.json`, `tests/glab/runner/post-5.status` (new)

**tests_added**
- `glab_overrides_no_color_and_the_terminal_prompt_and_closes_stdin`: runs the existing test `glab_runs_in_the_repository_with_no_color_and_stdin_closed` (now `#[ignore]`) in a child with `NO_COLOR=0`, `GIT_TERMINAL_PROMPT=1` and stdin from a file holding `leaked`. The child asserts the whole log, including `env: NO_COLOR=1 GIT_TERMINAL_PROMPT=0` and an empty `stdin: ` line.
- `the_fake_invents_no_stderr_for_an_error_body_without_a_message`: post 5 answers `400 Bad Request` with `{"error":"note is invalid"}` and has no `.err`. The run comes back as `Failed { status: Some(2), stdout: <body>, stderr: "fake glab: no recorded stderr for this body\n" }`.
- The four lookup tests were moved from `repo.rs` into `program.rs` without changes.

**smoke_evidence**
- `cargo fmt --check` → no output. I ran `cargo fmt -p yamt-gitio` first.
- `sh -n scripts/fake-glab/glab` → ok.
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished `dev` profile [unoptimized + debuginfo] target(s) in 40.38s`, no warnings.
- `cargo test -p yamt-gitio` → every binary `test result: ok`. Two examples: `36 passed` (unit), and `11 passed; 0 failed; 3 ignored` for the glab test file.
- `cargo test -q -p yamt-gitio --test glab`, 20 times in a row → `run 1` … `run 20`: each `test result: ok. 11 passed; 0 failed; 3 ignored`.
- `cargo mutants -p yamt-gitio --file crates/gitio/src/glab.rs --file crates/gitio/src/program.rs` → `ok Unmutated baseline in 4s build + 4s test`, then `16 mutants tested in 48s: 2 missed, 10 caught, 4 unviable`. Both misses are `program.rs:25:5 replace is_runnable -> bool with true/false`. That is the Windows-only `#[cfg(not(unix))]` `is_runnable`, which is not compiled on Linux, so no Linux test can catch it.
- The measured real-glab outputs in `tests/glab/README.md` are unchanged. I edited only the "Environment" text (`glab.env`), the `post-<n>.err` row, the sentence about where the message comes from, and the `runner/` scenario line.

**deviations_from_brief**
- I added a `runner/` post 5 and a test for item 3, so the new refusal has a test that exercises its failing case (SP4).
- `glab.env` is not sourced as shell. The fake reads `NAME=value` lines and uses `${VAR=value}`, so a variable already set in the environment wins. Any other line exits 2. This is written down in the README.
- `mutants.out/` is still in the working tree. `bash-guard` blocked `rm -rf mutants.out`, so it needs deleting before the commit.

**open_risks**
- `crates/gitio/src/program.rs:25`: the two Windows-only `is_runnable` mutants will always show as missed in a Linux mutants run, unless `.cargo/mutants.toml` (not mine to edit) excludes them.
- `scripts/fake-glab/glab:32`: `$(dirname "$0")` relies on sh being given the symlink's path as `$0`. Linux and macOS both do this, and the tests pass on Linux.
- From the review, still for you: the project map, `crates/gitio/AGENTS.md` and `docs/architecture.md` don't name `program.rs`, `glab.rs`, the fake or `tests/glab/` yet. Those files are outside this brief.