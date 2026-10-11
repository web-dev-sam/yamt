//! Merge session state machine: the only crate that combines git I/O with the chunk model.
#![forbid(unsafe_code)]

mod decode;
mod disk;
mod markers;
mod merge_data;
mod open;
mod remote_name;
mod seed;
mod session;
mod sides;
mod stages;
mod start;
mod writes;

pub use decode::{Eol, UnsupportedReason};
pub use disk::{DiskChange, DiskResult, DiskVersion};
pub use merge_data::{FileMergeData, MergeChunk, Middle, MiddleLine, NotText, merge_data};
pub use remote_name::RemoteName;
pub use session::{FileEntry, FileList, FileStatus, MergeSession, WriteReply};
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
    #[error("cannot read {path}: {source}")]
    ReadFailed {
        path: String,
        source: std::io::Error,
    },
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
