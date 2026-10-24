use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use yamt_gitio::{Oid, Repo};

use crate::look::LookJob;
use crate::{CheckoutLook, Error};

/// A `checkout` folder is always complete: it is made as `checkout.partial` and removed as
/// `checkout.removing`, so a crash leaves only folders that are safe to delete (plan §2 #110).
pub(crate) const CHECKOUT: &str = "checkout";
const PARTIAL: &str = "checkout.partial";
const REMOVING: &str = "checkout.removing";
const ORIGIN: &str = "origin";

/// `<pair folder>/checkout`, reused when it exists, otherwise made from `repo` at `commit`.
pub(crate) fn made_or_reused(
    pair_folder: &Path,
    repo: &Path,
    commit: &str,
) -> Result<PathBuf, Error> {
    let checkout = pair_folder.join(CHECKOUT);
    if checkout.is_dir() {
        return Ok(checkout);
    }
    remove_leftovers(pair_folder)?;
    let partial = pair_folder.join(PARTIAL);
    if let Err(error) = make(&partial, repo, commit) {
        if let Err(leftover) = remove_if_present(&partial) {
            tracing::warn!(%leftover, "a failed checkout's partial folder stays");
        }
        return Err(error);
    }
    fs::rename(&partial, &checkout).map_err(|source| Error::Rename {
        from: partial,
        to: checkout.clone(),
        source,
    })?;
    Ok(checkout)
}

fn make(partial: &Path, repo: &Path, commit: &str) -> Result<(), Error> {
    let commit = Oid::parse(commit)?;
    let clone = Repo::discover(repo)?.clone_shared_into(partial)?;
    clone.remove_remote(ORIGIN)?;
    clone.checkout_detached(&commit)?;
    Ok(())
}

/// Removes `<pair folder>/checkout` through `checkout.removing`; a missing one is already removed.
pub(crate) fn remove(pair_folder: &Path) -> Result<(), Error> {
    let removing = pair_folder.join(REMOVING);
    remove_if_present(&removing)?;
    let checkout = pair_folder.join(CHECKOUT);
    match fs::rename(&checkout, &removing) {
        Ok(()) => remove_if_present(&removing),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(Error::Remove {
            folder: checkout,
            source,
        }),
    }
}

/// Removes `<pair folder>/checkout` only when a look now finds it clean; a failed removal is logged.
pub(crate) fn remove_when_clean(pair_folder: &Path, new_commit: String) {
    match LookJob::in_pair(pair_folder, new_commit).look() {
        CheckoutLook::Clean => {
            if let Err(error) = remove(pair_folder) {
                tracing::warn!(%error, "the AI's clean checkout stays");
            }
        }
        CheckoutLook::Missing | CheckoutLook::Changed { .. } | CheckoutLook::Unreadable { .. } => {}
    }
}

/// Deletes the `checkout.partial` and `checkout.removing` folders a crash or kill left.
pub(crate) fn remove_leftovers(pair_folder: &Path) -> Result<(), Error> {
    remove_if_present(&pair_folder.join(PARTIAL))?;
    remove_if_present(&pair_folder.join(REMOVING))
}

fn remove_if_present(folder: &Path) -> Result<(), Error> {
    match fs::remove_dir_all(folder) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(Error::Remove {
            folder: folder.to_owned(),
            source,
        }),
    }
}
