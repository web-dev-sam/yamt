use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use yamt_range::{Range, RangeFileId};

use crate::thread_file::{StoredThread, THREADS_FILE, ThreadFile, read_threads, write_threads};
use crate::{
    Error, Message, MessageBody, MessageId, Posting, Result, Thread, ThreadAdded, ThreadId,
    ThreadLine, ThreadList,
};

pub(crate) mod waiting;

/// The threads of one pair folder; the pair lock makes its process the only writer.
#[derive(Debug)]
pub struct ThreadStore {
    path: PathBuf,
    file: ThreadFile,
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
        for stored in &self.file.threads {
            if let Some(file) = file_at(range, &stored.path) {
                threads.push(Thread {
                    id: stored.id,
                    file,
                    line: stored.line,
                    messages: stored.messages.clone(),
                    session: stored.session.clone(),
                });
            }
        }
        ThreadList { threads }
    }

    /// The stored paths `range` does not list, sorted, each once: their threads are kept but not shown.
    #[must_use]
    pub fn unlisted_paths(&self, range: &Range) -> Vec<String> {
        let mut paths = Vec::new();
        for stored in &self.file.threads {
            if file_at(range, &stored.path).is_none() {
                paths.push(stored.path.clone());
            }
        }
        paths.sort();
        paths.dedup();
        paths
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
        let message = new_message(next.take_message_id(&self.path)?, note(text));
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
        let message = new_message(next.take_message_id(&self.path)?, note(text));
        shown_thread_mut(&mut next, range, thread)?
            .messages
            .push(message);
        self.commit(next)?;
        Ok(self.list(range))
    }

    /// Stores the conversation the thread's next "Ask AI" continues; replaces an earlier one (#115: omp lost it).
    pub fn set_session(
        &mut self,
        range: &Range,
        thread: ThreadId,
        session: &str,
    ) -> Result<ThreadList> {
        let mut next = self.file.clone();
        shown_thread_mut(&mut next, range, thread)?.session = Some(session.to_owned());
        self.commit(next)?;
        Ok(self.list(range))
    }

    /// Sets the session as above when it differs, then appends `AiAnswer { session, turn }` with
    /// turn = the number of `AiAnswer`s of that session already in the thread (the one numbering rule).
    pub fn add_ai_answer(
        &mut self,
        range: &Range,
        thread: ThreadId,
        session: &str,
    ) -> Result<ThreadList> {
        let mut next = self.file.clone();
        let id = next.take_message_id(&self.path)?;
        let stored = shown_thread_mut(&mut next, range, thread)?;
        stored.session = Some(session.to_owned());
        let answer = MessageBody::AiAnswer {
            session: session.to_owned(),
            turn: answers_in(&stored.messages, session),
        };
        stored.messages.push(new_message(id, answer));
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

/// The thread when it is on a file of `range`.
fn shown_thread_mut<'a>(
    next: &'a mut ThreadFile,
    range: &Range,
    thread: ThreadId,
) -> Result<&'a mut StoredThread> {
    next.thread_mut(thread)
        .filter(|stored| file_at(range, &stored.path).is_some())
        .ok_or(Error::UnknownThread { thread })
}

/// How many of `messages` are answers in `session`: the turn its next answer gets.
fn answers_in(messages: &[Message], session: &str) -> u32 {
    let mut answers = 0;
    for message in messages {
        if let MessageBody::AiAnswer {
            session: answered_in,
            ..
        } = &message.body
            && answered_in == session
        {
            answers += 1;
        }
    }
    answers
}

fn require_text(text: &str) -> Result<()> {
    if text.trim().is_empty() {
        return Err(Error::EmptyMessage);
    }
    Ok(())
}

fn note(text: &str) -> MessageBody {
    MessageBody::Note {
        text: text.to_owned(),
    }
}

fn new_message(id: MessageId, body: MessageBody) -> Message {
    Message {
        id,
        body,
        written: seconds_since_1970(),
        posting: Posting::NotQueued,
    }
}

/// A clock set before 1970 stamps 0.
fn seconds_since_1970() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_secs())
}
