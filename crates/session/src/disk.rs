use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::{Oid, Repo};

use crate::markers::{open_regions, parse, split_lines};
use crate::session::LOG_TARGET;
use crate::{Error, Result};

/// Counts the settles of one file's disk changes; a view is built from one version.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct DiskVersion(pub u32);

/// What yamt did with a file that changed on disk.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum DiskResult {
    Staged,
    /// Not staged: the file still has this many open blocks and raw regions, at least one.
    MarkersLeft {
        conflicts: u32,
    },
    /// Not staged, by design: a `working-tree-encoding` file or a submodule that is not checked out.
    LeftAsIs,
    StageFailed {
        message: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct DiskChange {
    pub path: String,
    pub result: DiskResult,
}

/// A worktree entry as read, without following a link; the executable bit is not kept.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum OnDisk {
    Missing,
    File(Vec<u8>),
    Link(Vec<u8>),
    /// The commit checked out in the submodule; `None` when it is not checked out.
    Submodule(Option<Oid>),
    /// A directory (other than a submodule) or a special file.
    Other,
}

pub(crate) enum Seen {
    /// The file differed from git's merge output at start, or could not be read then.
    GitOutput,
    ViewFromStages(OnDisk),
    ViewFromDisk(OnDisk),
    /// The regular file rerere filled in at open, or yamt's own write over it, shown for review with
    /// each block of what git's merge wrote (plan §2 #90).
    ViewRemembered {
        shown: Vec<u8>,
        git_output: Vec<u8>,
    },
}

/// The file as this run of yamt found it at open: what Reset puts back (plan §2 #66).
pub(crate) enum AtOpen {
    /// What git wrote, untouched.
    Untouched(OnDisk),
    /// Different from what git wrote.
    Changed(OnDisk),
    /// git's output had conflict blocks, the file has none, and rerere no longer tracks the path: the
    /// resolution rerere replayed (plan §2 #90).
    Remembered {
        remembered: Vec<u8>,
        git_output: Vec<u8>,
    },
    Unread,
}

/// How a change to a file that is still present is settled.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MarkerRule {
    /// Binary, link, submodule and deleted-side files: git writes no markers, any change stages.
    StageAny,
    /// Two-sided text: staged only once no marker line is left.
    StageWithoutMarkers,
    /// `working-tree-encoding` files: their markers cannot be read, so they are never staged.
    NeverStage,
}

pub(crate) enum Settlement {
    Add,
    Remove,
    LeaveWithMarkers { conflicts: u32 },
    LeaveAsIs,
}

/// The outcome of the two batched staging commands of one settle.
pub(crate) struct Staging {
    added: Result<(), String>,
    removed: Result<(), String>,
}

impl Seen {
    pub(crate) fn is(&self, disk: &OnDisk) -> bool {
        match self {
            Seen::GitOutput => false,
            Seen::ViewFromStages(seen) | Seen::ViewFromDisk(seen) => seen == disk,
            Seen::ViewRemembered { shown, .. } => {
                matches!(disk, OnDisk::File(bytes) if bytes == shown)
            }
        }
    }

    /// Notes that yamt wrote the file `written` itself; the view stays.
    pub(crate) fn note_own_write(&mut self, written: Vec<u8>) {
        match self {
            Seen::ViewFromDisk(disk) => *disk = OnDisk::File(written),
            Seen::ViewRemembered { shown, .. } => *shown = written,
            Seen::ViewFromStages(_) | Seen::GitOutput => {
                *self = Seen::ViewFromStages(OnDisk::File(written));
            }
        }
    }
}

/// What Reset writes back and what yamt has seen once it did.
pub(crate) struct ResetTo {
    /// The file's bytes; `None`: no file.
    pub(crate) bytes: Option<Vec<u8>>,
    pub(crate) seen: Seen,
}

impl AtOpen {
    /// What yamt has seen at open: git's untouched output is the stages view.
    pub(crate) fn first_seen(&self) -> Seen {
        match self {
            AtOpen::Untouched(disk) => Seen::ViewFromStages(disk.clone()),
            AtOpen::Remembered {
                remembered,
                git_output,
            } => Seen::ViewRemembered {
                shown: remembered.clone(),
                git_output: git_output.clone(),
            },
            AtOpen::Changed(_) | AtOpen::Unread => Seen::GitOutput,
        }
    }

