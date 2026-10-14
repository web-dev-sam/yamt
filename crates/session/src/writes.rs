use std::fs;
use std::io;
use std::path::Path;

use yamt_gitio::{Repo, StageEntry};

use crate::disk::{DiskChange, DiskVersion, OnDisk, Seen, warn_unread};
use crate::session::{
    FileState, FileStatus, LOG_TARGET, MergeSession, Settled, WriteReply, file_index, find_file,
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
        let before = write_text(&self.repo, file, result)?;
        if let Err(error) = self.repo.add_paths(&[file.path.as_path()]) {
            put_back(
                &self.repo,
                file,
                before.as_deref(),
                "finish_rollback_failed",
            );
            return Err(error.into());
        }
        file.status = FileStatus::Resolved;
        file.seen = file
            .seen
            .after_own_write(OnDisk::File(result.as_bytes().to_vec()));
        Ok(self.written_reply())
    }

    /// Writes `text` without staging it, unless the file changed on disk or since `disk_version`
    /// (plan §2 #65); the disk version stays, and the write never comes back as a disk change.
    pub fn save(
        &mut self,
        path: &str,
        text: &str,
        disk_version: DiskVersion,
    ) -> Result<WriteReply> {
        find_file(&mut self.files, path)?.require_text()?;
        if let Some(change) = self.changed_on_disk(path, disk_version)? {
            return Ok(self.changed_reply(change));
        }
        let file = find_file(&mut self.files, path)?;
        write_text(&self.repo, file, text)?;
        file.seen = file
            .seen
            .after_own_write(OnDisk::File(text.as_bytes().to_vec()));
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
        let index_before = index_before(&self.repo, file)?;
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
        read_back(&self.repo, file);
        Ok(self.written_reply())
    }

    /// Puts back the captured stages and the file as this run found it at open (plan §2 #66),
    /// unless the file changed on disk or since `disk_version`; all or nothing.
    pub fn reset(&mut self, path: &str, disk_version: DiskVersion) -> Result<WriteReply> {
        if let Some(change) = self.changed_on_disk(path, disk_version)? {
            return Ok(self.changed_reply(change));
        }
        let file = find_file(&mut self.files, path)?;
        let now = file.read_disk(&self.repo)?;
        let entry = file.at_open.regular_entry().cloned();
        if entry.is_some() && matches!(now, OnDisk::Submodule(_) | OnDisk::Other) {
            return Err(Error::NotAFile {
                path: file.display_path(),
            });
        }
        let index_before = index_before(&self.repo, file)?;
        self.repo.restore_stages(&file.stages.entries())?;
        let worktree = match &entry {
            Some(OnDisk::File(bytes)) => put_entry(&self.repo, file, Some(bytes), &now),
            Some(OnDisk::Missing) => put_entry(&self.repo, file, None, &now),
            Some(OnDisk::Link(_) | OnDisk::Submodule(_) | OnDisk::Other) | None => {
                rebuild_markers(&self.repo, file)
            }
        };
        if let Err(error) = worktree {
            if let Err(restore_error) = restore_index(&self.repo, file, index_before) {
                warn_rollback_failed("reset_restore_failed", path, &restore_error);
                file.status = FileStatus::Unresolved;
            }
            return Err(error);
        }
        file.status = FileStatus::Unresolved;
        match entry {
            Some(disk) => file.seen = file.at_open.seen_after_reset(disk),
            None => read_back(&self.repo, file),
        }
        Ok(self.written_reply())
    }

    /// The change that stops a write to `path`: one settled after the window's `disk_version`,
    /// or one found now, which is settled before returning.
    fn changed_on_disk(
        &mut self,
        path: &str,
        disk_version: DiskVersion,
    ) -> Result<Option<DiskChange>> {
        let index = file_index(&self.files, path)?;
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
        let change = self.settle(vec![(index, disk)]).pop();
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

fn index_before(repo: &Repo, file: &FileState) -> Result<IndexBefore> {
    match file.status {
        FileStatus::Unresolved => Ok(IndexBefore::Conflicted),
        FileStatus::Resolved => Ok(IndexBefore::Resolved(repo.index_records(&file.path)?)),
    }
}

/// Writes `text` over the file unless it already holds these bytes; returns the bytes it found
/// (`None`: no file). A failed write puts them back, as far as it can.
fn write_text(repo: &Repo, file: &FileState, text: &str) -> Result<Option<Vec<u8>>> {
    let before = file_bytes_before_write(repo, file)?;
    if before.as_deref() == Some(text.as_bytes()) {
        return Ok(before);
    }
    let worktree_file = repo.root().join(&file.path);
    if let Err(error) = write_worktree_file(&worktree_file, &file.display_path(), text.as_bytes()) {
        put_back(repo, file, before.as_deref(), "write_rollback_failed");
        return Err(error);
    }
    Ok(before)
}

/// Best effort: the file as it was before yamt wrote it (`None`: no file).
fn put_back(repo: &Repo, file: &FileState, before: Option<&[u8]>, event: &str) {
    let worktree_file = repo.root().join(&file.path);
    let path = file.display_path();
    let rollback = match before {
        Some(bytes) => write_worktree_file(&worktree_file, &path, bytes),
        None => remove_worktree_file(&worktree_file, &path),
    };
    if let Err(error) = rollback {
        warn_rollback_failed(event, &path, &error);
    }
}

/// Writes `bytes` (`None`: removes the file), replacing a link found `now`; a failed write puts
/// the file from `now` back, as far as it can.
fn put_entry(repo: &Repo, file: &FileState, bytes: Option<&[u8]>, now: &OnDisk) -> Result<()> {
    let worktree_file = repo.root().join(&file.path);
    let path = file.display_path();
    if let OnDisk::Link(_) = now {
        remove_worktree_file(&worktree_file, &path)?;
    }
    let written = match bytes {
        Some(bytes) => write_worktree_file(&worktree_file, &path, bytes),
        None => remove_worktree_file(&worktree_file, &path),
    };
    if written.is_err() {
        match now {
            OnDisk::File(before) => put_back(repo, file, Some(before), "reset_rollback_failed"),
            OnDisk::Missing => put_back(repo, file, None, "reset_rollback_failed"),
            OnDisk::Link(_) | OnDisk::Submodule(_) | OnDisk::Other => {
                tracing::warn!(target: LOG_TARGET, event = "reset_link_not_put_back", path, "the link was removed before the failed write");
            }
        }
    }
    written
}

fn rebuild_markers(repo: &Repo, file: &FileState) -> Result<()> {
    if file.stages.can_rebuild_markers() {
        repo.checkout_merge(&file.path)?;
    }
    Ok(())
}

fn warn_rollback_failed(event: &str, path: &str, error: &Error) {
    tracing::warn!(target: LOG_TARGET, event, path, %error, "rollback failed");
}

fn file_bytes_before_write(repo: &Repo, file: &FileState) -> Result<Option<Vec<u8>>> {
    match file.read_disk(repo)? {
        OnDisk::File(bytes) => Ok(Some(bytes)),
        OnDisk::Missing => Ok(None),
        OnDisk::Link(_) | OnDisk::Submodule(_) | OnDisk::Other => Err(Error::NotAFile {
            path: file.display_path(),
        }),
    }
}

fn read_back(repo: &Repo, file: &mut FileState) {
    match file.read_disk(repo) {
        Ok(disk) => file.seen = Seen::ViewFromStages(disk),
        Err(error) => warn_unread(&file.display_path(), &error),
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
