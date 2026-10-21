use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;
use yamt_gitio::{Repo, Stop};

use crate::decode::UnsupportedReason;
use crate::disk::{
    AtOpen, DiskChange, DiskResult, DiskVersion, MarkerRule, OnDisk, Seen, Settlement,
    read_on_disk, settlement, stage, warn_unread,
};
use crate::merge_data::{FileMergeData, Texts, disk_merge_data, merge_data};
use crate::orientation::Orientation;
use crate::remembered::remembered_merge_data;
use crate::side_names::SideNames;
use crate::sides::{FileSides, SUBMODULE_MODE, Side, side_content};
use crate::stages::CapturedStages;
use crate::waiting::MarkerStyle;
use crate::{Error, Result};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum FileStatus {
    Unresolved,
    /// Unmerged for git, with the resolution git rerere replayed on disk, not yet reviewed (plan §2 #90).
    Remembered,
    Resolved,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileEntry {
    pub path: String,
    pub status: FileStatus,
    pub unsupported: Option<UnsupportedReason>,
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
    /// Both panes' names, read once at open.
    pub(crate) side_names: SideNames,
    pub(crate) stop: Stop,
    /// Decided once at open from `stop` (plan §2 #86).
    pub(crate) orientation: Orientation,
    /// The disk version every file starts at: above every version an earlier session of this run gave out (#1383).
    pub(crate) first_disk_version: DiskVersion,
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

    /// What git was doing when the session opened.
    #[must_use]
    pub fn stop(&self) -> &Stop {
        &self.stop
    }

    /// The highest disk version this session gave out; the session of git's next stop starts above it.
    #[must_use]
    pub fn highest_disk_version(&self) -> DiskVersion {
        let first = self.first_disk_version;
        self.files
            .iter()
            .map(|file| file.disk_version(first))
            .fold(first, std::cmp::max)
    }

    /// Settles every file that changed on disk since yamt last saw it, then re-reads git's marks.
    pub(crate) fn settle_and_mark(&mut self) -> Result<Vec<DiskChange>> {
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
        Ok(disk_changes)
    }

    pub(crate) fn refresh_statuses(&mut self) -> Result<()> {
        let unmerged = self.repo.unmerged()?;
        for file in &mut self.files {
            let is_unmerged = unmerged.iter().any(|entry| entry.path == file.path);
            file.status = if is_unmerged {
                file.unmerged_status()
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
        let first = self.first_disk_version;
        let mut changes = Vec::with_capacity(decided.len());
        for (index, disk, found) in decided {
            if let Some(file) = self.files.get_mut(index) {
                changes.push(file.settled_as(disk, staging.result(&found), first));
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
        let first = self.first_disk_version;
        let file = find_file(&mut self.files, path)?;
        let texts = file.require_text()?;
        let version = file.disk_version(first);
        let path = file.display_path();
        let orientation = self.orientation;
        match &file.seen {
            Seen::ViewFromDisk(disk) => Ok(disk_merge_data(
                &path,
                texts,
                disk,
                file.marker_size,
                orientation,
                version,
            )),
            Seen::ViewRemembered { shown, git_output } => Ok(remembered_merge_data(
                &path,
                texts,
                shown,
                git_output,
                file.marker_size,
                orientation,
                version,
            )),
            Seen::ViewFromStages(_) | Seen::GitOutput => Ok(merge_data(
                &path,
                &texts.base,
                &texts.local,
                &texts.remote,
                texts.deleted,
                &file.marker_style(orientation),
                version,
            )),
        }
    }

    pub fn describe(&mut self, path: &str) -> Result<FileSides> {
        let first = self.first_disk_version;
        let file = find_file(&mut self.files, path)?;
        let mut blobs = self.repo.blob_reader()?;
        let orientation = self.orientation;
        let pane = |side| file.stages.of(orientation.git_side(side));
        Ok(FileSides {
            path: file.display_path(),
            reason: file.unsupported_reason(),
            local: side_content(&mut blobs, pane(Side::Local))?,
            remote: side_content(&mut blobs, pane(Side::Remote))?,
            disk_version: file.disk_version(first),
        })
    }

    /// The files git still lists unmerged, remembered ones included.
    #[must_use]
    pub fn remaining(&self) -> usize {
        self.files
            .iter()
            .filter(|file| file.status != FileStatus::Resolved)
            .count()
    }
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

    /// The last settle's version, or `first` (the session's first disk version) before any settle.
    pub(crate) fn disk_version(&self, first: DiskVersion) -> DiskVersion {
        self.settled
            .as_ref()
            .map_or(first, |settled| settled.version)
    }

    /// The marker lines git wrote into this file, as found at open.
    fn marker_style(&self, orientation: Orientation) -> MarkerStyle {
        match &self.at_open {
            AtOpen::Untouched(OnDisk::File(bytes)) | AtOpen::Changed(OnDisk::File(bytes)) => {
                MarkerStyle::found_in(bytes, self.marker_size, orientation)
            }
            AtOpen::Untouched(_)
            | AtOpen::Changed(_)
            | AtOpen::Remembered { .. }
            | AtOpen::Unread => MarkerStyle::fallback(self.marker_size, orientation),
        }
    }

    /// The status of a file git lists unmerged: `Remembered` while it shows rerere's resolution.
    pub(crate) fn unmerged_status(&self) -> FileStatus {
        match self.seen {
            Seen::ViewRemembered { .. } => FileStatus::Remembered,
            Seen::GitOutput | Seen::ViewFromStages(_) | Seen::ViewFromDisk(_) => {
                FileStatus::Unresolved
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

    fn settled_as(&mut self, disk: OnDisk, result: DiskResult, first: DiskVersion) -> DiskChange {
        self.seen = Seen::ViewFromDisk(disk);
        self.settled = Some(Settled {
            version: DiskVersion(self.disk_version(first).0.saturating_add(1)),
            result: result.clone(),
        });
        DiskChange {
            path: self.display_path(),
            result,
        }
    }
}
