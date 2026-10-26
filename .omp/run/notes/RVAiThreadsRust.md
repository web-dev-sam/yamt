Both commands are in place: `set_thread_session` and `add_ai_answer` store a thread's AI session and add numbered AI answers. Every acceptance check passed: the store tests on real files, the shell test, `cargo fmt --check`, both clippy runs, the tests and `just arch-check`. cargo-mutants reports 0 missed on the new lines.

**summary**
- `MessageBody::AiAnswer` is now `{ session: String, turn: u32 }`. Plan row #121 amends format 1, which was never released, so there is no format bump.
- `ThreadStore::set_session` replaces the thread's session. `ThreadStore::add_ai_answer` sets the session, then adds an `AiAnswer` whose `turn` the store counts: how many answers from that session the thread already has.
- Both refuse a thread that is unknown or on a file the range doesn't list with `UnknownThread`, and write nothing. An AI answer starts as `NotQueued`.
- The two commands are in `src-tauri/src/review.rs`, each answering `ThreadList`, and are registered in `specta_builder`.

**files_changed**
- `crates/review/src/thread_types.rs`
- `crates/review/src/thread_store.rs`
- `crates/review/src/thread_store/waiting.rs` (new)
- `crates/review/src/send.rs` (import path only)
- `crates/review/tests/threads.rs`
- `crates/review/AGENTS.md`
- `src-tauri/src/review.rs`
- `src-tauri/src/commands.rs` (two registration lines)
- `src-tauri/AGENTS.md`

**tests_added**
- `a_session_is_stored_survives_a_reopen_and_a_second_one_replaces_it`: the session is stored, comes back after a reopen, and a second `set_session` replaces it on disk.
- `answers_number_0_1_2_within_a_session_and_a_new_session_starts_again_at_0`: answers in one session are turns 0, 1, 2. After a session change the next answer is turn 0 and the older answers keep their numbers. Message ids come from the counter, and the new answer is `NotQueued` and has a time stamp. Everything survives a reopen.
- `an_answer_counts_only_its_own_session_s_answers_and_keeps_the_older_ones`: sessions omp-1, then omp-2, then omp-1 again; the last answer is omp-1 turn 1.
- `format_1_writes_an_ai_answer_with_its_session_and_turn`: on disk the body is `{"kind":"aiAnswer","session":"omp-1","turn":0}`, and the thread's `session` and `nextMessage` are updated.
- `an_unknown_or_unlisted_thread_gets_no_session_or_answer_and_nothing_is_written`: both methods refuse an unknown thread and a thread on a file the range doesn't list; the file bytes stay the same.
- Extended `format_1_round_trips_every_body_and_posting_kind_and_a_session`: `EVERY_KIND` now holds an `aiAnswer` with a session.
- Extended `a_failed_write_changes_nothing_in_memory`: a failed write in either new method changes nothing.
- `review::tests::set_thread_session_and_add_ai_answer_reach_the_thread_store` (shell): both commands go through the invoke handler to the store, `list_threads` gives the same list back, and an unknown thread answers `{"kind":"UnknownThread","thread":9}`.

**smoke_evidence**
- `cargo fmt --check && echo FMT_OK` → `FMT_OK`
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.41s`
- `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → `Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.62s`
- `cargo test -p yamt-review -p yamt-app`:
  - yamt-app: `test review::tests::set_thread_session_and_add_ai_answer_reach_the_thread_store ... ok`, `test result: ok. 127 passed; 0 failed; 2 ignored`
  - review unit tests: `test result: ok. 35 passed; 0 failed`
  - `tests/review.rs`: `test result: ok. 15 passed; 0 failed`
  - `tests/threads.rs`: `test result: ok. 20 passed; 0 failed`, with all five new tests `... ok`
- `just arch-check` → `arch-check: ok`
- `cargo mutants -f crates/review/src/thread_store.rs -f src-tauri/src/review.rs --re 'set_thread_session|add_ai_answer|set_session|shown_thread_mut|answers_in|note ->|new_message|seconds_since_1970|add_note' -p yamt-review -p yamt-app` → `17 mutants tested in 2m: 7 caught, 10 unviable`

**deviations_from_brief**
- `src-tauri/src/commands.rs` is outside Owned. Main allowed the two registration lines (`review::set_thread_session`, `review::add_ai_answer`); nothing else in that file changed.
- To keep `thread_store.rs` under the 400-line limit, I moved what the sender reads from the store into a child file, `crates/review/src/thread_store/waiting.rs`. That is `QueuedMessage`, `queued`, `waiting_text`, `pending_draft_notes`, `record_if_waiting`, `waiting_text_of` and their unit tests, moved without changes. `send.rs` now imports from `crate::thread_store::waiting::QueuedMessage`.
- Also in `thread_store.rs`:
  - The thread lookup `add_note` did inline is now one helper, `shown_thread_mut`, which `add_note`, `set_session` and `add_ai_answer` all use.
  - `new_message(id, body)` now takes the message body as a parameter, with a small `note(text)` helper for notes.
- `add_ai_answer` always writes the session it is given. Writing the same session again changes nothing, and `commit` skips the write when nothing changed, which covers the brief's "sets the session when it differs".
- An empty session string is not refused; the brief names no such refusal.
- `crates/review/AGENTS.md` and `src-tauri/AGENTS.md` now describe the new methods, the two commands, the moved file and #121.
- `ipc/bindings.ts` is not regenerated; per the brief, the orchestrator does that. The web half reads `aiAnswer.turn` and now also gets `session`.

**open_risks**
- `src-tauri/src/review.rs` is 448 lines, over the 400-line rule (nothing checks it automatically; `commands.rs` 415 and `window.rs` 408 are already over). The tests could move to `src-tauri/src/review/tests.rs`, as `merge/tests.rs` does, but that file is outside Owned.
- The `answers_in` loop in `crates/review/src/thread_store.rs:198-211` uses `if let … && …` (a let chain), which needs edition 2024. It compiles here.