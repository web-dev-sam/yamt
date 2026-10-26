#![cfg(test)]

use std::fmt::Debug;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo};
use yamt_merge_core::{LeftLine, RightLine};
use yamt_range::{Range, RangeFileId, RangeSpec, Resolved};
use yamt_review::{
    Error, MessageBody, MessageId, Posting, Thread, ThreadAdded, ThreadId, ThreadLine, ThreadList,
    ThreadStore,
};

const THREADS: &str = "threads.json";

/// `main..local` lists a.txt (0), b.txt (1) and c.txt (2); `main..remote` lists c.txt (0) only.
fn repo() -> TempDir {
    let file = |path, base, local, remote| ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote,
    };
    let a: &[u8] = b"1\n";
    diverged_repo(&[
        file("a.txt", Some(a), Some(b"2\n"), Some(a)),
        file("b.txt", None, Some(b"new\n"), None),
        file("c.txt", Some(b"x\n"), Some(b"y\n"), Some(b"z\n")),
    ])
    .unwrap()
}

fn range(root: &Path, text: &str) -> Range {
    Resolved::resolve(root, &RangeSpec::parse(text).unwrap())
        .unwrap()
        .list()
        .unwrap()
}

fn local_range(repo: &TempDir) -> Range {
    range(repo.path(), "main..local")
}

fn threads_path(folder: &TempDir) -> PathBuf {
    folder.path().join(THREADS)
}

fn stored(folder: &TempDir, json: &str) {
    fs::write(threads_path(folder), json).unwrap();
}

fn on_disk(folder: &TempDir) -> Vec<u8> {
    fs::read(threads_path(folder)).unwrap()
}

fn json_on_disk(folder: &TempDir) -> Value {
    serde_json::from_slice(&on_disk(folder)).unwrap()
}

fn added_line() -> ThreadLine {
    ThreadLine::Added {
        right: RightLine(0),
    }
}

fn note(text: &str) -> MessageBody {
    MessageBody::Note {
        text: text.to_owned(),
    }
}

fn ai_answer(session: &str, turn: u32) -> MessageBody {
    MessageBody::AiAnswer {
        session: session.to_owned(),
        turn,
    }
}

/// The first message of a new thread on a.txt, through the store.
fn store_with_one_thread(folder: &TempDir, range: &Range) -> ThreadStore {
    let mut store = ThreadStore::open(folder.path()).unwrap();
    store
        .add_thread(range, RangeFileId(0), added_line(), "Why 300?")
        .unwrap();
    store
}

fn bodies(list: &ThreadList) -> Vec<MessageBody> {
    let messages = &only_thread(list).messages;
    messages
        .iter()
        .map(|message| message.body.clone())
        .collect()
}

fn refusal(folder: &TempDir) -> Error {
    match ThreadStore::open(folder.path()) {
        Ok(_) => panic!("the store opened"),
        Err(error) => error,
    }
}

fn broken_message(folder: &TempDir, json: &str) -> String {
    stored(folder, json);
    let Error::Broken { path, message } = refusal(folder) else {
        panic!("expected Broken");
    };
    assert_eq!(path, threads_path(folder));
    message
}

/// The error's words; the ids they name are the ones asked for.
fn refused<T: Debug>(result: Result<T, Error>) -> String {
    match result {
        Ok(answer) => panic!("expected an error, got {answer:?}"),
        Err(error) => error.to_string(),
    }
}

fn only_thread(list: &ThreadList) -> &Thread {
    assert_eq!(list.threads.len(), 1, "{list:?}");
    &list.threads[0]
}

