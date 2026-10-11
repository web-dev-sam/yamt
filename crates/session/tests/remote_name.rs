#![cfg(test)]

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git, git_ok};
use yamt_session::{MergeSession, RemoteName};

const FILE: &str = "cart.ts";
const UNREADABLE: u32 = 0o000;

fn diverged() -> TempDir {
    diverged_repo(&[ConflictFile {
        path: FILE,
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(b"local\n"),
        remote: Some(b"remote\n"),
    }])
    .unwrap()
}

fn require_conflict(root: &Path, args: &[&str]) {
    let output = git(root, args).unwrap();
    assert!(!output.status.success(), "{args:?} did not conflict");
}

fn stdout_line(root: &Path, args: &[&str]) -> String {
    let output = git_ok(root, args).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn remote_name_of(root: &Path) -> Option<RemoteName> {
    MergeSession::open(root).unwrap().remote_name()
}

fn branch(name: &str) -> RemoteName {
    RemoteName::Branch {
        name: name.to_owned(),
    }
}

fn commit(root: &Path, revision: &str, subject: &str, message: &str) -> RemoteName {
    RemoteName::Commit {
        short_id: stdout_line(root, &["rev-parse", "--short", revision]),
        subject: subject.to_owned(),
        message: message.to_owned(),
    }
}

#[test]
fn merging_a_branch_names_the_branch() {
    let dir = diverged();
    require_conflict(dir.path(), &["merge", "remote"]);

    assert_eq!(remote_name_of(dir.path()), Some(branch("remote")));
}

#[test]
fn merging_a_commit_no_branch_points_at_names_the_commit() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "--detach", "remote"]).unwrap();
    let message = ["-m", "detached subject", "-m", "detached body"];
    git_ok(
        root,
        &[&["commit", "--quiet", "--allow-empty"], &message[..]].concat(),
    )
    .unwrap();
    let detached = stdout_line(root, &["rev-parse", "HEAD"]);
    git_ok(root, &["checkout", "--quiet", "local"]).unwrap();
    require_conflict(root, &["merge", &detached]);

    let expected = commit(
        root,
        &detached,
        "detached subject",
        "detached subject\n\ndetached body",
    );
    assert_eq!(remote_name_of(root), Some(expected));
}

#[test]
fn two_branches_at_the_merged_commit_are_told_apart_by_the_merge_message() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["branch", "also", "remote"]).unwrap();
    git_ok(
        root,
        &[
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/heads/remote",
        ],
    )
    .unwrap();
    require_conflict(root, &["merge", "remote"]);

    assert_eq!(remote_name_of(root), Some(branch("remote")));
}

#[test]
fn two_branches_and_a_merge_message_naming_neither_give_the_commit() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["branch", "also", "remote"]).unwrap();
    let remote = stdout_line(root, &["rev-parse", "remote"]);
    require_conflict(root, &["merge", &remote]);

    assert_eq!(
        remote_name_of(root),
        Some(commit(root, "remote", "remote", "remote"))
    );
}

#[test]
fn an_unreadable_merge_message_drops_the_name() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["branch", "also", "remote"]).unwrap();
    require_conflict(root, &["merge", "remote"]);
    let merge_msg = root.join(".git/MERGE_MSG");
    fs::set_permissions(&merge_msg, fs::Permissions::from_mode(UNREADABLE)).unwrap();

    assert_eq!(remote_name_of(root), None);
}

#[test]
fn a_cherry_pick_names_the_picked_commit() {
    let dir = diverged();
    require_conflict(dir.path(), &["cherry-pick", "remote"]);

    assert_eq!(
        remote_name_of(dir.path()),
        Some(commit(dir.path(), "remote", "remote", "remote"))
    );
}

#[test]
fn a_rebase_names_the_replayed_commit() {
    let dir = diverged();
    let local = stdout_line(dir.path(), &["rev-parse", "local"]);
    require_conflict(dir.path(), &["rebase", "remote"]);

    assert_eq!(
        remote_name_of(dir.path()),
        Some(commit(dir.path(), &local, "local", "local"))
    );
}

#[test]
fn a_conflict_from_stash_pop_has_no_name() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "remote"]).unwrap();
    fs::write(root.join(FILE), "stashed\n").unwrap();
    git_ok(root, &["stash", "--quiet"]).unwrap();
    git_ok(root, &["checkout", "--quiet", "local"]).unwrap();
    require_conflict(root, &["stash", "pop"]);

    let session = MergeSession::open(root).unwrap();
    assert_eq!(session.files().len(), 1);
    assert_eq!(session.remote_name(), None);
}
