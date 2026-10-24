use std::ffi::OsString;
use std::fs::{self, File, OpenOptions, TryLockError};
use std::io;
use std::path::{Path, PathBuf};

use crate::{Error, Resolved, Result};

const LOCK_FILE: &str = "lock";
const GIT_DIR_NAME: &str = ".git";
const FNV_OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0100_0000_01b3;

/// The range window's claim on one repository and commit pair, held for the process's life.
#[derive(Debug)]
pub struct PairLock {
    _lock: File,
    folder: PathBuf,
}

impl PairLock {
    /// Takes `<range_dir>/<repo key>/<left id>-<right id>/lock`; another process holding it is `Locked`.
    pub fn take(range_dir: &Path, resolved: &Resolved) -> Result<PairLock> {
        let common_dir = resolved.repo.common_dir()?;
        let pair = format!(
            "{}-{}",
            resolved.left.oid.as_str(),
            resolved.right.oid.as_str()
        );
        let folder = range_dir.join(repo_key(&common_dir)).join(pair);
        fs::create_dir_all(&folder).map_err(|error| lock_failed(&folder, &error))?;
        let path = folder.join(LOCK_FILE);
        match hold(&path).map_err(|error| lock_failed(&path, &error))? {
            Some(file) => Ok(PairLock {
                _lock: file,
                folder,
            }),
            None => Err(Error::Locked {
                root: resolved.root().to_owned(),
                left: resolved.left.side.short_id.clone(),
                right: resolved.right.side.short_id.clone(),
            }),
        }
    }

    /// Takes an existing pair folder's lock; `None` while another `PairLock` holds it (an open window).
    pub fn try_hold(folder: &Path) -> io::Result<Option<PairLock>> {
        let held = hold(&folder.join(LOCK_FILE))?;
        Ok(held.map(|file| PairLock {
            _lock: file,
            folder: folder.to_owned(),
        }))
    }

    #[must_use]
    pub fn folder(&self) -> &Path {
        &self.folder
    }
}

/// Every `<range_dir>/<repo key>/<left id>-<right id>/` folder; a folder that cannot be listed adds none.
#[must_use]
pub fn pair_folders(range_dir: &Path) -> Vec<PathBuf> {
    let mut pairs = Vec::new();
    for repo in folders_in(range_dir) {
        pairs.extend(folders_in(&repo));
    }
    pairs
}

fn folders_in(folder: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.is_dir())
        .collect()
}

/// The lock file opened (created when missing) and locked; `None` when another open file holds the lock.
fn hold(path: &Path) -> io::Result<Option<File>> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(path)?;
    // The lock is the file's own: the OS releases it when the process ends, also on `kill -9`
    // (`File::try_lock`, flock(2) / `LockFileEx`).
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(error)) => Err(error),
    }
}

/// The repository's folder name, `-`, and the FNV-1a hash of its common git dir: the same from every worktree.
fn repo_key(common_dir: &Path) -> OsString {
    let in_work_tree = common_dir
        .file_name()
        .is_some_and(|name| name == GIT_DIR_NAME);
    let named = if in_work_tree {
        common_dir.parent().unwrap_or(common_dir)
    } else {
        common_dir
    };
    let mut key = named.file_name().unwrap_or_default().to_os_string();
    let hash = fnv1a_64(common_dir.as_os_str().as_encoded_bytes());
    key.push(format!("-{hash:016x}"));
    key
}

/// FNV-1a, 64 bits (<http://www.isthe.com/chongo/tech/comp/fnv/>): stable across Rust releases, unlike `DefaultHasher`.
fn fnv1a_64(bytes: &[u8]) -> u64 {
    let mut hash = FNV_OFFSET_BASIS;
    for &byte in bytes {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

fn lock_failed(path: &Path, error: &io::Error) -> Error {
    Error::LockFailed {
        path: path.to_owned(),
        message: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fnv1a_64_gives_the_published_vectors() {
        assert_eq!(format!("{:016x}", fnv1a_64(b"a")), "af63dc4c8601ec8c");
        assert_eq!(format!("{:016x}", fnv1a_64(b"")), "cbf29ce484222325");
        assert_eq!(format!("{:016x}", fnv1a_64(b"foobar")), "85944171f73967e8");
    }

    #[test]
    fn the_key_names_the_work_tree_folder_or_a_bare_repository_and_hashes_the_common_dir() {
        let key = |dir: &str| repo_key(Path::new(dir)).into_string().unwrap();
        let hash = |dir: &str| format!("{:016x}", fnv1a_64(dir.as_bytes()));
        assert_eq!(
            key("/x/proj/.git"),
            format!("proj-{}", hash("/x/proj/.git"))
        );
        assert_eq!(
            key("/x/proj.git"),
            format!("proj.git-{}", hash("/x/proj.git"))
        );
        assert_ne!(key("/x/proj/.git"), key("/y/proj/.git"));
    }

    #[test]
    fn try_hold_answers_none_while_another_lock_holds_the_pair_and_takes_it_once_released() {
        let folder = tempfile::tempdir().unwrap();
        let first = PairLock::try_hold(folder.path()).unwrap().unwrap();
        assert_eq!(first.folder(), folder.path());

        assert!(PairLock::try_hold(folder.path()).unwrap().is_none());

        drop(first);
        assert!(PairLock::try_hold(folder.path()).unwrap().is_some());
    }

    #[test]
    fn pair_folders_lists_every_pair_folder_under_every_repository_and_no_file() {
        let range_dir = tempfile::tempdir().unwrap();
        let one = range_dir.path().join("proj-1");
        let two = range_dir.path().join("other-2");
        for pair in [one.join("a-b"), one.join("c-d"), two.join("e-f")] {
            fs::create_dir_all(pair).unwrap();
        }
        fs::write(one.join(LOCK_FILE), b"").unwrap();
        fs::write(range_dir.path().join("stray"), b"").unwrap();

        let mut pairs = pair_folders(range_dir.path());
        pairs.sort();

        assert_eq!(pairs, [two.join("e-f"), one.join("a-b"), one.join("c-d")]);
        assert_eq!(
            pair_folders(&range_dir.path().join("missing")),
            Vec::<PathBuf>::new()
        );
    }
}
