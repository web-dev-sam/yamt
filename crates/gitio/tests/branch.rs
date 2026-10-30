#![cfg(test)]

use std::path::Path;

use yamt_conflict_repo::{
    ConflictFile, FileKind, TempDir, conflict_repo, diverged_repo, git, git_ok,
};
use yamt_gitio::{Error, Oid, Repo};

const UNKNOWN_COMMIT: &str = "1111111111111111111111111111111111111111";
const GIT_FATAL_STATUS: i32 = 128;
const CONFLICTED: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];
const MERGES_CLEANLY: [ConflictFile<'static>; 2] = [
    ConflictFile {
        path: "local.txt",
        kind: FileKind::Regular,
        base: Some(b"base\n"),
        local: Some(b"local\n"),
        remote: Some(b"base\n"),
    },
    ConflictFile {
        path: "remote.txt",
        kind: FileKind::Regular,
        base: Some(b"base\n"),
        local: Some(b"base\n"),
        remote: Some(b"remote\n"),
    },
];

fn text(dir: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(dir, args).unwrap())
        .unwrap()
        .trim_end()
        .to_owned()
}

fn commit(repo: &Repo, name: &str) -> Oid {
    repo.commit_named(name).unwrap().unwrap()
}

/// `git config <key>`, `None` when it is not set.
fn config(dir: &Path, key: &str) -> Option<String> {
    let output = git(dir, &["config", key]).unwrap();
    output.status.success().then(|| {
        String::from_utf8(output.stdout)
            .unwrap()
            .trim_end()
            .to_owned()
    })
}

/// The diverged repository (on `local`; `main` is the base, `remote` the other side) and its `Repo`.
fn diverged() -> (TempDir, Repo) {
    let dir = diverged_repo(&CONFLICTED).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    (dir, repo)
}

#[test]
fn checkout_branch_at_creates_fast_forwards_and_keeps_upstream() {
    let (dir, repo) = diverged();
    let root = dir.path();
    let (main, local) = (commit(&repo, "main"), commit(&repo, "local"));

    repo.checkout_branch_at("feature", &main).unwrap();
    repo.set_upstream("feature", "gitlab").unwrap();

    assert_eq!(text(root, &["symbolic-ref", "HEAD"]), "refs/heads/feature");
    assert_eq!(commit(&repo, "HEAD"), main);
    assert_eq!(
        config(root, "branch.feature.remote").as_deref(),
        Some("gitlab")
    );
    assert_eq!(
        config(root, "branch.feature.merge").as_deref(),
        Some("refs/heads/feature")
    );

    repo.checkout_branch("local").unwrap();
    repo.checkout_branch_at("feature", &local).unwrap();

    assert_eq!(text(root, &["symbolic-ref", "HEAD"]), "refs/heads/feature");
    assert_eq!(commit(&repo, "feature"), local);
    assert_eq!(text(root, &["status", "--porcelain=v1"]), "");
    assert_eq!(
        config(root, "branch.feature.remote").as_deref(),
        Some("gitlab")
    );
    assert_eq!(
        config(root, "branch.feature.merge").as_deref(),
        Some("refs/heads/feature")
    );
}

#[test]
fn checkout_branch_switches_head_and_the_worktree_to_the_branch() {
    let (dir, repo) = diverged();
    let root = dir.path();

    repo.checkout_branch("remote").unwrap();

    assert_eq!(text(root, &["symbolic-ref", "HEAD"]), "refs/heads/remote");
    assert_eq!(std::fs::read(root.join("a.txt")).unwrap(), b"remote\n");
}

#[test]
fn branch_force_keeps_the_upstream_config() {
    let (dir, repo) = diverged();
    let root = dir.path();
    let main = commit(&repo, "main");
    repo.set_upstream("remote", "gitlab").unwrap();

    repo.move_branch("remote", &main).unwrap();

    assert_eq!(commit(&repo, "remote"), main);
    assert_eq!(
        config(root, "branch.remote.remote").as_deref(),
        Some("gitlab")
    );
    assert_eq!(
        config(root, "branch.remote.merge").as_deref(),
        Some("refs/heads/remote")
    );
}

#[test]
fn delete_branch_removes_the_branch_and_its_config() {
    let (dir, repo) = diverged();
    let root = dir.path();
    repo.set_upstream("remote", "gitlab").unwrap();

    repo.delete_branch("remote").unwrap();

    assert_eq!(repo.commit_named("refs/heads/remote").unwrap(), None);
    assert_eq!(config(root, "branch.remote.remote"), None);
    assert_eq!(config(root, "branch.remote.merge"), None);
}

