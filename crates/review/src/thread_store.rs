use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use yamt_range::{Range, RangeFileId};

use crate::thread_file::{StoredThread, THREADS_FILE, ThreadFile, read_threads, write_threads};
use crate::{
    Error, Message, MessageBody, MessageId, Posting, Result, Thread, ThreadAdded, ThreadId,
    ThreadLine, ThreadList,
};

/// The threads of one pair folder; the pair lock makes its process the only writer.
#[derive(Debug)]
pub struct ThreadStore {
    path: PathBuf,
    file: ThreadFile,
}

/// A message waiting for the next send: queued, or refused and sent again.
#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(not(test), expect(dead_code, reason = "the sender of row 16 reads it"))]
pub(crate) struct QueuedMessage {
    pub(crate) thread: ThreadId,
    pub(crate) message: MessageId,
    pub(crate) path: String,
    pub(crate) line: ThreadLine,
    pub(crate) text: String,
}

impl ThreadStore {
    /// Reads `<folder>/threads.json`; a missing file is an empty store, and nothing is written.
    pub fn open(folder: &Path) -> Result<ThreadStore> {
        let path = folder.join(THREADS_FILE);
        let file = read_threads(&path)?.unwrap_or_else(ThreadFile::empty);
        Ok(ThreadStore { path, file })
    }

    /// The threads on files of `range`, in creation order; threads on other paths are kept but left out.
    #[must_use]
    pub fn list(&self, range: &Range) -> ThreadList {
        let mut threads = Vec::new();
        let mut unlisted = Vec::new();
        for stored in &self.file.threads {
            match file_at(range, &stored.path) {
                Some(file) => threads.push(Thread {
                    id: stored.id,
                    file,
                    line: stored.line,
                    messages: stored.messages.clone(),
                    session: stored.session.clone(),
                }),
                None => unlisted.push(stored.path.as_str()),
            }
        }
        if !unlisted.is_empty() {
            tracing::warn!(paths = ?unlisted, "review threads kept on files this range does not list");
        }
        ThreadList { threads }
    }

    /// A new thread on `line` of `file`, with `text` as its first message.
    pub fn add_thread(
        &mut self,
        range: &Range,
        file: RangeFileId,
        line: ThreadLine,
        text: &str,
    ) -> Result<ThreadAdded> {
        require_text(text)?;
        let entry = range.entry(file).ok_or(Error::UnknownFile { file })?;
        let mut next = self.file.clone();
        let id = next.take_thread_id(&self.path)?;
        let message = new_message(&mut next, &self.path, text)?;
        next.threads.push(StoredThread {
            id,
            path: entry.path.clone(),
            line,
            session: None,
            messages: vec![message],
        });
        self.commit(next)?;
        Ok(ThreadAdded {
            thread: id,
            list: self.list(range),
        })
    }

    /// Appends `text` to the thread as a note.
    pub fn add_note(&mut self, range: &Range, thread: ThreadId, text: &str) -> Result<ThreadList> {
        require_text(text)?;
        let mut next = self.file.clone();
        let message = new_message(&mut next, &self.path, text)?;
        let stored = next
            .thread_mut(thread)
            .filter(|stored| file_at(range, &stored.path).is_some())
            .ok_or(Error::UnknownThread { thread })?;
        stored.messages.push(message);
        self.commit(next)?;
        Ok(self.list(range))
    }

    /// Queues the message for the next send with `text`, the message as edited for GitLab.
    pub fn queue(&mut self, range: &Range, message: MessageId, text: &str) -> Result<ThreadList> {
        require_text(text)?;
        let queued = Posting::Queued {
            text: text.to_owned(),
        };
        self.change_posting(range, message, queued)
    }

    /// Takes the message out of the queue.
    pub fn unqueue(&mut self, range: &Range, message: MessageId) -> Result<ThreadList> {
        self.change_posting(range, message, Posting::NotQueued)
    }

    /// Every queued or refused message, in thread order, then message order.
    #[cfg_attr(not(test), expect(dead_code, reason = "the sender of row 16 calls it"))]
    pub(crate) fn queued(&self) -> Vec<QueuedMessage> {
        let mut queued = Vec::new();
        for thread in &self.file.threads {
            for message in &thread.messages {
                let text = match &message.posting {
                    Posting::Queued { text } | Posting::Refused { text, .. } => text,
                    Posting::NotQueued | Posting::Pending { .. } => continue,
                };
                queued.push(QueuedMessage {
                    thread: thread.id,
                    message: message.id,
                    path: thread.path.clone(),
                    line: thread.line,
                    text: text.clone(),
                });
            }
        }
        queued
    }

