#![cfg(test)]

use std::path::{Path, PathBuf};

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_range::{Error, PairLock, RangeSpec, Resolved};

const LOCK_FILE: &str = "lock";

/// A file of the scripted repository: `base` on `main`, `local` on the checked-out branch `local`, `remote` on `remote`.
fn file<'a>(
    path: &'a str,
    base: Option<&'a [u8]>,
    local: Option<&'a [u8]>,
    remote: Option<&'a [u8]>,
) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote,
    }
}

/// A file only `local` changes.
fn changed<'a>(path: &'a str, base: Option<&'a [u8]>, local: Option<&'a [u8]>) -> ConflictFile<'a> {
    file(path, base, local, base)
}

fn repo_with(files: &[ConflictFile]) -> TempDir {
    diverged_repo(files).unwrap()
}

fn rev_parse(root: &Path, revision: &str) -> String {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn short_id(root: &Path, revision: &str) -> String {
    let output = git_ok(root, &["log", "-1", "--format=%h", revision]).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn resolved(root: &Path, text: &str) -> Resolved {
    Resolved::resolve(root, &RangeSpec::parse(text).unwrap()).unwrap()
}

fn pair_folder(range_dir: &Path, root: &Path, left: &str, right: &str) -> PathBuf {
    let lock = PairLock::take(range_dir, &resolved(root, &format!("{left}..{right}"))).unwrap();
    lock.folder().to_owned()
}

#[test]
fn the_same_pair_twice_is_locked_naming_both_short_ids() {
    let dir = repo_with(&[changed("a.txt", Some(b"a\n"), Some(b"b\n"))]);
    let root = dir.path();
    let range_dir = tempfile::tempdir().unwrap();
    let first = resolved(root, "main..local");
    let held = PairLock::take(range_dir.path(), &first).unwrap();
    let main_id = rev_parse(root, "main");
    let typed_otherwise = resolved(root, &format!("{main_id}..HEAD"));

    let error = PairLock::take(range_dir.path(), &typed_otherwise).unwrap_err();

    let (left, right) = (short_id(root, "main"), short_id(root, "local"));
    let line = format!(
        "another yamt window shows {left}..{right} of {}",
        typed_otherwise.root().display()
    );
    assert_eq!(error.to_string(), line);
    assert!(matches!(&error, Error::Locked { root: shown, .. } if shown == typed_otherwise.root()));
    let pair = format!("{main_id}-{}", rev_parse(root, "local"));
    assert_eq!(held.folder().file_name().unwrap(), pair.as_str());
    let repo_folder = held.folder().parent().unwrap();
    assert_eq!(repo_folder.parent().unwrap(), range_dir.path());
    assert!(held.folder().join(LOCK_FILE).is_file());
    drop(held);
    assert!(PairLock::take(range_dir.path(), &typed_otherwise).is_ok());
}

#[test]
fn another_worktree_of_the_same_repository_shares_the_lock() {
    let dir = repo_with(&[file("a.txt", Some(b"a\n"), Some(b"b\n"), Some(b"c\n"))]);
    let root = dir.path();
    let linked_dir = tempfile::tempdir().unwrap();
    let linked = linked_dir.path().join("elsewhere");
    let linked_arg = linked.to_str().unwrap();
    git_ok(
        root,
        &[
            "worktree", "add", "--quiet", "--detach", linked_arg, "remote",
        ],
    )
    .unwrap();
    let range_dir = tempfile::tempdir().unwrap();
    let _held = PairLock::take(range_dir.path(), &resolved(root, "main..remote")).unwrap();
    let from_linked = resolved(&linked, "main..remote");

    let error = PairLock::take(range_dir.path(), &from_linked).unwrap_err();

    assert!(matches!(&error, Error::Locked { root: shown, .. } if shown == from_linked.root()));
    assert_ne!(from_linked.root(), resolved(root, "main..remote").root());
}

#[test]
fn a_different_pair_is_not_locked() {
    let dir = repo_with(&[file("a.txt", Some(b"a\n"), Some(b"b\n"), Some(b"c\n"))]);
    let root = dir.path();
    let range_dir = tempfile::tempdir().unwrap();
    let to_local = PairLock::take(range_dir.path(), &resolved(root, "main..local")).unwrap();

    let to_remote = PairLock::take(range_dir.path(), &resolved(root, "main..remote")).unwrap();
    let reversed = PairLock::take(range_dir.path(), &resolved(root, "local..main")).unwrap();

    assert_ne!(to_local.folder(), to_remote.folder());
    assert_ne!(to_local.folder(), reversed.folder());
    assert_eq!(to_local.folder().parent(), to_remote.folder().parent());
    let other_dir = repo_with(&[file("a.txt", Some(b"a\n"), Some(b"b\n"), Some(b"c\n"))]);
    let other = pair_folder(range_dir.path(), other_dir.path(), "main", "local");
    assert_ne!(other.parent(), to_local.folder().parent());
}
