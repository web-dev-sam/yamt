//! A merge request's merge in the user's own checkout (plan §2 #139–#143): the checks before it, the fetch, the
//! checkout and the merge, the record that survives a restart, the restore after Abort, the push, and the locks that
//! keep it to one start and one window at a time.
#![forbid(unsafe_code)]

mod push;
mod record;
mod restore;
mod start;

use std::fs::File;
use std::io;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use specta::Type;
use yamt_gitio::Repo;

use crate::record::{MergeRecord, RECORD_FILE, WINDOW_LOCK_FILE, hold, is_live};

pub use push::push;
pub use start::start;

const CLAIM_RETRY: Duration = Duration::from_millis(50);
const CLAIM_PATIENCE: Duration = Duration::from_secs(1);

/// What resolving needs from GitLab: the merge request's branch, the branch it goes into and the remote holding both.
pub struct MergeRequestBranches {
    pub iid: u32,
    pub remote: String,
    pub branch: String,
    pub target: String,
}

/// A started merge: `target` merged into `branch`, stopped before its commit.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Started {
    pub branch: String,
    pub target: String,
    /// false: GitLab's "has conflicts" was stale, the merge is clean.
    pub conflicts: bool,
}

/// Why a start changed nothing (or, for `GitRefused` with leftovers, could not put everything back).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Refusal {
    /// `Some`: the iid of the unfinished merge; `None`: another start holds the start lock.
    AlreadyMerging {
        iid: Option<u32>,
    },
    /// git is in the middle of another operation.
    Busy,
    UncommittedChanges,
    FetchFailed {
        message: String,
    },
    /// The local branch has commits GitLab's does not.
    LocalAhead {
        branch: String,
    },
    AlreadyContains {
        branch: String,
        target: String,
    },
    GitRefused {
        message: String,
        left: Vec<Leftover>,
    },
    RecordUnreadable {
        path: String,
        message: String,
    },
}

/// Where Abort returns HEAD to.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ReturnTo {
    Branch {
        name: String,
    },
    /// `id`: the commit's first 7 hex characters.
    Commit {
        id: String,
    },
}

/// What a restore could not put back.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Leftover {
    /// HEAD moved after the merge started, so it stays where it is.
    NotReturned {
        to: ReturnTo,
    },
    ReturnRefused {
        to: ReturnTo,
        message: String,
    },
    /// The branch moved after the merge started, so it stays where it is.
    BranchKept {
        branch: String,
    },
    BranchRefused {
        branch: String,
        message: String,
    },
}

/// What the start did to the merge request's local branch.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum BranchBefore {
    Created,
    /// `id`: the first 7 hex characters of the commit it was fast-forwarded from.
    MovedFrom {
        id: String,
    },
    Unchanged,
}

/// The recorded merge as the merge window shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeView {
    pub branch: String,
    pub target: String,
    /// `None` when the branch itself was checked out before.
    pub return_to: Option<ReturnTo>,
    pub branch_before: BranchBefore,
}

/// Whether a merge yamt started is unfinished in a repository.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LocalMerge {
    Free,
    #[serde(rename_all = "camelCase")]
    Merging {
        iid: u32,
        window_open: bool,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PushReply {
    Pushed,
    /// git's words: the ref's rejection, else its first `fatal:`/`error:` line.
    Failed {
        message: String,
    },
}

/// The branch a committed merge may be pushed to, and the remote it came from.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PushOffer {
    remote: String,
    branch: String,
}

impl PushOffer {
    #[must_use]
    pub fn branch(&self) -> &str {
        &self.branch
    }
}

/// The recorded merge while git is still in it.
pub struct LiveMerge {
    repo: Repo,
    path: PathBuf,
    record: MergeRecord,
}