fn folder_names(folder: &TempDir) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(folder.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

const EVERY_KIND: &str = r#"{
  "format": 1,
  "nextThread": 5,
  "nextMessage": 7,
  "threads": [
    { "id": 1, "path": "a.txt", "line": { "kind": "removed", "left": 3 }, "session": "omp-session-1",
      "messages": [
        { "id": 1, "body": { "kind": "note", "text": "Why 300?" }, "written": 1761300000, "posting": { "kind": "notQueued" } },
        { "id": 2, "body": { "kind": "aiAnswer", "session": "omp-session-0", "turn": 3 }, "written": 1761300001, "posting": { "kind": "queued", "text": "Why 300 ms?" } } ] },
    { "id": 2, "path": "b.txt", "line": { "kind": "added", "right": 4 }, "session": null,
      "messages": [
        { "id": 3, "body": { "kind": "note", "text": "t" }, "written": 1761300002, "posting": { "kind": "refused", "text": "t", "reason": "400 Bad request" } } ] },
    { "id": 3, "path": "c.txt", "line": { "kind": "unchangedOnLeft", "left": 5, "right": 6 }, "session": null,
      "messages": [
        { "id": 4, "body": { "kind": "note", "text": "p" }, "written": 1761300003,
          "posting": { "kind": "pending", "text": "p", "draft_note": 12345678901, "merge_request": "!12", "link": "https://gitlab.example/g/p/-/merge_requests/12/diffs" } } ] },
    { "id": 4, "path": "c.txt", "line": { "kind": "unchangedOnRight", "left": 7, "right": 8 }, "session": null,
      "messages": [
        { "id": 6, "body": { "kind": "note", "text": "u" }, "written": 1761300004, "posting": { "kind": "notQueued" } } ] }
  ]
}"#;

#[test]
fn a_missing_file_is_an_empty_store_and_nothing_is_written() {
    let repo = repo();
    let folder = tempfile::tempdir().unwrap();
    let store = ThreadStore::open(folder.path()).unwrap();
    assert_eq!(store.list(&local_range(&repo)).threads, []);
    assert_eq!(folder_names(&folder), Vec::<String>::new());
}

#[test]
fn format_1_round_trips_every_body_and_posting_kind_and_a_session() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();

    let list = store.list(&range);
    let files: Vec<(u32, RangeFileId)> = list.threads.iter().map(|t| (t.id.0, t.file)).collect();
    assert_eq!(
        files,
        [
            (1, RangeFileId(0)),
            (2, RangeFileId(1)),
            (3, RangeFileId(2)),
            (4, RangeFileId(2))
        ]
    );
    let first = &list.threads[0];
    assert_eq!(first.session.as_deref(), Some("omp-session-1"));
    assert_eq!(first.line, ThreadLine::Removed { left: LeftLine(3) });
    assert_eq!(first.messages[1].body, ai_answer("omp-session-0", 3));
    assert_eq!(first.messages[1].written, 1_761_300_001);
    assert_eq!(
        list.threads[2].messages[0].posting,
        Posting::Pending {
            text: "p".to_owned(),
            draft_note: 12_345_678_901,
            merge_request: "!12".to_owned(),
            link: "https://gitlab.example/g/p/-/merge_requests/12/diffs".to_owned(),
        }
    );

    store.add_note(&range, ThreadId(4), "more").unwrap();
    let mut written = json_on_disk(&folder);
    written["threads"][3]["messages"]
        .as_array_mut()
        .unwrap()
        .pop();
    written["nextMessage"] = Value::from(7);
    let original: Value = serde_json::from_str(EVERY_KIND).unwrap();
    assert_eq!(written, original);
}

#[test]
fn a_broken_file_names_line_and_column_and_is_left_unchanged() {
    let folder = tempfile::tempdir().unwrap();
    let json = "{\n  \"format\": 1,\n  oops\n}";
    let message = broken_message(&folder, json);
    assert!(message.contains("line 3 column 3"), "{message}");
    assert_eq!(on_disk(&folder), json.as_bytes());
    assert_eq!(folder_names(&folder), [THREADS]);
}

#[test]
fn a_newer_format_is_refused_and_left_unchanged() {
    let folder = tempfile::tempdir().unwrap();
    let json = r#"{"format":2,"anything":"else"}"#;
    stored(&folder, json);
    let error = refusal(&folder);
    assert!(
        matches!(&error, Error::NewerFormat { path, format: 2 } if *path == threads_path(&folder)),
        "{error:?}"
    );
    assert_eq!(on_disk(&folder), json.as_bytes());
    assert_eq!(folder_names(&folder), [THREADS]);
}

