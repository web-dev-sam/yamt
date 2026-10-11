#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git, git_ok};
use yamt_session::{MergeSession, RemoteName};

const FILE: &str = "cart.ts";

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

fn short_id_as_gitio_reads_config(root: &Path, revision: &str) -> String {
    let output = Command::new("git")
        .current_dir(root)
        .env("LC_ALL", "C")
        .args(["rev-parse", "--short", revision])
        .output()
        .unwrap();
    assert!(output.status.success(), "{output:?}");
    String::from_utf8(output.stdout)
        .unwrap()
        .trim_end()
        .to_owned()
}

fn remote_name_of(root: &Path) -> Option<RemoteName> {
    MergeSession::open(root).unwrap().remote_name()
}

fn branch(name: &str) -> RemoteName {
    RemoteName::Branch {
        name: name.to_owned(),
    }
}

fn assert_names_commit(root: &Path, revision: &str, subject: &str, message: &str) {
    let expected = RemoteName::Commit {
        short_id: short_id_as_gitio_reads_config(root, revision),
        subject: subject.to_owned(),
        message: message.to_owned(),
    };
    assert_eq!(remote_name_of(root), Some(expected));
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

    assert_names_commit(
        root,
        &detached,
        "detached subject",
        "detached subject\n\ndetached body",
    );
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

    assert_names_commit(root, "remote", "remote", "remote");
}

#[test]
fn an_unreadable_merge_message_drops_the_name() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["branch", "also", "remote"]).unwrap();
    require_conflict(root, &["merge", "remote"]);
    let merge_msg = root.join(".git/MERGE_MSG");
    fs::remove_file(&merge_msg).unwrap();
    fs::create_dir(&merge_msg).unwrap();

    assert_eq!(remote_name_of(root), None);
}

#[test]
fn a_cherry_pick_names_the_picked_commit() {
    let dir = diverged();
    let root = dir.path();
    require_conflict(root, &["cherry-pick", "remote"]);

    assert_names_commit(root, "remote", "remote", "remote");
}

#[test]
fn a_rebase_names_the_replayed_commit() {
    let dir = diverged();
    let root = dir.path();
    let local = stdout_line(root, &["rev-parse", "local"]);
    require_conflict(root, &["rebase", "remote"]);

    assert_names_commit(root, &local, "local", "local");
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
