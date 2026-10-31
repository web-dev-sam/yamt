use serde::Deserialize;

use super::{FORMAT, StoredThread, ThreadFile};
use crate::{Message, MessageId, ThreadId, ThreadLine, ThreadPlace};

pub(super) const FORMAT_1: u32 = 1;

/// `threads.json` format 1: each thread on one line.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Format1File {
    next_thread: ThreadId,
    next_message: MessageId,
    threads: Vec<Format1Thread>,
}

#[derive(Deserialize)]
struct Format1Thread {
    id: ThreadId,
    path: String,
    line: ThreadLine,
    session: Option<String>,
    messages: Vec<Message>,
}

impl Format1File {
    /// The same threads, each on its line's one-line place; the next write is the current format.
    pub(super) fn current(self) -> ThreadFile {
        let mut threads = Vec::new();
        for thread in self.threads {
            threads.push(StoredThread {
                id: thread.id,
                path: thread.path,
                place: ThreadPlace::one_line(thread.line),
                session: thread.session,
                messages: thread.messages,
            });
        }
        ThreadFile {
            format: FORMAT,
            next_thread: self.next_thread,
            next_message: self.next_message,
            threads,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use yamt_merge_core::{LeftLine, RightLine};

    use super::*;
    use crate::thread_file::{THREADS_FILE, parsed};
    use crate::{MessageBody, Posting};

    #[test]
    fn format_1_line_reads_as_a_one_line_place() {
        let format_1 = r#"{"format":1,"nextThread":2,"nextMessage":2,"threads":[{"id":1,"path":"a.txt","line":{"kind":"unchangedOnLeft","left":3,"right":4},"session":"omp-1","messages":[{"id":1,"body":{"kind":"note","text":"a"},"written":0,"posting":{"kind":"notQueued"}}]}]}"#;
        let read = parsed(Path::new(THREADS_FILE), format_1.as_bytes()).unwrap();
        let line = ThreadLine::UnchangedOnLeft {
            left: LeftLine(3),
            right: RightLine(4),
        };
        let message = Message {
            id: MessageId(1),
            body: MessageBody::Note {
                text: "a".to_owned(),
            },
            written: 0,
            posting: Posting::NotQueued,
        };
        let expected = ThreadFile {
            format: FORMAT,
            next_thread: ThreadId(2),
            next_message: MessageId(2),
            threads: vec![StoredThread {
                id: ThreadId(1),
                path: "a.txt".to_owned(),
                place: ThreadPlace::one_line(line),
                session: Some("omp-1".to_owned()),
                messages: vec![message],
            }],
        };
        assert_eq!(read, expected);
    }
}
