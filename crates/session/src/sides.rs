use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::{BlobReader, StageEntry};

use crate::Result;
use crate::decode::{MAX_TEXT_BYTES, UnsupportedReason, is_binary};

pub(crate) const SYMLINK_MODE: u32 = 0o120_000;
pub(crate) const SUBMODULE_MODE: u32 = 0o160_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Local,
    Remote,
}

// specta-typescript refuses 64-bit integers (`BigIntForbidden`) and types `f64` as `number | null`;
// `type = u32` exports a plain `number`, which holds every size below 2^53 bytes exactly.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum SideContent {
    Missing,
    Text {
        lines: u32,
    },
    Binary {
        #[specta(type = u32)]
        bytes: u64,
    },
    NonUtf8 {
        #[specta(type = u32)]
        bytes: u64,
    },
    TooLarge {
        #[specta(type = u32)]
        bytes: u64,
    },
    Link {
        target: String,
    },
    Commit {
        id: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileSides {
    pub path: String,
    pub reason: Option<UnsupportedReason>,
    pub local: SideContent,
    pub remote: SideContent,
}

pub(crate) fn side_content(
    blobs: &mut BlobReader,
    entry: Option<&StageEntry>,
) -> Result<SideContent> {
    let Some(entry) = entry else {
        return Ok(SideContent::Missing);
    };
    let content = match entry.mode {
        SUBMODULE_MODE => SideContent::Commit {
            id: entry.oid.as_str().to_owned(),
        },
        SYMLINK_MODE => SideContent::Link {
            target: String::from_utf8_lossy(&blobs.read(&entry.oid)?).into_owned(),
        },
        _ => describe_blob(&blobs.read(&entry.oid)?),
    };
    Ok(content)
}

fn describe_blob(bytes: &[u8]) -> SideContent {
    let size = bytes.len() as u64;
    if is_binary(bytes) {
        return SideContent::Binary { bytes: size };
    }
    if bytes.len() > MAX_TEXT_BYTES {
        return SideContent::TooLarge { bytes: size };
    }
    match std::str::from_utf8(bytes) {
        Ok(text) => SideContent::Text {
            lines: u32::try_from(text.lines().count()).unwrap_or(u32::MAX),
        },
        Err(_) => SideContent::NonUtf8 { bytes: size },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_blob_is_described_by_the_first_failing_check_with_its_size_or_its_line_count() {
        let too_large_and_latin1 = vec![b'\xe9'; MAX_TEXT_BYTES + 1];
        let binary_and_too_large = vec![b'\0'; MAX_TEXT_BYTES + 1];
        let size = (MAX_TEXT_BYTES + 1) as u64;
        assert_eq!(
            describe_blob(&binary_and_too_large),
            SideContent::Binary { bytes: size }
        );
        assert_eq!(
            describe_blob(&too_large_and_latin1),
            SideContent::TooLarge { bytes: size }
        );
        assert_eq!(
            describe_blob(b"caf\xe9\n"),
            SideContent::NonUtf8 { bytes: 5 }
        );
        assert_eq!(describe_blob(b"one\ntwo"), SideContent::Text { lines: 2 });
        assert_eq!(describe_blob(b"one\ntwo\n"), SideContent::Text { lines: 2 });
        assert_eq!(describe_blob(b""), SideContent::Text { lines: 0 });
    }
}
