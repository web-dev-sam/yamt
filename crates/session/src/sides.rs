use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::{BlobReader, StageEntry};

use crate::Result;
use crate::decode::{UnsupportedReason, describe_blob};

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