#[test]
fn a_threads_json_that_cannot_be_read_is_read_failed_and_nothing_in_the_folder_changes() {
    let folder = tempfile::tempdir().unwrap();
    fs::create_dir(threads_path(&folder)).unwrap();
    let error = refusal(&folder);
    assert!(
        matches!(&error, Error::ReadFailed { path, .. } if *path == threads_path(&folder)),
        "{error:?}"
    );
    assert_eq!(folder_names(&folder), [THREADS]);
}

fn message_json(id: u32) -> String {
    format!(
        r#"{{"id":{id},"body":{{"kind":"note","text":"a"}},"written":0,"posting":{{"kind":"notQueued"}}}}"#
    )
}

fn thread_json(id: u32, messages: &[String]) -> String {
    format!(
        r#"{{"id":{id},"path":"a.txt","line":{{"kind":"added","right":0}},"session":null,"messages":[{}]}}"#,
        messages.join(",")
    )
}

fn file_json(next_thread: u32, next_message: u32, threads: &[String]) -> String {
    format!(
        r#"{{"format":1,"nextThread":{next_thread},"nextMessage":{next_message},"threads":[{}]}}"#,
        threads.join(",")
    )
}

#[test]
fn repeated_ids_ids_at_or_above_next_and_threads_without_messages_are_broken() {
    let one = |thread, message| thread_json(thread, &[message_json(message)]);
    let cases = [
        (
            file_json(3, 3, &[one(1, 1), one(1, 2)]),
            "the thread id 1 appears twice",
        ),
        (
            file_json(2, 3, &[thread_json(1, &[message_json(1), message_json(1)])]),
            "the message id 1 appears twice",
        ),
        (
            file_json(2, 2, &[one(2, 1)]),
            "the thread id 2 is not below `nextThread` 2",
        ),
        (
            file_json(2, 2, &[one(1, 3)]),
            "the message id 3 is not below `nextMessage` 2",
        ),
        (
            file_json(2, 2, &[thread_json(1, &[])]),
            "the thread 1 has no messages",
        ),
    ];
    for (json, expected) in cases {
        let folder = tempfile::tempdir().unwrap();
        assert_eq!(broken_message(&folder, &json), expected);
        assert_eq!(on_disk(&folder), json.as_bytes());
    }
}

#[test]
fn adding_writes_the_thread_with_its_first_message_and_new_ids() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let before = now();
    let added = store
        .add_thread(&range, RangeFileId(1), added_line(), "Why 300?")
        .unwrap();
    let after = now();

    assert_eq!(added.thread, ThreadId(1));
    let thread = only_thread(&added.list);
    assert_eq!(
        (thread.id, thread.file, thread.line, &thread.session),
        (ThreadId(1), RangeFileId(1), added_line(), &None)
    );
    let first = &thread.messages[0];
    assert_eq!(first.id, MessageId(1));
    assert_eq!(first.body, note("Why 300?"));
    assert_eq!(first.posting, Posting::NotQueued);
    assert!(
        (before..=after).contains(&first.written),
        "{}",
        first.written
    );

    let written = json_on_disk(&folder);
    assert_eq!(written["format"], 1);
    assert_eq!(written["nextThread"], 2);
    assert_eq!(written["nextMessage"], 2);
    assert_eq!(written["threads"][0]["path"], "b.txt");
    assert_eq!(
        ThreadStore::open(folder.path()).unwrap().list(&range),
        added.list
    );

    let list = store.add_note(&range, ThreadId(1), "Because.").unwrap();
    let messages = &only_thread(&list).messages;
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[1].id, MessageId(2));
    assert_eq!(messages[1].body, note("Because."));
    assert_eq!(ThreadStore::open(folder.path()).unwrap().list(&range), list);
}

#[test]
fn ids_never_repeat_after_reopening() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(
        &folder,
        r#"{"format":1,"nextThread":10,"nextMessage":20,"threads":[{"id":1,"path":"a.txt","line":{"kind":"added","right":0},"session":null,"messages":[{"id":1,"body":{"kind":"note","text":"a"},"written":0,"posting":{"kind":"notQueued"}}]}]}"#,
    );
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let ThreadAdded { thread, list } = store
        .add_thread(&range, RangeFileId(0), added_line(), "b")
        .unwrap();
    assert_eq!(thread, ThreadId(10));
    assert_eq!(list.threads[1].messages[0].id, MessageId(20));

    let mut reopened = ThreadStore::open(folder.path()).unwrap();
    let again = reopened
        .add_thread(&range, RangeFileId(0), added_line(), "c")
        .unwrap();
    assert_eq!(again.thread, ThreadId(11));
    assert_eq!(again.list.threads[2].messages[0].id, MessageId(21));
}

