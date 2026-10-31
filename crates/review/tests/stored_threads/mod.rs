use std::fmt::Debug;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo};
use yamt_merge_core::RightLine;
use yamt_range::{Range, RangeFileId, RangeSpec, Resolved};
use yamt_review::{Error, MessageBody, Thread, ThreadLine, ThreadList, ThreadPlace, ThreadStore};

pub const THREADS: &str = "threads.json";

/// `main..local` lists a.txt (0), b.txt (1) and c.txt (2); `main..remote` lists c.txt (0) only.
pub fn repo() -> TempDir {
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

pub fn range(root: &Path, text: &str) -> Range {
    Resolved::resolve(root, &RangeSpec::parse(text).unwrap())
        .unwrap()
        .list()
        .unwrap()
}

pub fn local_range(repo: &TempDir) -> Range {
    range(repo.path(), "main..local")
}

pub fn threads_path(folder: &TempDir) -> PathBuf {
    folder.path().join(THREADS)
}

pub fn stored(folder: &TempDir, json: &str) {
    fs::write(threads_path(folder), json).unwrap();
}

pub fn on_disk(folder: &TempDir) -> Vec<u8> {
    fs::read(threads_path(folder)).unwrap()
}

pub fn json_on_disk(folder: &TempDir) -> Value {
    serde_json::from_slice(&on_disk(folder)).unwrap()
}

pub fn added_place() -> ThreadPlace {
    ThreadPlace::one_line(ThreadLine::Added {
        right: RightLine(0),
    })
}

pub fn note(text: &str) -> MessageBody {
    MessageBody::Note {
        text: text.to_owned(),
    }
}

pub fn ai_answer(session: &str, turn: u32) -> MessageBody {
    MessageBody::AiAnswer {
        session: session.to_owned(),
        turn,
    }
}

/// The first message of a new thread on a.txt, through the store.
pub fn store_with_one_thread(folder: &TempDir, range: &Range) -> ThreadStore {
    let mut store = ThreadStore::open(folder.path()).unwrap();
    store
        .add_thread(range, RangeFileId(0), added_place(), "Why 300?")
        .unwrap();
    store
}

pub fn bodies(list: &ThreadList) -> Vec<MessageBody> {
    let messages = &only_thread(list).messages;
    messages
        .iter()
        .map(|message| message.body.clone())
        .collect()
}

/// The error's words; the ids they name are the ones asked for.
pub fn refused<T: Debug>(result: Result<T, Error>) -> String {
    match result {
        Ok(answer) => panic!("expected an error, got {answer:?}"),
        Err(error) => error.to_string(),
    }
}

pub fn only_thread(list: &ThreadList) -> &Thread {
    assert_eq!(list.threads.len(), 1, "{list:?}");
    &list.threads[0]
}

/// Today's format: one thread per kind of end line, each on one line, and thread 5 on a range across both sides.
pub const EVERY_KIND: &str = r#"{
  "format": 2,
  "nextThread": 6,
  "nextMessage": 8,
  "threads": [
    { "id": 1, "path": "a.txt",
      "place": { "start": { "kind": "removed", "left": 3 }, "end": { "kind": "removed", "left": 3 } },
      "session": "omp-session-1",
      "messages": [
        { "id": 1, "body": { "kind": "note", "text": "Why 300?" }, "written": 1761300000, "posting": { "kind": "notQueued" } },
        { "id": 2, "body": { "kind": "aiAnswer", "session": "omp-session-0", "turn": 3 }, "written": 1761300001, "posting": { "kind": "queued", "text": "Why 300 ms?" } } ] },
    { "id": 2, "path": "b.txt",
      "place": { "start": { "kind": "added", "right": 4 }, "end": { "kind": "added", "right": 4 } },
      "session": null,
      "messages": [
        { "id": 3, "body": { "kind": "note", "text": "t" }, "written": 1761300002, "posting": { "kind": "refused", "text": "t", "reason": "400 Bad request" } } ] },
    { "id": 3, "path": "c.txt",
      "place": { "start": { "kind": "unchanged", "left": 5, "right": 6 }, "end": { "kind": "unchangedOnLeft", "left": 5, "right": 6 } },
      "session": null,
      "messages": [
        { "id": 4, "body": { "kind": "note", "text": "p" }, "written": 1761300003,
          "posting": { "kind": "pending", "text": "p", "draft_note": 12345678901, "merge_request": "!12", "link": "https://gitlab.example/g/p/-/merge_requests/12/diffs" } } ] },
    { "id": 4, "path": "c.txt",
      "place": { "start": { "kind": "unchanged", "left": 7, "right": 8 }, "end": { "kind": "unchangedOnRight", "left": 7, "right": 8 } },
      "session": null,
      "messages": [
        { "id": 6, "body": { "kind": "note", "text": "u" }, "written": 1761300004, "posting": { "kind": "notQueued" } } ] },
    { "id": 5, "path": "c.txt",
      "place": { "start": { "kind": "removed", "left": 1 }, "end": { "kind": "added", "right": 2 } },
      "session": null,
      "messages": [
        { "id": 7, "body": { "kind": "note", "text": "r" }, "written": 1761300005, "posting": { "kind": "notQueued" } } ] }
  ]
}"#;
