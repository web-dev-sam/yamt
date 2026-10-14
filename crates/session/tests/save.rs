#![cfg(test)]

use std::fs;
use std::time::{Duration, SystemTime};

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok};
use yamt_session::{DiskResult, DiskVersion, Error, FileStatus, MergeSession, Middle, WriteReply};

const TEXT: &str = "src/cart.ts";
const BASE: &[u8] = b"one\ntwo\nthree\n";
const LOCAL: &[u8] = b"one\nlocal\nthree\n";
const REMOTE: &[u8] = b"one\nremote\nthree\n";
const SAVED: &str = "one\n<<<<<<< ours\nlocal\n=======\nremote, kept\n>>>>>>> theirs\nthree\n";
const FOREIGN: &[u8] = b"written by another tool\n";
const LONG_AGO: Duration = Duration::from_secs(1_000_000);

fn conflict() -> TempDir {
    conflict_repo(&[ConflictFile {
        path: TEXT,
        kind: FileKind::Regular,
        base: Some(BASE),
        local: Some(LOCAL),
        remote: Some(REMOTE),
    }])
    .unwrap()
}

fn opened(dir: &TempDir) -> MergeSession {
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert_eq!(session.refresh().unwrap().disk_changes, []);
    session
}

fn read(dir: &TempDir) -> Vec<u8> {
    fs::read(dir.path().join(TEXT)).unwrap()
}

fn write(dir: &TempDir, bytes: &[u8]) {
    fs::write(dir.path().join(TEXT), bytes).unwrap();
}

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

fn index(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-s", "--", TEXT]).unwrap()).unwrap()
}

fn status(session: &MergeSession) -> FileStatus {
    session.files()[0].status
}

fn assert_written(reply: &WriteReply) {
    assert!(matches!(reply, WriteReply::Written { .. }), "{reply:?}");
}

fn assert_changed_on_disk(reply: &WriteReply) {
    assert!(
        matches!(reply, WriteReply::ChangedOnDisk { .. }),
        "{reply:?}"
    );
}

#[test]
fn a_save_writes_without_staging_and_never_comes_back_as_a_disk_change() {
    let dir = conflict();
    let mut session = opened(&dir);
    let before = unmerged(&dir);

    let reply = session.save(TEXT, SAVED, DiskVersion(0)).unwrap();

    assert_written(&reply);
    assert_eq!(read(&dir), SAVED.as_bytes());
    assert_eq!(session.refresh().unwrap().disk_changes, []);
    assert_eq!(unmerged(&dir), before);
    assert_eq!(status(&session), FileStatus::Unresolved);
    assert_eq!(session.load(TEXT).unwrap().disk_version, DiskVersion(0));
}

#[test]
fn a_foreign_write_before_a_save_stops_it_and_a_stale_version_writes_nothing() {
    let dir = conflict();
    let mut session = opened(&dir);
    write(&dir, FOREIGN);

    let first = session.save(TEXT, SAVED, DiskVersion(0)).unwrap();
    let stale = session.save(TEXT, SAVED, DiskVersion(0)).unwrap();

    assert_changed_on_disk(&first);
    assert_changed_on_disk(&stale);
    assert_eq!(read(&dir), FOREIGN);
    let current = session.save(TEXT, SAVED, DiskVersion(1)).unwrap();
    assert_written(&current);
    assert_eq!(read(&dir), SAVED.as_bytes());
}

#[test]
fn a_save_of_the_bytes_already_on_disk_leaves_the_file_untouched() {
    let dir = conflict();
    let mut session = opened(&dir);
    let file = fs::File::options()
        .write(true)
        .open(dir.path().join(TEXT))
        .unwrap();
    let long_ago = SystemTime::UNIX_EPOCH + LONG_AGO;
    file.set_modified(long_ago).unwrap();
    let on_disk = String::from_utf8(read(&dir)).unwrap();

    let reply = session.save(TEXT, &on_disk, DiskVersion(0)).unwrap();

    assert_written(&reply);
    let modified = fs::metadata(dir.path().join(TEXT)).unwrap().modified();
    assert_eq!(modified.unwrap(), long_ago);
}

#[test]
fn save_and_reset_refuse_a_directory_without_touching_the_index() {
    let dir = conflict();
    let mut session = opened(&dir);
    let worktree_file = dir.path().join(TEXT);
    fs::remove_file(&worktree_file).unwrap();
    fs::create_dir(&worktree_file).unwrap();
    session.refresh().unwrap();
    let index_before = index(&dir);

    let saved = session.save(TEXT, SAVED, DiskVersion(1));
    let reset = session.reset(TEXT, DiskVersion(1));

    for refused in [saved, reset] {
        assert!(
            matches!(refused, Err(Error::NotAFile { .. })),
            "{refused:?}"
        );
    }
    assert_eq!(index(&dir), index_before);
    assert!(worktree_file.is_dir());
}

