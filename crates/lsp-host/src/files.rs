use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use yamt_pipe::plain_name;

const MAX_TEXT_BYTES: u64 = 64 * 1024;

/// What a repository-relative path holds, for detection; a path outside the repository is `Missing`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum ProjectFile {
    Missing,
    Folder,
    Text { text: String },
    TooLarge,
    NotText,
}

/// `relative` uses `/` separators and only plain names (no `..`, `.`, root or drive); `None` when
/// it is not such a path or leads out of the repository through a link.
pub(crate) fn in_repository(root: &Path, relative: &str) -> Option<PathBuf> {
    let mut path = root.to_owned();
    for segment in relative.split('/').filter(|segment| !segment.is_empty()) {
        path.push(plain_name(segment)?);
    }
    if let (Ok(real), Ok(real_root)) = (fs::canonicalize(&path), fs::canonicalize(root))
        && !real.starts_with(real_root)
    {
        return None;
    }
    Some(path)
}

pub(crate) fn project_file(root: &Path, relative: &str) -> ProjectFile {
    let Some(path) = in_repository(root, relative) else {
        return ProjectFile::Missing;
    };
    let Ok(metadata) = fs::metadata(&path) else {
        return ProjectFile::Missing;
    };
    if metadata.is_dir() {
        return ProjectFile::Folder;
    }
    if metadata.len() > MAX_TEXT_BYTES {
        return ProjectFile::TooLarge;
    }
    let Ok(bytes) = fs::read(&path) else {
        return ProjectFile::Missing;
    };
    match String::from_utf8(bytes) {
        Ok(text) => ProjectFile::Text { text },
        Err(_) => ProjectFile::NotText,
    }
}
