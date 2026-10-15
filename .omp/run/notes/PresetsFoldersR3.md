The Windows CI failure (#1052) is fixed by renaming the test's placed program. Only the test changed. `a_bare_program_name_is_found_in_a_project_folder_and_not_without_it` now copies or links the echo server into `<repo>/tools` as `yamt-echo-in-tools` plus `EXE_SUFFIX` (`.exe` on Windows, nothing on Linux and macOS). Before, it used the echo server's own name, which can also sit on Windows' PATH during test runs. The brief marks that as `[INFERENCE]` and I did not check it on Windows. With the new name, both halves of the test show the same thing on every system.

```
summary                 crates/lsp-host/tests/run.rs: the test now places the echo server as
                        `yamt-echo-in-tools{EXE_SUFFIX}` instead of under its own file name, so no
                        system can find it on PATH. #1040's unix symlink (`place_echo`), the Windows
                        copy and #1007's check (`searched` has no folder in the repo) are unchanged.
files_changed           crates/lsp-host/tests/run.rs
tests_added             none. One existing test changed: a_bare_program_name_is_found_in_a_project_folder_and_not_without_it
                        now uses a name that exists only in the temp repo's tools/.
smoke_evidence
  1. cargo test -p yamt-lsp-host --test run
       → test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.01s
     20-run loop (cargo test -q -p yamt-lsp-host --test run, counting successes)
       → passed 20 of 20
  2. command -v yamt-echo-in-tools; echo "exit $?"
       → (no output) exit 1
     cargo test -p yamt-lsp-host --test run -- --exact a_bare_program_name_is_found_in_a_project_folder_and_not_without_it
       → test a_bare_program_name_is_found_in_a_project_folder_and_not_without_it ... ok
     Why the first half depends on folders.project: the program exists only as
     <tempdir>/tools/yamt-echo-in-tools[.exe]. A tempdir is never on PATH and folders.home is
     empty, so `tools` in folders.project is the only route to it. With `&command.folders`
     replaced by `&ProgramFolders::default()`, the first start would be NotFound and the
     `Started` assert would fail. The second half (project = []) is NotFound for the same reason.
     It can no longer be found through the target folder Windows puts on PATH.
  3. cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings
       → Finished `dev` profile [unoptimized + debuginfo] target(s) in 35.37s
     cargo fmt --all --check; echo "fmt exit $?"
       → fmt exit 0
deviations_from_brief   - Acceptance 2 was argued, not run: lib.rs was not edited (the brief does not
                          allow it); the evidence is the `command -v` check above and the argument
                          beside it.
open_risks              - crates/lsp-host/tests/run.rs:392: no Windows run here. A name with a PATHEXT
                          extension (.exe) is taken as-is by program.rs `windows_candidates`
                          (program.rs:170), so the lookup in tools/ should succeed. Windows CI
                          (`windows-2025`) has to confirm it.
```