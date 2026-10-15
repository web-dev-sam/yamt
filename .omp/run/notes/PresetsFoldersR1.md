Both blocks are fixed in `crates/lsp-host/**`, and the new test passes on the real code but fails when `&command.folders` is replaced by `&ProgramFolders::default()`.

summary
- Block 1 (#1006): the `ProgramFolders` doc comment now says an entry with an empty name (`go/bin/`, `a//b`) is skipped too, alongside empty, absolute, `..` and `.` entries.
- Block 2 (#1007): a new `tests/run.rs` case proves `Host::start` looks a bare program name up through `command.folders`.

files_changed
- `crates/lsp-host/src/program.rs` (doc comment, lines 18–20)
- `crates/lsp-host/tests/run.rs` (new test; `use std::path::Path;` added)

tests_added
- `a_bare_program_name_is_found_in_a_project_folder_and_not_without_it`: lsp-echo is copied into `<repo>/tools`. Started by its bare file name with `folders.project = ["tools"]`, the reply is `Started`. With `folders.project = []` the reply is `NotFound`, and no folder in `searched` lies inside the repository, so `<repo>/tools` is not there.

smoke_evidence
1. `cargo test -p yamt-lsp-host --test run a_bare_program` → `test a_bare_program_name_is_found_in_a_project_folder_and_not_without_it ... ok`.
   With `lib.rs:95` changed to `&ProgramFolders::default()`:
   ```
   thread 'a_bare_program_name_is_found_in_a_project_folder_and_not_without_it' (311992) panicked at crates/lsp-host/tests/run.rs:399:5:
   NotFound { program: "lsp-echo", searched: ["/home/wds/.local/share/pnpm/bin", …, "/usr/bin", …, "/home/wds/.vite-plus/fallback-bin"] }
   test result: FAILED. 0 passed; 1 failed; …
   ```
   After that run, `lib.rs` was put back; its snapshot tag is `#ADD4` again, the same as before the change.
2. `cargo test -p yamt-lsp-host`: lib `19 passed`, lsp-echo `0 passed`, `tests/files.rs` `3 passed`, `tests/run.rs` `18 passed`, doc-tests `0 passed`; nothing failed.
   `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → `Finished \`dev\` profile … in 34.75s`, no warnings.
   `cargo fmt --all --check` → no output (`fmt-ok`).

deviations_from_brief
- The brief asks for `searched` to hold no `<repo>/tools`. The test checks something slightly stronger: no folder in `searched` is inside the repository at all. This doesn't depend on how the path string is written.
- I did not run `just bindings`, because it writes `frontend/src/ipc/bindings.ts`, which is outside Owned. The new doc text has not been checked in `bindings.ts`; it will show up when the orchestrator regenerates it.

open_risks
- `crates/lsp-host/tests/run.rs:376`: the test finds the program by `ECHO`'s file name, which is `lsp-echo.exe` on Windows. It only passed on Linux. On Windows the name already ends in a `PATHEXT` extension, which the lookup accepts as it is, so I expect it to pass there too [INFERENCE].