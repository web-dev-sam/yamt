use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;
use yamt_gitio::{BlobReader, Repo, Stage, StageEntry};
use yamt_merge_core::{Chunk, Options, WordChanges, compute_chunks, word_changes};

use crate::decode::{Eol, UnsupportedReason, decode_sides, detect_eol};
use crate::{Error, Result};

const SYMLINK_MODE: u32 = 0o120_000;
const SUBMODULE_MODE: u32 = 0o160_000;

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
    pub fn files(&self) -> Vec<FileEntry> {
        let mut entries = Vec::with_capacity(self.files.len());
        for file in &self.files {
            let unsupported = match &file.content {
                Content::Text(_) => None,
                Content::Unsupported(reason) => Some(*reason),
            };
            entries.push(FileEntry {
                path: file.display_path(),
                status: file.status,
                unsupported,
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
        fs::write(&worktree_file, result).map_err(|source| Error::WriteFailed {
            path: path.to_owned(),
            source,
        })?;
        self.repo.add(&file.path)?;
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
}

impl CapturedStages {
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
