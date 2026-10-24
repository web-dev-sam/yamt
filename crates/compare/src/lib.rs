//! The compare window's stored tabs: their list, both columns' texts, and the differences between them.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod files;
mod index;
mod store;

use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_merge_core::{Difference, compare};

pub use crate::store::TabStore;

/// A tab's identity; ids never repeat within a data folder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct TabId(pub u32);

/// One of a tab's two texts: the left is the base the right is compared against.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Column {
    /// The base.
    Left,
    /// The text compared against the left.
    Right,
}

/// Counts one column's sends from the window; starts at 0 per tab when the store opens.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Type)]
pub struct ColumnVersion(pub u32);

/// The versions of a tab's two texts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct ColumnVersions {
    /// The left text's version.
    pub left: ColumnVersion,
    /// The right text's version.
    pub right: ColumnVersion,
}

/// The language a tab shows both columns in.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TabLanguage {
    /// Detected by the window from the texts.
    Auto,
    /// Picked by the user.
    Picked {
        /// A window language name, opaque here.
        name: String,
    },
}

/// One tab as the window lists it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct TabEntry {
    /// The tab's id.
    pub id: TabId,
    /// The tab's name.
    pub name: String,
    /// The tab's language.
    pub language: TabLanguage,
    /// Either column holds text.
    pub holds_text: bool,
}

/// Every tab in the stored order, and the one shown.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct TabList {
    /// The tabs in the stored order.
    pub tabs: Vec<TabEntry>,
    /// The shown tab, always one of `tabs`.
    pub shown: TabId,
}

/// What the window gets when it starts.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct CompareStart {
    /// The tabs.
    pub list: TabList,
    /// The most bytes a column holds (`MAX_COLUMN_BYTES`).
    pub column_limit: u32,
}

/// The differences between a tab's two texts, and the versions they were computed from.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct Comparison {
    /// The versions of the two texts compared.
    pub versions: ColumnVersions,
    /// The differences, sorted and disjoint.
    pub differences: Vec<Difference>,
}

/// A tab's two texts and their comparison.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct TabTexts {
    /// The left text.
    pub left: String,
    /// The right text.
    pub right: String,
    /// The comparison of the two.
    pub comparison: Comparison,
}

/// The most bytes a column holds: the merge window's per-file limit (`yamt_merge_core::MAX_TEXT_BYTES`).
pub const MAX_COLUMN_BYTES: u32 = 8 * 1024 * 1024;

/// Why a store operation failed.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Another process holds the lock file.
    #[error("another yamt --diff window is open ({})", path.display())]
    Locked {
        /// The data folder.
        path: PathBuf,
    },
    /// `tabs.json` does not read as format 1.
    #[error("the stored compare tabs {} cannot be read: {message}; nothing was changed", path.display())]
    Broken {
        /// The `tabs.json` path.
        path: PathBuf,
        /// What is wrong, with line and column where serde has them.
        message: String,
    },
    /// `tabs.json` was written by a newer yamt.
    #[error("the stored compare tabs {} were written by a newer yamt (format {format})", path.display())]
    NewerFormat {
        /// The `tabs.json` path.
        path: PathBuf,
        /// The format the file names.
        format: u32,
    },
    /// A file could not be read, or a column file is not UTF-8.
    #[error("cannot read {}: {message}", path.display())]
    ReadFailed {
        /// The file.
        path: PathBuf,
        /// The cause.
        message: String,
    },
    /// A file could not be written or removed.
    #[error("cannot write {}: {message}", path.display())]
    WriteFailed {
        /// The file.
        path: PathBuf,
        /// The cause.
        message: String,
    },
    /// No tab has this id.
    #[error("no compare tab has the id {}", tab.0)]
    UnknownTab {
        /// The id asked for.
        tab: TabId,
    },
    /// A column, sent or on disk, holds more than `MAX_COLUMN_BYTES`.
    #[error("a column of {bytes} bytes is over the limit of {MAX_COLUMN_BYTES} bytes")]
    TooLarge {
        /// The column's size.
        bytes: usize,
    },
}

/// Results of this crate.
pub type Result<T, E = Error> = std::result::Result<T, E>;

/// One tab's two texts and their versions, shared with the store (no copy), so the diff runs outside its lock.
#[derive(Clone, Debug)]
pub struct LoadedTab {
    left: Arc<str>,
    right: Arc<str>,
    versions: ColumnVersions,
}

impl LoadedTab {
    pub(crate) fn new(left: Arc<str>, right: Arc<str>) -> LoadedTab {
        LoadedTab {
            left,
            right,
            versions: ColumnVersions {
                left: ColumnVersion(0),
                right: ColumnVersion(0),
            },
        }
    }

    pub(crate) fn holds_text(&self) -> bool {
        !self.left.is_empty() || !self.right.is_empty()
    }

    pub(crate) fn version(&self, column: Column) -> ColumnVersion {
        match column {
            Column::Left => self.versions.left,
            Column::Right => self.versions.right,
        }
    }

    pub(crate) fn with_column(
        &self,
        column: Column,
        text: Arc<str>,
        version: ColumnVersion,
    ) -> LoadedTab {
        let mut changed = self.clone();
        match column {
            Column::Left => {
                changed.left = text;
                changed.versions.left = version;
            }
            Column::Right => {
                changed.right = text;
                changed.versions.right = version;
            }
        }
        changed
    }
}

/// The differences between the tab's two texts (`yamt_merge_core::compare`) and their versions.
#[must_use]
pub fn comparison(loaded: &LoadedTab) -> Comparison {
    Comparison {
        versions: loaded.versions,
        differences: compare(&loaded.left, &loaded.right),
    }
}

/// The tab's two texts and `comparison(loaded)`.
#[must_use]
pub fn tab_texts(loaded: &LoadedTab) -> TabTexts {
    TabTexts {
        left: loaded.left.to_string(),
        right: loaded.right.to_string(),
        comparison: comparison(loaded),
    }
}

/// The differences between two texts (`yamt_merge_core::compare`); `Error::TooLarge` when either is over
/// `MAX_COLUMN_BYTES`.
pub fn text_differences(left: &str, right: &str) -> Result<Vec<Difference>> {
    files::require_within_limit(left.len())?;
    files::require_within_limit(right.len())?;
    Ok(compare(left, right))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_column_limit_is_merge_core_s_text_limit() {
        assert_eq!(
            usize::try_from(MAX_COLUMN_BYTES),
            Ok(yamt_merge_core::MAX_TEXT_BYTES)
        );
    }

    #[test]
    fn text_differences_refuses_a_side_over_the_column_limit() {
        let at_limit = "a".repeat(MAX_COLUMN_BYTES as usize);
        let over = "a".repeat(MAX_COLUMN_BYTES as usize + 1);
        let over_bytes = over.len();
        assert!(matches!(
            text_differences(&over, "b"),
            Err(Error::TooLarge { bytes }) if bytes == over_bytes
        ));
        assert!(matches!(
            text_differences("b", &over),
            Err(Error::TooLarge { bytes }) if bytes == over_bytes
        ));
        assert!(text_differences(&at_limit, &at_limit).is_ok());
    }

    #[test]
    fn text_differences_equals_merge_core_compare() {
        let left = "one\ntwo words here\nthree\n";
        let right = "one\ntwo other words here\nfour\n";
        let differences = text_differences(left, right).unwrap();
        assert_ne!(differences, Vec::new());
        assert_eq!(differences, compare(left, right));
    }
}
