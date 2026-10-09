use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;
use yamt_gitio::{BlobReader, Repo, Stage, StageEntry};
use yamt_merge_core::{Chunk, Options, compute_chunks};

use crate::decode::{Eol, UnsupportedReason, decode_side, detect_eol, language_of};
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
    pub language: Option<String>,
    pub chunks: Vec<Chunk>,
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
        let file = self.file(path)?;
        let texts = file.texts()?;
        let eol_source = if texts.base.is_empty() {
            &texts.local
        } else {
            &texts.base
        };
        let chunks = compute_chunks(
            &texts.base,
            &texts.local,
            &texts.remote,
            &Options::default(),
        );
        Ok(FileMergeData {
            path: file.display_path(),
            base: texts.base.clone(),
            local: texts.local.clone(),
            remote: texts.remote.clone(),
            eol: detect_eol(eol_source),
            language: language_of(&file.path),
            chunks,
        })
    }

    pub fn finish(&mut self, path: &str, result: &str) -> Result<()> {
        let file = self.file(path)?;
        file.texts()?;
        let worktree_file = self.repo.root().join(&file.path);
        fs::write(&worktree_file, result).map_err(|source| Error::WriteFailed {
            path: path.to_owned(),
            source,
        })?;
        self.repo.add(&file.path)?;
        self.file_mut(path)?.status = FileStatus::Resolved;
        Ok(())
    }

    pub fn reset(&mut self, path: &str) -> Result<()> {
        let file = self.file(path)?;
        self.repo.restore_stages(&file.stages.entries())?;
        // `checkout -m` refuses a path without both sides: "does not have all necessary versions".
        if file.stages.has_both_sides() {
            self.repo.checkout_merge(&file.path)?;
        }
        self.file_mut(path)?.status = FileStatus::Unresolved;
        Ok(())
    }

    #[must_use]
    pub fn remaining(&self) -> usize {
        self.files
            .iter()
            .filter(|file| file.status == FileStatus::Unresolved)
            .count()
    }

    fn file(&self, path: &str) -> Result<&FileState> {
        self.files
            .iter()
            .find(|file| file.display_path() == path)
            .ok_or_else(|| Error::UnknownPath {
                path: path.to_owned(),
            })
    }

    fn file_mut(&mut self, path: &str) -> Result<&mut FileState> {
        self.files
            .iter_mut()
            .find(|file| file.display_path() == path)
            .ok_or_else(|| Error::UnknownPath {
                path: path.to_owned(),
            })
    }
}

impl FileState {
    fn display_path(&self) -> String {
        self.path.to_string_lossy().into_owned()
    }

    fn texts(&self) -> Result<&Texts> {
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

    fn has_both_sides(&self) -> bool {
        self.local.is_some() && self.remote.is_some()
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
        match groups.last_mut() {
            Some((path, stages)) if *path == entry.path => stages.insert(entry),
            Some(_) | None => {
                let mut stages = CapturedStages::default();
                let path = entry.path.clone();
                stages.insert(entry);
                groups.push((path, stages));
            }
        }
    }
    groups
}

fn read_content(blobs: &mut BlobReader, path: &Path, stages: &CapturedStages) -> Result<Content> {
    if path.to_str().is_none() {
        return Ok(Content::Unsupported(UnsupportedReason::NonUtf8));
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
    let decoded = decode_texts(base, blobs.read(&local.oid)?, blobs.read(&remote.oid)?);
    match decoded {
        Ok(texts) => Ok(Content::Text(texts)),
        Err(reason) => Ok(Content::Unsupported(reason)),
    }
}

fn decode_texts(
    base: Vec<u8>,
    local: Vec<u8>,
    remote: Vec<u8>,
) -> Result<Texts, UnsupportedReason> {
    Ok(Texts {
        base: decode_side(base)?,
        local: decode_side(local)?,
        remote: decode_side(remote)?,
    })
}
