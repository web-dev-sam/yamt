#![cfg(test)]

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok};
use yamt_session::{DiskChange, DiskResult, DiskVersion, FileStatus, MergeSession};

const FIRST: &str = "a.ts";
const SECOND: &str = "b.ts";

fn text_conflict(path: &str) -> ConflictFile<'_> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(b"local\n"),
        remote: Some(b"remote\n"),
    }
}

fn two_conflicts() -> TempDir {
    conflict_repo(&[text_conflict(FIRST), text_conflict(SECOND)]).unwrap()
}

fn statuses(session: &MergeSession) -> Vec<(String, FileStatus)> {
    let files = session.files().into_iter();
    files.map(|file| (file.path, file.status)).collect()
}

fn expected(statuses: &[(&str, FileStatus)]) -> Vec<(String, FileStatus)> {
    let statuses = statuses.iter();
    statuses
        .map(|(path, status)| ((*path).to_owned(), *status))
        .collect()
}

#[test]
fn a_file_added_outside_after_start_reads_as_resolved() {
    use FileStatus::{Resolved, Unresolved};
    let dir = two_conflicts();
    let mut session = MergeSession::open(dir.path()).unwrap();
    git_ok(dir.path(), &["add", FIRST]).unwrap();
    assert_eq!(session.remaining(), 2);

    let list = session.refresh().unwrap();

    let after = expected(&[(FIRST, Resolved), (SECOND, Unresolved)]);
    assert_eq!(statuses(&session), after);
    assert_eq!(list.disk_changes, []);
    assert_eq!(session.remaining(), 1);
}

#[test]
fn a_finished_file_checked_out_with_markers_outside_reads_as_unresolved() {
    use FileStatus::{Resolved, Unresolved};
    let dir = two_conflicts();
    let mut session = MergeSession::open(dir.path()).unwrap();
    session.finish(FIRST, "done\n", DiskVersion(0)).unwrap();
    session.finish(SECOND, "done\n", DiskVersion(0)).unwrap();
    git_ok(dir.path(), &["checkout", "-m", FIRST]).unwrap();

    let list = session.refresh().unwrap();

    assert_eq!(
        statuses(&session),
        expected(&[(FIRST, Unresolved), (SECOND, Resolved)])
    );
    let markers_left = DiskResult::MarkersLeft { conflicts: 1 };
    let change = DiskChange {
        path: FIRST.to_owned(),
        result: markers_left,
    };
    assert_eq!(list.disk_changes, [change]);
}

#[test]
fn a_file_that_was_not_conflicted_at_start_is_never_listed() {
    let dir = two_conflicts();
    git_ok(dir.path(), &["add", SECOND]).unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();
    git_ok(dir.path(), &["checkout", "-m", SECOND]).unwrap();

    session.refresh().unwrap();

    assert_eq!(
        statuses(&session),
        expected(&[(FIRST, FileStatus::Unresolved)])
    );
}

#[test]
fn refresh_with_a_broken_index_is_a_git_error_and_keeps_the_statuses() {
    let dir = two_conflicts();
    let mut session = MergeSession::open(dir.path()).unwrap();
    session.finish(FIRST, "done\n", DiskVersion(0)).unwrap();
    let before = statuses(&session);
    std::fs::write(dir.path().join(".git/index"), "not an index").unwrap();

    let error = session.refresh().unwrap_err();

    assert!(matches!(error, yamt_session::Error::Git(_)), "{error:?}");
    assert_eq!(statuses(&session), before);
}
