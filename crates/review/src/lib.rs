//! The user's review of a commit range: threads on its lines, stored per repository and commit pair.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod gitlab;
mod glab_answer;
mod lines_up;
mod position;
mod right_branch;
mod send;
mod thread_file;
mod thread_store;
mod thread_types;

use std::path::PathBuf;

use serde::Serialize;
use specta::Type;
use yamt_range::RangeFileId;

pub use crate::send::{check_gitlab, send_queue};
pub use crate::thread_store::ThreadStore;
pub use crate::thread_types::{
    Message, MessageBody, MessageId, Posting, Thread, ThreadAdded, ThreadId, ThreadLine, ThreadList,
};
pub use yamt_gitio::Glab;

/// A merge request as the window names it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct MergeRequestRef {
    /// Its short reference, "!12".
    pub reference: String,
    /// Its title.
    pub title: String,
    /// Its page on GitLab.
    pub web_url: String,
}

/// What the merge requests were looked up by.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LookedAt {
    /// The right side's branch: its open merge requests.
    Branch {
        /// The branch, without `refs/heads/` or a remote.
        name: String,
    },
    /// The right commit, as the range names no branch: the open merge requests ending at it.
    Commit {
        /// The commit's short id.
        short_id: String,
    },
}

/// Why posting is disabled: GitLab's diff is not the window's, or GitLab could not be asked.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NotLinedUp {
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first output line, which names the instance.
        detail: String,
    },
    /// No open merge request was found.
    NoMergeRequest {
        /// What was looked up.
        looked_at: LookedAt,
    },
    /// Several open merge requests, none of them lining up.
    Several {
        /// What was looked up.
        looked_at: LookedAt,
        /// Their references, "!12".
        references: Vec<String>,
    },
    /// The merge request's diff ends at another commit.
    Moved {
        /// The merge request.
        merge_request: MergeRequestRef,
        /// The short id GitLab's diff ends at.
        gitlab_head: String,
        /// The short id the window's right side is.
        shown_head: String,
    },
    /// The merge request's diff starts from another commit.
    OtherBase {
        /// The merge request.
        merge_request: MergeRequestRef,
        /// The short id GitLab's diff starts from.
        gitlab_base: String,
        /// The short id the window's left side is.
        shown_base: String,
    },
    /// GitLab still prepares the merge request's diff.
    Preparing {
        /// The merge request.
        merge_request: MergeRequestRef,
    },
    /// glab failed, timed out or answered something unexpected.
    Failed {
        /// What went wrong, in glab's or yamt's words.
        message: String,
    },
}

/// Whether GitLab's diff is exactly the window's.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GitLabCheck {
    /// It is: posting goes to this merge request.
    LinedUp {
        /// The merge request.
        merge_request: MergeRequestRef,
    },
    /// It is not.
    NotLinedUp {
        /// Why.
        why: NotLinedUp,
    },
}

/// How far a send is: `done` of `of` messages.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SendProgress {
    /// The messages handled so far.
    pub done: u32,
    /// The messages the send handles.
    pub of: u32,
}

/// How a send ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SendReply {
    /// GitLab's diff is not the window's; nothing was sent.
    NotLinedUp {
        /// Why.
        why: NotLinedUp,
    },
    /// Every queued message was handled.
    Sent {
        /// The threads after the send.
        list: ThreadList,
        /// Messages now pending on GitLab.
        sent: u32,
        /// Messages GitLab refused, still queued.
        refused: u32,
    },
    /// The send stopped; the message it stopped at and the rest stay queued.
    Stopped {
        /// The threads after the send.
        list: ThreadList,
        /// Messages now pending on GitLab.
        sent: u32,
        /// Messages GitLab refused, still queued.
        refused: u32,
        /// Why it stopped.
        reason: String,
    },
}

/// Why a thread store operation failed.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// `threads.json` could not be read.
    #[error("cannot read {}: {message}", path.display())]
    ReadFailed {
        /// The `threads.json` path.
        path: PathBuf,
        /// The cause.
        message: String,
    },
    /// `threads.json` does not read as format 1.
    #[error("the review threads {} cannot be read: {message}; nothing was changed", path.display())]
    Broken {
        /// The `threads.json` path.
        path: PathBuf,
        /// What is wrong, with line and column where serde has them.
        message: String,
    },
    /// `threads.json` was written by a newer yamt.
    #[error("the review threads {} were written by a newer yamt (format {format})", path.display())]
    NewerFormat {
        /// The `threads.json` path.
        path: PathBuf,
        /// The format the file names.
        format: u32,
    },
    /// `threads.json` could not be written.
    #[error("cannot write {}: {message}", path.display())]
    WriteFailed {
        /// The `threads.json` path.
        path: PathBuf,
        /// The cause.
        message: String,
    },
    /// No file of the range has this id.
    #[error("no file {} in this range", file.0)]
    UnknownFile {
        /// The id asked for.
        file: RangeFileId,
    },
    /// No thread on a file of the range has this id.
    #[error("no review thread has the id {}", thread.0)]
    UnknownThread {
        /// The id asked for.
        thread: ThreadId,
    },
    /// No message on a file of the range has this id.
    #[error("no review message has the id {}", message.0)]
    UnknownMessage {
        /// The id asked for.
        message: MessageId,
    },
    /// The text is empty or only white space.
    #[error("a message needs text")]
    EmptyMessage,
    /// The message is already a draft note on GitLab.
    #[error("the message {} is pending on GitLab", message.0)]
    MessagePending {
        /// The message.
        message: MessageId,
    },
    /// The message is an AI answer, which is never edited or deleted.
    #[error("the message {} is an AI answer, not a note", message.0)]
    NotANote {
        /// The message.
        message: MessageId,
    },
}

/// Results of this crate.
pub type Result<T, E = Error> = std::result::Result<T, E>;
