use std::fs::{self, File, OpenOptions, TryLockError};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use yamt_gitio::{Operation, Stop};

use crate::{BranchBefore, MergeView, ReturnTo};

pub(crate) const RECORD_FILE: &str = "yamt-merge-request.json";
pub(crate) const START_LOCK_FILE: &str = "yamt-merge-request.lock";
pub(crate) const WINDOW_LOCK_FILE: &str = "yamt-merge-window.lock";
pub(crate) const FORMAT: u32 = 1;
const TEMPORARY_SUFFIX: &str = ".tmp";
const SHORT_ID_LEN: usize = 7;

/// What a start changed and what Abort puts back: `<git dir>/yamt-merge-request.json`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MergeRecord {
    pub format: u32,
    pub iid: u32,
    pub remote: String,
    pub branch: String,
    pub target: String,
    pub return_to: RecordedReturn,
    pub branch_before: RecordedBranch,
    /// The full id of the branch tip the start checked out.
    pub head: String,
    /// The full id of the target tip the start merged.
    pub merging: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum RecordedReturn {
    Branch { name: String },
    Detached { commit: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum RecordedBranch {
    Created,
    MovedFrom { commit: String },
    Unchanged,
}

#[derive(Deserialize)]
struct FormatOnly {
    format: u32,
}

impl MergeRecord {
    /// Whether the start found the merge request's branch already checked out.
    pub fn returns_to_itself(&self) -> bool {
        matches!(&self.return_to, RecordedReturn::Branch { name } if *name == self.branch)
    }

    pub fn view(&self) -> MergeView {
        let return_to = if self.returns_to_itself() {
            None
        } else {
            Some(self.return_to.shown())
        };
        let branch_before = match &self.branch_before {
            RecordedBranch::Created => BranchBefore::Created,
            RecordedBranch::MovedFrom { commit } => BranchBefore::MovedFrom {
                id: short_id(commit),
            },
            RecordedBranch::Unchanged => BranchBefore::Unchanged,
        };
        MergeView {
            branch: self.branch.clone(),
            target: self.target.clone(),
            return_to,
            branch_before,
        }
    }
}

impl RecordedReturn {
    pub fn shown(&self) -> ReturnTo {
        match self {
            RecordedReturn::Branch { name } => ReturnTo::Branch { name: name.clone() },
            RecordedReturn::Detached { commit } => ReturnTo::Commit {
                id: short_id(commit),
            },
        }
    }
}

fn short_id(commit: &str) -> String {
    commit.chars().take(SHORT_ID_LEN).collect()
}

/// The record at `path`; `Ok(None)` when there is none, `Err` with the reason when it cannot be read, does not
/// parse, or has a format newer than this yamt's.
pub(crate) fn read(path: &Path) -> Result<Option<MergeRecord>, String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    let format = serde_json::from_slice::<FormatOnly>(&bytes)
        .map_err(|error| error.to_string())?
        .format;
    if format > FORMAT {
        return Err(format!(
            "its format {format} is newer than this yamt reads ({FORMAT})"
        ));
    }
    let record = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    Ok(Some(record))
}

/// Writes `record` to `<path>.tmp`, syncs it and renames it over `path`, so a crash leaves the old file or the new.
pub(crate) fn write(path: &Path, record: &MergeRecord) -> io::Result<()> {
    let bytes = serde_json::to_vec_pretty(record).map_err(io::Error::other)?;
    let mut temporary = path.as_os_str().to_owned();
    temporary.push(TEMPORARY_SUFFIX);
    let temporary = PathBuf::from(temporary);
    let mut file = File::create(&temporary)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    fs::rename(&temporary, path)
}

/// Removes the record; a failure is logged, as nobody could act on it.
pub(crate) fn remove(path: &Path) {
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => {
            tracing::warn!(path = %path.display(), %error, "cannot remove the merge record");
        }
    }
}

/// The lock file opened (created when missing) and locked; `None` when another open file holds the lock.
pub(crate) fn hold(path: &Path) -> io::Result<Option<File>> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(path)?;
    // The lock is the open file's own: the OS releases it when the file is closed or the process ends, also on
    // `kill -9` (`File::try_lock`, flock(2)).
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(error)) => Err(error),
    }
}

