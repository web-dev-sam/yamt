use std::path::Path;

use yamt_range::{PairLock, pair_folders};

use crate::checkout;

/// What crashes and kills left in `range_dir`'s pair folders: in every pair whose lock it takes, the partial and
/// removing folders and a clean checkout are deleted; a changed or unreadable one is kept. In `own`, the
/// window's own pair folder, only the partial and removing folders go: its checkout is reused.
pub fn sweep_leftovers(range_dir: &Path, own: &Path) {
    for folder in pair_folders(range_dir) {
        if folder == own {
            remove_leftovers(&folder);
            continue;
        }
        match PairLock::try_hold(&folder) {
            Ok(Some(_held)) => {
                remove_leftovers(&folder);
                if let Some(new_commit) = right_commit(&folder) {
                    checkout::remove_when_clean(&folder, new_commit);
                }
            }
            Ok(None) => {}
            Err(error) => {
                tracing::warn!(%error, folder = %folder.display(), "a pair's lock cannot be taken");
            }
        }
    }
}

fn remove_leftovers(folder: &Path) {
    if let Err(error) = checkout::remove_leftovers(folder) {
        tracing::warn!(%error, "a leftover of the AI's checkout stays");
    }
}

/// The right commit from the pair folder's name `<left id>-<right id>` (`yamt_range::PairLock::take`).
fn right_commit(folder: &Path) -> Option<String> {
    let name = folder.file_name()?.to_str()?;
    let (_left, right) = name.split_once('-')?;
    Some(right.to_owned())
}
