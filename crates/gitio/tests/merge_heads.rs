#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;

use yamt_conflict_repo::{
    ConflictFile, FileKind, TempDir, conflict_repo, diverged_repo, git, git_ok,
};
use yamt_gitio::{CommitSummary, Error, Oid, Repo};

const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "cart.ts",
    kind: FileKind::Regular,
    base: Some(b"one\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

fn stdout_line(root: &Path, args: &[&str]) -> String {
    let output = git_ok(root, args).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn short_id_as_gitio_reads_config(root: &Path, revision: &str) -> Vec<u8> {
    let output = Command::new("git")
        .current_dir(root)
        .env("LC_ALL", "C")
        .args(["rev-parse", "--short", revision])
        .output()
        .unwrap();
    assert!(output.status.success(), "{output:?}");
    output.stdout.trim_ascii_end().to_vec()
}

fn oid_of(root: &Path, revision: &str) -> Oid {
    Oid::parse(&stdout_line(root, &["rev-parse", revision])).unwrap()
}

fn merging() -> (TempDir, Repo) {
    let dir = conflict_repo(&FILES).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    (dir, repo)
}

#[test]
fn commit_named_resolves_merge_head_and_is_none_for_a_missing_head() {
    let (dir, repo) = merging();

    let merge_head = repo.commit_named("MERGE_HEAD").unwrap();

    assert_eq!(merge_head, Some(oid_of(dir.path(), "remote")));
    assert_eq!(repo.commit_named("CHERRY_PICK_HEAD").unwrap(), None);
}

#[test]
fn commit_named_without_a_repository_is_a_git_failure_not_a_missing_head() {
    let (dir, repo) = merging();
    std::fs::remove_dir_all(dir.path().join(".git")).unwrap();

    let error = repo.commit_named("MERGE_HEAD").unwrap_err();

    let Error::GitFailed { stderr, .. } = error else {
        panic!("expected GitFailed, got {error:?}");
    };
    assert!(stderr.contains("not a git repository"), "{stderr}");
}

#[test]
fn branches_at_lists_local_and_remote_tracking_branches_but_not_symbolic_refs() {
    let (dir, repo) = merging();
    let root = dir.path();
    git_ok(root, &["branch", "also", "remote"]).unwrap();
    git_ok(root, &["update-ref", "refs/remotes/origin/main", "remote"]).unwrap();
    git_ok(root, &["update-ref", "refs/tags/v1", "remote"]).unwrap();
    git_ok(root, &["tag", "remote", "remote"]).unwrap();
    git_ok(
        root,
        &[
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/remotes/origin/main",
        ],
    )
    .unwrap();

    let branches = repo.branches_at(&oid_of(root, "remote")).unwrap();

    let expected: [&[u8]; 3] = [b"also", b"remote", b"origin/main"];
    assert_eq!(branches, expected);
}

#[test]
fn merge_message_reads_merge_msg_and_is_none_outside_a_merge() {
    let (_dir, repo) = merging();
    let message = repo.merge_message().unwrap().unwrap();
    assert!(
        message.starts_with(b"Merge branch 'remote' into local\n"),
        "{}",
        String::from_utf8_lossy(&message)
    );

    let dir = diverged_repo(&FILES).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    assert_eq!(repo.merge_message().unwrap(), None);
}

#[test]
fn merge_message_that_cannot_be_read_is_a_read_failure_naming_the_file() {
    let (_dir, repo) = merging();
    let merge_msg = repo.root().join(".git/MERGE_MSG");
    fs::remove_file(&merge_msg).unwrap();
    fs::create_dir(&merge_msg).unwrap();

    let error = repo.merge_message().unwrap_err();

    assert!(
        matches!(&error, Error::ReadFailed { path, .. } if *path == merge_msg),
        "{error:?}"
    );
}

#[test]
fn merge_message_of_a_linked_worktree_is_read_from_its_own_git_dir() {
    let dir = diverged_repo(&FILES).unwrap();
    let root = dir.path();
    let linked = root.join("linked");
    let linked_arg = linked.to_str().unwrap();
    git_ok(
        root,
        &[
            "worktree", "add", "--quiet", "--detach", linked_arg, "local",
        ],
    )
    .unwrap();
    let merge = git(&linked, &["merge", "remote"]).unwrap();
    assert!(!merge.status.success());
    let repo = Repo::discover(&linked).unwrap();

    let message = repo.merge_message().unwrap().unwrap();

    assert!(message.starts_with(b"Merge branch 'remote' into HEAD\n"));
    assert_eq!(Repo::discover(root).unwrap().merge_message().unwrap(), None);
}

#[test]
fn commit_summary_gives_the_short_id_subject_and_raw_message() {
    let dir = diverged_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    git_ok(root, &["checkout", "--quiet", "--detach", "remote"]).unwrap();
    git_ok(
        root,
        &[
            "commit",
            "--quiet",
            "--allow-empty",
            "-m",
            "subject",
            "-m",
            "body",
        ],
    )
    .unwrap();

    let summary = repo.commit_summary(&oid_of(root, "HEAD")).unwrap();

    let expected = CommitSummary {
        short_id: short_id_as_gitio_reads_config(root, "HEAD"),
        subject: b"subject".to_vec(),
        message: b"subject\n\nbody\n\n".to_vec(),
    };
    assert_eq!(summary, expected);
}
