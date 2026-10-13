#![cfg(test)]

use std::fs;
#[cfg(unix)]
use std::path::Path;

use yamt_conflict_repo::{FileKind, TempDir, conflict_repo, git, git_ok};
use yamt_session::{DiskVersion, FileStatus, MergeSession, Side, WriteReply};

mod every_kind;
use every_kind::{
    BINARY, LATIN1, LOCAL_COMMIT, LOCAL_DELETED, REMOTE_COMMIT, REMOTE_DELETED, SUBMODULE, TEXT,
    conflict, every_kind_of_conflict,
};
#[cfg(unix)]
use every_kind::{FILE_OR_LINK, FILE_OR_LINK_RENAMED, SYMLINK, file_against_link};

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

fn staged(dir: &TempDir, path: &str) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-s", "--", path]).unwrap()).unwrap()
}

fn status_of(session: &MergeSession, path: &str) -> FileStatus {
    let files = session.files();
    files.iter().find(|file| file.path == path).unwrap().status
}

fn stage_zero_of(unmerged: &str, path: &str, side: Side) -> String {
    let stage = match side {
        Side::Local => " 2\t",
        Side::Remote => " 3\t",
    };
    let record_end = format!("{stage}{path}");
    let line = unmerged.lines().find(|line| line.ends_with(&record_end));
    line.map(|line| format!("{}\n", line.replace(stage, " 0\t")))
        .unwrap_or_default()
}

/// The merge as the window opens it: its first list settles what changed on disk before start.
fn opened(dir: &TempDir) -> (MergeSession, String) {
    let before = unmerged(dir);
    let mut session = MergeSession::open(dir.path()).unwrap();
    session.refresh().unwrap();
    (session, before)
}

fn unmerged_path_count(dir: &TempDir) -> usize {
    let args = ["diff", "--name-only", "--diff-filter=U"];
    String::from_utf8(git_ok(dir.path(), &args).unwrap())
        .unwrap()
        .lines()
        .count()
}

fn assert_take_resolves_to_that_side(
    dir: &TempDir,
    session: &mut MergeSession,
    before: &str,
    path: &str,
    side: Side,
) {
    let version = session.describe(path).unwrap().disk_version;

    let reply = session.take(path, side, version).unwrap();

    assert!(matches!(reply, WriteReply::Written { .. }), "{reply:?}");
    assert_eq!(staged(dir, path), stage_zero_of(before, path, side));
    assert_eq!(status_of(session, path), FileStatus::Resolved);
    assert_eq!(session.remaining(), unmerged_path_count(dir));
}

fn taken(path: &str, side: Side) -> TempDir {
    let dir = every_kind_of_conflict();
    taken_in(&dir, path, side);
    dir
}

fn taken_in(dir: &TempDir, path: &str, side: Side) {
    let (mut session, before) = opened(dir);
    assert_take_resolves_to_that_side(dir, &mut session, &before, path, side);
}

#[test]
fn take_of_a_binary_file_stages_and_writes_the_chosen_side_with_fresh_stat_data() {
    for (side, bytes) in [
        (Side::Local, b"\0local".as_slice()),
        (Side::Remote, b"\0remote!"),
    ] {
        let dir = taken(BINARY, side);
        assert_eq!(fs::read(dir.path().join(BINARY)).unwrap(), bytes);
        let diff_files = git(dir.path(), &["diff-files", "--quiet", "--", BINARY]).unwrap();
        assert!(diff_files.status.success(), "{diff_files:?}");
    }
}

#[cfg(unix)]
#[test]
fn take_of_a_symlink_makes_the_worktree_a_link_to_the_chosen_target() {
    for (side, target) in [
        (Side::Local, "local-target"),
        (Side::Remote, "remote-target"),
    ] {
        let dir = taken(SYMLINK, side);
        assert_eq!(
            fs::read_link(dir.path().join(SYMLINK)).unwrap(),
            Path::new(target)
        );
    }
}

