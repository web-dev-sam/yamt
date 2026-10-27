# RVNoteEditsRustR1 — note edits Rust fix round 1 (rust-impl, 4m20s)

Verbatim output:

```
summary
  The three findings from round 1 are fixed and behaviour is unchanged.
  - `edit_note` now uses `waiting_text_of` (made `pub(super)`) to decide which notes wait for a send, instead of its own `matches!`.
  - `delete_message` first runs a check that only reads, then calls the new `ThreadFile::remove_message`. That function takes the message out of its own thread, and drops that thread if it is now empty.
  - The 8 edit/delete tests moved to `tests/note_edits.rs`. The builders both test files use now live once, in `tests/stored_threads/mod.rs`.

files_changed
  crates/review/src/thread_store.rs
  crates/review/src/thread_store/waiting.rs
  crates/review/src/thread_file.rs
  crates/review/tests/threads.rs
  crates/review/tests/note_edits.rs (new)
  crates/review/tests/stored_threads/mod.rs (new)
  crates/review/AGENTS.md

tests_added
  No new assertions. The 8 round-1 tests moved word for word into tests/note_edits.rs:
  - editing_a_note_replaces_its_text_and_a_waiting_note_waits_with_the_new_text
  - deleting_a_note_takes_it_out_of_its_thread_and_the_thread_keeps_its_session
  - deleting_a_queued_or_refused_note_takes_it_out_of_the_queue
  - a_thread_loses_its_last_message_and_goes_while_its_neighbours_keep_order_and_ids
  - ids_stay_fresh_after_a_delete
  - deleting_a_note_before_an_answer_leaves_the_turn_numbering_as_it_was
  - edit_and_delete_refuse_in_the_order_unknown_ai_answer_pending_blank_and_write_nothing
  - an_ai_answer_is_not_a_note_even_when_pending
  These tests reach every changed line: remove_message's skip past other threads, the message removal and the empty-thread removal; edit_note's waiting branch; the refusal order.

smoke_evidence
  cargo fmt --check → FMT_OK
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile [unoptimized + debuginfo] target(s) in 36.78s", no warnings
  cargo nextest run -p yamt-review -p yamt-app → "Summary [3.540s] 216 tests run: 216 passed, 2 skipped"
  cargo nextest run -p yamt-review -E 'binary(note_edits)' → "8 tests run: 8 passed, 0 skipped"
  wc -l:
    threads.rs 593 (was 939)
    note_edits.rs 242
    stored_threads/mod.rs 127

deviations_from_brief
  - threads.rs is 593 lines, still over the 400-line limit. Getting under 400 means splitting tests that have nothing to do with this round (format/broken-file, add/queue, session/answer), so I did not.
  - Added a read-only `ThreadFile::message(&self, id)` next to `message_mut`. `delete_message`'s check (`shown_message`) uses it. `waiting_text` also uses it now, replacing its own `flat_map` search, so finding a message by id is done in one place in each of its two forms (read-only and mutable).
  - Replaced `unsent_note_mut` with `require_unsent_note(&Message) -> Result<()>`, which only reads. Edit calls `shown_message_mut`, then this check; delete calls `shown_message`, then this check. The error order is unchanged: UnknownMessage → NotANote → MessagePending → EmptyMessage (EmptyMessage only applies to edit).
  - Review nit applied: in note_edits.rs, four `ThreadStore::open(folder.path()).unwrap().list(&range)` lines became `reopened_list(&folder, &range)`. It is the same expression, so the tests assert the same thing. `queued` and `reopened_list` stay in note_edits.rs because no other file uses them.
  - Not done here, not in Owned: the project-map line for yamt-review (the boundary review's PM6 finding) should add edit_note/delete_message and the `thread_file` `message`/`remove_message` functions.

open_risks
  - crates/review/src/thread_file.rs:96 `remove_message`: it removes a thread while looping over the threads, and returns straight after. The compiler accepts this, but a reader may find it surprising.
```