    /// Stores what a send made of the message.
    #[cfg_attr(not(test), expect(dead_code, reason = "the sender of row 16 calls it"))]
    pub(crate) fn record(&mut self, message: MessageId, posting: Posting) -> Result<()> {
        let mut next = self.file.clone();
        let (_, stored) = next
            .message_mut(message)
            .ok_or(Error::UnknownMessage { message })?;
        stored.posting = posting;
        self.commit(next)
    }

    fn change_posting(
        &mut self,
        range: &Range,
        message: MessageId,
        posting: Posting,
    ) -> Result<ThreadList> {
        let mut next = self.file.clone();
        let (_, stored) = next
            .message_mut(message)
            .filter(|(path, _)| file_at(range, path).is_some())
            .ok_or(Error::UnknownMessage { message })?;
        match stored.posting {
            Posting::Pending { .. } => return Err(Error::MessagePending { message }),
            Posting::NotQueued | Posting::Queued { .. } | Posting::Refused { .. } => {}
        }
        stored.posting = posting;
        self.commit(next)?;
        Ok(self.list(range))
    }

    /// Writes `next` when it differs from the file in memory, then keeps it; a failed write keeps the old one.
    fn commit(&mut self, next: ThreadFile) -> Result<()> {
        if next != self.file {
            write_threads(&self.path, &next)?;
            self.file = next;
        }
        Ok(())
    }
}

fn file_at(range: &Range, path: &str) -> Option<RangeFileId> {
    range
        .entries()
        .iter()
        .find(|entry| entry.path == path)
        .map(|entry| entry.id)
}

fn require_text(text: &str) -> Result<()> {
    if text.trim().is_empty() {
        return Err(Error::EmptyMessage);
    }
    Ok(())
}

fn new_message(next: &mut ThreadFile, path: &Path, text: &str) -> Result<Message> {
    Ok(Message {
        id: next.take_message_id(path)?,
        body: MessageBody::Note {
            text: text.to_owned(),
        },
        written: seconds_since_1970(),
        posting: Posting::NotQueued,
    })
}

/// A clock set before 1970 stamps 0.
fn seconds_since_1970() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_secs())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use yamt_merge_core::RightLine;

    use super::*;

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

    #[test]
    fn queued_lists_queued_and_refused_messages_in_thread_then_message_order() {
        let dir = tempfile::tempdir().unwrap();
        let store = stored_in(dir.path());
        let queued: Vec<_> = store
            .queued()
            .into_iter()
            .map(|q| (q.thread.0, q.message.0, q.path, q.line, q.text))
            .collect();
        let line = ThreadLine::Added {
            right: RightLine(4),
        };
        let expected = vec![
            (2, 5, "b.txt".to_owned(), line, "first".to_owned()),
            (2, 1, "b.txt".to_owned(), line, "second".to_owned()),
            (1, 4, "a.txt".to_owned(), line, "third".to_owned()),
        ];
        assert_eq!(queued, expected);
    }

    #[test]
    fn record_writes_the_posting_and_keeps_it() {
        let dir = tempfile::tempdir().unwrap();
        let mut store = stored_in(dir.path());
        let pending = Posting::Pending {
            text: "first".to_owned(),
            draft_note: 9,
            merge_request: "!1".to_owned(),
            link: "l".to_owned(),
        };
        store.record(MessageId(5), pending).unwrap();
        let reopened = ThreadStore::open(dir.path()).unwrap();
        assert_eq!(reopened.file, store.file);
        let ids: Vec<u32> = store.queued().iter().map(|q| q.message.0).collect();
        assert_eq!(ids, [1, 4]);
    }

    #[test]
    fn record_on_an_unknown_message_is_unknown_message() {
        let dir = tempfile::tempdir().unwrap();
        let mut store = stored_in(dir.path());
        let result = store.record(MessageId(42), Posting::NotQueued);
        assert!(matches!(
            result,
            Err(Error::UnknownMessage {
                message: MessageId(42)
            })
        ));
    }
}
