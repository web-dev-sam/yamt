use std::path::Path;

use yamt_gitio::{Oid, Repo};

use crate::entries::{FileAt, blob_ids, entries_at, files_at, sort_by_display_path};
use crate::load::load_file;
use crate::search::search_page;
use crate::spec::Dots;
use crate::{
    Compared, Error, RangeEntry, RangeFile, RangeFileId, RangeSide, RangeSideLabel, RangeSpec,
    RangeStart, Result, SearchTexts,
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

/// A resolved range and its changed files: immutable for the window's life. `entries[i]` and
/// `files[i]` are the same file, whose id is `i`.
pub struct Range {
    resolved: Resolved,
    entries: Vec<RangeEntry>,
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
        Ok(Range {
            resolved: self,
            entries: entries_at(&changed),
            files: files_at(&changed, sizes),
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
            files: self.entries.clone(),
        }
    }

    pub fn load(&self, file: RangeFileId) -> Result<RangeFile> {
        let Some(found) = list_index(file).and_then(|index| self.files.get(index)) else {
            return Err(Error::UnknownFile { file });
        };
        load_file(&self.resolved.repo, found)
    }

    /// One page of text files from `from` on; `from` may be the list's length, which answers an empty last page.
    pub fn search_texts(&self, from: RangeFileId) -> Result<SearchTexts> {
        let Some(files) = list_index(from).and_then(|index| self.files.get(index..)) else {
            return Err(Error::UnknownFile { file: from });
        };
        search_page(&self.resolved.repo, from, files)
    }

    #[must_use]
    pub fn entry(&self, file: RangeFileId) -> Option<&RangeEntry> {
        list_index(file).and_then(|index| self.entries.get(index))
    }

    #[must_use]
    pub fn entries(&self) -> &[RangeEntry] {
        &self.entries
    }

    #[must_use]
    pub fn compared(&self) -> Compared {
        Compared {
            left: self.resolved.left.oid.clone(),
            right: self.resolved.right.oid.clone(),
            left_short_id: self.resolved.left.side.short_id.clone(),
            right_short_id: self.resolved.right.side.short_id.clone(),
            right_label: self.resolved.right.side.label.clone(),
        }
    }

    /// The work tree root git answered.
    #[must_use]
    pub fn root(&self) -> &Path {
        self.resolved.root()
    }
}

fn list_index(file: RangeFileId) -> Option<usize> {
    usize::try_from(file.0).ok()
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

#[cfg(test)]
mod tests {
    use std::fs;

    use yamt_conflict_repo::{ConflictFile, FileKind, git_ok};

    use super::*;

    fn file<'a>(path: &'a str, local: &'a [u8]) -> ConflictFile<'a> {
        ConflictFile {
            path,
            kind: FileKind::Regular,
            base: None,
            local: Some(local),
            remote: None,
        }
    }

    fn commit(root: &Path, revision: &str) -> Oid {
        let output = git_ok(root, &["rev-parse", revision]).unwrap();
        Oid::parse(String::from_utf8(output).unwrap().trim_end()).unwrap()
    }

    fn short_commit(root: &Path, revision: &str) -> String {
        let output = git_ok(root, &["rev-parse", "--short", revision]).unwrap();
        String::from_utf8(output).unwrap().trim_end().to_owned()
    }

    #[test]
    fn the_accessors_answer_the_listed_rows_both_commits_and_the_work_tree() {
        let repo =
            yamt_conflict_repo::diverged_repo(&[file("a.txt", b"a\n"), file("b.txt", b"b\n")])
                .unwrap();
        let root = repo.path();
        let spec = RangeSpec::parse("main..local").unwrap();
        let range = Resolved::resolve(root, &spec).unwrap().list().unwrap();

        assert_eq!(range.entries(), range.start().files.as_slice());
        let paths: Vec<&str> = range
            .entries()
            .iter()
            .map(|entry| entry.path.as_str())
            .collect();
        assert_eq!(paths, ["a.txt", "b.txt"]);
        assert_eq!(range.entry(RangeFileId(1)), range.entries().get(1));
        assert_eq!(range.entry(RangeFileId(2)), None);
        assert_eq!(
            range.compared(),
            Compared {
                left: commit(root, "main"),
                right: commit(root, "local"),
                left_short_id: short_commit(root, "main"),
                right_short_id: short_commit(root, "local"),
                right_label: named("local"),
            }
        );
        assert_eq!(
            fs::canonicalize(range.root()).unwrap(),
            fs::canonicalize(root).unwrap()
        );
    }
}
