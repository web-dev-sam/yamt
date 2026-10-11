//! Merge session state machine: the only crate that combines git I/O with the chunk model.
#![forbid(unsafe_code)]

mod decode;
mod remote_name;
mod session;
mod sides;
mod stages;

pub use decode::{Eol, UnsupportedReason};
pub use remote_name::RemoteName;
pub use session::{FileEntry, FileMergeData, FileStatus, MergeSession, merge_data};
pub use sides::{FileSides, Side, SideContent};

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
