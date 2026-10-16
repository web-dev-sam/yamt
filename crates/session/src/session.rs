use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;
use yamt_gitio::Repo;

use crate::decode::UnsupportedReason;
use crate::disk::{
    AtOpen, DiskChange, DiskResult, DiskVersion, MarkerRule, OnDisk, Seen, Settlement,
    read_on_disk, settlement, stage, warn_unread,
};
use crate::merge_data::{FileMergeData, Texts, disk_merge_data, merge_data};
use crate::side_names::{MERGE_HEAD, SideNames};
use crate::sides::{FileSides, SUBMODULE_MODE, side_content};
use crate::stages::CapturedStages;
use crate::waiting::MarkerStyle;
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

/// The files as git sees them, the disk changes settled while looking, and whether a merge is in progress.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileList {
    pub files: Vec<FileEntry>,
    pub disk_changes: Vec<DiskChange>,
    /// A `git merge` stopped on conflicts is in progress (`MERGE_HEAD`, no rebase): what Abort merge undoes (plan §2 #74).
    pub merging: bool,
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
    pub(crate) side_names: SideNames,
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
    /// Set once by `open`, never written again.
    pub(crate) at_open: AtOpen,
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
    pub fn side_names(&self) -> &SideNames {
        &self.side_names
    }

    /// Settles every file that changed on disk since yamt last saw it, then re-reads git's marks.
    pub fn refresh(&mut self) -> Result<FileList> {
        let mut looked = Vec::new();
        for (index, file) in self.files.iter().enumerate() {
            match file.look(&self.repo) {
                Ok(Some(disk)) => looked.push((index, disk)),
                Ok(None) => {}
                Err(error) => warn_unread(&file.display_path(), &error),
            }
        }
        let disk_changes = self.settle(looked);
        self.refresh_statuses()?;
        Ok(FileList {
            files: self.files(),
            disk_changes,
            merging: is_merging(&self.repo),
        })
    }

    /// `git merge --abort`. The session must not be used for the merge afterwards.
    pub fn abort_merge(&self) -> Result<()> {
        self.repo.abort_merge()?;
        Ok(())
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

    /// Settles each read of the file at its index: one batch of `git add` and one of
    /// `update-index --force-remove`.
    pub(crate) fn settle(&mut self, looked: Vec<(usize, OnDisk)>) -> Vec<DiskChange> {
        let mut adds: Vec<&Path> = Vec::new();
        let mut removes: Vec<&Path> = Vec::new();
        let mut decided = Vec::with_capacity(looked.len());
        for (index, disk) in looked {
            let Some(file) = self.files.get(index) else {
                continue;
            };
            let found = settlement(&disk, file.rule, file.marker_size);
            match found {
                Settlement::Add => adds.push(&file.path),
                Settlement::Remove => removes.push(&file.path),
                Settlement::LeaveWithMarkers { .. } | Settlement::LeaveAsIs => {}
            }
            decided.push((index, disk, found));
        }
        let staging = stage(&self.repo, &adds, &removes);
        let mut changes = Vec::with_capacity(decided.len());
        for (index, disk, found) in decided {
            if let Some(file) = self.files.get_mut(index) {
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
            Seen::ViewFromDisk(disk) => Ok(disk_merge_data(
                &path,
                texts,
                disk,
                file.marker_size,
                version,
            )),
            Seen::ViewFromStages(_) | Seen::GitOutput => Ok(merge_data(
                &path,
                &texts.base,
                &texts.local,
                &texts.remote,
                texts.deleted,
                &file.marker_style(),
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

fn is_merging(repo: &Repo) -> bool {
    match merge_in_progress(repo) {
        Ok(merging) => merging,
        Err(error) => {
            tracing::warn!(target: LOG_TARGET, event = "merge_state_unread", %error, "no merge to abort is assumed");
            false
        }
    }
}

// A `git rebase -r` stopped on a merge commit's conflict writes MERGE_HEAD too; `git merge --abort` there would leave the rebase half done.
fn merge_in_progress(repo: &Repo) -> yamt_gitio::Result<bool> {
    if repo.commit_named(MERGE_HEAD)?.is_none() {
        return Ok(false);
    }
    Ok(!repo.rebase_in_progress()?)
}

pub(crate) fn find_file<'a>(files: &'a mut [FileState], path: &str) -> Result<&'a mut FileState> {
    files
        .iter_mut()
        .find(|file| file.path.to_string_lossy() == path)
        .ok_or_else(|| unknown_path(path))
}

pub(crate) fn file_index(files: &[FileState], path: &str) -> Result<usize> {
    files
        .iter()
        .position(|file| file.path.to_string_lossy() == path)
        .ok_or_else(|| unknown_path(path))
}

fn unknown_path(path: &str) -> Error {
    Error::UnknownPath {
        path: path.to_owned(),
    }
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

    /// The marker lines git wrote into this file, as found at open.
    fn marker_style(&self) -> MarkerStyle {
        match &self.at_open {
            AtOpen::Untouched(OnDisk::File(bytes)) | AtOpen::Changed(OnDisk::File(bytes)) => {
                MarkerStyle::found_in(bytes, self.marker_size)
            }
            AtOpen::Untouched(_) | AtOpen::Changed(_) | AtOpen::Unread => {
                MarkerStyle::fallback(self.marker_size)
            }
        }
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
        self.seen = Seen::ViewFromDisk(disk);
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
