use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;
use yamt_gitio::{BlobReader, Repo, Stage, StageEntry};
use yamt_merge_core::{Chunk, Options, WordChanges, compute_chunks, word_changes};

use crate::decode::{Eol, UnsupportedReason, decode_sides, detect_eol};
use crate::sides::{FileSides, SUBMODULE_MODE, SYMLINK_MODE, Side, side_content};
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
    pub eol: Eol,
    pub chunks: Vec<Chunk>,
    pub word_changes: Vec<WordChanges>,
}

#[must_use]
pub fn merge_data(path: &str, base: &str, local: &str, remote: &str) -> FileMergeData {
    let eol_source = if base.is_empty() { local } else { base };
    let chunks = compute_chunks(base, local, remote, &Options::default());
    FileMergeData {
        path: path.to_owned(),
        base: base.to_owned(),
        local: local.to_owned(),
        remote: remote.to_owned(),
        eol: detect_eol(eol_source),
        word_changes: word_changes(base, local, remote, &chunks),
        chunks,
    }
}

const LOG_TARGET: &str = "session";

pub struct MergeSession {
    repo: Repo,
    files: Vec<FileState>,
}

struct FileState {
    path: PathBuf,
    stages: CapturedStages,
    status: FileStatus,
    content: Content,
}

#[derive(Default)]
struct CapturedStages {
    base: Option<StageEntry>,
    local: Option<StageEntry>,
    remote: Option<StageEntry>,
}

enum Content {
    Text(Texts),
    Unsupported(UnsupportedReason),
}

struct Texts {
    base: String,
    local: String,
    remote: String,
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
        Ok(MergeSession { repo, files })
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        self.repo.root()
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

impl CapturedStages {
    fn side(&self, side: Side) -> Option<&StageEntry> {
        match side {
            Side::Local => self.local.as_ref(),
            Side::Remote => self.remote.as_ref(),
        }
    }

    fn insert(&mut self, entry: StageEntry) {
        match entry.stage {
            Stage::Base => self.base = Some(entry),
            Stage::Local => self.local = Some(entry),
            Stage::Remote => self.remote = Some(entry),
        }
    }

    fn can_rebuild_markers(&self) -> bool {
        // `checkout -m` refuses a path without both sides: "does not have all necessary versions" (git builtin/checkout.c, observed on git 2.56).
        let has_both_sides = self.local.is_some() && self.remote.is_some();
        // A gitlink stage is a commit, not a blob: "fatal: unable to read blob object" (exit 128, observed on git 2.56).
        has_both_sides && !self.has_mode(SUBMODULE_MODE)
    }

    fn has_mode(&self, mode: u32) -> bool {
        [&self.base, &self.local, &self.remote]
            .into_iter()
            .flatten()
            .any(|entry| entry.mode == mode)
    }

    fn entries(&self) -> Vec<StageEntry> {
        [&self.base, &self.local, &self.remote]
            .into_iter()
            .flatten()
            .cloned()
            .collect()
    }
}

fn group_by_path(entries: Vec<StageEntry>) -> Vec<(PathBuf, CapturedStages)> {
    let mut groups: Vec<(PathBuf, CapturedStages)> = Vec::new();
    for entry in entries {
        if let Some((path, stages)) = groups.last_mut()
            && *path == entry.path
        {
            stages.insert(entry);
        } else {
            let mut stages = CapturedStages::default();
            let path = entry.path.clone();
            stages.insert(entry);
            groups.push((path, stages));
        }
    }
    groups
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
    let Some(local) = &stages.local else {
        return Ok(Content::Unsupported(UnsupportedReason::LocalDeleted));
    };
    let Some(remote) = &stages.remote else {
        return Ok(Content::Unsupported(UnsupportedReason::RemoteDeleted));
    };
    let base = match &stages.base {
        Some(entry) => blobs.read(&entry.oid)?,
        None => Vec::new(),
    };
    let sides = [base, blobs.read(&local.oid)?, blobs.read(&remote.oid)?];
    match decode_sides(sides) {
        Ok([base, local, remote]) => Ok(Content::Text(Texts {
            base,
            local,
            remote,
        })),
        Err(reason) => Ok(Content::Unsupported(reason)),
    }
}