/// Whether git is still in the merge `record` started: merging the recorded commit, at the recorded head, on the
/// recorded branch.
pub(crate) fn is_live(record: &MergeRecord, stop: &Stop, current_branch: Option<&[u8]>) -> bool {
    let merging_it = matches!(
        &stop.operation,
        Some(Operation::Merge { merging }) if merging.as_str() == record.merging
    );
    let at_head = stop
        .head
        .as_ref()
        .is_some_and(|head| head.as_str() == record.head);
    merging_it && at_head && current_branch == Some(record.branch.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    use yamt_gitio::Oid;

    const HEAD: &str = "1111111111111111111111111111111111111111";
    const MERGING: &str = "2222222222222222222222222222222222222222";
    const OTHER: &str = "3333333333333333333333333333333333333333";
    const BRANCH: &str = "feature/due-dates";

    fn record() -> MergeRecord {
        MergeRecord {
            format: FORMAT,
            iid: 21,
            remote: "origin".to_owned(),
            branch: BRANCH.to_owned(),
            target: "main".to_owned(),
            return_to: RecordedReturn::Branch {
                name: "develop".to_owned(),
            },
            branch_before: RecordedBranch::MovedFrom {
                commit: OTHER.to_owned(),
            },
            head: HEAD.to_owned(),
            merging: MERGING.to_owned(),
        }
    }

    fn merge_stop(merging: &str, head: &str) -> Stop {
        Stop {
            operation: Some(Operation::Merge {
                merging: Oid::parse(merging).unwrap(),
            }),
            head: Some(Oid::parse(head).unwrap()),
        }
    }

    #[test]
    fn the_recorded_merge_at_its_head_on_its_branch_is_live() {
        let stop = merge_stop(MERGING, HEAD);

        assert!(is_live(&record(), &stop, Some(BRANCH.as_bytes())));
    }

    #[test]
    fn any_mismatch_makes_the_record_stale() {
        let on_branch = Some(BRANCH.as_bytes());
        let another_merge = merge_stop(OTHER, HEAD);
        let another_head = merge_stop(MERGING, OTHER);
        let no_operation = Stop {
            operation: None,
            head: Some(Oid::parse(HEAD).unwrap()),
        };
        let no_head = Stop {
            head: None,
            ..merge_stop(MERGING, HEAD)
        };
        let cherry_pick = Stop {
            operation: Some(Operation::CherryPick {
                picking: Some(Oid::parse(MERGING).unwrap()),
                progress: None,
            }),
            ..merge_stop(MERGING, HEAD)
        };

        assert!(!is_live(&record(), &another_merge, on_branch));
        assert!(!is_live(&record(), &another_head, on_branch));
        assert!(!is_live(&record(), &no_operation, on_branch));
        assert!(!is_live(&record(), &no_head, on_branch));
        assert!(!is_live(&record(), &cherry_pick, on_branch));
        let at_head = merge_stop(MERGING, HEAD);
        assert!(!is_live(&record(), &at_head, Some(b"develop")));
        assert!(!is_live(&record(), &at_head, None));
    }

    #[test]
    fn a_written_record_reads_back_and_leaves_no_temporary_file() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join(RECORD_FILE);

        write(&path, &record()).unwrap();

        assert_eq!(read(&path), Ok(Some(record())));
        let files = fs::read_dir(folder.path()).unwrap().count();
        assert_eq!(files, 1);
    }

    #[test]
    fn a_missing_record_is_none() {
        let folder = tempfile::tempdir().unwrap();

        assert_eq!(read(&folder.path().join(RECORD_FILE)), Ok(None));
    }

    #[test]
    fn a_record_path_that_cannot_be_read_is_unreadable_not_missing() {
        let folder = tempfile::tempdir().unwrap();

        assert!(read(folder.path()).is_err());
    }

    #[test]
    fn a_newer_format_or_unparsable_json_is_unreadable() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join(RECORD_FILE);
        let mut newer = serde_json::to_value(record()).unwrap();
        newer["format"] = serde_json::json!(FORMAT + 1);

        fs::write(&path, serde_json::to_vec(&newer).unwrap()).unwrap();
        let newer_read = read(&path);
        fs::write(&path, b"{ \"format\": 1, \"iid\": 21 }").unwrap();
        let incomplete_read = read(&path);
        fs::write(&path, b"not json").unwrap();
        let garbage_read = read(&path);

        let newer_message = "its format 2 is newer than this yamt reads (1)".to_owned();
        assert_eq!(newer_read, Err(newer_message));
        assert!(incomplete_read.is_err());
        assert!(garbage_read.is_err());
    }

    #[test]
    fn the_view_shortens_ids_and_omits_a_return_to_the_branch_itself() {
        let mut detached = record();
        detached.return_to = RecordedReturn::Detached {
            commit: HEAD.to_owned(),
        };
        let mut on_itself = record();
        on_itself.return_to = RecordedReturn::Branch {
            name: BRANCH.to_owned(),
        };

        let id = "1111111".to_owned();
        assert_eq!(detached.view().return_to, Some(ReturnTo::Commit { id }));
        assert_eq!(on_itself.view().return_to, None);
        let name = "develop".to_owned();
        assert_eq!(record().view().return_to, Some(ReturnTo::Branch { name }));
        let id = "3333333".to_owned();
        assert_eq!(
            record().view().branch_before,
            BranchBefore::MovedFrom { id }
        );
    }
}
