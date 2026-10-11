use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;
use yamt_gitio::Repo;

use crate::decode::UnsupportedReason;
use crate::disk::{
    DiskChange, DiskResult, DiskVersion, MarkerRule, OnDisk, Seen, Settlement, read_on_disk,
    settlement, stage,
};
use crate::merge_data::{FileMergeData, Texts, disk_merge_data, merge_data};
use crate::remote_name::RemoteName;
use crate::sides::{FileSides, SUBMODULE_MODE, side_content};
use crate::stages::CapturedStages;
use crate::{Error, Result};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum FileStatus {
    Unresolved,
    Resolved,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileEntry {
    pub path: String,
    pub status: FileStatus,
    pub unsupported: Option<UnsupportedReason>,
}

/// The files as git sees them, and the disk changes settled while looking.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileList {
    pub files: Vec<FileEntry>,
    pub disk_changes: Vec<DiskChange>,
}

/// What a write did: written, or nothing written because the file changed on disk first.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum WriteReply {
    Written {
        files: Vec<FileEntry>,
    },
    ChangedOnDisk {
        files: Vec<FileEntry>,
        change: DiskChange,
    },
}

pub(crate) const LOG_TARGET: &str = "session";

pub struct MergeSession {
    pub(crate) repo: Repo,
    pub(crate) files: Vec<FileState>,
    pub(crate) remote_name: Option<RemoteName>,
}

pub(crate) struct FileState {
    pub(crate) path: PathBuf,
    pub(crate) stages: CapturedStages,
    pub(crate) status: FileStatus,
    pub(crate) content: Content,
    pub(crate) marker_size: usize,
    pub(crate) rule: MarkerRule,
    pub(crate) seen: Seen,
    pub(crate) settled: Option<Settled>,
}

/// The latest settle of a file's disk change.
pub(crate) struct Settled {
    pub(crate) version: DiskVersion,
    pub(crate) result: DiskResult,
}

pub(crate) enum Content {
    Text(Texts),
    Unsupported(UnsupportedReason),
}

impl MergeSession {
    #[must_use]
    pub fn root(&self) -> &Path {
        self.repo.root()
    }

    #[must_use]
    pub fn remote_name(&self) -> Option<RemoteName> {
        self.remote_name.clone()
    }

    /// Settles every file that changed on disk since yamt last saw it, then re-reads git's marks.
    pub fn refresh(&mut self) -> Result<FileList> {
        let mut looked = Vec::with_capacity(self.files.len());
        for file in &self.files {
            match file.look(&self.repo) {
                Ok(change) => looked.push(change),
                Err(error) => {
                    let path = file.display_path();
                    tracing::warn!(target: LOG_TARGET, event = "disk_unread", %path, %error, "the file is looked at again next time");
                    looked.push(None);
                }
            }
        }
        let disk_changes = self.settle(looked);
        self.refresh_statuses()?;
        Ok(FileList {
            files: self.files(),
            disk_changes,
        })
    }

    pub(crate) fn refresh_statuses(&mut self) -> Result<()> {
        let unmerged = self.repo.unmerged()?;
        for file in &mut self.files {
            let is_unmerged = unmerged.iter().any(|entry| entry.path == file.path);
            file.status = if is_unmerged {
                FileStatus::Unresolved
            } else {
                FileStatus::Resolved
            };
        }
        Ok(())
    }

    /// Settles each `Some` read (one per file, in file order): one batch of `git add` and one of
    /// `update-index --force-remove`.
    pub(crate) fn settle(&mut self, looked: Vec<Option<OnDisk>>) -> Vec<DiskChange> {
        let mut adds: Vec<&Path> = Vec::new();
        let mut removes: Vec<&Path> = Vec::new();
        let mut settlements = Vec::with_capacity(looked.len());
        for (file, disk) in self.files.iter().zip(&looked) {
            let found = disk
                .as_ref()
                .map(|disk| settlement(disk, file.rule, file.marker_size));
            match &found {
                Some(Settlement::Add) => adds.push(&file.path),
                Some(Settlement::Remove) => removes.push(&file.path),
                Some(Settlement::Leave { .. }) | None => {}
            }
            settlements.push(found);
        }
        let staging = stage(&self.repo, &adds, &removes);
        let mut changes = Vec::new();
        let decided = looked.into_iter().zip(settlements);
        for (file, (disk, found)) in self.files.iter_mut().zip(decided) {
            if let (Some(disk), Some(found)) = (disk, found) {
                changes.push(file.settled_as(disk, staging.result(&found)));
            }
        }
        changes
    }

