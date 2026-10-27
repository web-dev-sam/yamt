# RVNoteEditsRustR1Check — boundary re-check of ec75aa4

Verbatim output:

```json
{
  "verdict": "pass",
  "findings": [],
  "items": [
    {
      "id": 1639,
      "status": "fixed",
      "evidence": "crates/review/src/thread_store.rs:162 now reads `if waiting_text_of(&stored.posting).is_some() { stored.posting = Posting::Queued { text: text.to_owned() } }`. `waiting_text_of` is `pub(super)` at thread_store/waiting.rs:79-84 and is an exhaustive `match` over all four `Posting` variants. thread_store.rs:14 imports it. A grep for `matches!(` in crates/review/src finds only test assertions (thread_file.rs:312/318, waiting.rs:213)."
    },
    {
      "id": 1640,
      "status": "fixed",
      "evidence": "`ThreadFile::remove_message` (crates/review/src/thread_file.rs:95-111) finds the message once, takes it out of its own thread, removes that thread when it is left empty, and returns. `delete_message` (thread_store.rs:172-178) first runs the read-only check `require_unsent_note(shown_message(&self.file, range, message)?)?`, then clones and calls `next.remove_message(message)`. `unsent_note_mut` and the `retain` scan over every thread are gone: the only `retain(` left in src is send.rs:202, which is about drafts."
    },
    {
      "id": 1641,
      "status": "fixed",
      "evidence": "All eight edit/delete tests are now in crates/review/tests/note_edits.rs (242 lines), with `queued` and `reopened_list` local to that file. The shared builders (`repo`, `range`, `local_range`, `stored`, `on_disk`, `json_on_disk`, `EVERY_KIND`, `refused`, `bodies`, `only_thread`, `store_with_one_thread`, `note`, `ai_answer`, `added_line`, `threads_path`, `THREADS`) exist once, in tests/stored_threads/mod.rs, and both files use them through `mod stored_threads;`. threads.rs has no `const` or builder copies left (grep `^fn |^const ` shows only its own `refusal`, `broken_message`, `folder_names`, `now`, `message_json`, `thread_json`, `file_json`). It still mentions edit_note/delete_message only in the failed-write test at :382-383. threads.rs …
    }
  ],
  "checked": [
    "Deviation accepted: read-only `ThreadFile::message` (thread_file.rs:70-78) sits next to `message_mut` (:81-93) with the same lookup. Its callers are `shown_message` (thread_store.rs:232) and `waiting_text` (waiting.rs:37). `waiting_text` still searches every thread, unlisted paths included, as the old `flat_map` did, and returns `None` for a gone message as before. So there is still one lookup by id, in a read form and a write form.",
    "Deviation accepted: `require_unsent_note(&Message)` (thread_store.rs:~250-261) checks `MessageBody` and then `Posting`, both as exhaustive `match`es with no wildcard. The error order is unchanged: UnknownMessage (shown_message/_mut) → NotANote → MessagePending → EmptyMessage (edit only: `require_text` runs after the check at :160). `delete_message` clones only after the check passes and changes no behaviour.",
    "Deviation accepted: threads.rs stays at 593 lines. What is left covers format/broken files (:52-192), add/queue/write failures (:194-474) and session/answer (:476-593). None of it is about this round's edit/delete, and the brief allowed exactly this exception if it was reported.",
    "Accepted open risk: `remove_message` calls `self.threads.remove(index)` inside the `iter_mut().enumerate()` loop. It returns right after, so the iterator is never used again. The implementer reports a clean clippy run with `-D warnings`. Behaviour matches the old retain plus empty-thread filter, because thread_file.rs `problem()` refuses repeated message ids and empty threads on read. So exactly one message and at most its own thread are removed. The loop form is a readability point, not growth harm, so per RV8 it is not reported.",
    "`remove_message` never needs a not-found answer: its only caller runs `shown_message` first, so the message exists in a listed thread. Thread order and the `nextThread`/`nextMessage` counters are untouched. tests/note_edits.rs `a_thread_loses_its_last_message_and_goes_while_its_neighbours_keep_order_and_ids` checks ids (1,0),(3,2),(4,2) and counters 5/7 on disk.",
    "One writer of threads.json is unchanged: edit_note and delete_message both go through `commit(next)`, and a failed write keeps the old file (threads.rs:360-400 still runs both).",
    "The round-1 tests moved without their assertions changing. The only changes are four `ThreadStore::open(..).unwrap().list(&range)` lines replaced by `reopened_list(&folder, &range)`, which is the same expression (note_edits.rs:20-22). This also applies round 1's nit.",
    "Ownership: every file changed (thread_store.rs, thread_store/waiting.rs, thread_file.rs, tests/threads.rs, tests/note_edits.rs, tests/stored_threads/mod.rs, AGENTS.md) is inside the brief's Owned list.",
    "Docs match the code. crates/review/AGENTS.md names `message`/`message_mut` as the one lookup by id and `remove_message` as the one removal. Project-map lines 66 and 68 now name `edit_note`/`delete_message` and `message`/`message_mut`/`remove_message`, which closes round 1's PM6 should outside this brief.",
    "No new crate edges, `use` items or state. `waiting_text_of` widened only from private to `pub(super)`. The `///` lines on `message`, `remove_message` and `require_unsent_note` say what each returns or refuses (CP2). There are no narration comments.",
    "No tests or gates were run (RV6)."
  ]
}
```

[Some lines truncated to 768 chars. Use agent://RVNoteEditsRustR1Check:raw:19-19 to read line 19 whole]