#![cfg(test)]

use std::fs;
use std::path::PathBuf;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok};
use yamt_session::{DiskResult, DiskVersion, Error, FileStatus, MergeSession, Side, WriteReply};

mod listing;
use listing::listed;

const TEXT: &str = "src/cart.ts";
const BINARY: &str = "assets/logo.bin";
const DELETED: &str = "assets/removed.txt";
#[cfg(unix)]
const READ_ONLY_DIR: u32 = 0o555;
#[cfg(unix)]
const WRITABLE_DIR: u32 = 0o755;

fn mixed_conflict() -> TempDir {
    conflict_repo(&[
        ConflictFile {
            path: TEXT,
            kind: FileKind::Regular,
            base: Some(b"one\ntwo\n"),
            local: Some(b"one\nlocal\n"),
            remote: Some(b"one\nremote\n"),
        },
        ConflictFile {
            path: BINARY,
            kind: FileKind::Regular,
            base: Some(b"\0base"),
            local: Some(b"\0local"),
            remote: Some(b"\0remote"),
        },
        ConflictFile {
            path: DELETED,
            kind: FileKind::Regular,
            base: Some(b"kept\nbase\n"),
            local: None,
            remote: Some(b"kept\nremote\n"),
        },
    ])
    .unwrap()
}

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

fn status_of(session: &MergeSession, path: &str) -> FileStatus {
    let files = session.files();
    files.iter().find(|file| file.path == path).unwrap().status
}

fn worktree(dir: &TempDir, path: &str) -> Option<Vec<u8>> {
    fs::read(dir.path().join(path)).ok()
}

fn index_lock(dir: &TempDir) -> PathBuf {
    let lock = dir.path().join(".git/index.lock");
    fs::write(&lock, "").unwrap();
    lock
}

fn assert_nothing_changed(
    dir: &TempDir,
    session: &MergeSession,
    path: &str,
    before: &(String, Option<Vec<u8>>),
) {
    assert_eq!(unmerged(dir), before.0);
    assert_eq!(worktree(dir, path), before.1, "worktree of {path}");
    assert_eq!(status_of(session, path), FileStatus::Unresolved);
}

fn assert_git_error(result: Result<WriteReply, Error>) {
    let error = result.unwrap_err();
    assert!(matches!(error, Error::Git(_)), "{error:?}");
}

#[test]
fn finish_with_a_held_index_lock_puts_the_worktree_file_back_and_stays_unresolved() {
    let dir = mixed_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before = (unmerged(&dir), worktree(&dir, TEXT));
    let lock = index_lock(&dir);

    assert_git_error(session.finish(TEXT, "one\nmerged\n", DiskVersion(0)));

    assert_nothing_changed(&dir, &session, TEXT, &before);
    fs::remove_file(lock).unwrap();
    session
        .finish(TEXT, "one\nmerged\n", DiskVersion(0))
        .unwrap();
    assert_eq!(status_of(&session, TEXT), FileStatus::Resolved);
}

#[test]
fn finish_with_a_held_index_lock_leaves_a_deleted_worktree_file_absent() {
    let dir = mixed_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    fs::remove_file(dir.path().join(TEXT)).unwrap();
    let deleted = listed(&mut session).disk_changes.remove(0).result;
    assert_eq!(deleted, DiskResult::Staged);
    let staged_before = staged(&dir, TEXT);
    let _lock = index_lock(&dir);

    assert_git_error(session.finish(TEXT, "one\nmerged\n", DiskVersion(1)));

    assert_eq!(worktree(&dir, TEXT), None);
    assert_eq!(staged(&dir, TEXT), staged_before);
    assert_eq!(status_of(&session, TEXT), FileStatus::Resolved);
}

#[test]
fn take_with_a_held_index_lock_changes_nothing() {
    let dir = mixed_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let _lock = index_lock(&dir);

    for (path, side) in [(BINARY, Side::Remote), (DELETED, Side::Local)] {
        let before = (unmerged(&dir), worktree(&dir, path));
        assert_git_error(session.take(path, side, DiskVersion(0)));
        assert_nothing_changed(&dir, &session, path, &before);
    }
}

// Unix only: Windows does not honour the read-only attribute on a folder ("File Attribute
// Constants", `FILE_ATTRIBUTE_READONLY`), so nothing there makes a worktree write fail this way.
#[cfg(unix)]
fn set_assets_mode(dir: &TempDir, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    let assets = dir.path().join("assets");
    fs::set_permissions(assets, fs::Permissions::from_mode(mode)).unwrap();
}

#[cfg(unix)]
#[test]
fn take_whose_worktree_write_fails_puts_the_conflict_back() {
    let dir = mixed_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let binary_before = (unmerged(&dir), worktree(&dir, BINARY));
    let deleted_before = (unmerged(&dir), worktree(&dir, DELETED));
    set_assets_mode(&dir, READ_ONLY_DIR);

    let binary = session.take(BINARY, Side::Remote, DiskVersion(0));
    let deleted = session.take(DELETED, Side::Local, DiskVersion(0));

    set_assets_mode(&dir, WRITABLE_DIR);
    assert_git_error(binary);
    assert!(
        matches!(deleted, Err(Error::WriteFailed { .. })),
        "{deleted:?}"
    );
    assert_nothing_changed(&dir, &session, BINARY, &binary_before);
    assert_nothing_changed(&dir, &session, DELETED, &deleted_before);
}

fn staged(dir: &TempDir, path: &str) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-s", "--", path]).unwrap()).unwrap()
}

#[cfg(unix)]
#[test]
fn take_of_a_resolved_file_whose_worktree_write_fails_keeps_the_earlier_resolution() {
    let dir = mixed_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    session.take(BINARY, Side::Local, DiskVersion(0)).unwrap();
    session.take(DELETED, Side::Local, DiskVersion(0)).unwrap();
    let before = |path| (staged(&dir, path), worktree(&dir, path));
    let (binary_before, deleted_before) = (before(BINARY), before(DELETED));
    assert_eq!(deleted_before, (String::new(), None));
    set_assets_mode(&dir, READ_ONLY_DIR);

    let binary = session.take(BINARY, Side::Remote, DiskVersion(0));
    let deleted = session.take(DELETED, Side::Remote, DiskVersion(0));

    set_assets_mode(&dir, WRITABLE_DIR);
    assert_git_error(binary);
    assert_git_error(deleted);
    for (path, before) in [(BINARY, binary_before), (DELETED, deleted_before)] {
        assert_eq!((staged(&dir, path), worktree(&dir, path)), before, "{path}");
        assert_eq!(status_of(&session, path), FileStatus::Resolved, "{path}");
    }
}