#[cfg(unix)]
#[test]
fn a_save_refuses_a_link_and_reset_replaces_it_with_the_file_at_open() {
    let dir = conflict();
    let mut session = opened(&dir);
    let at_open = read(&dir);
    let outside = TempDir::new().unwrap();
    let target = outside.path().join("target.txt");
    fs::write(&target, FOREIGN).unwrap();
    let worktree_file = dir.path().join(TEXT);
    fs::remove_file(&worktree_file).unwrap();
    std::os::unix::fs::symlink(&target, &worktree_file).unwrap();
    session.refresh().unwrap();

    let saved = session.save(TEXT, SAVED, DiskVersion(1));
    session.reset(TEXT, DiskVersion(1)).unwrap();

    assert!(matches!(saved, Err(Error::NotAFile { .. })), "{saved:?}");
    assert_eq!(fs::read(&target).unwrap(), FOREIGN);
    assert!(!worktree_file.symlink_metadata().unwrap().is_symlink());
    assert_eq!(read(&dir), at_open);
}

#[test]
fn reset_after_a_save_brings_back_the_bytes_and_the_stages_of_this_run_s_start() {
    let dir = conflict();
    let mut session = opened(&dir);
    let at_open = read(&dir);
    let before = unmerged(&dir);
    session.save(TEXT, SAVED, DiskVersion(0)).unwrap();
    session.finish(TEXT, "merged\n", DiskVersion(0)).unwrap();

    let reply = session.reset(TEXT, DiskVersion(0)).unwrap();

    assert_written(&reply);
    assert_eq!(read(&dir), at_open);
    let middle = session.load(TEXT).unwrap().middle;
    assert!(matches!(middle, Middle::Stages { .. }), "{middle:?}");
    assert_eq!(unmerged(&dir), before);
    assert_eq!(status(&session), FileStatus::Unresolved);
    assert_eq!(session.refresh().unwrap().disk_changes, []);
}

#[test]
fn reset_in_a_later_run_brings_back_what_that_run_found_saved() {
    let dir = conflict();
    let mut first_run = opened(&dir);
    first_run.save(TEXT, SAVED, DiskVersion(0)).unwrap();
    drop(first_run);
    let mut second_run = MergeSession::open(dir.path()).unwrap();
    let settled = second_run.refresh().unwrap().disk_changes;
    assert_eq!(settled[0].result, DiskResult::MarkersLeft { conflicts: 1 });
    let second_save = SAVED.replace("remote, kept", "remote, changed again");
    second_run.save(TEXT, &second_save, DiskVersion(1)).unwrap();

    second_run.reset(TEXT, DiskVersion(1)).unwrap();

    assert_eq!(read(&dir), SAVED.as_bytes());
    assert_eq!(second_run.refresh().unwrap().disk_changes, []);
}

#[test]
fn reset_of_a_file_changed_by_hand_before_start_brings_back_the_hand_edit() {
    let dir = conflict();
    let before = unmerged(&dir);
    write(&dir, FOREIGN);
    let mut session = MergeSession::open(dir.path()).unwrap();
    let settled = session.refresh().unwrap().disk_changes;
    assert_eq!(settled[0].result, DiskResult::Staged);

    session.reset(TEXT, DiskVersion(1)).unwrap();

    assert_eq!(read(&dir), FOREIGN);
    let foreign = String::from_utf8(FOREIGN.to_vec()).unwrap();
    assert_eq!(
        session.load(TEXT).unwrap().middle,
        Middle::Disk { text: foreign }
    );
    assert_eq!(unmerged(&dir), before);
    assert_eq!(status(&session), FileStatus::Unresolved);
    assert_eq!(session.refresh().unwrap().disk_changes, []);
    assert_eq!(status(&session), FileStatus::Unresolved);
}

#[test]
fn reset_with_a_held_index_lock_leaves_the_file_and_the_index_as_they_were() {
    let dir = conflict();
    let mut session = opened(&dir);
    session.save(TEXT, SAVED, DiskVersion(0)).unwrap();
    session.finish(TEXT, "merged\n", DiskVersion(0)).unwrap();
    let index_before = index(&dir);
    fs::write(dir.path().join(".git/index.lock"), "").unwrap();

    let reset = session.reset(TEXT, DiskVersion(0));

    assert!(matches!(reset, Err(Error::Git(_))), "{reset:?}");
    assert_eq!(read(&dir), b"merged\n");
    assert_eq!(index(&dir), index_before);
    assert_eq!(status(&session), FileStatus::Resolved);
}

// Unix only: a read-only file makes the write fail; root ignores the mode, as the other
// failed-write tests assume a normal user.
#[cfg(unix)]
#[test]
fn reset_whose_file_write_fails_puts_the_index_back() {
    use std::os::unix::fs::PermissionsExt;
    const READ_ONLY: u32 = 0o444;
    let dir = conflict();
    let mut session = opened(&dir);
    session.finish(TEXT, "merged\n", DiskVersion(0)).unwrap();
    let index_before = index(&dir);
    let worktree_file = dir.path().join(TEXT);
    fs::set_permissions(&worktree_file, fs::Permissions::from_mode(READ_ONLY)).unwrap();

    let reset = session.reset(TEXT, DiskVersion(0));

    assert!(matches!(reset, Err(Error::WriteFailed { .. })), "{reset:?}");
    assert_eq!(read(&dir), b"merged\n");
    assert_eq!(index(&dir), index_before);
    assert_eq!(status(&session), FileStatus::Resolved);
}
