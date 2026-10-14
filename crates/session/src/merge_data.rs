use serde::Serialize;
use specta::Type;
use yamt_merge_core::{Chunk, LineRange, Options, WordChanges, compute_chunks, word_changes};

use crate::decode::{Eol, MAX_TEXT_BYTES, detect_eol, is_binary};
use crate::disk::{DiskVersion, OnDisk};
use crate::seed::{Seeded, seed};
use crate::sides::Side;
use crate::waiting::{MarkerStyle, Waiting};

/// 0-based line of the middle pane's starting text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Type)]
pub struct MiddleLine(pub u32);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct MergeChunk {
    pub chunk: Chunk,
    pub middle: LineRange<MiddleLine>,
    pub words: WordChanges,
    pub waiting: Waiting,
}

/// Why the file on disk cannot be shown as the middle text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum NotText {
    Deleted,
    Binary,
    NonUtf8,
    TooLarge,
    Link,
    Directory,
}

/// Where the middle pane starts: yamt's merge of the stages (base), or the file as found on disk.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum Middle {
    Stages { text: String },
    Disk { text: String },
    DiskNotText { found: NotText },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileMergeData {
    pub path: String,
    pub middle: Middle,
    pub local: String,
    pub remote: String,
    pub deleted: Option<Side>,
    pub eol: Eol,
    pub chunks: Vec<MergeChunk>,
    pub disk_version: DiskVersion,
}

pub(crate) struct Texts {
    pub(crate) base: String,
    pub(crate) local: String,
    pub(crate) remote: String,
    pub(crate) deleted: Option<Side>,
}

#[must_use]
pub fn merge_data(
    path: &str,
    base: &str,
    local: &str,
    remote: &str,
    deleted: Option<Side>,
    style: &MarkerStyle,
    disk_version: DiskVersion,
) -> FileMergeData {
    let chunks = compute_chunks(base, local, remote, &Options::default());
    let words = word_changes(base, local, remote, &chunks);
    let base_lines: Vec<&str> = base.split_inclusive('\n').collect();
    let mut merge_chunks = Vec::with_capacity(chunks.len());
    for (chunk, words) in chunks.into_iter().zip(words) {
        let middle = LineRange {
            start: MiddleLine(chunk.base.start.0),
            len: chunk.base.len,
        };
        let waiting = style.waiting(&chunk, &base_lines);
        merge_chunks.push(MergeChunk {
            chunk,
            middle,
            words,
            waiting,
        });
    }
    FileMergeData {
        path: path.to_owned(),
        middle: Middle::Stages {
            text: base.to_owned(),
        },
        local: local.to_owned(),
        remote: remote.to_owned(),
        deleted,
        eol: stages_eol(base, local, remote),
        chunks: merge_chunks,
        disk_version,
    }
}

pub(crate) fn disk_merge_data(
    path: &str,
    texts: &Texts,
    disk: &OnDisk,
    marker_size: usize,
    disk_version: DiskVersion,
) -> FileMergeData {
    let (middle, eol, chunks) = match seeded_from_disk(disk, marker_size, texts) {
        Ok(seeded) => (
            Middle::Disk {
                text: seeded.middle,
            },
            seeded.eol,
            seeded.chunks,
        ),
        Err(found) => (
            Middle::DiskNotText { found },
            stages_eol(&texts.base, &texts.local, &texts.remote),
            Vec::new(),
        ),
    };
    FileMergeData {
        path: path.to_owned(),
        middle,
        local: texts.local.clone(),
        remote: texts.remote.clone(),
        deleted: texts.deleted,
        eol,
        chunks,
        disk_version,
    }
}

fn seeded_from_disk(disk: &OnDisk, marker_size: usize, texts: &Texts) -> Result<Seeded, NotText> {
    let bytes = match disk {
        OnDisk::File(bytes) => bytes,
        OnDisk::Missing => return Err(NotText::Deleted),
        OnDisk::Link(_) => return Err(NotText::Link),
        OnDisk::Submodule(_) | OnDisk::Other => return Err(NotText::Directory),
    };
    Ok(seed(disk_text(bytes)?, marker_size, texts))
}

fn disk_text(bytes: &[u8]) -> Result<&str, NotText> {
    if is_binary(bytes) {
        return Err(NotText::Binary);
    }
    if bytes.len() > MAX_TEXT_BYTES {
        return Err(NotText::TooLarge);
    }
    std::str::from_utf8(bytes).map_err(|_| NotText::NonUtf8)
}

fn stages_eol(base: &str, local: &str, remote: &str) -> Eol {
    let eol_source = [base, local, remote]
        .into_iter()
        .find(|text| text.contains('\n'))
        .unwrap_or_default();
    detect_eol(eol_source)
}
