#![cfg(test)]

use std::path::Path;

use yamt_conflict_repo::{
    ConflictFile, FileKind, TempDir, conflict_repo, diverged_repo, git, git_ok, rebase_merges_repo,
};
use yamt_session::MergeSession;

const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "cart.ts",
    kind: FileKind::Regular,
    base: Some(b"one\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

fn merging_after_refresh(root: &Path) -> bool {
    MergeSession::open(root).unwrap().refresh().unwrap().merging
}

fn stopped_by(args: &[&str]) -> TempDir {
    let dir = diverged_repo(&FILES).unwrap();
    let output = git(dir.path(), args).unwrap();
    assert!(!output.status.success(), "{args:?} did not stop");
    dir
}

#[test]
fn a_merge_stopped_on_conflicts_is_merging() {
    let dir = conflict_repo(&FILES).unwrap();
    assert!(merging_after_refresh(dir.path()));
}

#[test]
fn stops_that_git_merge_abort_refuses_are_not_merging() {
    for args in [
        ["cherry-pick", "remote"].as_slice(),
        ["rebase", "remote"].as_slice(),
        ["revert", "--no-edit", "remote"].as_slice(),
        ["merge", "--squash", "remote"].as_slice(),
    ] {
        let dir = stopped_by(args);
        assert!(!merging_after_refresh(dir.path()), "{args:?}");
    }
}

#[test]
fn a_rebase_stopped_on_a_merge_commit_has_merge_head_but_is_not_merging() {
    let dir = rebase_merges_repo(&FILES).unwrap();
    assert!(git_ok(dir.path(), &["rev-parse", "--verify", "MERGE_HEAD"]).is_ok());
    assert!(!merging_after_refresh(dir.path()));
}

#[test]
fn a_merge_aborted_outside_is_not_merging_on_the_next_refresh() {
    let dir = conflict_repo(&FILES).unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert!(session.refresh().unwrap().merging);

    git_ok(dir.path(), &["merge", "--abort"]).unwrap();

    assert!(!session.refresh().unwrap().merging);
}

#[cfg(unix)]
#[test]
fn an_unreadable_rebase_state_is_not_merging_and_never_fails_the_list() {
    let dir = conflict_repo(&FILES).unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let rebase_merge = dir.path().join(".git").join("rebase-merge");
    std::os::unix::fs::symlink("rebase-merge", &rebase_merge).unwrap();
    assert!(rebase_merge.try_exists().is_err());

    let list = session.refresh().unwrap();

    assert!(!list.merging);
    assert_eq!(list.files.len(), FILES.len());
}

#[test]
fn abort_merge_runs_git_merge_abort() {
    let dir = conflict_repo(&FILES).unwrap();
    let session = MergeSession::open(dir.path()).unwrap();

    session.abort_merge().unwrap();

    let status = git_ok(dir.path(), &["status", "--porcelain"]).unwrap();
    assert_eq!(String::from_utf8(status).unwrap(), "");
    assert!(git_ok(dir.path(), &["rev-parse", "--verify", "MERGE_HEAD"]).is_err());
}
