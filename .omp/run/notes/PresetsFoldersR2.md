The flaky test #1040 is fixed. On Unix it now places `lsp-echo` in `<repo>/tools` as a symlink to the built binary instead of a copy, so this process never has an open write handle to the file it executes. Windows still copies, because it has no "Text file busy" error. The test still proves that a bare name is found through `folders.project` and not found without it. All three acceptance items pass.

```
summary                 a_bare_program_name_is_found_in_a_project_folder_and_not_without_it no longer copies lsp-echo
                        on unix. A new helper, place_echo (#[cfg(unix)] symlink, #[cfg(windows)] fs::copy), puts it in
                        <repo>/tools. With no write handle to the file in this process, another test's fork can't cause
                        ETXTBSY when the program is started. The lookup's fs::metadata (program.rs:148) follows the
                        link, so the test still covers folders.project. No product code changed.
files_changed           crates/lsp-host/tests/run.rs
tests_added             none new; the test above was changed: it calls place_echo instead of fs::copy
smoke_evidence
  1. 20-run loop: `for i in $(seq 1 20); do cargo test -q -p yamt-lsp-host --test run … && pass=$((pass+1)); done`
       → passed 20/20
       → test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.01s
  2. lib.rs:95 changed to `&ProgramFolders::default()`, then
     `cargo test -q -p yamt-lsp-host --test run a_bare_program_name`:
       → thread 'a_bare_program_name_is_found_in_a_project_folder_and_not_without_it' panicked at crates/lsp-host/tests/run.rs:411:5:
         NotFound { program: "lsp-echo", searched: ["/home/wds/.local/share/pnpm/bin", … ] }
       → test result: FAILED. 0 passed; 1 failed; … 17 filtered out
     lib.rs restored (file hash back to #ADD4):
       `git diff --stat crates/lsp-host/src` → (empty)
       `cargo test -q -p yamt-lsp-host --test run` → test result: ok. 18 passed; 0 failed
  3. `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings`
       → Finished `dev` profile [unoptimized + debuginfo] target(s) in 34.35s
     `cargo fmt --all --check` → exit 0
     (both run before the item-2 tamper; lib.rs is unchanged since, and run.rs was not touched after them)
deviations_from_brief
  - For item 2, the ownership hook blocked the edit to crates/lsp-host/src/lib.rs, including in a scratch copy under
    target/ (since deleted). Main then added lib.rs to Owned for this check only. After the change the format hook had
    rewrapped line 95 across lines 95–100; I put back the original two lines exactly.
  - I added a two-line /// comment above the unix place_echo. It states the external fact (ETXTBSY from execve(2) when
    another fork holds the write handle) under CP1.
open_risks
  - crates/lsp-host/tests/run.rs:385 (the windows place_echo) still copies; per the brief Windows has no ETXTBSY. Not
    run here, since this machine is Linux.
```