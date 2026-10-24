use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_merge_core::{LeftLine, RightLine};
use yamt_range::RangeFileId;

/// A thread's identity; ids never repeat within a pair folder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct ThreadId(pub u32);

/// A message's identity; ids never repeat within a pair folder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct MessageId(pub u32);

/// The line a thread is on; the variant decides the column that shows it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ThreadLine {
    /// A left line inside a difference.
    Removed {
        /// The line.
        left: LeftLine,
    },
    /// A right line inside a difference.
    Added {
        /// The line.
        right: RightLine,
    },
    /// An unchanged line, shown in the left column.
    UnchangedOnLeft {
        /// The line in the left text.
        left: LeftLine,
        /// The same line in the right text.
        right: RightLine,
    },
    /// An unchanged line, shown in the right column.
    UnchangedOnRight {
        /// The line in the left text.
        left: LeftLine,
        /// The same line in the right text.
        right: RightLine,
    },
}

/// What a message says.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MessageBody {
    /// Text the user wrote.
    Note {
        /// The text as written.
        text: String,
    },
    /// An AI answer, kept in the AI's own session.
    AiAnswer {
        /// The answer's turn in the thread's session.
        turn: u32,
    },
}

/// Where a message stands on its way to GitLab.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Posting {
    /// Not meant for GitLab.
    NotQueued,
    /// Waiting for the next send.
    Queued {
        /// The text to post, as edited.
        text: String,
    },
    /// GitLab refused it; it is sent again with the next send.
    Refused {
        /// The text to post, as edited.
        text: String,
        /// GitLab's words.
        reason: String,
    },
    /// Posted as a draft note of the user's pending review.
    Pending {
        /// The text posted.
        text: String,
        /// GitLab's id of the draft note.
        #[specta(type = u32)]
        draft_note: u64,
        /// The merge request's reference, "!12".
        merge_request: String,
        /// The merge request's Changes page.
        link: String,
    },
}

/// One message of a thread.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct Message {
    /// The message's id.
    pub id: MessageId,
    /// What it says.
    pub body: MessageBody,
    /// When it was added, in seconds since 1970.
    #[specta(type = u32)]
    pub written: u64,
    /// Where it stands on its way to GitLab.
    pub posting: Posting,
}

/// A thread on one line of one file of the range.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct Thread {
    /// The thread's id.
    pub id: ThreadId,
    /// The file it is on.
    pub file: RangeFileId,
    /// The line it is on.
    pub line: ThreadLine,
    /// Its messages in the order they were added; never empty.
    pub messages: Vec<Message>,
    /// The AI session the thread's answers live in.
    pub session: Option<String>,
}

/// Every thread on a file of the range, in the order they were made.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct ThreadList {
    /// The threads.
    pub threads: Vec<Thread>,
}

/// A new thread's id, and the threads with it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct ThreadAdded {
    /// The new thread.
    pub thread: ThreadId,
    /// Every thread, the new one last.
    pub list: ThreadList,
}
