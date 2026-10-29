use yamt_gitio::{BlobReader, Repo};
use yamt_merge_core::{MAX_TEXT_BYTES, compare};

use crate::entries::{BlobAt, FileAt};
use crate::{RangeEntryKind, RangeFile, RangeModeChange, RangeSides, Result};

/// A file's two sides as text, or which sides are not UTF-8.
pub(crate) enum Decoded {
    Texts { left: String, right: String },
    NotUtf8 { sides: RangeSides },
}

/// What `file` shows, read from the repository only when the listing cannot answer.
pub(crate) fn load_file(repo: &Repo, file: &FileAt) -> Result<RangeFile> {
    if let Some(answer) = decide(file) {
        return Ok(answer);
    }
    let mut reader = repo.blob_reader()?;
    let (left, right) = read_sides(&mut reader, file)?;
    match decoded(left, right) {
        Decoded::Texts { left, right } => Ok(RangeFile::Texts {
            differences: compare(&left, &right),
            left,
            right,
            mode: mode_change(file),
        }),
        Decoded::NotUtf8 { sides } => Ok(RangeFile::NotUtf8 { sides }),
    }
}

/// Both sides' bytes; a missing side reads as empty.
pub(crate) fn read_sides(reader: &mut BlobReader, file: &FileAt) -> Result<(Vec<u8>, Vec<u8>)> {
    let left = read_side(reader, file.old.as_ref())?;
    let right = read_side(reader, file.new.as_ref())?;
    Ok((left, right))
}

pub(crate) fn decoded(left: Vec<u8>, right: Vec<u8>) -> Decoded {
    match (String::from_utf8(left), String::from_utf8(right)) {
        (Ok(left), Ok(right)) => Decoded::Texts { left, right },
        (Err(_), Ok(_)) => Decoded::NotUtf8 {
            sides: RangeSides::Left,
        },
        (Ok(_), Err(_)) => Decoded::NotUtf8 {
            sides: RangeSides::Right,
        },
        (Err(_), Err(_)) => Decoded::NotUtf8 {
            sides: RangeSides::Both,
        },
    }
}

#[expect(
    clippy::cast_possible_truncation,
    reason = "the compile-time assert before the cast proves MAX_TEXT_BYTES fits in u32"
)]
const TOO_LARGE_LIMIT: u32 = {
    assert!(MAX_TEXT_BYTES <= u32::MAX as usize);
    MAX_TEXT_BYTES as u32
};

/// The answer the listing alone gives (plan §2 #105's order up to the size), or `None`: read the blobs.
pub(crate) fn decide(file: &FileAt) -> Option<RangeFile> {
    let (old, new) = (file.old.as_ref(), file.new.as_ref());
    if old.is_some_and(BlobAt::is_gitlink) || new.is_some_and(BlobAt::is_gitlink) {
        return Some(RangeFile::Submodule {
            old: commit_id(old),
            new: commit_id(new),
        });
    }
    if let (Some(old), Some(new)) = (old, new) {
        let (old_kind, new_kind) = (old.kind(), new.kind());
        if (old_kind == RangeEntryKind::Link) != (new_kind == RangeEntryKind::Link) {
            return Some(RangeFile::KindChanged {
                old: old_kind,
                new: new_kind,
            });
        }
        if old.oid == new.oid && old_kind != new_kind {
            return Some(RangeFile::ModeOnly {
                old: old_kind,
                new: new_kind,
            });
        }
    }
    if file.binary {
        return Some(RangeFile::Binary);
    }
    if old.is_some_and(is_too_large) || new.is_some_and(is_too_large) {
        return Some(RangeFile::TooLarge {
            limit: TOO_LARGE_LIMIT,
        });
    }
    None
}

fn commit_id(side: Option<&BlobAt>) -> Option<String> {
    side.filter(|side| side.is_gitlink())
        .map(|side| side.oid.as_str().to_owned())
}

fn is_too_large(blob: &BlobAt) -> bool {
    blob.size.is_some_and(|size| size > MAX_TEXT_BYTES as u64)
}

fn read_side(reader: &mut BlobReader, side: Option<&BlobAt>) -> Result<Vec<u8>> {
    match side {
        Some(blob) => Ok(reader.read(&blob.oid)?),
        None => Ok(Vec::new()),
    }
}

fn mode_change(file: &FileAt) -> RangeModeChange {
    match (&file.old, &file.new) {
        (Some(old), Some(new)) if old.kind() != new.kind() => RangeModeChange::Changed {
            old: old.kind(),
            new: new.kind(),
        },
        _ => RangeModeChange::Same,
    }
}
