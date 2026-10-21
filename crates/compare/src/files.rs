use std::collections::HashSet;
use std::fs::{self, File, OpenOptions, TryLockError};
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::{Column, Error, MAX_COLUMN_BYTES, Result, TabId};

pub(crate) const INDEX_FILE: &str = "tabs.json";
const LOCK_FILE: &str = "lock";
const TEMP_SUFFIX: &str = ".tmp";
const LEFT_SUFFIX: &str = "-left.txt";
const RIGHT_SUFFIX: &str = "-right.txt";

pub(crate) fn column_path(dir: &Path, tab: TabId, column: Column) -> PathBuf {
    dir.join(column_file_name(tab, column))
}

fn column_file_name(tab: TabId, column: Column) -> String {
    let suffix = match column {
        Column::Left => LEFT_SUFFIX,
        Column::Right => RIGHT_SUFFIX,
    };
    format!("{}{suffix}", tab.0)
}

/// The lock is the file's own: the OS releases it when the process ends, also on `kill -9`
/// (`File::try_lock`, flock(2) / `LockFileEx`).
pub(crate) fn take_lock(dir: &Path) -> Result<File> {
    let path = dir.join(LOCK_FILE);
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&path)
        .map_err(|error| write_failed(&path, &error))?;
    match file.try_lock() {
        Ok(()) => Ok(file),
        Err(TryLockError::WouldBlock) => Err(Error::Locked {
            path: dir.to_owned(),
        }),
        Err(TryLockError::Error(error)) => Err(write_failed(&path, &error)),
    }
}

/// Through a temporary file beside `path` and a rename, so a kill leaves the old or the new text.
pub(crate) fn write_atomically(path: &Path, text: &str) -> Result<()> {
    let mut temp = path.as_os_str().to_owned();
    temp.push(TEMP_SUFFIX);
    let temp = PathBuf::from(temp);
    let written = fs::write(&temp, text).and_then(|()| fs::rename(&temp, path));
    if let Err(error) = written {
        fs::remove_file(&temp).ok();
        return Err(write_failed(path, &error));
    }
    Ok(())
}

/// A missing file is an empty column.
pub(crate) fn read_column(path: &Path) -> Result<Arc<str>> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Arc::from("")),
        Err(error) => return Err(read_failed(path, error.to_string())),
    };
    require_within_limit(bytes.len())?;
    let text = String::from_utf8(bytes).map_err(|error| read_failed(path, error.to_string()))?;
    Ok(Arc::from(text))
}

pub(crate) fn require_within_limit(bytes: usize) -> Result<()> {
    if bytes > MAX_COLUMN_BYTES as usize {
        return Err(Error::TooLarge { bytes });
    }
    Ok(())
}

pub(crate) fn has_text_on_disk(dir: &Path, tab: TabId) -> bool {
    [Column::Left, Column::Right].into_iter().any(|column| {
        fs::metadata(column_path(dir, tab, column)).is_ok_and(|metadata| metadata.len() > 0)
    })
}

/// A file left behind here (a failed removal) is an orphan the next open removes.
pub(crate) fn remove_columns(dir: &Path, tab: TabId) {
    for column in [Column::Left, Column::Right] {
        fs::remove_file(column_path(dir, tab, column)).ok();
    }
}

/// Column files and their temporary files whose tab is not in `tabs`; every other file stays.
pub(crate) fn remove_orphans(dir: &Path, tabs: &HashSet<TabId>) -> Result<()> {
    let entries = fs::read_dir(dir).map_err(|error| read_failed(dir, error.to_string()))?;
    for entry in entries {
        let entry = entry.map_err(|error| read_failed(dir, error.to_string()))?;
        let name = entry.file_name();
        let Some(tab) = name.to_str().and_then(column_file_tab) else {
            continue;
        };
        if !tabs.contains(&tab) {
            let path = entry.path();
            fs::remove_file(&path).map_err(|error| write_failed(&path, &error))?;
        }
    }
    Ok(())
}

fn column_file_tab(name: &str) -> Option<TabId> {
    let name = name.strip_suffix(TEMP_SUFFIX).unwrap_or(name);
    let id = name
        .strip_suffix(LEFT_SUFFIX)
        .or_else(|| name.strip_suffix(RIGHT_SUFFIX))?;
    let tab = TabId(id.parse().ok()?);
    [Column::Left, Column::Right]
        .into_iter()
        .any(|column| column_file_name(tab, column) == name)
        .then_some(tab)
}

pub(crate) fn read_failed(path: &Path, message: String) -> Error {
    Error::ReadFailed {
        path: path.to_owned(),
        message,
    }
}

pub(crate) fn write_failed(path: &Path, error: &io::Error) -> Error {
    Error::WriteFailed {
        path: path.to_owned(),
        message: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn column_and_temp_names_give_their_tab() {
        assert_eq!(column_file_tab("12-left.txt"), Some(TabId(12)));
        assert_eq!(column_file_tab("3-right.txt"), Some(TabId(3)));
        assert_eq!(column_file_tab("3-right.txt.tmp"), Some(TabId(3)));
    }

    #[test]
    fn other_names_are_no_column_files() {
        assert_eq!(column_file_tab("tabs.json"), None);
        assert_eq!(column_file_tab("tabs.json.tmp"), None);
        assert_eq!(column_file_tab("notes-left.txt"), None);
        assert_eq!(column_file_tab("3-middle.txt"), None);
        assert_eq!(column_file_tab("lock"), None);
        assert_eq!(column_file_tab("03-left.txt"), None);
        assert_eq!(column_file_tab("+3-left.txt"), None);
        assert_eq!(column_file_tab("+7-right.txt.tmp"), None);
    }
}
