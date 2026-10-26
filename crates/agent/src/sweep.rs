use std::path::Path;

use yamt_range::{PairLock, pair_folders, pair_right_commit};

use crate::checkout;

/// What crashes and kills left in `range_dir`'s pair folders other than `own`. A folder holding no checkout
/// and no leftover is skipped without its lock. In every other pair whose lock it takes, the partial and
/// removing folders go and a clean checkout is renamed to `checkout.removing`, which is deleted after the lock
/// is released, so a window starting on that pair waits for no deletion; a changed or unreadable checkout is kept.
pub(crate) fn sweep_other_pairs(range_dir: &Path, own: &Path) {
    for folder in pair_folders(range_dir) {
        if folder == own || !checkout::has_any(&folder) {
            continue;
        }
        let set_aside = match PairLock::try_hold(&folder) {
            Ok(Some(_held)) => set_aside_under_lock(&folder),
            Ok(None) => false,
            Err(error) => {
                tracing::warn!(%error, folder = %folder.display(), "a pair's lock cannot be taken");
                false
            }
        };
        if set_aside {
            logged(checkout::remove_set_aside(&folder));
        }
    }
}

/// The leftovers deleted and a clean checkout renamed to `checkout.removing`; true once renamed.
fn set_aside_under_lock(folder: &Path) -> bool {
    logged(checkout::remove_leftovers(folder));
    let Some(new_commit) = pair_right_commit(folder) else {
        return false;
    };
    match checkout::set_aside_when_clean(folder, new_commit.as_str().to_owned()) {
        Ok(set_aside) => set_aside,
        Err(error) => {
            tracing::warn!(%error, "the AI's clean checkout stays");
            false
        }
    }
}

pub(crate) fn logged(removed: Result<(), crate::Error>) {
    if let Err(error) = removed {
        tracing::warn!(%error, "a leftover of the AI's checkout stays");
    }
}
