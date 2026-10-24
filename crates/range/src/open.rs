use std::path::Path;

use yamt_gitio::{Oid, Repo};

use crate::entries::{FileAt, blob_ids, files_at, sort_by_display_path};
use crate::load::load_file;
use crate::spec::Dots;
use crate::{
    Error, RangeFile, RangeFileId, RangeSide, RangeSideLabel, RangeSpec, RangeStart, Result,
};

/// A range whose two commits git has named: built before any window opens.
pub struct Resolved {
    pub(crate) repo: Repo,
    spec: RangeSpec,
    pub(crate) left: SideAt,
    pub(crate) right: SideAt,
}

/// One side's commit, and how the window names it.
pub(crate) struct SideAt {
    pub(crate) oid: Oid,
    pub(crate) side: RangeSide,
}

/// A resolved range and its changed files: immutable for the window's life.
pub struct Range {
    resolved: Resolved,
    files: Vec<FileAt>,
}

impl Resolved {
    pub fn resolve(cwd: &Path, spec: &RangeSpec) -> Result<Resolved> {
        let repo = Repo::discover(cwd).map_err(|error| not_a_repository(cwd, error))?;
        let left_tip = commit_named(&repo, &spec.left)?;
        let right_tip = commit_named(&repo, &spec.right)?;
        let (left_oid, left_label) = match spec.dots {
            Dots::Two => (left_tip, named(&spec.left)),
            Dots::Three => {
                let base = repo.merge_base(&left_tip, &right_tip)?;
                let Some(base) = base else {
                    return Err(Error::NoMergeBase {
                        left: spec.left.clone(),
                        right: spec.right.clone(),
                    });
                };
                let label = RangeSideLabel::MergeBase {
                    left: spec.left.clone(),
                    right: spec.right.clone(),
                };
                (base, label)
            }
        };
        let left = side_at(&repo, left_oid, left_label)?;
        let right = side_at(&repo, right_tip, named(&spec.right))?;
        Ok(Resolved {
            repo,
            spec: spec.clone(),
            left,
            right,
        })
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        self.repo.root()
    }

    pub fn list(self) -> Result<Range> {
        let mut changed = self.repo.changed_files(&self.left.oid, &self.right.oid)?;
        sort_by_display_path(&mut changed);
        let sizes = self.repo.blob_sizes(&blob_ids(&changed))?;
        let files = files_at(changed, sizes);
        Ok(Range {
            resolved: self,
            files,
        })
    }
}

impl Range {
    #[must_use]
    pub fn start(&self) -> RangeStart {
        RangeStart {
            range: self.resolved.spec.text().to_owned(),
            left: self.resolved.left.side.clone(),
            right: self.resolved.right.side.clone(),
            files: self.files.iter().map(|file| file.entry.clone()).collect(),
        }
    }

    pub fn load(&self, file: RangeFileId) -> Result<RangeFile> {
        let Some(found) = self.files.iter().find(|at| at.entry.id == file) else {
            return Err(Error::UnknownFile { file });
        };
        load_file(&self.resolved.repo, found)
    }
}

/// `Repo::discover` fails with git's own refusal outside a work tree; its first line names why.
fn not_a_repository(cwd: &Path, error: yamt_gitio::Error) -> Error {
    if let yamt_gitio::Error::GitFailed { stderr, .. } = &error {
        let message = stderr.lines().next().unwrap_or_default().to_owned();
        return Error::NotARepository {
            path: cwd.to_owned(),
            message,
        };
    }
    Error::Git(error)
}

fn commit_named(repo: &Repo, name: &str) -> Result<Oid> {
    repo.commit_named(name)?.ok_or_else(|| Error::UnknownName {
        name: name.to_owned(),
    })
}

fn named(name: &str) -> RangeSideLabel {
    RangeSideLabel::Named {
        name: name.to_owned(),
    }
}

fn side_at(repo: &Repo, oid: Oid, label: RangeSideLabel) -> Result<SideAt> {
    let summary = repo.commit_summary(&oid)?;
    let side = RangeSide {
        label,
        short_id: String::from_utf8_lossy(&summary.short_id).into_owned(),
        subject: String::from_utf8_lossy(&summary.subject).into_owned(),
    };
    Ok(SideAt { oid, side })
}
