use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;
use yamt_gitio::{BlobReader, Repo, StageEntry};
use yamt_merge_core::{Chunk, Options, WordChanges, compute_chunks, word_changes};

use crate::decode::{Eol, UnsupportedReason, decode_sides, detect_eol};
use crate::remote_name::{RemoteName, read_remote_name};
use crate::sides::{FileSides, SUBMODULE_MODE, SYMLINK_MODE, Side, side_content};
use crate::stages::{CapturedStages, group_by_path};
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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct FileMergeData {
    pub path: String,
    pub base: String,
    pub local: String,
    pub remote: String,
    pub deleted: Option<Side>,
    pub eol: Eol,
    pub chunks: Vec<Chunk>,
    pub word_changes: Vec<WordChanges>,
}

#[must_use]
pub fn merge_data(
    path: &str,
    base: &str,
    local: &str,
    remote: &str,
    deleted: Option<Side>,
) -> FileMergeData {
    let eol_source = [base, local, remote]
        .into_iter()
        .find(|text| text.contains('\n'))
        .unwrap_or_default();
    let chunks = compute_chunks(base, local, remote, &Options::default());
    FileMergeData {
        path: path.to_owned(),
        base: base.to_owned(),
        local: local.to_owned(),
        remote: remote.to_owned(),
        deleted,
        eol: detect_eol(eol_source),
        word_changes: word_changes(base, local, remote, &chunks),
        chunks,
    }
}

pub(crate) const LOG_TARGET: &str = "session";

pub struct MergeSession {
    repo: Repo,
    files: Vec<FileState>,
    remote_name: Option<RemoteName>,
}

struct FileState {
    path: PathBuf,
    stages: CapturedStages,
    status: FileStatus,
    content: Content,
}

enum Content {
    Text(Texts),
    Unsupported(UnsupportedReason),
}

struct Texts {
    base: String,
    local: String,
    remote: String,
    deleted: Option<Side>,
}

enum IndexBefore {
    Conflicted,
    Resolved(Vec<u8>),
}

impl MergeSession {
    pub fn open(cwd: &Path) -> Result<MergeSession> {
        let repo = Repo::discover(cwd)?;
        let mut blobs = repo.blob_reader()?;
        let mut files = Vec::new();
        for (path, stages) in group_by_path(repo.unmerged()?) {
            let content = read_content(&mut blobs, &path, &stages)?;
            files.push(FileState {
                path,
                stages,
                status: FileStatus::Unresolved,
                content,
            });
        }
        let remote_name = read_remote_name(&repo);
        Ok(MergeSession {
            repo,
            files,
            remote_name,
        })
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        self.repo.root()
    }

    #[must_use]
    pub fn remote_name(&self) -> Option<RemoteName> {
        self.remote_name.clone()
    }

    pub fn refresh_statuses(&mut self) -> Result<()> {
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
        Ok(merge_data(
            &file.display_path(),
            &texts.base,
            &texts.local,
            &texts.remote,
            texts.deleted,
        ))
    }

    pub fn finish(&mut self, path: &str, result: &str) -> Result<()> {
        let file = find_file(&mut self.files, path)?;
        file.require_text()?;
        let worktree_file = self.repo.root().join(&file.path);
        let before = worktree_bytes(&worktree_file, path)?;
        write_worktree_file(&worktree_file, path, result.as_bytes())?;
        if let Err(error) = self.repo.add(&file.path) {
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
        Ok(())
    }

    pub fn describe(&mut self, path: &str) -> Result<FileSides> {
        let file = find_file(&mut self.files, path)?;
        let mut blobs = self.repo.blob_reader()?;
        Ok(FileSides {
            path: file.display_path(),
            reason: file.unsupported_reason(),
            local: side_content(&mut blobs, file.stages.local.as_ref())?,
            remote: side_content(&mut blobs, file.stages.remote.as_ref())?,
        })
    }

    pub fn take(&mut self, path: &str, side: Side) -> Result<()> {
        let file = find_file(&mut self.files, path)?;
        let index_before = match file.status {
            FileStatus::Unresolved => IndexBefore::Conflicted,
            FileStatus::Resolved => IndexBefore::Resolved(self.repo.index_records(&file.path)?),
        };
        let chosen = file.stages.side(side);
        match chosen {
            Some(entry) => self.repo.resolve_with(entry)?,
            None => self.repo.remove_from_index(&file.path)?,
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
        Ok(())
    }

    pub fn reset(&mut self, path: &str) -> Result<()> {
        let file = find_file(&mut self.files, path)?;
        self.repo.restore_stages(&file.stages.entries())?;
        file.status = FileStatus::Unresolved;
        if file.stages.can_rebuild_markers() {
            self.repo.checkout_merge(&file.path)?;
        }
        Ok(())
    }

    #[must_use]
    pub fn remaining(&self) -> usize {
        self.files
            .iter()
            .filter(|file| file.status == FileStatus::Unresolved)
            .count()
    }
}

fn find_file<'a>(files: &'a mut [FileState], path: &str) -> Result<&'a mut FileState> {
    files
        .iter_mut()
        .find(|file| file.path.to_string_lossy() == path)
        .ok_or_else(|| Error::UnknownPath {
            path: path.to_owned(),
        })
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

impl FileState {
    fn display_path(&self) -> String {
        self.path.to_string_lossy().into_owned()
    }

    fn require_text(&self) -> Result<&Texts> {
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
}

fn read_content(blobs: &mut BlobReader, path: &Path, stages: &CapturedStages) -> Result<Content> {
    if path.to_str().is_none() {
        return Ok(Content::Unsupported(UnsupportedReason::NonUtf8));
    }
    if stages.has_mode(SUBMODULE_MODE) {
        return Ok(Content::Unsupported(UnsupportedReason::Submodule));
    }
    if stages.has_mode(SYMLINK_MODE) {
        return Ok(Content::Unsupported(UnsupportedReason::Symlink));
    }
    let deleted = match (&stages.local, &stages.remote) {
        (Some(_), Some(_)) => None,
        (None, Some(_)) => Some(Side::Local),
        (Some(_), None) => Some(Side::Remote),
        (None, None) => return Ok(Content::Unsupported(UnsupportedReason::LocalDeleted)),
    };
    let base = stage_bytes(blobs, stages.base.as_ref(), b"")?;
    let local = stage_bytes(blobs, stages.local.as_ref(), &base)?;
    let remote = stage_bytes(blobs, stages.remote.as_ref(), &base)?;
    match decode_sides([base, local, remote]) {
        Ok([base, local, remote]) => Ok(Content::Text(Texts {
            base,
            local,
            remote,
            deleted,
        })),
        Err(reason) => Ok(Content::Unsupported(
            deleted_reason(deleted).unwrap_or(reason),
        )),
    }
}

fn stage_bytes(
    blobs: &mut BlobReader,
    entry: Option<&StageEntry>,
    missing: &[u8],
) -> Result<Vec<u8>> {
    match entry {
        Some(entry) => Ok(blobs.read(&entry.oid)?),
        None => Ok(missing.to_vec()),
    }
}

fn deleted_reason(deleted: Option<Side>) -> Option<UnsupportedReason> {
    deleted.map(|side| match side {
        Side::Local => UnsupportedReason::LocalDeleted,
        Side::Remote => UnsupportedReason::RemoteDeleted,
    })
}