    #[must_use]
    pub fn files(&self) -> Vec<FileEntry> {
        let mut entries = Vec::with_capacity(self.files.len());
        for file in &self.files {
            entries.push(FileEntry {
                path: file.display_path(),
                status: file.status,
                unsupported: file.unsupported_reason(),
            });
        }
        entries
    }

    pub fn load(&mut self, path: &str) -> Result<FileMergeData> {
        let file = find_file(&mut self.files, path)?;
        let texts = file.require_text()?;
        let version = file.disk_version();
        let path = file.display_path();
        match &file.seen {
            Seen::Disk(disk) => Ok(disk_merge_data(
                &path,
                texts,
                disk,
                file.marker_size,
                version,
            )),
            Seen::Stages(_) | Seen::GitOutput => Ok(merge_data(
                &path,
                &texts.base,
                &texts.local,
                &texts.remote,
                texts.deleted,
                version,
            )),
        }
    }

    pub fn describe(&mut self, path: &str) -> Result<FileSides> {
        let file = find_file(&mut self.files, path)?;
        let mut blobs = self.repo.blob_reader()?;
        Ok(FileSides {
            path: file.display_path(),
            reason: file.unsupported_reason(),
            local: side_content(&mut blobs, file.stages.local.as_ref())?,
            remote: side_content(&mut blobs, file.stages.remote.as_ref())?,
            disk_version: file.disk_version(),
        })
    }

    #[must_use]
    pub fn remaining(&self) -> usize {
        self.files
            .iter()
            .filter(|file| file.status == FileStatus::Unresolved)
            .count()
    }
}

pub(crate) fn find_file<'a>(files: &'a mut [FileState], path: &str) -> Result<&'a mut FileState> {
    files
        .iter_mut()
        .find(|file| file.path.to_string_lossy() == path)
        .ok_or_else(|| Error::UnknownPath {
            path: path.to_owned(),
        })
}

impl FileState {
    pub(crate) fn display_path(&self) -> String {
        self.path.to_string_lossy().into_owned()
    }

    pub(crate) fn require_text(&self) -> Result<&Texts> {
        match &self.content {
            Content::Text(texts) => Ok(texts),
            Content::Unsupported(reason) => Err(Error::Unsupported {
                path: self.display_path(),
                reason: *reason,
            }),
        }
    }

    fn unsupported_reason(&self) -> Option<UnsupportedReason> {
        match &self.content {
            Content::Text(_) => None,
            Content::Unsupported(reason) => Some(*reason),
        }
    }

    pub(crate) fn disk_version(&self) -> DiskVersion {
        self.settled
            .as_ref()
            .map_or(DiskVersion(0), |settled| settled.version)
    }

    pub(crate) fn read_disk(&self, repo: &Repo) -> Result<OnDisk> {
        read_on_disk(repo, &self.path, self.stages.has_mode(SUBMODULE_MODE))
    }

    /// The disk read to settle: the file differs from what yamt last saw, or its last staging failed.
    pub(crate) fn look(&self, repo: &Repo) -> Result<Option<OnDisk>> {
        let disk = self.read_disk(repo)?;
        let stage_failed = matches!(
            self.settled,
            Some(Settled {
                result: DiskResult::StageFailed { .. },
                ..
            })
        );
        Ok((stage_failed || !self.seen.is(&disk)).then_some(disk))
    }

    fn settled_as(&mut self, disk: OnDisk, result: DiskResult) -> DiskChange {
        self.seen = Seen::Disk(disk);
        self.settled = Some(Settled {
            version: DiskVersion(self.disk_version().0.saturating_add(1)),
            result: result.clone(),
        });
        DiskChange {
            path: self.display_path(),
            result,
        }
    }
}
