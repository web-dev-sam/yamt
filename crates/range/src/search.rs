use yamt_gitio::Repo;
use yamt_merge_core::line_changes;

use crate::entries::FileAt;
use crate::load::{Decoded, decide, decoded, read_sides};
use crate::{RangeFileId, Result, SearchText, SearchTexts};

/// Blob bytes a page reads before it ends; a page reads at least one file.
const SEARCH_PAGE_BYTES: usize = 4 * 1024 * 1024;

/// The texts of `files`, whose first id is `first`, that `load_file` answers as `Texts`, until about
/// `SEARCH_PAGE_BYTES` were read.
pub(crate) fn search_page(
    repo: &Repo,
    first: RangeFileId,
    files: &[FileAt],
) -> Result<SearchTexts> {
    let mut reader = repo.blob_reader()?;
    let mut page = Vec::new();
    let mut bytes_read = 0;
    for (id, file) in (first.0..).zip(files) {
        if bytes_read >= SEARCH_PAGE_BYTES {
            return Ok(SearchTexts {
                files: page,
                next: Some(RangeFileId(id)),
            });
        }
        if decide(file).is_some() {
            continue;
        }
        let (left, right) = read_sides(&mut reader, file)?;
        bytes_read += left.len() + right.len();
        if let Decoded::Texts { left, right } = decoded(left, right) {
            page.push(SearchText {
                file: RangeFileId(id),
                changes: line_changes(&left, &right),
                left,
                right,
            });
        }
    }
    Ok(SearchTexts {
        files: page,
        next: None,
    })
}
