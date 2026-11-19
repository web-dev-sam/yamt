use std::collections::HashSet;
use std::fmt::Display;
use std::fs::{self, File, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use yamt_gitio::Oid;
use yamt_range::{Dots, RangeEntryKind, SideName, SideObject};

use crate::{Error, Result, ReviewOf};

const REVIEWED_FILE: &str = "reviewed.json";
const TEXTS_FOLDER: &str = "texts";
const LOCK_FILE: &str = "lock";
const FORMAT: u32 = 1;
const TEMP_SUFFIX: &str = ".tmp";

/// `reviewed.json`: the review its folder holds and the marks, sorted by path.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReviewedFile {
    format: u32,
    review: StoredReview,
    pub(crate) marks: Vec<StoredMark>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum StoredReview {
    Range {
        left: StoredSideName,
        dots: StoredDots,
        right: StoredSideName,
    },
    MergeRequest {
        project: String,
        iid: u32,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum StoredSideName {
    Ref { name: String },
    Commit { id: String },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum StoredDots {
    Two,
    Three,
}

/// A file's two sides when it was marked; `keptText`: `texts/<right id>` holds the right side's text.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredMark {
    pub(crate) path: String,
    pub(crate) left: Option<StoredSide>,
    pub(crate) right: Option<StoredSide>,
    pub(crate) kept_text: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct StoredSide {
    pub(crate) id: String,
    pub(crate) kind: RangeEntryKind,
}

#[derive(Deserialize)]
struct FormatOnly {
    format: u32,
}

impl StoredReview {
    fn of(review: &ReviewOf) -> StoredReview {
        match review {
            ReviewOf::Range(names) => StoredReview::Range {
                left: StoredSideName::of(&names.left),
                dots: match names.dots {
                    Dots::Two => StoredDots::Two,
                    Dots::Three => StoredDots::Three,
                },
                right: StoredSideName::of(&names.right),
            },
            ReviewOf::MergeRequest { project, iid } => StoredReview::MergeRequest {
                project: project.clone(),
                iid: *iid,
            },
        }
    }
}

impl StoredSideName {
    fn of(side: &SideName) -> StoredSideName {
        match side {
            SideName::Ref { full_name } => StoredSideName::Ref {
                name: full_name.clone(),
            },
            SideName::Commit { id } => StoredSideName::Commit {
                id: id.as_str().to_owned(),
            },
        }
    }
}

impl StoredSide {
    pub(crate) fn of(side: &SideObject) -> StoredSide {
        StoredSide {
            id: side.id.as_str().to_owned(),
            kind: side.kind,
        }
    }
}

impl ReviewedFile {
    /// Puts `mark` in its place by path, over the mark on the same path.
    pub(crate) fn put(&mut self, mark: StoredMark) {
        match self.position(&mark.path) {
            Ok(index) => {
                if let Some(stored) = self.marks.get_mut(index) {
                    *stored = mark;
                }
            }
            Err(index) => self.marks.insert(index, mark),
        }
    }

    pub(crate) fn remove(&mut self, path: &str) {
        if let Ok(index) = self.position(path) {
            self.marks.remove(index);
        }
    }

    fn position(&self, path: &str) -> std::result::Result<usize, usize> {
        self.marks
            .binary_search_by(|mark| mark.path.as_str().cmp(path))
    }

    /// What makes parsed marks unusable: paths not in strictly ascending order, or an id that is not git's.
    fn problem(&self) -> Option<String> {
        for pair in self.marks.windows(2) {
            if let [first, second] = pair
                && first.path >= second.path
            {
                return Some(format!(
                    "the marks are not sorted by path at \"{}\"",
                    second.path
                ));
            }
        }
        for mark in &self.marks {
            for side in [&mark.left, &mark.right].into_iter().flatten() {
                if Oid::parse(&side.id).is_err() {
                    return Some(format!(
                        "\"{}\" of {} is not an object id",
                        side.id, mark.path
                    ));
                }
            }
        }
        None
    }
}

/// The folder's lock, taken for one read-modify-write and released when the file is dropped (`File::lock`,
/// flock(2) / `LockFileEx`); creates the folder.
pub(crate) fn lock(folder: &Path) -> Result<File> {
    fs::create_dir_all(folder).map_err(|error| write_failed(folder, &error))?;
    let path = folder.join(LOCK_FILE);
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&path)
        .and_then(|file| file.lock().map(|()| file))
        .map_err(|error| write_failed(&path, &error))?;
    Ok(file)
}

/// The folder's marks of `review`; no marks when it holds no `reviewed.json`.
pub(crate) fn read_reviewed(folder: &Path, review: &ReviewOf) -> Result<ReviewedFile> {
    let path = folder.join(REVIEWED_FILE);
    let review = StoredReview::of(review);
    match fs::read(&path) {
        Ok(bytes) => parsed(&path, &bytes, &review),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(ReviewedFile {
            format: FORMAT,
            review,
            marks: Vec::new(),
        }),
        Err(error) => Err(read_failed(&path, &error)),
    }
}

fn parsed(path: &Path, bytes: &[u8], review: &StoredReview) -> Result<ReviewedFile> {
    let FormatOnly { format } =
        serde_json::from_slice(bytes).map_err(|error| broken(path, error.to_string()))?;
    if format > FORMAT {
        return Err(Error::NewerFormat {
            path: path.to_owned(),
            format,
        });
    }
    if format != FORMAT {
        return Err(broken(path, format!("format {format} is not {FORMAT}")));
    }
    let file: ReviewedFile =
        serde_json::from_slice(bytes).map_err(|error| broken(path, error.to_string()))?;
    if file.review != *review {
        return Err(broken(path, "`review` names another review".to_owned()));
    }
    match file.problem() {
        Some(message) => Err(broken(path, message)),
        None => Ok(file),
    }
}

pub(crate) fn write_reviewed(folder: &Path, file: &ReviewedFile) -> Result<()> {
    let path = folder.join(REVIEWED_FILE);
    let mut text =
        serde_json::to_string_pretty(file).map_err(|error| write_failed(&path, &error))?;
    text.push('\n');
    write_atomically(&path, text.as_bytes())
}

/// Writes `texts/<id>` unless it is there: a blob's text never changes.
pub(crate) fn keep_text(folder: &Path, id: &str, text: &str) -> Result<()> {
    let texts = folder.join(TEXTS_FOLDER);
    let path = texts.join(id);
    if path.exists() {
        return Ok(());
    }
    fs::create_dir_all(&texts).map_err(|error| write_failed(&texts, &error))?;
    write_atomically(&path, text.as_bytes())
}

pub(crate) fn kept_text(folder: &Path, id: &str) -> Result<String> {
    let path = folder.join(TEXTS_FOLDER).join(id);
    let bytes = fs::read(&path).map_err(|error| read_failed(&path, &error))?;
    String::from_utf8(bytes).map_err(|error| read_failed(&path, &error))
}

/// Removes every file in `texts/` no mark keeps.
pub(crate) fn sweep_texts(folder: &Path, marks: &[StoredMark]) -> Result<()> {
    let texts = folder.join(TEXTS_FOLDER);
    let entries = match fs::read_dir(&texts) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(read_failed(&texts, &error)),
    };
    let kept: HashSet<&str> = marks
        .iter()
        .filter(|mark| mark.kept_text)
        .filter_map(|mark| mark.right.as_ref().map(|right| right.id.as_str()))
        .collect();
    for entry in entries {
        let path = entry.map_err(|error| read_failed(&texts, &error))?.path();
        let is_kept = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| kept.contains(name));
        if !is_kept {
            fs::remove_file(&path).map_err(|error| write_failed(&path, &error))?;
        }
    }
    Ok(())
}

/// Through a temporary file beside `path` and a rename, so a kill leaves the old or the new text.
fn write_atomically(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut temp = path.as_os_str().to_owned();
    temp.push(TEMP_SUFFIX);
    let temp = PathBuf::from(temp);
    if let Err(error) = fs::write(&temp, bytes).and_then(|()| fs::rename(&temp, path)) {
        fs::remove_file(&temp).ok();
        return Err(write_failed(path, &error));
    }
    Ok(())
}

fn broken(path: &Path, message: String) -> Error {
    Error::Broken {
        path: path.to_owned(),
        message,
    }
}

fn read_failed(path: &Path, error: &impl Display) -> Error {
    Error::ReadFailed {
        path: path.to_owned(),
        message: error.to_string(),
    }
}

fn write_failed(path: &Path, error: &impl Display) -> Error {
    Error::WriteFailed {
        path: path.to_owned(),
        message: error.to_string(),
    }
}