#[test]
fn blank_text_is_refused_and_nothing_written() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let blank = " \n\t ";
    let result = store.add_thread(&range, RangeFileId(0), added_line(), blank);
    assert!(matches!(result, Err(Error::EmptyMessage)), "{result:?}");
    assert_eq!(folder_names(&folder), Vec::<String>::new());

    let list = store
        .add_thread(&range, RangeFileId(0), added_line(), "a")
        .unwrap()
        .list;
    let bytes = on_disk(&folder);
    let note = store.add_note(&range, ThreadId(1), blank);
    assert!(matches!(note, Err(Error::EmptyMessage)), "{note:?}");
    let queue = store.queue(&range, MessageId(1), "");
    assert!(matches!(queue, Err(Error::EmptyMessage)), "{queue:?}");
    assert_eq!(on_disk(&folder), bytes);
    assert_eq!(store.list(&range), list);
}

#[test]
fn queue_keeps_the_edited_text_and_unqueue_drops_it() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();

    let queued = store.queue(&range, MessageId(1), "Why 300 ms?").unwrap();
    let first = &queued.threads[0].messages[0];
    assert_eq!(first.body, note("Why 300?"));
    assert_eq!(
        first.posting,
        Posting::Queued {
            text: "Why 300 ms?".to_owned()
        }
    );
    assert_eq!(
        ThreadStore::open(folder.path()).unwrap().list(&range),
        queued
    );

    let requeued = store.queue(&range, MessageId(3), "t, again").unwrap();
    assert_eq!(
        requeued.threads[1].messages[0].posting,
        Posting::Queued {
            text: "t, again".to_owned()
        }
    );

    let unqueued = store.unqueue(&range, MessageId(1)).unwrap();
    assert_eq!(unqueued.threads[0].messages[0].posting, Posting::NotQueued);
    assert_eq!(unqueued.threads[0].messages[0].body, note("Why 300?"));
    assert_eq!(
        ThreadStore::open(folder.path()).unwrap().list(&range),
        unqueued
    );
}

#[test]
fn a_pending_message_cannot_be_queued_or_unqueued() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let list = store.list(&range);

    let queue = store.queue(&range, MessageId(4), "again");
    assert!(
        matches!(
            queue,
            Err(Error::MessagePending {
                message: MessageId(4)
            })
        ),
        "{queue:?}"
    );
    let unqueue = store.unqueue(&range, MessageId(4));
    assert!(
        matches!(
            unqueue,
            Err(Error::MessagePending {
                message: MessageId(4)
            })
        ),
        "{unqueue:?}"
    );
    assert_eq!(on_disk(&folder), EVERY_KIND.as_bytes());
    assert_eq!(store.list(&range), list);
}

#[test]
fn a_failed_write_changes_nothing_in_memory() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let list = store
        .add_thread(&range, RangeFileId(0), added_line(), "a")
        .unwrap()
        .list;
    let bytes = on_disk(&folder);
    let temp = folder.path().join("threads.json.tmp");
    fs::create_dir(&temp).unwrap();
    fs::write(temp.join("in the way"), "").unwrap();

    let failures = [
        store
            .add_thread(&range, RangeFileId(1), added_line(), "b")
            .map(|added| added.list),
        store.add_note(&range, ThreadId(1), "b"),
        store.queue(&range, MessageId(1), "b"),
        store.set_session(&range, ThreadId(1), "omp-1"),
        store.add_ai_answer(&range, ThreadId(1), "omp-1"),
    ];
    for failure in failures {
        assert!(
            matches!(&failure, Err(Error::WriteFailed { path, .. }) if *path == threads_path(&folder)),
            "{failure:?}"
        );
    }
    assert_eq!(store.list(&range), list);
    assert_eq!(on_disk(&folder), bytes);

    fs::remove_dir_all(&temp).unwrap();
    let added = store
        .add_thread(&range, RangeFileId(1), added_line(), "b")
        .unwrap();
    assert_eq!(added.thread, ThreadId(2));
    assert_eq!(added.list.threads[1].messages[0].id, MessageId(2));
}

