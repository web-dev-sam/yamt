use yamt_range::{Range, RangeFileId};

use super::{ThreadStore, file_at};
use crate::{Error, MessageId, Posting, Result, ThreadLine};

/// A message waiting for the next send: queued, or refused and sent again. Its text is read again before the post.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct QueuedMessage {
    pub(crate) message: MessageId,
    pub(crate) file: RangeFileId,
    pub(crate) line: ThreadLine,
}

impl ThreadStore {
    /// Every queued or refused message on a file of `range`, in thread order, then message order.
    pub(crate) fn queued(&self, range: &Range) -> Vec<QueuedMessage> {
        let mut queued = Vec::new();
        for thread in &self.file.threads {
            let Some(file) = file_at(range, &thread.path) else {
                continue;
            };
            for message in &thread.messages {
                if waiting_text_of(&message.posting).is_some() {
                    queued.push(QueuedMessage {
                        message: message.id,
                        file,
                        line: thread.line,
                    });
                }
            }
        }
        queued
    }

    /// The text to post when the message still waits for a send; `None` once it is unqueued, pending or gone.
    pub(crate) fn waiting_text(&self, message: MessageId) -> Option<String> {
        let stored = self
            .file
            .threads
            .iter()
            .flat_map(|thread| &thread.messages)
            .find(|stored| stored.id == message)?;
        waiting_text_of(&stored.posting).map(str::to_owned)
    }

    /// The draft notes the store's pending messages own.
    pub(crate) fn pending_draft_notes(&self) -> Vec<u64> {
        let mut owned = Vec::new();
        for thread in &self.file.threads {
            for message in &thread.messages {
                if let Posting::Pending { draft_note, .. } = message.posting {
                    owned.push(draft_note);
                }
            }
        }
        owned
    }

    /// Stores what a send made of the message, only while it still waits with `posted_text`; whether it did.
    pub(crate) fn record_if_waiting(
        &mut self,
        message: MessageId,
        posted_text: &str,
        posting: Posting,
    ) -> Result<bool> {
        let mut next = self.file.clone();
        let (_, stored) = next
            .message_mut(message)
            .ok_or(Error::UnknownMessage { message })?;
        if waiting_text_of(&stored.posting) != Some(posted_text) {
            return Ok(false);
        }
        stored.posting = posting;
        self.commit(next)?;
        Ok(true)
    }
}

