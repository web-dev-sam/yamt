//! The user's review of a commit range: threads on its lines, stored per repository and commit pair.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod thread_file;
mod thread_store;
mod thread_types;

use std::path::PathBuf;

use yamt_range::RangeFileId;

pub use crate::thread_store::ThreadStore;
pub use crate::thread_types::{
    Message, MessageBody, MessageId, Posting, Thread, ThreadAdded, ThreadId, ThreadLine, ThreadList,
};

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
}

/// Results of this crate.
pub type Result<T, E = Error> = std::result::Result<T, E>;