    /// The regular file, or its absence, that Reset writes back, seen in the stages view when git
    /// wrote it, in the remembered view when rerere did and in the disk view otherwise; `None` when
    /// only git can rebuild the entry (a link, a submodule, something else, or unread at open).
    pub(crate) fn reset_to(&self) -> Option<ResetTo> {
        let (disk, seen) = match self {
            AtOpen::Untouched(disk) => (disk, Seen::ViewFromStages(disk.clone())),
            AtOpen::Changed(disk) => (disk, Seen::ViewFromDisk(disk.clone())),
            AtOpen::Remembered {
                remembered,
                git_output,
            } => {
                return Some(ResetTo {
                    bytes: Some(remembered.clone()),
                    seen: Seen::ViewRemembered {
                        shown: remembered.clone(),
                        git_output: git_output.clone(),
                    },
                });
            }
            AtOpen::Unread => return None,
        };
        let bytes = match disk {
            OnDisk::File(bytes) => Some(bytes.clone()),
            OnDisk::Missing => None,
            OnDisk::Link(_) | OnDisk::Submodule(_) | OnDisk::Other => return None,
        };
        Some(ResetTo { bytes, seen })
    }
}

pub(crate) fn warn_unread(path: &str, error: &Error) {
    tracing::warn!(target: LOG_TARGET, event = "disk_unread", %path, %error, "the file is looked at again next time");
}

pub(crate) fn read_on_disk(repo: &Repo, path: &Path, is_submodule: bool) -> Result<OnDisk> {
    let full_path = repo.root().join(path);
    let read_failed = |source| Error::ReadFailed {
        path: path.to_string_lossy().into_owned(),
        source,
    };
    let file_type = match fs::symlink_metadata(&full_path) {
        Ok(metadata) => metadata.file_type(),
        Err(source) if is_absent(&source) => return Ok(OnDisk::Missing),
        Err(source) => return Err(read_failed(source)),
    };
    let read = if file_type.is_symlink() {
        fs::read_link(&full_path)
            .map(|target| OnDisk::Link(target.into_os_string().into_encoded_bytes()))
    } else if file_type.is_file() {
        fs::read(&full_path).map(OnDisk::File)
    } else if file_type.is_dir() && is_submodule {
        return Ok(OnDisk::Submodule(repo.submodule_head(path)?));
    } else {
        Ok(OnDisk::Other)
    };
    match read {
        Ok(disk) => Ok(disk),
        Err(source) if is_absent(&source) => Ok(OnDisk::Missing),
        Err(source) => Err(read_failed(source)),
    }
}

fn is_absent(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::NotFound | io::ErrorKind::NotADirectory
    )
}

pub(crate) fn settlement(disk: &OnDisk, rule: MarkerRule, marker_size: usize) -> Settlement {
    let stage_any = match rule {
        MarkerRule::NeverStage => return Settlement::LeaveAsIs,
        MarkerRule::StageAny => true,
        MarkerRule::StageWithoutMarkers => false,
    };
    match disk {
        OnDisk::Missing | OnDisk::Other => Settlement::Remove,
        OnDisk::Submodule(None) => Settlement::LeaveAsIs,
        OnDisk::Link(_) | OnDisk::Submodule(Some(_)) => Settlement::Add,
        OnDisk::File(_) if stage_any => Settlement::Add,
        OnDisk::File(bytes) => match open_regions(&parse(&split_lines(bytes), marker_size)) {
            0 => Settlement::Add,
            conflicts => Settlement::LeaveWithMarkers { conflicts },
        },
    }
}

pub(crate) fn stage(repo: &Repo, to_add: &[&Path], to_remove: &[&Path]) -> Staging {
    let added = if to_add.is_empty() {
        Ok(())
    } else {
        repo.add_paths(to_add).map_err(|error| error.to_string())
    };
    let removed = if to_remove.is_empty() {
        Ok(())
    } else {
        repo.remove_paths(to_remove)
            .map_err(|error| error.to_string())
    };
    Staging { added, removed }
}

impl Staging {
    pub(crate) fn result(&self, settlement: &Settlement) -> DiskResult {
        let staged = |outcome: &Result<(), String>| match outcome {
            Ok(()) => DiskResult::Staged,
            Err(message) => DiskResult::StageFailed {
                message: message.clone(),
            },
        };
        match settlement {
            Settlement::Add => staged(&self.added),
            Settlement::Remove => staged(&self.removed),
            Settlement::LeaveWithMarkers { conflicts } => DiskResult::MarkersLeft {
                conflicts: *conflicts,
            },
            Settlement::LeaveAsIs => DiskResult::LeftAsIs,
        }
    }
}
