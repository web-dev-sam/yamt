//! Merge session state machine: the only crate that combines git I/O with the chunk model.
#![forbid(unsafe_code)]

mod decode;
mod session;

pub use decode::{Eol, UnsupportedReason};
pub use session::{FileEntry, FileMergeData, FileStatus, MergeSession};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Git(#[from] yamt_gitio::Error),
    #[error("{path} is not a conflicted file of this merge")]
    UnknownPath { path: String },
    #[error("{path} cannot be merged as text: {reason:?}")]
    Unsupported {
        path: String,
        reason: UnsupportedReason,
    },
    #[error("cannot write {path}: {source}")]
    WriteFailed {
        path: String,
        source: std::io::Error,
    },
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
