use std::fs;
use std::io;
use std::path::Path;

use yamt_gitio::{Repo, StageEntry};

use crate::disk::{DiskChange, DiskVersion, OnDisk, Seen};
use crate::session::{
    FileState, FileStatus, LOG_TARGET, MergeSession, Settled, WriteReply, find_file,
};
use crate::sides::{SUBMODULE_MODE, Side};
use crate::{Error, Result};

enum IndexBefore {
    Conflicted,
    Resolved(Vec<u8>),
}

impl MergeSession {
    /// Writes `result` and stages it, unless the file changed on disk or since `disk_version`.
    pub fn finish(
        &mut self,
        path: &str,
        result: &str,
        disk_version: DiskVersion,
    ) -> Result<WriteReply> {
        find_file(&mut self.files, path)?.require_text()?;
        if let Some(change) = self.changed_on_disk(path, disk_version)? {
            return Ok(self.changed_reply(change));
        }
        let file = find_file(&mut self.files, path)?;
        let worktree_file = self.repo.root().join(&file.path);
        let before = worktree_bytes(&worktree_file, path)?;
        write_worktree_file(&worktree_file, path, result.as_bytes())?;
        if let Err(error) = self.repo.add_paths(&[file.path.as_path()]) {
            let rollback = match before {
                Some(bytes) => write_worktree_file(&worktree_file, path, &bytes),
                None => remove_worktree_file(&worktree_file, path),
            };
            if let Err(rollback_error) = rollback {
                warn_rollback_failed("finish_rollback_failed", path, &rollback_error);
            }
            return Err(error.into());
        }
        file.status = FileStatus::Resolved;
        let read_back = file.read_disk(&self.repo)?;
        file.seen = match &file.seen {
            Seen::Disk(_) => Seen::Disk(read_back),
            Seen::Stages(_) | Seen::GitOutput => Seen::Stages(read_back),
        };
        Ok(self.written_reply())
    }

    /// Resolves the file with one side, unless it changed on disk or since `disk_version`.
    pub fn take(
        &mut self,
        path: &str,
        side: Side,
        disk_version: DiskVersion,
    ) -> Result<WriteReply> {
        if let Some(change) = self.changed_on_disk(path, disk_version)? {
            return Ok(self.changed_reply(change));
        }
        let file = find_file(&mut self.files, path)?;
        let index_before = match file.status {
            FileStatus::Unresolved => IndexBefore::Conflicted,
            FileStatus::Resolved => IndexBefore::Resolved(self.repo.index_records(&file.path)?),
        };
        let chosen = file.stages.side(side);
        match chosen {
            Some(entry) => self.repo.resolve_with(entry)?,
            None => self.repo.remove_paths(&[file.path.as_path()])?,
        }
        if let Err(error) = write_chosen_side(&self.repo, file, chosen) {
            if let Err(restore_error) = restore_index(&self.repo, file, index_before) {
                warn_rollback_failed("take_restore_failed", path, &restore_error);
                // A failed `update-index` leaves the index as it was: git replaces it only by
                // renaming `index.lock` over it (git lockfile.h), so the chosen side is still staged.
                file.status = FileStatus::Resolved;
            }
            return Err(error);
        }
        file.status = FileStatus::Resolved;
        file.seen = Seen::Stages(file.read_disk(&self.repo)?);
        Ok(self.written_reply())
    }

    /// Puts the captured stages back (and the markers, where git can), unless the file changed on
    /// disk or since `disk_version`.
    pub fn reset(&mut self, path: &str, disk_version: DiskVersion) -> Result<WriteReply> {
        if let Some(change) = self.changed_on_disk(path, disk_version)? {
            return Ok(self.changed_reply(change));
        }
        let file = find_file(&mut self.files, path)?;
        self.repo.restore_stages(&file.stages.entries())?;
        file.status = FileStatus::Unresolved;
        if file.stages.can_rebuild_markers() {
            self.repo.checkout_merge(&file.path)?;
        }
        file.seen = Seen::Stages(file.read_disk(&self.repo)?);
        Ok(self.written_reply())
    }

    /// The change that stops a write to `path`: one settled after the window's `disk_version`,
    /// or one found now, which is settled before returning.
    fn changed_on_disk(
        &mut self,
        path: &str,
        disk_version: DiskVersion,
    ) -> Result<Option<DiskChange>> {
        let file = find_file(&mut self.files, path)?;
        if let Some(Settled { version, result }) = &file.settled
            && *version != disk_version
        {
            return Ok(Some(DiskChange {
                path: file.display_path(),
                result: result.clone(),
            }));
        }
        let Some(disk) = file.look(&self.repo)? else {
            return Ok(None);
        };
        let mut disk = Some(disk);
        let looked: Vec<Option<OnDisk>> = self
            .files
            .iter()
            .map(|other| {
                if other.path.to_string_lossy() == path {
                    disk.take()
                } else {
                    None
                }
            })
            .collect();
        let change = self.settle(looked).pop();
        self.refresh_statuses()?;
        Ok(change)
    }

    fn changed_reply(&self, change: DiskChange) -> WriteReply {
        WriteReply::ChangedOnDisk {
            files: self.files(),
            change,
        }
    }

    fn written_reply(&self) -> WriteReply {
        WriteReply::Written {
            files: self.files(),
        }
    }
}

fn write_chosen_side(repo: &Repo, file: &FileState, chosen: Option<&StageEntry>) -> Result<()> {
    match chosen {
        Some(entry) if entry.mode == SUBMODULE_MODE => Ok(()),
        Some(_) => Ok(repo.checkout_from_index(&file.path)?),
        None if file.stages.has_mode(SUBMODULE_MODE) => Ok(()),
        None => remove_worktree_file(&repo.root().join(&file.path), &file.display_path()),
    }
}

fn restore_index(repo: &Repo, file: &FileState, before: IndexBefore) -> Result<()> {
    match before {
        IndexBefore::Conflicted => Ok(repo.restore_stages(&file.stages.entries())?),
        IndexBefore::Resolved(records) => Ok(repo.restore_index_records(&file.path, records)?),
    }
}

fn warn_rollback_failed(event: &str, path: &str, error: &Error) {
    tracing::warn!(target: LOG_TARGET, event, path, %error, "rollback failed");
}

fn worktree_bytes(worktree_file: &Path, path: &str) -> Result<Option<Vec<u8>>> {
    match fs::read(worktree_file) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(source) if source.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(source) => Err(write_failed(path, source)),
    }
}

fn write_worktree_file(worktree_file: &Path, path: &str, bytes: &[u8]) -> Result<()> {
    fs::write(worktree_file, bytes).map_err(|source| write_failed(path, source))
}

fn remove_worktree_file(worktree_file: &Path, path: &str) -> Result<()> {
    match fs::remove_file(worktree_file) {
        Ok(()) => Ok(()),
        Err(source) if source.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(write_failed(path, source)),
    }
}

fn write_failed(path: &str, source: io::Error) -> Error {
    Error::WriteFailed {
        path: path.to_owned(),
        source,
    }
}