/// The text a send posts: a queued message's, or a refused one's sent again.
fn waiting_text_of(posting: &Posting) -> Option<&str> {
    match posting {
        Posting::Queued { text } | Posting::Refused { text, .. } => Some(text),
        Posting::NotQueued | Posting::Pending { .. } => None,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo};
    use yamt_merge_core::RightLine;
    use yamt_range::{RangeSpec, Resolved};

    use super::*;
    use crate::thread_file::THREADS_FILE;

    const STORED: &str = r#"{"format":1,"nextThread":3,"nextMessage":6,"threads":[
        {"id":2,"path":"b.txt","line":{"kind":"added","right":4},"session":null,"messages":[
            {"id":5,"body":{"kind":"note","text":"b"},"written":0,"posting":{"kind":"queued","text":"first"}},
            {"id":1,"body":{"kind":"note","text":"c"},"written":0,"posting":{"kind":"refused","text":"second","reason":"400"}}]},
        {"id":1,"path":"a.txt","line":{"kind":"added","right":4},"session":null,"messages":[
            {"id":2,"body":{"kind":"note","text":"d"},"written":0,"posting":{"kind":"notQueued"}},
            {"id":3,"body":{"kind":"note","text":"e"},"written":0,"posting":{"kind":"pending","text":"e","draft_note":7,"merge_request":"!1","link":"l"}},
            {"id":4,"body":{"kind":"note","text":"f"},"written":0,"posting":{"kind":"queued","text":"third"}}]}]}"#;

    fn stored_in(dir: &Path) -> ThreadStore {
        fs::write(dir.join(THREADS_FILE), STORED).unwrap();
        ThreadStore::open(dir).unwrap()
    }

    /// `main..local` lists a.txt (0) and b.txt (1); `main..remote` lists a.txt (0) only.
    fn repo() -> TempDir {
        let file = |path, local: &'static [u8], remote: Option<&'static [u8]>| ConflictFile {
            path,
            kind: FileKind::Regular,
            base: remote.map(|_| b"1\n".as_slice()),
            local: Some(local),
            remote,
        };
        diverged_repo(&[
            file("a.txt", b"2\n", Some(b"3\n")),
            file("b.txt", b"new\n", None),
        ])
        .unwrap()
    }

    fn range(repo: &TempDir, text: &str) -> Range {
        Resolved::resolve(repo.path(), &RangeSpec::parse(text).unwrap())
            .unwrap()
            .list()
            .unwrap()
    }

    #[test]
    fn queued_lists_queued_and_refused_messages_in_thread_then_message_order() {
        let repo = repo();
        let dir = tempfile::tempdir().unwrap();
        let store = stored_in(dir.path());
        let queued: Vec<_> = store
            .queued(&range(&repo, "main..local"))
            .into_iter()
            .map(|q| (q.message.0, q.file, q.line))
            .collect();
        let line = ThreadLine::Added {
            right: RightLine(4),
        };
        let expected = vec![
            (5, RangeFileId(1), line),
            (1, RangeFileId(1), line),
            (4, RangeFileId(0), line),
        ];
        assert_eq!(queued, expected);
    }

    #[test]
    fn waiting_text_is_a_queued_or_refused_message_s_text_now() {
        let dir = tempfile::tempdir().unwrap();
        let store = stored_in(dir.path());
        let texts: Vec<Option<String>> = [5, 1, 2, 3, 42]
            .into_iter()
            .map(|id| store.waiting_text(MessageId(id)))
            .collect();
        let first = Some("first".to_owned());
        let second = Some("second".to_owned());
        assert_eq!(texts, [first, second, None, None, None]);
    }

    #[test]
    fn pending_draft_notes_are_the_drafts_pending_messages_own() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(stored_in(dir.path()).pending_draft_notes(), [7]);
    }

    #[test]
    fn queued_leaves_out_messages_on_paths_the_range_does_not_list() {
        let repo = repo();
        let dir = tempfile::tempdir().unwrap();
        let store = stored_in(dir.path());
        let queued: Vec<_> = store
            .queued(&range(&repo, "main..remote"))
            .into_iter()
            .map(|q| (q.message.0, q.file))
            .collect();
        assert_eq!(queued, [(4, RangeFileId(0))]);
    }

    #[test]
    fn record_if_waiting_writes_the_posting_and_keeps_it() {
        let dir = tempfile::tempdir().unwrap();
        let mut store = stored_in(dir.path());
        let applied = store.record_if_waiting(MessageId(5), "first", pending("first"));
        assert!(applied.unwrap());
        let reopened = ThreadStore::open(dir.path()).unwrap();
        assert_eq!(reopened.file, store.file);
        let local = range(&repo(), "main..local");
        let ids: Vec<u32> = store.queued(&local).iter().map(|q| q.message.0).collect();
        assert_eq!(ids, [1, 4]);
        assert_eq!(store.pending_draft_notes(), [9, 7]);
    }

    #[test]
    fn record_if_waiting_leaves_a_changed_message_alone_and_refuses_an_unknown_one() {
        let dir = tempfile::tempdir().unwrap();
        let mut store = stored_in(dir.path());
        let before = store.file.clone();
        let edited = store.record_if_waiting(MessageId(5), "older text", pending("older text"));
        assert!(!edited.unwrap());
        let unqueued = store.record_if_waiting(MessageId(2), "d", pending("d"));
        assert!(!unqueued.unwrap());
        let already_pending = store.record_if_waiting(MessageId(3), "e", pending("e"));
        assert!(!already_pending.unwrap());
        assert_eq!(store.file, before);
        assert_eq!(ThreadStore::open(dir.path()).unwrap().file, before);
        let unknown = store.record_if_waiting(MessageId(42), "x", Posting::NotQueued);
        let message = MessageId(42);
        assert!(matches!(unknown, Err(Error::UnknownMessage { message: m }) if m == message));
    }

    fn pending(text: &str) -> Posting {
        Posting::Pending {
            text: text.to_owned(),
            draft_note: 9,
            merge_request: "!1".to_owned(),
            link: "l".to_owned(),
        }
    }
}
