//! Merge session state machine: the only crate that combines git I/O with the chunk model.
#![forbid(unsafe_code)]

mod decode;
mod disk;
mod locate;
mod markers;
mod merge_data;
mod open;
mod operation;
mod orientation;
mod remembered;
mod scratch;
mod seed;
mod session;
mod side_names;
mod sides;
mod stages;
mod start;
mod waiting;
mod writes;

pub use decode::{Eol, UnsupportedReason};
pub use disk::{DiskChange, DiskResult, DiskVersion};
pub use markers::DEFAULT_MARKER_SIZE;
pub use merge_data::{FileMergeData, MergeChunk, Middle, MiddleLine, NotText, merge_data};
pub use operation::{Continued, OperationKind, OperationView, ProgressView, Refreshed, StopList};
pub use orientation::{GitSide, Orientation};
pub use remembered::{Replayed, remembered_data};
pub use session::{FileEntry, FileStatus, MergeSession, WriteReply};
pub use side_names::{SideName, SideNames};
pub use sides::{FileSides, Side, SideContent};
pub use waiting::{MarkerStyle, Waiting};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Git(#[from] yamt_gitio::Error),
    #[error("{path} is not a conflicted file of this merge")]
    UnknownPath { path: String },
    #[error("git records no operation to abort or continue")]
    NoOperation,
    #[error("git has moved on from the stop this request was made at")]
    StopMovedOn,
    #[error("git refused: {message}")]
    GitRefused { message: String },
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
    #[error("cannot write {path}: it is not a regular file")]
    NotAFile { path: String },
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