#[test]
fn delete_and_move_refuse_a_branch_checked_out_in_another_worktree() {
    let (dir, repo) = diverged();
    let elsewhere = tempfile::tempdir().unwrap();
    let worktree = elsewhere.path().join("worktree");
    let worktree_path = worktree.display().to_string();
    git_ok(
        dir.path(),
        &["worktree", "add", "-q", &worktree_path, "remote"],
    )
    .unwrap();
    let (main, remote) = (commit(&repo, "main"), commit(&repo, "remote"));

    let deleted = repo.delete_branch("remote");
    let moved = repo.move_branch("remote", &main);

    assert!(
        matches!(deleted, Err(Error::GitFailed { .. })),
        "{deleted:?}"
    );
    assert!(matches!(moved, Err(Error::GitFailed { .. })), "{moved:?}");
    assert_eq!(commit(&repo, "remote"), remote);
}

#[test]
fn reset_keep_moves_the_checked_out_branch_and_refuses_a_change_in_the_way() {
    let (dir, repo) = diverged();
    let root = dir.path();
    let (main, remote) = (commit(&repo, "main"), commit(&repo, "remote"));

    repo.reset_keep(&main).unwrap();

    assert_eq!(text(root, &["symbolic-ref", "HEAD"]), "refs/heads/local");
    assert_eq!(commit(&repo, "local"), main);
    assert_eq!(std::fs::read(root.join("a.txt")).unwrap(), b"base\n");

    std::fs::write(root.join("a.txt"), b"mine\n").unwrap();
    let refused = repo.reset_keep(&remote);

    assert!(
        matches!(refused, Err(Error::GitFailed { .. })),
        "{refused:?}"
    );
    assert_eq!(commit(&repo, "local"), main);
    assert_eq!(std::fs::read(root.join("a.txt")).unwrap(), b"mine\n");
}

#[test]
fn is_ancestor_answers_both_ways_and_fails_on_an_unknown_commit() {
    let (_dir, repo) = diverged();
    let (main, local) = (commit(&repo, "main"), commit(&repo, "local"));
    let unknown = Oid::parse(UNKNOWN_COMMIT).unwrap();

    assert!(repo.is_ancestor(&main, &local).unwrap());
    assert!(!repo.is_ancestor(&local, &main).unwrap());
    let failed = repo.is_ancestor(&unknown, &local);
    assert!(
        matches!(
            failed,
            Err(Error::GitFailed {
                status: Some(GIT_FATAL_STATUS),
                ..
            })
        ),
        "{failed:?}"
    );
}

#[test]
fn has_tracked_changes_ignores_untracked_files_and_sees_staged_unstaged_and_unmerged() {
    let (dir, repo) = diverged();
    let root = dir.path();
    assert!(!repo.has_tracked_changes().unwrap());

    std::fs::write(root.join("untracked.txt"), b"new\n").unwrap();
    assert!(!repo.has_tracked_changes().unwrap());

    std::fs::write(root.join("a.txt"), b"changed\n").unwrap();
    assert!(repo.has_tracked_changes().unwrap());

    git_ok(root, &["add", "a.txt"]).unwrap();
    git_ok(root, &["checkout", "--", "a.txt"]).unwrap();
    assert_eq!(
        text(root, &["status", "--porcelain=v1", "--untracked-files=no"]),
        "M  a.txt"
    );
    assert!(repo.has_tracked_changes().unwrap());

    let conflicted = conflict_repo(&CONFLICTED).unwrap();
    let unmerged = Repo::discover(conflicted.path()).unwrap();
    assert!(unmerged.has_tracked_changes().unwrap());
}

#[test]
fn merge_no_commit_stops_with_merge_head_on_conflicts_and_on_a_clean_merge() {
    let (_conflicting_dir, conflicting) = diverged();
    let head = commit(&conflicting, "HEAD");

    let stopped = conflicting.merge_no_commit("remote").unwrap();

    assert!(!stopped.succeeded);
    let conflicted: Vec<String> = conflicting
        .unmerged()
        .unwrap()
        .iter()
        .map(|entry| entry.path.display().to_string())
        .collect();
    assert_eq!(conflicted, ["a.txt", "a.txt", "a.txt"]);
    assert!(conflicting.git_path("MERGE_HEAD").unwrap().exists());
    assert_eq!(commit(&conflicting, "HEAD"), head);

    let clean_dir = diverged_repo(&MERGES_CLEANLY).unwrap();
    let clean = Repo::discover(clean_dir.path()).unwrap();
    let head = commit(&clean, "HEAD");

    let merged = clean.merge_no_commit("remote").unwrap();

    assert!(
        merged.succeeded,
        "{}",
        String::from_utf8_lossy(&merged.output)
    );
    assert_eq!(clean.unmerged().unwrap(), Vec::new());
    assert!(clean.git_path("MERGE_HEAD").unwrap().exists());
    assert_eq!(commit(&clean, "HEAD"), head);
    assert_eq!(
        std::fs::read(clean_dir.path().join("remote.txt")).unwrap(),
        b"remote\n"
    );
}
