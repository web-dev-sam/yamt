//! The user's "Reviewed" marks on a range's files, remembered per review in yamt's data folder (plan §2 #195).
#![forbid(unsafe_code)]

mod review_of;
mod store;
mod stored;

use std::path::PathBuf;

use serde::Serialize;
use specta::Type;
use yamt_merge_core::Difference;
use yamt_range::RangeFileId;

pub use crate::review_of::ReviewOf;
pub use crate::store::ReviewedStore;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ReviewMark {
    Reviewed,
    ChangedSinceReview,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileReview {
    pub file: RangeFileId,
    pub mark: ReviewMark,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SinceReview {
    /// The right side's text at the mark (left column) against today's right side (right column).
    Texts {
        reviewed: String,
        current: String,
        differences: Vec<Difference>,
    },
    /// Either text is missing: the mark kept none (not text then) or today's file is not text.
    NoText,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("cannot read {}: {message}", path.display())]
    ReadFailed { path: PathBuf, message: String },
    #[error("the reviewed marks {} cannot be read: {message}; nothing was changed", path.display())]
    Broken { path: PathBuf, message: String },
    #[error("the reviewed marks {} were written by a newer yamt (format {format})", path.display())]
    NewerFormat { path: PathBuf, format: u32 },
    #[error("cannot write {}: {message}", path.display())]
    WriteFailed { path: PathBuf, message: String },
    #[error("no file {} in this range", file.0)]
    UnknownFile { file: RangeFileId },
    #[error(transparent)]
    Range(#[from] yamt_range::Error),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
