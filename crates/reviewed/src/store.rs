use std::collections::HashMap;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use yamt_merge_core::compare;
use yamt_range::{Range, RangeFileId};

use crate::stored::{
    ReviewedFile, StoredMark, StoredSide, keep_text, kept_text, lock, read_reviewed, sweep_texts,
    write_reviewed,
};
use crate::{Error, FileReview, Result, ReviewMark, ReviewOf, SinceReview};

/// One window's marks on its range: classified at open, then changed only by its own `mark` and `unmark`.
pub struct ReviewedStore {
    folder: PathBuf,
    review: ReviewOf,
    files: Vec<Option<Marked>>,
}

/// A listed file's mark as stored, and what it means for this range.
struct Marked {
    mark: ReviewMark,
    stored: StoredMark,
}

impl ReviewedStore {
    /// `<reviewed_dir>/<range.repo_key()>/<16 hex>/`: under its lock, reads `reviewed.json` (missing = no marks, nothing
    /// written), refuses newer/broken (file untouched), drops marks on paths `range` does not list and sweeps
    /// `texts/` files no mark names (writing only when something was dropped), then classifies each listed file.
    pub fn open(reviewed_dir: &Path, review: ReviewOf, range: &Range) -> Result<ReviewedStore> {
        let folder = reviewed_dir
            .join(range.repo_key()?)
            .join(review.folder_name());
        let has_folder = fs::exists(&folder).map_err(|error| Error::ReadFailed {
            path: folder.clone(),
            message: error.to_string(),
        })?;
        let marks = if has_folder {
            prune_unlisted_marks(&folder, &review, range)?
        } else {
            Vec::new()
        };
        Ok(ReviewedStore {
            files: classified(range, marks)?,
            folder,
            review,
        })
    }

    /// Marked files in list order; a file not in it is unreviewed.
    #[must_use]
    pub fn marks(&self) -> Vec<FileReview> {
        (0..)
            .zip(&self.files)
            .filter_map(|(id, marked)| {
                marked.as_ref().map(|marked| FileReview {
                    file: RangeFileId(id),
                    mark: marked.mark,
                })
            })
            .collect()
    }

    /// Records the file's current two sides (and its right text in `texts/<right id>` when `right_text` is `Some`
    /// and the file is missing there); the file becomes `Reviewed`.
    pub fn mark(&mut self, range: &Range, file: RangeFileId) -> Result<()> {
        let path = listed_path(range, file)?;
        let sides = range.sides(file)?;
        let right = sides.right.as_ref().map(StoredSide::of);
        let text = match &right {
            Some(right) => range.right_text(file)?.map(|text| (right.id.clone(), text)),
            None => None,
        };
        let stored = StoredMark {
            path: path.to_owned(),
            left: sides.left.as_ref().map(StoredSide::of),
            right,
            kept_text: text.is_some(),
        };
        self.write_change(text.as_ref(), |reviewed| reviewed.put(stored.clone()))?;
        if let Some(slot) = self.slot_mut(file) {
            *slot = Some(Marked {
                mark: ReviewMark::Reviewed,
                stored,
            });
        }
        Ok(())
    }

    /// Forgets the file's mark ("Unmark" and "Review from start"); a file with no mark writes nothing.
    pub fn unmark(&mut self, range: &Range, file: RangeFileId) -> Result<()> {
        let path = listed_path(range, file)?;
        if self.marked(file).is_none() {
            return Ok(());
        }
        self.write_change(None, |reviewed| reviewed.remove(path))?;
        if let Some(slot) = self.slot_mut(file) {
            *slot = None;
        }
        Ok(())
    }

    /// The reviewed right text (`""` when the mark's right side was deleted; `NoText` when the mark kept none, when
    /// another window's open swept the kept text, and for a file with no mark) against `range.right_text(file)`.
    pub fn since_review(&self, range: &Range, file: RangeFileId) -> Result<SinceReview> {
        listed_path(range, file)?;
        let Some(marked) = self.marked(file) else {
            return Ok(SinceReview::NoText);
        };
        let reviewed = match &marked.stored.right {
            None => String::new(),
            Some(right) if marked.stored.kept_text => match kept_text(&self.folder, &right.id)? {
                Some(text) => text,
                None => return Ok(SinceReview::NoText),
            },
            Some(_) => return Ok(SinceReview::NoText),
        };
        let Some(current) = range.right_text(file)? else {
            return Ok(SinceReview::NoText);
        };
        Ok(SinceReview::Texts {
            differences: compare(&reviewed, &current),
            reviewed,
            current,
        })
    }

    /// Under the lock: re-reads `reviewed.json`, keeps `text` as `texts/<id>`, applies `change`, writes the file.
    fn write_change(
        &self,
        text: Option<&(String, String)>,
        change: impl FnOnce(&mut ReviewedFile),
    ) -> Result<()> {
        let _held = lock(&self.folder)?;
        let mut reviewed = read_reviewed(&self.folder, &self.review)?;
        if let Some((id, text)) = text {
            keep_text(&self.folder, id, text)?;
        }
        change(&mut reviewed);
        write_reviewed(&self.folder, &reviewed)
    }

    fn marked(&self, file: RangeFileId) -> Option<&Marked> {
        let index = usize::try_from(file.0).ok()?;
        self.files.get(index)?.as_ref()
    }

    fn slot_mut(&mut self, file: RangeFileId) -> Option<&mut Option<Marked>> {
        let index = usize::try_from(file.0).ok()?;
        self.files.get_mut(index)
    }
}

fn listed_path(range: &Range, file: RangeFileId) -> Result<&str> {
    match range.entry(file) {
        Some(entry) => Ok(&entry.path),
        None => Err(Error::UnknownFile { file }),
    }
}

/// Under the lock: drops from `reviewed.json` the marks on paths `range` does not list, removes the texts no remaining
/// mark keeps, and returns the remaining marks.
fn prune_unlisted_marks(
    folder: &Path,
    review: &ReviewOf,
    range: &Range,
) -> Result<Vec<StoredMark>> {
    let _held = lock(folder)?;
    let mut reviewed = read_reviewed(folder, review)?;
    let listed: HashSet<&str> = range
        .entries()
        .iter()
        .map(|entry| entry.path.as_str())
        .collect();
    let stored = reviewed.marks.len();
    reviewed
        .marks
        .retain(|mark| listed.contains(mark.path.as_str()));
    if reviewed.marks.len() != stored {
        write_reviewed(folder, &reviewed)?;
    }
    sweep_texts(folder, &reviewed.marks)?;
    Ok(reviewed.marks)
}

/// Each listed file's mark: `Reviewed` while its right side is the one marked, else `ChangedSinceReview`.
fn classified(range: &Range, marks: Vec<StoredMark>) -> Result<Vec<Option<Marked>>> {
    let mut by_path: HashMap<String, StoredMark> = marks
        .into_iter()
        .map(|mark| (mark.path.clone(), mark))
        .collect();
    let mut files = Vec::with_capacity(range.entries().len());
    for entry in range.entries() {
        let Some(stored) = by_path.remove(&entry.path) else {
            files.push(None);
            continue;
        };
        let right = range.sides(entry.id)?.right;
        let mark = if stored.right == right.as_ref().map(StoredSide::of) {
            ReviewMark::Reviewed
        } else {
            ReviewMark::ChangedSinceReview
        };
        files.push(Some(Marked { mark, stored }));
    }
    Ok(files)
}
