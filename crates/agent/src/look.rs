use std::fs;
use std::path::{Path, PathBuf};

use yamt_gitio::Repo;

use crate::CheckoutLook;
use crate::checkout::checkout_folder;

/// The checkout's folder and the commit it was made at, taken under the shell's lock; `look` runs git outside it.
#[derive(Clone, Debug)]
pub struct LookJob {
    folder: PathBuf,
    new_commit: String,
}

impl LookJob {
    pub(crate) fn in_pair(pair_folder: &Path, new_commit: String) -> LookJob {
        LookJob {
            folder: checkout_folder(pair_folder),
            new_commit,
        }
    }

    /// "Changed" is any file `git status` lists (an ignored one is not), any branch or stash (plan §2 #122),
    /// or `HEAD` away from the commit.
    #[must_use]
    pub fn look(self) -> CheckoutLook {
        if !self.folder.exists() {
            return CheckoutLook::Missing;
        }
        let folder = self.folder.to_string_lossy().into_owned();
        match changes(&self.folder, &self.new_commit) {
            Ok(Changes {
                files,
                refs,
                head_moved,
            }) if files.is_empty() && refs.is_empty() && !head_moved => CheckoutLook::Clean,
            Ok(Changes {
                files,
                refs,
                head_moved,
            }) => CheckoutLook::Changed {
                folder,
                files,
                refs,
                head_moved,
            },
            Err(message) => CheckoutLook::Unreadable { folder, message },
        }
    }
}

struct Changes {
    files: Vec<String>,
    refs: Vec<String>,
    head_moved: bool,
}

fn changes(folder: &Path, new_commit: &str) -> Result<Changes, String> {
    let repo = own_repo(folder)?;
    let entries = repo.status_entries().map_err(|error| error.to_string())?;
    let refs = repo
        .branches_and_stash()
        .map_err(|error| error.to_string())?;
    let head = repo.head_commit().map_err(|error| error.to_string())?;
    Ok(Changes {
        files: entries
            .iter()
            .map(|entry| entry.path.to_string_lossy().into_owned())
            .collect(),
        refs,
        head_moved: head.as_str() != new_commit,
    })
}

/// The repository whose work tree is `folder` itself: git looks in parent folders when the checkout's
/// own `.git` is broken, and a repository found there is not the checkout.
fn own_repo(folder: &Path) -> Result<Repo, String> {
    let repo = Repo::discover_from_folder(folder).map_err(|error| error.to_string())?;
    let own = fs::canonicalize(folder).map_err(|error| error.to_string())?;
    let found = fs::canonicalize(repo.root()).map_err(|error| error.to_string())?;
    if found == own {
        Ok(repo)
    } else {
        Err(format!(
            "git finds the repository {} instead",
            found.display()
        ))
    }
}
