#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Run, STEP_ONE_MESSAGE, TempDir, diverged_repo, git, git_ok,
    operation_repo,
};
use yamt_session::{MergeSession, SideName, SideNames};

mod listing;
use listing::listed;

const FILE: &str = "cart.ts";

fn cart() -> ConflictFile<'static> {
    ConflictFile {
        path: FILE,
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(b"local\n"),
        remote: Some(b"remote\n"),
    }
}

fn diverged() -> TempDir {
    diverged_repo(&[cart()]).unwrap()
}

fn stopped(run: Run) -> TempDir {
    operation_repo(run, &[cart()]).unwrap()
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

fn side_names_of(root: &Path) -> SideNames {
    listed(&mut MergeSession::open(root).unwrap()).sides
}

fn branch(name: &str) -> SideName {
    SideName::Branch {
        name: name.to_owned(),
    }
}

fn commit(root: &Path, revision: &str, subject: &str, message: &str) -> SideName {
    SideName::Commit {
        short_id: short_id_as_gitio_reads_config(root, revision),
        subject: subject.to_owned(),
        message: message.to_owned(),
    }
}

#[test]
fn merging_a_branch_names_both_branches() {
    let dir = diverged();
    require_conflict(dir.path(), &["merge", "remote"]);

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(branch("remote")),
    };
    assert_eq!(side_names_of(dir.path()), expected);
}

#[test]
fn merging_from_a_detached_checkout_names_the_checked_out_commit() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "--detach", "local"]).unwrap();
    require_conflict(root, &["merge", "remote"]);

    let expected = SideNames {
        local: Some(commit(root, "HEAD", "local", "local")),
        remote: Some(branch("remote")),
    };
    assert_eq!(side_names_of(root), expected);
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

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(commit(
            root,
            &detached,
            "detached subject",
            "detached subject\n\ndetached body",
        )),
    };
    assert_eq!(side_names_of(root), expected);
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

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(branch("remote")),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn two_branches_and_a_merge_message_naming_neither_give_the_commit() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["branch", "also", "remote"]).unwrap();
    let remote = stdout_line(root, &["rev-parse", "remote"]);
    require_conflict(root, &["merge", &remote]);

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(commit(root, "remote", "remote", "remote")),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn an_unreadable_merge_message_drops_only_the_remote_name() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["branch", "also", "remote"]).unwrap();
    require_conflict(root, &["merge", "remote"]);
    let merge_msg = root.join(".git/MERGE_MSG");
    fs::remove_file(&merge_msg).unwrap();
    fs::create_dir(&merge_msg).unwrap();

    let expected = SideNames {
        local: Some(branch("local")),
        remote: None,
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn an_unreadable_branch_drops_only_the_local_name() {
    let dir = diverged();
    let root = dir.path();
    require_conflict(root, &["merge", "remote"]);
    let heads = root.join(".git/refs/heads");
    fs::write(heads.join("loop-a"), "ref: refs/heads/loop-b\n").unwrap();
    fs::write(heads.join("loop-b"), "ref: refs/heads/loop-a\n").unwrap();
    fs::write(root.join(".git/HEAD"), "ref: refs/heads/loop-a\n").unwrap();
    let branch_read = git(root, &["branch", "--show-current"]).unwrap();
    let stderr = String::from_utf8(branch_read.stderr).unwrap();
    assert!(stderr.contains("failed to resolve HEAD"), "{stderr:?}");

    let expected = SideNames {
        local: None,
        remote: Some(branch("remote")),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn a_cherry_pick_names_the_branch_and_the_picked_commit() {
    let dir = diverged();
    let root = dir.path();
    require_conflict(root, &["cherry-pick", "remote"]);

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(commit(root, "remote", "remote", "remote")),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn a_rebase_names_the_replayed_commit_on_the_left_and_the_commit_it_stands_on_on_the_right() {
    let dir = diverged();
    let root = dir.path();
    let local = stdout_line(root, &["rev-parse", "local"]);
    require_conflict(root, &["rebase", "remote"]);

    let expected = SideNames {
        local: Some(commit(root, &local, "local", "local")),
        remote: Some(commit(root, "remote", "remote", "remote")),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn both_rebase_backends_name_the_replayed_step_on_the_left() {
    for run in [Run::Rebase, Run::RebaseApply] {
        let dir = stopped(run);
        let root = dir.path();

        let expected = SideNames {
            local: Some(commit(root, "remote~2", "step 1", STEP_ONE_MESSAGE)),
            remote: Some(commit(root, "HEAD", "local", "local")),
        };
        assert_eq!(side_names_of(root), expected, "{run:?}");
    }
}

#[test]
fn a_rebase_redoing_a_merge_keeps_head_on_the_left_and_names_the_merged_branch() {
    let dir = stopped(Run::RebaseMerges);
    let root = dir.path();

    let expected = SideNames {
        local: Some(commit(root, "HEAD", "onto", "onto")),
        remote: Some(branch("remote")),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn a_squash_merge_names_the_merged_branch() {
    let dir = stopped(Run::SquashMerge);

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(branch("remote")),
    };
    assert_eq!(side_names_of(dir.path()), expected);
}

#[test]
fn a_squash_merge_of_a_commit_no_branch_points_at_names_the_commit() {
    let dir = diverged();
    let root = dir.path();
    let remote = stdout_line(root, &["rev-parse", "remote"]);
    git_ok(root, &["branch", "--quiet", "-D", "remote"]).unwrap();
    require_conflict(root, &["merge", "--squash", &remote]);

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(commit(root, &remote, "remote", "remote")),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn a_revert_names_the_reverted_commit_as_a_revert() {
    let dir = stopped(Run::Revert);
    let root = dir.path();

    let expected = SideNames {
        local: Some(branch("main")),
        remote: Some(SideName::Revert {
            short_id: short_id_as_gitio_reads_config(root, "HEAD~1"),
            subject: "step 1".to_owned(),
            message: STEP_ONE_MESSAGE.to_owned(),
        }),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn am_names_the_patch_by_its_subject_and_message() {
    let dir = stopped(Run::Am);

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(SideName::Patch {
            subject: "step 1".to_owned(),
            message: STEP_ONE_MESSAGE.to_owned(),
        }),
    };
    assert_eq!(side_names_of(dir.path()), expected);
}

#[test]
fn a_cherry_pick_from_a_range_names_the_picked_step() {
    let dir = stopped(Run::CherryPickRange);
    let root = dir.path();

    let expected = SideNames {
        local: Some(branch("local")),
        remote: Some(commit(root, "remote~2", "step 1", STEP_ONE_MESSAGE)),
    };
    assert_eq!(side_names_of(root), expected);
}

#[test]
fn a_conflict_from_stash_pop_names_only_the_branch() {
    let dir = diverged();
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "remote"]).unwrap();
    fs::write(root.join(FILE), "stashed\n").unwrap();
    git_ok(root, &["stash", "--quiet"]).unwrap();
    git_ok(root, &["checkout", "--quiet", "local"]).unwrap();
    require_conflict(root, &["stash", "pop"]);

    let mut session = MergeSession::open(root).unwrap();
    assert_eq!(session.files().len(), 1);
    let expected = SideNames {
        local: Some(branch("local")),
        remote: None,
    };
    assert_eq!(listed(&mut session).sides, expected);
}
