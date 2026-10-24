//! A commit range of a git repository: its spec, both sides, the changed files and what each one shows.
#![forbid(unsafe_code)]

mod entries;
mod load;
mod lock;
mod open;
mod spec;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::Oid;
use yamt_merge_core::Difference;

pub use crate::lock::{PairLock, pair_folders};
pub use crate::open::{Range, Resolved};
pub use crate::spec::{RangeSpec, SpecError};

/// A changed file's place in the range's list: 0.. in list order, fixed for the window's life.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct RangeFileId(pub u32);

/// How a column header names its side.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeSideLabel {
    /// A side as typed; an empty side is `HEAD`.
    Named { name: String },
    /// The left of `a...b`: where `right` branched off `left`.
    MergeBase { left: String, right: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeSide {
    pub label: RangeSideLabel,
    pub short_id: String,
    pub subject: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeChange {
    Added,
    Modified,
    Deleted,
    Renamed { old_path: String },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeLineCounts {
    Counted { added: u32, removed: u32 },
    NotCounted,
}

/// One row of the list; `path` is the new path, the old one for a deleted file (UTF-8, lossy for display).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeEntry {
    pub id: RangeFileId,
    pub path: String,
    pub change: RangeChange,
    pub lines: RangeLineCounts,
}

/// The two commits the range compares, and how the right one was named.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Compared {
    pub left: Oid,
    pub right: Oid,
    pub right_label: RangeSideLabel,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeStart {
    pub range: String,
    pub left: RangeSide,
    pub right: RangeSide,
    pub files: Vec<RangeEntry>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RangeEntryKind {
    File,
    Executable,
    Link,
    Submodule,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeModeChange {
    Same,
    Changed {
        old: RangeEntryKind,
        new: RangeEntryKind,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RangeSides {
    Left,
    Right,
    Both,
}

/// What one file shows: decided once, here.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeFile {
    Texts {
        left: String,
        right: String,
        differences: Vec<Difference>,
        mode: RangeModeChange,
    },
    Binary,
    TooLarge {
        limit: u32,
    },
    NotUtf8 {
        sides: RangeSides,
    },
    ModeOnly {
        old: RangeEntryKind,
        new: RangeEntryKind,
    },
    KindChanged {
        old: RangeEntryKind,
        new: RangeEntryKind,
    },
    Submodule {
        old: Option<String>,
        new: Option<String>,
    },
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{} is not inside a git repository: {message}", path.display())]
    NotARepository { path: PathBuf, message: String },
    #[error("git names no commit \"{name}\"")]
    UnknownName { name: String },
    #[error("{left} and {right} have no merge base")]
    NoMergeBase { left: String, right: String },
    #[error("another yamt window shows {left}..{right} of {}", root.display())]
    Locked {
        root: PathBuf,
        left: String,
        right: String,
    },
    #[error("cannot write {}: {message}", path.display())]
    LockFailed { path: PathBuf, message: String },
    #[error("no file {} in this range", file.0)]
    UnknownFile { file: RangeFileId },
    #[error(transparent)]
    Git(#[from] yamt_gitio::Error),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
