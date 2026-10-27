# RVNoteEditsRustBoundary — boundary review of d7f2968

Verbatim output:

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "RS9",
      "file": "crates/review/src/thread_store.rs",
      "line": 159,
      "problem": "`edit_note` decides again which postings wait for a send with `matches!(stored.posting, Posting::Queued { .. } | Posting::Refused { .. })`. That rule already has one home in `waiting_text_of` (thread_store/waiting.rs:79-84), which `queued`, `waiting_text` and `record_if_waiting` use. The macro's hidden `_ => false` also gets past `wildcard_enum_match_arm`. If a later `Posting` variant waits for a send, the sender will pick it up, but an edit will leave its old text as what gets posted, and nothing will fail.",
      "fix": "Make `waiting_text_of` `pub(super)` and write `if waiting_text_of(&stored.posting).is_some() { stored.posting = Posting::Queued { text: text.to_owned() }; }`, or use an exhaustive `match` over all four variants."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/review/src/thread_store.rs",
      "line": 174,
      "problem": "`delete_message` calls `unsent_note_mut` only as a check and drops the `&mut Message` it returns. It then finds the message a second time by scanning every thread, unlisted paths included, with `retain(|stored| stored.id != message)`, and filters the whole file for empty threads. A reader has to check thread_file.rs's unique-id and non-empty refusals to see that only one message and one thread can go. As more rules are added, this scan-by-id becomes a second way of finding a message, next to `message_mut`.",
      "fix": "Add one `pub(crate) fn remove_message(&mut self, message: MessageId)` to `ThreadFile` (thread_file.rs). It takes the message out of its own thread and removes that thread if it is now empty. Call it after a check that only reads, for example a `require_unsent_note` that borrows `&ThreadFile`. Note that thread_file.rs is outside this brief's `Owned`, so the orchestrator would need to widen it."
    },
    {
      "severity": "should",
      "rule_id": "RS6",
      "file": "crates/review/tests/threads.rs",
      "line": 721,
      "problem": "The patch adds about 230 lines of edit/delete tests to a file that was already 707 lines and is now 939, more than twice RS6's 400. The next change to the store will add to the same file and push it further past the limit. The implementer listed this under `open_risks`.",
      "fix": "Move the eight edit/delete tests and `queued`/`reopened_list` into `crates/review/tests/note_edits.rs`, with the shared helpers (`stored`, `on_disk`, `EVERY_KIND`, `refused`, …) in a `tests/common`-free module named for what it builds (e.g. `tests/stored_threads/mod.rs`). This needs a brief that owns those paths."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 66,
      "problem": "The yamt-review entry still describes `thread_store` as `add_thread/add_note/queue/unqueue, set_session, add_ai_answer … shown_thread_mut`. The src-tauri range entry (line 95) and docs/architecture.md:537 already name `edit_note`/`delete_message`, so the map and the code disagree about what the store does. The next agent who reads the map to find where a note is changed will be told it isn't.",
      "fix": "Add `edit_note`/`delete_message` (only an unsent `Note`, #123) and `unsent_note_mut`/`shown_message_mut` to the thread_store line. This file belongs to the orchestrator."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "crates/review/tests/threads.rs",
      "line": 717,
      "problem": "`reopened_list` is used by one test only. Ten other places in the same file write `ThreadStore::open(folder.path()).unwrap().list(&range)` inline, including four of the new tests (777, 804, 826, 875). That leaves two ways of doing the same thing, and nothing else is harder because of it.",
      "fix": "Use `reopened_list` at 777, 804, 826 and 875 (and the older sites), or inline it again and shorten the edit test some other way."
    }
  ],
  "checked": [
    "Contract signatures match the brief: `ThreadStore::edit_note(&mut self, &Range, MessageId, &str) -> Result<ThreadList>` (thread_store.rs:149) and `delete_message(&mut self, &Range, MessageId) -> Result<ThreadList>` (:172). `Error::NotANote { message }` has the brief's doc line (lib.rs:226-231), and its message is lowercase with no trailing punctuation (RS7).",
    "Order of checks as in the brief and #123: `shown_message_mut` gives UnknownMessage for an unknown or unlisted message, then `unsent_note_mut` gives NotANote before MessagePending (thread_store.rs:242-256), then `require_text` runs after the lookup in edit only (:157).",
    "One writer of threads.json: both new methods clone `self.file`, edit the clone and go through `commit`, so a failed write keeps the old file. No new state, and no new row is needed in the state-ownership table.",
    "Deviation accepted: `change_posting` now uses `shown_message_mut`, which wraps the existing `ThreadFile::message_mut` with the same filter and error. `message_mut` is not new (waiting.rs:68 already uses it), and thread_file.rs is not touched.",
    "Delete keeps the thread file's invariants: thread_file.rs:98-127 refuses duplicate message ids and empty threads when reading, so the retain at thread_store.rs:175-178 removes exactly one message and at most its own thread. `Thread.messages` 'never empty' (thread_types.rs:117) still holds.",
    "Delete leaves the thread's `session` and the `nextThread`/`nextMessage` counters alone, so ids are never reused (#123). `answers_in` counts only `AiAnswer`s, so #121's turn numbering does not depend on deleted notes.",
    "send.rs posts each message as its own draft at its line (`position`/`line_place`), not as a reply to the thread's first message, so a thread whose first note is deleted still posts correctly.",
    "`record_if_waiting`'s UnknownMessage for a gone message is unchanged (waiting.rs:67-69), as the brief asks.",
    "src-tauri: `edit_note`/`delete_message` take `send_guard` before `locked(&state.threads)` (review.rs:96-97, 107-108), the same lock order as #117 and `send_queue`. Both are registered in commands.rs:57-58, and both use the same `#[expect(needless_pass_by_value)]` pattern as their sibling commands.",
    "IpcError::NotANote { message } was added (ipc_error.rs:63-65), the From mapping lists it explicitly with no wildcard (:190), and its JSON test is at ipc_error/tests.rs:250-259. The deviation that puts it in its own test because of the 40-line limit is accepted.",
    "review/tests.rs:132-153 checks SendRunning for both commands while the guard is held, and that the list is unchanged after release. :155-177 checks that the commands reach the store and that their refusals come back with the right kinds.",
    "Ownership: the implementer's files_changed are all within the brief's `Owned` globs. bindings.ts (editNote/deleteMessage, NotANote in the IpcError union), architecture.md:537/557, ipc-contract SKILL.md:82 and project-map line 95 match the new surface.",
    "Dependency direction is unchanged: no new crate edges, yamt-review still has no tauri (PM1), and no new `use` outside the crate's existing imports.",
    "Comments follow the comment policy: the `///` lines on `shown_message_mut`/`unsent_note_mut` say what the function returns and cite #123. The test rationale at review/tests.rs:132 follows the precedent at :120.",
    "No contradiction with plan §2 #117/#120/#121/#123: AI answers are never edited or deleted, Pending messages are refused, a queued or refused note becomes `Queued { text }` (the Post text is replaced and the refusal reason dropped), and a `NotQueued` note stays `NotQueued`.",
    "No tests or gates were run (RV6)."
  ]
}
```