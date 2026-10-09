#![cfg(test)]

use std::fs;

use yamt_conflict_repo::{ConflictFile, TempDir, conflict_repo, git_ok};
use yamt_session::{Eol, Error, FileStatus, MergeSession, UnsupportedReason};

const FILE: &str = "src/cart.ts";
const OTHER: &str = "src/other.ts";

fn two_file_conflict() -> TempDir {
    conflict_repo(&[
        ConflictFile {
            path: FILE,
            base: Some(b"one\ntwo\nthree\n"),
            local: Some(b"one\nlocal\nthree\n"),
            remote: Some(b"one\nremote\nthree\n"),
        },
        ConflictFile {
            path: OTHER,
            base: Some(b"four\nfive\n"),
            local: Some(b"four\nlocal five\n"),
            remote: Some(b"four\nremote five\n"),
        },
    ])
    .unwrap()
}

fn single_conflict(path: &str, sides: [&[u8]; 3]) -> TempDir {
    let [base, local, remote] = sides;
    conflict_repo(&[ConflictFile {
        path,
        base: Some(base),
        local: Some(local),
        remote: Some(remote),
    }])
    .unwrap()
}

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

fn status_of(session: &MergeSession, path: &str) -> FileStatus {
    let files = session.files();
    files.iter().find(|file| file.path == path).unwrap().status
}

fn assert_finish_with_local_round_trips_bytes(sides: [&[u8]; 3], expected_eol: Eol) {
    const PATH: &str = "eol.txt";
    let dir = single_conflict(PATH, sides);
    let mut session = MergeSession::open(dir.path()).unwrap();
    let data = session.load(PATH).unwrap();
    assert_eq!(data.eol, expected_eol);

    session.finish(PATH, &data.local).unwrap();

    let worktree = fs::read(dir.path().join(PATH)).unwrap();
    assert_eq!(worktree, sides[1]);
}

#[test]
fn crlf_file_is_detected_and_finish_writes_its_crlf_bytes_unchanged() {
    let sides: [&[u8]; 3] = [b"a\r\nb\r\nc", b"a\r\nlocal\r\nc", b"a\r\nremote\r\nc"];
    assert_finish_with_local_round_trips_bytes(sides, Eol::CrLf);
}

#[test]
fn mixed_eol_file_is_detected_and_finish_writes_its_bytes_unchanged() {
    let sides: [&[u8]; 3] = [
        b"a\r\nb\nc\r\n",
        b"a\r\nlocal\nc\r\n",
        b"a\r\nremote\nc\r\n",
    ];
    assert_finish_with_local_round_trips_bytes(sides, Eol::Mixed);
}

#[test]
fn finish_writes_the_result_marks_it_resolved_and_git_no_longer_lists_it() {
    const RESULT: &str = "one\nmerged\nthree\n";
    let dir = two_file_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert_eq!(session.remaining(), 2);

    session.finish(FILE, RESULT).unwrap();

    assert!(!unmerged(&dir).contains(FILE));
    assert!(unmerged(&dir).contains(OTHER));
    assert_eq!(fs::read_to_string(dir.path().join(FILE)).unwrap(), RESULT);
    assert_eq!(status_of(&session, FILE), FileStatus::Resolved);
    assert_eq!(session.remaining(), 1);
}

#[test]
fn reset_after_finish_restores_git_stages_and_conflict_markers() {
    let dir = two_file_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before_finish = unmerged(&dir);
    session.finish(FILE, "resolved\n").unwrap();
    // `git add` leaves a resolve-undo record that `checkout -m` alone would use to bring the
    // conflict back (git-ls-files(1) --resolve-undo); without it only the captured stages can.
    git_ok(dir.path(), &["update-index", "--clear-resolve-undo"]).unwrap();

    session.reset(FILE).unwrap();

    assert_eq!(unmerged(&dir), before_finish);
    let worktree = fs::read_to_string(dir.path().join(FILE)).unwrap();
    assert!(worktree.contains("<<<<<<<"), "no markers in {worktree:?}");
    assert_eq!(status_of(&session, FILE), FileStatus::Unresolved);
    assert_eq!(session.remaining(), 2);
}

#[test]
fn unknown_path_is_rejected_by_load_finish_and_reset() {
    const UNKNOWN: &str = "not-conflicted.ts";
    let dir = two_file_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let errors = [
        session.load(UNKNOWN).unwrap_err(),
        session.finish(UNKNOWN, "text\n").unwrap_err(),
        session.reset(UNKNOWN).unwrap_err(),
    ];

    for error in errors {
        assert!(
            matches!(&error, Error::UnknownPath { path } if path == UNKNOWN),
            "{error:?}"
        );
    }
    assert!(!dir.path().join(UNKNOWN).exists());
}

#[test]
fn finish_refuses_an_unsupported_file_and_leaves_the_worktree_alone() {
    const PATH: &str = "image.bin";
    let dir = single_conflict(PATH, [b"\0base", b"\0local", b"\0remote"]);
    let worktree_before = fs::read(dir.path().join(PATH)).unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let error = session.finish(PATH, "text\n").unwrap_err();

    assert!(
        matches!(
            &error,
            Error::Unsupported {
                reason: UnsupportedReason::Binary,
                ..
            }
        ),
        "{error:?}"
    );
    assert_eq!(fs::read(dir.path().join(PATH)).unwrap(), worktree_before);
    assert!(unmerged(&dir).contains(PATH));
}

#[test]
fn reset_of_a_delete_modify_file_resolved_outside_restores_its_stages() {
    const PATH: &str = "gone.txt";
    let dir = conflict_repo(&[ConflictFile {
        path: PATH,
        base: Some(b"kept\nbase\n"),
        local: None,
        remote: Some(b"kept\nremote\n"),
    }])
    .unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before = unmerged(&dir);
    git_ok(dir.path(), &["add", "--", PATH]).unwrap();
    git_ok(dir.path(), &["update-index", "--clear-resolve-undo"]).unwrap();

    session.reset(PATH).unwrap();

    assert_eq!(unmerged(&dir), before);
    assert_eq!(status_of(&session, PATH), FileStatus::Unresolved);
}
