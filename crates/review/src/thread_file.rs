use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{Error, Message, MessageId, Result, ThreadId, ThreadLine};

pub(crate) const THREADS_FILE: &str = "threads.json";
const FORMAT: u32 = 1;
const FIRST_THREAD: ThreadId = ThreadId(1);
const FIRST_MESSAGE: MessageId = MessageId(1);
const TEMP_SUFFIX: &str = ".tmp";

/// `threads.json`: every thread in creation order, and the ids the next thread and message get.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ThreadFile {
    format: u32,
    next_thread: ThreadId,
    next_message: MessageId,
    pub(crate) threads: Vec<StoredThread>,
}

/// A thread as stored: on a path, since a file id may name another file once the list changes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct StoredThread {
    pub(crate) id: ThreadId,
    pub(crate) path: String,
    pub(crate) line: ThreadLine,
    pub(crate) session: Option<String>,
    pub(crate) messages: Vec<Message>,
}

#[derive(Deserialize)]
struct FormatOnly {
    format: u32,
}

impl ThreadFile {
    pub(crate) fn empty() -> ThreadFile {
        ThreadFile {
            format: FORMAT,
            next_thread: FIRST_THREAD,
            next_message: FIRST_MESSAGE,
            threads: Vec::new(),
        }
    }

    /// Refused as `Broken` at `path` when the id taken would leave none for one more thread.
    pub(crate) fn take_thread_id(&mut self, path: &Path) -> Result<ThreadId> {
        let id = self.next_thread;
        self.next_thread = ThreadId(id.0.saturating_add(1));
        self.require_room(path)?;
        Ok(id)
    }

    /// Refused as `Broken` at `path` when the id taken would leave none for one more message.
    pub(crate) fn take_message_id(&mut self, path: &Path) -> Result<MessageId> {
        let id = self.next_message;
        self.next_message = MessageId(id.0.saturating_add(1));
        self.require_room(path)?;
        Ok(id)
    }

    pub(crate) fn thread_mut(&mut self, thread: ThreadId) -> Option<&mut StoredThread> {
        self.threads.iter_mut().find(|stored| stored.id == thread)
    }

    /// The message and the path of its thread.
    pub(crate) fn message_mut(&mut self, message: MessageId) -> Option<(&str, &mut Message)> {
        for thread in &mut self.threads {
            if let Some(found) = thread
                .messages
                .iter_mut()
                .find(|stored| stored.id == message)
            {
                return Some((thread.path.as_str(), found));
            }
        }
        None
    }

    fn require_room(&self, path: &Path) -> Result<()> {
        match no_room_left(self.next_thread, self.next_message) {
            Some(message) => Err(broken(path, message)),
            None => Ok(()),
        }
    }

    /// What makes a parsed file unusable: no id left for a new thread or message, an id repeated or at or
    /// above its counter, or a thread without messages.
    fn problem(&self) -> Option<String> {
        if let Some(message) = no_room_left(self.next_thread, self.next_message) {
            return Some(message);
        }
        let mut threads = HashSet::new();
        let mut messages = HashSet::new();
        for thread in &self.threads {
            if !threads.insert(thread.id) {
                return Some(format!("the thread id {} appears twice", thread.id.0));
            }
            if thread.id.0 >= self.next_thread.0 {
                return Some(format!(
                    "the thread id {} is not below `nextThread` {}",
                    thread.id.0, self.next_thread.0
                ));
            }
            if thread.messages.is_empty() {
                return Some(format!("the thread {} has no messages", thread.id.0));
            }
            for message in &thread.messages {
                if let Some(problem) = self.message_problem(message.id, &mut messages) {
                    return Some(problem);
                }
            }
        }
        None
    }

    fn message_problem(&self, id: MessageId, seen: &mut HashSet<MessageId>) -> Option<String> {
        if !seen.insert(id) {
            return Some(format!("the message id {} appears twice", id.0));
        }
        if id.0 >= self.next_message.0 {
            return Some(format!(
                "the message id {} is not below `nextMessage` {}",
                id.0, self.next_message.0
            ));
        }
        None
    }
}

/// Why a file with these counters has no id left for a new thread or message.
fn no_room_left(next_thread: ThreadId, next_message: MessageId) -> Option<String> {
    if next_thread.0 == u32::MAX {
        return Some(format!(
            "`nextThread` {} leaves no id for a new thread",
            u32::MAX
        ));
    }
    if next_message.0 == u32::MAX {
        return Some(format!(
            "`nextMessage` {} leaves no id for a new message",
            u32::MAX
        ));
    }
    None
}

/// `None` when there is no `threads.json` at `path`.
pub(crate) fn read_threads(path: &Path) -> Result<Option<ThreadFile>> {
    match fs::read(path) {
        Ok(bytes) => parsed(path, &bytes).map(Some),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(Error::ReadFailed {
            path: path.to_owned(),
            message: error.to_string(),
        }),
    }
}

