# RVNoteEditsRust — note edits, Rust (rust-impl, 5m1s)

Verbatim output of agent://RVNoteEditsRust:

I added `ThreadStore::edit_note` and `ThreadStore::delete_message`, `Error::NotANote`, the two Tauri commands (both take the send guard before the store) and `IpcError::NotANote`. `cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings` are clean. `cargo nextest run -p yamt-review -p yamt-app` passed 216 of 216, with 2 skipped.

**summary**
- Edit and delete check in the brief's order through one shared helper (`unsent_note_mut`): unknown or not on a listed file → `UnknownMessage`; AI answer → `NotANote`; `Pending` → `MessagePending`; then, for edit only, blank → `EmptyMessage`.
- Edit replaces `Note.text`. A `NotQueued` note stays as it is; a `Queued` or `Refused` note becomes `Queued { text }`.
- Delete removes the message, then removes any thread left with no message. A remaining thread keeps its `session`, and the id counters are never touched.
- Commands `edit_note` and `delete_message` are registered in `commands.rs`. While a send runs they answer `SendRunning`.

**files_changed**
- `crates/review/src/thread_store.rs`
- `crates/review/src/lib.rs`
- `crates/review/tests/threads.rs`
- `crates/review/AGENTS.md`
- `src-tauri/src/review.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/ipc_error.rs`
- `src-tauri/src/ipc_error/tests.rs`
- `src-tauri/src/review/tests.rs`

**tests_added** (each store test also checks the file after `ThreadStore::open`)
- `crates/review/tests/threads.rs`:
  - `editing_a_note_replaces_its_text_and_a_waiting_note_waits_with_the_new_text`: a `NotQueued` note stays `NotQueued`, keeping its id and `written`. A refused note and a queued note become `Queued` with the new text. Other messages and threads are unchanged.
  - `deleting_a_note_takes_it_out_of_its_thread_and_the_thread_keeps_its_session`: the message leaves its thread, and the thread's session and the neighbouring threads are unchanged.
  - `deleting_a_queued_or_refused_note_takes_it_out_of_the_queue`: the queued and refused notes are gone from the queue, and only the queued AI answer still waits.
  - `a_thread_loses_its_last_message_and_goes_while_its_neighbours_keep_order_and_ids`: the emptied thread leaves the file. The other threads keep their order, ids and file ids, and `nextThread`/`nextMessage` are unchanged on disk.
  - `ids_stay_fresh_after_a_delete`: after a delete, a new message gets id 3, not 2. After every message is deleted, a new thread gets thread 2 and message 4.
  - `deleting_a_note_before_an_answer_leaves_the_turn_numbering_as_it_was`: after deleting the note before the first answer, the next answer is still `omp-1` turn 1.
  - `edit_and_delete_refuse_in_the_order_unknown_ai_answer_pending_blank_and_write_nothing`: blank text is sent with each earlier refusal to prove the order. Each refusal leaves the file byte-identical and memory unchanged.
  - `an_ai_answer_is_not_a_note_even_when_pending`: `NotANote` comes before `MessagePending`.
  - `a_failed_write_changes_nothing_in_memory` (existing test, extended): it now covers edit and delete.
- `src-tauri/src/review/tests.rs`:
  - `edit_note_and_delete_message_answer_send_running_while_a_send_runs_and_change_nothing`: while the guard is held, both answer `{"kind":"SendRunning"}`. `list_threads` after release equals the list from before.
  - `edit_note_and_delete_message_reach_the_thread_store`: the edit reaches the store, blank text answers `EmptyMessage`, the delete answers `{"threads":[]}`, and a second delete answers `UnknownMessage`.
- `src-tauri/src/ipc_error/tests.rs`:
  - `an_ai_answer_refused_as_a_note_has_its_kind_and_message`: serialises as `{"kind":"NotANote","message":8}`.

**smoke_evidence**
- `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings` → `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 1.43s`, with no warnings.
- `cargo nextest run -p yamt-review -p yamt-app` → `Summary [3.636s] 216 tests run: 216 passed, 2 skipped`. This includes:
  - `PASS yamt-app review::tests::edit_note_and_delete_message_answer_send_running_while_a_send_runs_and_change_nothing`
  - `PASS yamt-app review::tests::edit_note_and_delete_message_reach_the_thread_store`
  - `PASS yamt-review::threads edit_and_delete_refuse_in_the_order_unknown_ai_answer_pending_blank_and_write_nothing`
  - `PASS yamt-review::threads a_thread_loses_its_last_message_and_goes_while_its_neighbours_keep_order_and_ids`
  - `PASS yamt-review::threads ids_stay_fresh_after_a_delete`
  - `PASS yamt-review::threads deleting_a_note_before_an_answer_leaves_the_turn_numbering_as_it_was`
- `just mutants` was not run; the brief leaves it to you.

**deviations_from_brief**
- `change_posting` now uses the new `shown_message_mut` helper, the one message lookup shared with edit and delete. Its behaviour is unchanged.
- Decided where the brief was open: the `NotANote` message reads "the message N is an AI answer, not a note".
- The `NotANote` JSON check is its own test, because adding it to `each_review_error_has_its_kind_and_a_write_failure_names_the_file` took that function past clippy's 40-line limit.
- I added a small `reopened_list` helper in `threads.rs` to keep the edit test under the same limit.

**open_risks**
- `crates/review/tests/threads.rs` is now 939 lines; it was already 707, over RS6's 400. Splitting it means a new test file outside my owned paths.
- The window, `frontend/src/ipc/bindings.ts` (to be regenerated with `just bindings`), `docs/architecture.md` and the ipc-contract skill don't list the new commands and `NotANote` yet. They are yours to update, and `just map-check` may flag the missing commands until architecture names them.