/// The merge window's hold on `<git dir>/yamt-merge-window.lock`; dropping it (or the process ending) releases it.
#[derive(Debug)]
pub struct WindowClaim {
    _lock: File,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Git(#[from] yamt_gitio::Error),
    #[error("cannot lock {}: {source}", path.display())]
    LockFailed { path: PathBuf, source: io::Error },
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl LiveMerge {
    #[must_use]
    pub fn view(&self) -> MergeView {
        self.record.view()
    }

    #[must_use]
    pub fn iid(&self) -> u32 {
        self.record.iid
    }

    /// After git's merge abort: HEAD back where it was, the branch as it was; what does not match the record
    /// stays and is listed. Removes the record.
    #[must_use]
    pub fn restore(self) -> Vec<Leftover> {
        restore::restore(&self.repo, &self.path, &self.record)
    }

    /// After the merge commit: removes the record.
    #[must_use]
    pub fn committed(self) -> PushOffer {
        record::remove(&self.path);
        PushOffer {
            remote: self.record.remote,
            branch: self.record.branch,
        }
    }
}

/// `Merging` while a live record exists; any problem reading it is `Free`, with a warning.
#[must_use]
pub fn local_merge(root: &Path) -> LocalMerge {
    match find_live(root) {
        Ok(Some(live)) => LocalMerge::Merging {
            iid: live.iid(),
            window_open: window_is_open(root),
        },
        Ok(None) => LocalMerge::Free,
        Err(error) => {
            tracing::warn!(%error, "cannot tell whether a merge yamt started is in progress");
            LocalMerge::Free
        }
    }
}

/// The recorded merge when git is still in it; an unreadable or newer record is `Ok(None)`, with a warning.
pub fn find_live(root: &Path) -> Result<Option<LiveMerge>> {
    let repo = Repo::discover(root)?;
    let path = repo.git_path(RECORD_FILE)?;
    let record = match record::read(&path) {
        Ok(Some(record)) => record,
        Ok(None) => return Ok(None),
        Err(message) => {
            tracing::warn!(path = %path.display(), message, "cannot read the merge record");
            return Ok(None);
        }
    };
    let stop = repo.stop()?;
    let current_branch = repo.current_branch()?;
    if !is_live(&record, &stop, current_branch.as_deref()) {
        return Ok(None);
    }
    Ok(Some(LiveMerge { repo, path, record }))
}

/// Takes `<git dir>/yamt-merge-window.lock`, retrying `try_lock` every 50 ms for up to 1 s; Ok(None) when another
/// process still holds it.
pub fn claim_window(root: &Path) -> Result<Option<WindowClaim>> {
    let path = Repo::discover(root)?.git_path(WINDOW_LOCK_FILE)?;
    let deadline = Instant::now() + CLAIM_PATIENCE;
    loop {
        let held = hold(&path).map_err(|source| Error::LockFailed {
            path: path.clone(),
            source,
        })?;
        if let Some(file) = held {
            return Ok(Some(WindowClaim { _lock: file }));
        }
        if Instant::now() >= deadline {
            return Ok(None);
        }
        thread::sleep(CLAIM_RETRY);
    }
}

/// One `try_lock` of the window lock, released at once: true when another process holds it.
#[must_use]
pub fn window_is_open(root: &Path) -> bool {
    let held = Repo::discover(root)
        .and_then(|repo| repo.git_path(WINDOW_LOCK_FILE))
        .map_err(|error| error.to_string())
        .and_then(|path| hold(&path).map_err(|error| error.to_string()));
    match held {
        Ok(Some(_released_at_once)) => false,
        Ok(None) => true,
        Err(error) => {
            tracing::warn!(error, "cannot tell whether the merge window is open");
            false
        }
    }
}

/// git's first stderr line when git refused, else the error in words.
pub(crate) fn git_message(error: &yamt_gitio::Error) -> String {
    if let yamt_gitio::Error::GitFailed { stderr, .. } = error
        && let Some(line) = yamt_gitio::first_line(stderr.as_bytes())
    {
        return line;
    }
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    use serde_json::json;

    #[test]
    fn the_window_reads_camel_case_fields_tagged_by_kind() {
        let merging = LocalMerge::Merging {
            iid: 21,
            window_open: true,
        };
        let view = MergeView {
            branch: "feature/x".to_owned(),
            target: "main".to_owned(),
            return_to: None,
            branch_before: BranchBefore::MovedFrom {
                id: "3f1c2a9".to_owned(),
            },
        };

        let merging_json = json!({ "kind": "merging", "iid": 21, "windowOpen": true });
        assert_eq!(serde_json::to_value(merging).unwrap(), merging_json);
        let view_json = json!({
            "branch": "feature/x", "target": "main", "returnTo": null,
            "branchBefore": { "kind": "movedFrom", "id": "3f1c2a9" },
        });
        assert_eq!(serde_json::to_value(view).unwrap(), view_json);
        let refusal = Refusal::AlreadyMerging { iid: None };
        let refusal_json = json!({ "kind": "alreadyMerging", "iid": null });
        assert_eq!(serde_json::to_value(refusal).unwrap(), refusal_json);
    }

    #[test]
    fn git_message_is_gits_first_stderr_line_else_the_error() {
        let refused = yamt_gitio::Error::GitFailed {
            args: vec!["checkout".to_owned()],
            status: Some(1),
            stderr: "\nerror: first\nhint: advice\n".to_owned(),
        };
        let silent = yamt_gitio::Error::GitFailed {
            args: vec!["checkout".to_owned()],
            status: Some(1),
            stderr: String::new(),
        };

        assert_eq!(git_message(&refused), "error: first");
        assert_eq!(
            git_message(&silent),
            "`checkout` failed with exit status 1: "
        );
        assert_eq!(
            git_message(&yamt_gitio::Error::GitNotFound),
            "git executable not found on PATH"
        );
    }
}