#[cfg(unix)]
#[test]
fn take_of_a_file_against_a_link_writes_the_link_and_the_file() {
    let dir = file_against_link();
    fs::remove_file(dir.path().join(FILE_OR_LINK)).unwrap();
    fs::remove_file(dir.path().join(FILE_OR_LINK_RENAMED)).unwrap();
    let (mut session, before) = opened(&dir);
    assert_take_resolves_to_that_side(&dir, &mut session, &before, FILE_OR_LINK, Side::Remote);
    let renamed = FILE_OR_LINK_RENAMED;
    assert_take_resolves_to_that_side(&dir, &mut session, &before, renamed, Side::Local);
    assert_eq!(
        fs::read_link(dir.path().join(FILE_OR_LINK)).unwrap(),
        Path::new("docs/README.md")
    );
    assert_eq!(
        fs::read(dir.path().join(FILE_OR_LINK_RENAMED)).unwrap(),
        b"local\nfile\n"
    );
}

#[test]
fn take_of_the_deleting_side_removes_index_entry_and_worktree_file() {
    for (path, side) in [(LOCAL_DELETED, Side::Local), (REMOTE_DELETED, Side::Remote)] {
        let dir = taken(path, side);
        assert_eq!(staged(&dir, path), "");
        assert!(dir.path().join(path).symlink_metadata().is_err());
    }
}

#[test]
fn take_of_the_deleting_side_accepts_a_worktree_file_already_gone() {
    let dir = every_kind_of_conflict();
    fs::remove_file(dir.path().join(LOCAL_DELETED)).unwrap();
    taken_in(&dir, LOCAL_DELETED, Side::Local);
    assert_eq!(staged(&dir, LOCAL_DELETED), "");
}

#[test]
fn take_of_the_deleting_side_of_a_submodule_unstages_it_and_leaves_its_directory() {
    const DELETED_SUBMODULE: &str = "vendor/lib";
    let dir = conflict_repo(&[conflict(
        DELETED_SUBMODULE,
        FileKind::Submodule,
        [
            Some(LOCAL_COMMIT.as_bytes()),
            Some(REMOTE_COMMIT.as_bytes()),
            None,
        ],
    )])
    .unwrap();
    fs::create_dir_all(dir.path().join(DELETED_SUBMODULE)).unwrap();

    taken_in(&dir, DELETED_SUBMODULE, Side::Remote);

    assert_eq!(staged(&dir, DELETED_SUBMODULE), "");
    assert!(dir.path().join(DELETED_SUBMODULE).is_dir());
}

#[test]
fn take_of_the_kept_side_of_a_deleted_file_restores_it() {
    for (path, side, bytes) in [
        (LOCAL_DELETED, Side::Remote, b"kept\nremote\n".as_slice()),
        (REMOTE_DELETED, Side::Local, b"kept\nlocal\nmore\n"),
    ] {
        let dir = every_kind_of_conflict();
        fs::remove_file(dir.path().join(path)).unwrap();
        taken_in(&dir, path, side);
        assert_eq!(fs::read(dir.path().join(path)).unwrap(), bytes);
    }
}

#[test]
fn take_of_a_submodule_stages_the_chosen_commit_and_leaves_its_worktree_alone() {
    for (side, commit) in [(Side::Local, LOCAL_COMMIT), (Side::Remote, REMOTE_COMMIT)] {
        let dir = every_kind_of_conflict();
        fs::remove_dir(dir.path().join(SUBMODULE)).unwrap();
        taken_in(&dir, SUBMODULE, side);
        assert_eq!(
            staged(&dir, SUBMODULE),
            format!("160000 {commit} 0\t{SUBMODULE}\n")
        );
        assert!(dir.path().join(SUBMODULE).symlink_metadata().is_err());
    }
}

#[test]
fn reset_after_take_brings_back_the_stages_of_every_kind() {
    let kinds = [
        (TEXT, Side::Remote),
        (LOCAL_DELETED, Side::Local),
        (REMOTE_DELETED, Side::Local),
        (BINARY, Side::Remote),
        (LATIN1, Side::Local),
        #[cfg(unix)]
        (SYMLINK, Side::Remote),
        (SUBMODULE, Side::Local),
    ];
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before = unmerged(&dir);
    for (path, side) in kinds {
        session.take(path, side, DiskVersion(0)).unwrap();
    }
    assert_eq!(unmerged(&dir), "");
    git_ok(dir.path(), &["update-index", "--clear-resolve-undo"]).unwrap();

    for (path, _) in kinds {
        session.reset(path, DiskVersion(0)).unwrap();
    }

    assert_eq!(unmerged(&dir), before);
    assert_eq!(session.remaining(), kinds.len());
}