#[test]
fn threads_on_paths_no_longer_listed_are_kept_on_every_write() {
    let repo = repo();
    let local = local_range(&repo);
    let remote = range(repo.path(), "main..remote");
    let folder = tempfile::tempdir().unwrap();
    let mut store = ThreadStore::open(folder.path()).unwrap();
    for (file, text) in [(0, "on a"), (1, "on b"), (2, "on c")] {
        store
            .add_thread(&local, RangeFileId(file), added_line(), text)
            .unwrap();
    }

    let mut reopened = ThreadStore::open(folder.path()).unwrap();
    assert_eq!(reopened.unlisted_paths(&remote), ["a.txt", "b.txt"]);
    assert_eq!(reopened.unlisted_paths(&local), Vec::<String>::new());
    let shown = reopened.list(&remote);
    let thread = only_thread(&shown);
    assert_eq!((thread.id, thread.file), (ThreadId(3), RangeFileId(0)));

    let after_note = reopened.add_note(&remote, ThreadId(3), "more").unwrap();
    assert_eq!(only_thread(&after_note).messages.len(), 2);
    let hidden = reopened.add_note(&remote, ThreadId(1), "more");
    assert_eq!(refused(hidden), "no review thread has the id 1");
    let hidden_message = reopened.queue(&remote, MessageId(1), "more");
    assert_eq!(refused(hidden_message), "no review message has the id 1");
    reopened.queue(&remote, MessageId(3), "queued").unwrap();

    let all = ThreadStore::open(folder.path()).unwrap().list(&local);
    let ids: Vec<(u32, u32)> = all.threads.iter().map(|t| (t.id.0, t.file.0)).collect();
    assert_eq!(ids, [(1, 0), (2, 1), (3, 2)]);
    assert_eq!(all.threads[1].messages[0].body, note("on b"));
}

#[test]
fn a_leftover_temp_file_is_ignored() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let temp = folder.path().join("threads.json.tmp");
    fs::write(&temp, "{ half written").unwrap();

    let mut store = ThreadStore::open(folder.path()).unwrap();
    assert_eq!(store.list(&range).threads, []);
    let list = store
        .add_thread(&range, RangeFileId(0), added_line(), "a")
        .unwrap()
        .list;
    assert_eq!(ThreadStore::open(folder.path()).unwrap().list(&range), list);
    assert_eq!(folder_names(&folder), [THREADS]);
}

#[test]
fn an_unknown_file_thread_or_message_is_its_error() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let list = store.list(&range);

    let file = store.add_thread(&range, RangeFileId(3), added_line(), "a");
    assert_eq!(refused(file), "no file 3 in this range");
    let thread = store.add_note(&range, ThreadId(5), "a");
    assert_eq!(refused(thread), "no review thread has the id 5");
    let queue = store.queue(&range, MessageId(5), "a");
    assert_eq!(refused(queue), "no review message has the id 5");
    let unqueue = store.unqueue(&range, MessageId(5));
    assert_eq!(refused(unqueue), "no review message has the id 5");
    assert_eq!(on_disk(&folder), EVERY_KIND.as_bytes());
    assert_eq!(store.list(&range), list);
}

#[test]
fn a_session_is_stored_survives_a_reopen_and_a_second_one_replaces_it() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = store_with_one_thread(&folder, &range);

    let list = store.set_session(&range, ThreadId(1), "omp-1").unwrap();
    assert_eq!(only_thread(&list).session.as_deref(), Some("omp-1"));
    assert_eq!(only_thread(&list).messages.len(), 1);
    let mut reopened = ThreadStore::open(folder.path()).unwrap();
    assert_eq!(reopened.list(&range), list);

    let replaced = reopened.set_session(&range, ThreadId(1), "omp-2").unwrap();
    assert_eq!(only_thread(&replaced).session.as_deref(), Some("omp-2"));
    assert_eq!(json_on_disk(&folder)["threads"][0]["session"], "omp-2");
    assert_eq!(
        ThreadStore::open(folder.path()).unwrap().list(&range),
        replaced
    );
}

