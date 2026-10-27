All three items in the brief are fixed. `cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings` are clean, and `cargo test -p yamt-review` passes. When I removed the `NotFound` guard by hand, the new test failed. Nothing is committed.

**summary**
- **Item 1:** a new integration test makes `threads.json` a folder so it cannot be read. `ThreadStore::open` must then answer `Error::ReadFailed` with that path, and the pair folder must still hold only `threads.json`.
- **Item 2:** `queued(&self, range: &Range)` now drops messages on paths the range does not list, using `file_at` as `list`, `add_note` and `change_posting` do. `QueuedMessage` carries `file: RangeFileId` instead of `path`.
- **Item 3:** `list` is pure and logs nothing. The new `pub fn unlisted_paths(&self, range: &Range) -> Vec<String>` gives the stored paths the range does not list, sorted, each once.

**files_changed**
- `crates/review/src/thread_store.rs`
- `crates/review/tests/threads.rs`
- `crates/review/Cargo.toml`
- `crates/review/AGENTS.md`
- `Cargo.lock` (cargo regenerated it; see deviations)

**tests_added**
- `a_threads_json_that_cannot_be_read_is_read_failed_and_nothing_in_the_folder_changes` (tests/threads.rs): an unreadable `threads.json` is refused as `ReadFailed` with `path == threads_path(&folder)`, and the folder still holds only `["threads.json"]`. This kills the `NotFound` guard → `true` mutant.
- `threads_on_paths_no_longer_listed_are_kept_on_every_write` (extended): it now also adds a thread on a.txt. `unlisted_paths` is `["a.txt", "b.txt"]` through `main..remote` and `[]` through `main..local`. Because of the new first thread, the ids in its later assertions shift by one.
- `queued_leaves_out_messages_on_paths_the_range_does_not_list` (thread_store.rs unit test): through `main..remote`, only message 4 on a.txt comes back, as `RangeFileId(0)`.
- `queued_lists_queued_and_refused_messages_in_thread_then_message_order` (updated): it now asserts the `RangeFileId` (b.txt → 1, a.txt → 0) instead of the path.
- `record_writes_the_posting_and_keeps_it` (updated): it calls `queued` with a range.
- The unit tests build their `Range` over a small `diverged_repo`: `main..local` lists a.txt and b.txt, `main..remote` lists only a.txt.

**smoke_evidence**
- `cargo test -p yamt-review` → `test result: ok. 11 passed` (unit), `test result: ok. 15 passed` (threads), `test result: ok. 0 passed` (doc). Both `a_threads_json_that_cannot_be_read_… ... ok` and `threads_on_paths_no_longer_listed_are_kept_on_every_write ... ok` appear.
- `NotFound` guard replaced by hand with `Err(_) => Ok(None)`, then `cargo test -p yamt-review --test threads` → `test a_threads_json_that_cannot_be_read_is_read_failed_and_nothing_in_the_folder_changes ... FAILED`, `panicked at crates/review/tests/threads.rs:78:18`, `test result: FAILED. 14 passed; 1 failed`. The guard is restored.
- `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings` → no output from fmt, then clippy `Finished dev profile` with no warnings or errors.

**deviations_from_brief**
- I removed `tracing.workspace = true` from `crates/review/Cargo.toml`, because `list` was its only user. Cargo then dropped the `"tracing",` line from yamt-review's entry in `Cargo.lock`, which is outside Owned. It is a one-line, cargo-generated change. Restore the dependency instead if the orchestrator wants it kept.
- `unlisted_paths` returns its paths sorted with duplicates removed; the brief did not set the order. Two threads on one path then appear once in the warning, and the result does not depend on the order threads were made.
- `QueuedMessage` carries the `RangeFileId` rather than the entry. It is a plain copied value, and `range.entry(file)` gives row 16 the entry when it needs it.
- I shortened `threads_on_paths_no_longer_listed_are_kept_on_every_write` to stay under clippy's 40-line limit: a loop adds the threads, and the ids are compared as `(u32, u32)` pairs. It checks the same things as before.

**open_risks**
- Row 17's shell still has to call `unlisted_paths` once at start and log the result. Until it does, no warning about hidden threads appears anywhere (`crates/review/src/thread_store.rs:56`).