fn parsed(path: &Path, bytes: &[u8]) -> Result<ThreadFile> {
    let FormatOnly { format } =
        serde_json::from_slice(bytes).map_err(|error| broken(path, error.to_string()))?;
    if format > FORMAT {
        return Err(Error::NewerFormat {
            path: path.to_owned(),
            format,
        });
    }
    if format != FORMAT {
        return Err(broken(path, format!("format {format} is not {FORMAT}")));
    }
    let file: ThreadFile =
        serde_json::from_slice(bytes).map_err(|error| broken(path, error.to_string()))?;
    match file.problem() {
        Some(message) => Err(broken(path, message)),
        None => Ok(file),
    }
}

fn broken(path: &Path, message: String) -> Error {
    Error::Broken {
        path: path.to_owned(),
        message,
    }
}

/// Through a temporary file beside `path` and a rename, so a kill leaves the old or the new text.
pub(crate) fn write_threads(path: &Path, file: &ThreadFile) -> Result<()> {
    let write_failed = |message: String| Error::WriteFailed {
        path: path.to_owned(),
        message,
    };
    let mut text =
        serde_json::to_string_pretty(file).map_err(|error| write_failed(error.to_string()))?;
    text.push('\n');
    let mut temp = path.as_os_str().to_owned();
    temp.push(TEMP_SUFFIX);
    let temp = PathBuf::from(temp);
    if let Err(error) = fs::write(&temp, text).and_then(|()| fs::rename(&temp, path)) {
        fs::remove_file(&temp).ok();
        return Err(write_failed(error.to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn problem_of(json: &str) -> String {
        match parsed(Path::new(THREADS_FILE), json.as_bytes()) {
            Err(Error::Broken { message, .. }) => message,
            other => panic!("expected Broken, got {other:?}"),
        }
    }

    const MESSAGE_1: &str =
        r#"{"id":1,"body":{"kind":"note","text":"a"},"written":0,"posting":{"kind":"notQueued"}}"#;

    fn thread(id: u32, messages: &str) -> String {
        format!(
            r#"{{"id":{id},"path":"a.txt","line":{{"kind":"added","right":0}},"session":null,"messages":[{messages}]}}"#
        )
    }

    fn file(next_thread: u32, next_message: u32, threads: &[String]) -> String {
        format!(
            r#"{{"format":1,"nextThread":{next_thread},"nextMessage":{next_message},"threads":[{}]}}"#,
            threads.join(",")
        )
    }

    #[test]
    fn a_thread_id_at_next_thread_is_broken_so_ids_never_repeat() {
        let message = problem_of(&file(1, 2, &[thread(1, MESSAGE_1)]));
        assert_eq!(message, "the thread id 1 is not below `nextThread` 1");
    }

    #[test]
    fn a_thread_id_below_next_thread_reads() {
        let json = file(2, 2, &[thread(1, MESSAGE_1)]);
        assert!(parsed(Path::new(THREADS_FILE), json.as_bytes()).is_ok());
    }

    #[test]
    fn a_message_id_at_next_message_is_broken_so_ids_never_repeat() {
        let message = problem_of(&file(2, 1, &[thread(1, MESSAGE_1)]));
        assert_eq!(message, "the message id 1 is not below `nextMessage` 1");
    }

    #[test]
    fn a_message_id_repeated_in_another_thread_is_broken() {
        let message = problem_of(&file(3, 2, &[thread(1, MESSAGE_1), thread(2, MESSAGE_1)]));
        assert_eq!(message, "the message id 1 appears twice");
    }

    #[test]
    fn counters_at_u32_max_are_broken_so_a_new_id_never_overflows() {
        assert_eq!(
            problem_of(&file(u32::MAX, 1, &[])),
            "`nextThread` 4294967295 leaves no id for a new thread"
        );
        assert_eq!(
            problem_of(&file(1, u32::MAX, &[])),
            "`nextMessage` 4294967295 leaves no id for a new message"
        );
    }

    #[test]
    fn format_0_is_broken_not_newer() {
        assert_eq!(problem_of(r#"{"format":0}"#), "format 0 is not 1");
    }

    #[test]
    fn taking_the_id_below_u32_max_is_refused_and_leaves_room_checks_to_both_counters() {
        let path = Path::new(THREADS_FILE);
        let mut threads = ThreadFile::empty();
        threads.next_thread = ThreadId(u32::MAX - 1);
        assert!(matches!(
            threads.take_thread_id(path),
            Err(Error::Broken { .. })
        ));
        let mut messages = ThreadFile::empty();
        messages.next_message = MessageId(u32::MAX - 1);
        assert!(matches!(
            messages.take_message_id(path),
            Err(Error::Broken { .. })
        ));
        let mut room = ThreadFile::empty();
        room.next_thread = ThreadId(u32::MAX - 2);
        assert_eq!(room.take_thread_id(path).unwrap(), ThreadId(u32::MAX - 2));
        assert_eq!(room.take_message_id(path).unwrap(), FIRST_MESSAGE);
    }
}