#[test]
fn answers_number_0_1_2_within_a_session_and_a_new_session_starts_again_at_0() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = store_with_one_thread(&folder, &range);

    for _ in 0..3 {
        store.add_ai_answer(&range, ThreadId(1), "omp-1").unwrap();
    }
    let first_answers = store.list(&range);
    assert_eq!(
        only_thread(&first_answers).session.as_deref(),
        Some("omp-1")
    );
    store.add_note(&range, ThreadId(1), "And 400?").unwrap();
    let list = store.add_ai_answer(&range, ThreadId(1), "omp-2").unwrap();

    let expected = [
        note("Why 300?"),
        ai_answer("omp-1", 0),
        ai_answer("omp-1", 1),
        ai_answer("omp-1", 2),
        note("And 400?"),
        ai_answer("omp-2", 0),
    ];
    assert_eq!(bodies(&list), expected);
    let thread = only_thread(&list);
    assert_eq!(thread.session.as_deref(), Some("omp-2"));
    let ids: Vec<u32> = thread.messages.iter().map(|message| message.id.0).collect();
    assert_eq!(ids, [1, 2, 3, 4, 5, 6]);
    let newest = &thread.messages[5];
    assert_eq!(newest.posting, Posting::NotQueued);
    assert!(newest.written > 0, "{}", newest.written);
    assert_eq!(ThreadStore::open(folder.path()).unwrap().list(&range), list);
}

#[test]
fn an_answer_counts_only_its_own_session_s_answers_and_keeps_the_older_ones() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = store_with_one_thread(&folder, &range);
    store.add_ai_answer(&range, ThreadId(1), "omp-1").unwrap();
    store.add_ai_answer(&range, ThreadId(1), "omp-2").unwrap();
    store.set_session(&range, ThreadId(1), "omp-1").unwrap();

    let list = store.add_ai_answer(&range, ThreadId(1), "omp-1").unwrap();

    let expected = [
        note("Why 300?"),
        ai_answer("omp-1", 0),
        ai_answer("omp-2", 0),
        ai_answer("omp-1", 1),
    ];
    assert_eq!(bodies(&list), expected);
    assert_eq!(only_thread(&list).session.as_deref(), Some("omp-1"));
}

#[test]
fn format_1_writes_an_ai_answer_with_its_session_and_turn() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = store_with_one_thread(&folder, &range);

    let list = store.add_ai_answer(&range, ThreadId(1), "omp-1").unwrap();

    let written = json_on_disk(&folder);
    let answer = serde_json::json!({ "kind": "aiAnswer", "session": "omp-1", "turn": 0 });
    assert_eq!(written["threads"][0]["messages"][1]["body"], answer);
    assert_eq!(written["threads"][0]["session"], "omp-1");
    assert_eq!(written["nextMessage"], 3);
    assert_eq!(ThreadStore::open(folder.path()).unwrap().list(&range), list);
}

#[test]
fn an_unknown_or_unlisted_thread_gets_no_session_or_answer_and_nothing_is_written() {
    let repo = repo();
    let local = local_range(&repo);
    let remote = range(repo.path(), "main..remote");
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let list = store.list(&local);

    let session = store.set_session(&local, ThreadId(5), "omp-1");
    assert_eq!(refused(session), "no review thread has the id 5");
    let answer = store.add_ai_answer(&local, ThreadId(5), "omp-1");
    assert_eq!(refused(answer), "no review thread has the id 5");
    let hidden_session = store.set_session(&remote, ThreadId(1), "omp-1");
    assert_eq!(refused(hidden_session), "no review thread has the id 1");
    let hidden_answer = store.add_ai_answer(&remote, ThreadId(1), "omp-1");
    assert_eq!(refused(hidden_answer), "no review thread has the id 1");
    assert_eq!(on_disk(&folder), EVERY_KIND.as_bytes());
    assert_eq!(store.list(&local), list);
}
