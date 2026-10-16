# AbortMergeRust — 3.A-abort-rust (board "Abort merge" row 1)

Brief: `docs/slices/briefs/3.A-abort-rust.md`. Base `7d334d8`.

## Summary
gitio `Repo::abort_merge`, `Repo::rebase_in_progress` (private `git_path` shared with `merge_message`); session
`FileList.merging` (MERGE_HEAD names a commit and no rebase; re-read each refresh; a git failure warns
`merge_state_unread` and gives false) and `MergeSession::abort_merge`; src-tauri `merge.rs`: `enum Merge { Held(MergeSession),
Aborted }`, `MergeState = Mutex<Merge>`, `Merge::session()` (Aborted → `IpcError::MergeAborted`), `Merge::abort()` (Aborted
only after git succeeds); `abort_merge` destroys the calling window; `ending_on_close(&mut Merge)`: Aborted → exit 1
`merge aborted`, no refresh. ipc: `merging`, `abortMerge`, `sideNames` rejects naming the kind; fixture `merging: true`,
`abortMerge` logs `fixture.abort_merge`; problemText `MergeAborted` sentence.

## Tests
gitio/tests/abort.rs (5), session/tests/merging.rs (5), src-tauri merge.rs mock-window (3), ipc tauri/fixture tests,
problemText (1). cargo test 471 passed; web 1353 passed.

## Smoke (real app, Xvfb via app-session)
Unsaved edit in crlf.txt (dot lit) → invoke abort_merge → window and process gone, no question; status clean, no MERGE_*;
tauri-driver.log "yamt: merge aborted"; exit status 1 through a throwaway wrapper. Refusal (MM src/added.ts): reply
`Git` with git's "not uptodate" text, app stays, status and `ls-files -s` md5 identical, list_files merging true.

## Mutants (agent's own run)
Rust: 1 survivor (rebase guard) fixed with `Path::try_exists`; gitio 11/11 caught; session 8 caught 1 unviable;
src-tauri 7 caught 25 unviable. TS: none on changed lines.

## Deviations (accepted)
- `WebviewWindow::destroy()` instead of `AppHandle::exit`: destroy emits no events (no CloseRequested to the page guard),
  the last window gone ends `run_return`, and MockRuntime's `request_exit` is `unimplemented!()`.
- `#[expect(clippy::large_enum_variant, reason = …)]` on `Merge`.
- Test helper `conflict_repo::rebase_merges_repo` + `Error::RebaseDidNotConflict`.
- `side_names.rs` `MERGE_HEAD` now `pub(crate)`.
- `just app-session read "<js with parentheses>"` broke on the unquoted recipe → orchestrator fixed the justfile
  (`[positional-arguments]`, `"$@"`), #1078.
- map-check needed architecture + ipc-contract lines → applied by the orchestrator.

## Open risks
- `rebase_in_progress`'s `Err` arm (a git-dir path that cannot be checked) untested (repo.rs:112).
- `destroy()` failing only warns; the state is already Aborted, so a normal close ends with exit 1.
- Real app observed on Linux/WebKitGTK only; macOS/Windows [INFERENCE] same.
- Leftover dirs `/var/tmp/yamt-mutants/{out,out-s,out-a}` (bash-guard blocks `rm -r`).
