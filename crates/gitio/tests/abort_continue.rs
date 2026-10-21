#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Run, STEP_TWO_FILE, TempDir, conflict_repo, git, git_ok,
    operation_repo, ready_repo, start,
};
use yamt_gitio::{Error, GitRun, Operation, Repo};

const CART: &str = "cart.ts";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: CART,
    kind: FileKind::Regular,
    base: Some(b"one\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];
const STEP_ONE_MESSAGE: &str = "step 1\n\nThe first step's body.";
const WITHOUT_AN_EDITOR: [&str; 7] = [
    "a_merge_commits_git_s_message_without_its_conflicts_comment",
    "a_squash_merge_commits_git_s_squash_message",
    "a_rebase_of_either_backend_keeps_each_commit_s_message",
    "a_pick_range_keeps_each_commit_s_message",
    "a_revert_commits_git_s_revert_message",
    "am_keeps_the_patch_s_message",
    "a_squash_step_continued_past_gives_the_combined_message",
];

fn text(root: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(root, args).unwrap()).unwrap()
}

/// What an abort must give back: the status, every branch tip and the stash list.
fn repository_state(root: &Path) -> [String; 3] {
    let tips = [
        "for-each-ref",
        "--format=%(refname) %(objectname)",
        "refs/heads",
    ];
    [
        text(root, &["status", "--porcelain"]),
        text(root, &tips),
        text(root, &["stash", "list"]),
    ]
}

fn operation(repo: &Repo) -> Operation {
    repo.stop().unwrap().operation.unwrap()
}

fn resolve(root: &Path, path: &str) {
    fs::write(root.join(path), "resolved\n").unwrap();
    git_ok(root, &["add", "--", path]).unwrap();
}

fn message(root: &Path, revision: &str) -> String {
    let message = text(root, &["log", "-1", "--format=%B", revision]);
    message.trim_end().to_owned()
}

fn stopped(run: Run) -> (TempDir, Repo) {
    let dir = operation_repo(run, &FILES).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    git_ok(dir.path(), &["config", "core.editor", "false"]).unwrap();
    (dir, repo)
}

fn continued(repo: &Repo) -> GitRun {
    repo.continue_operation(&operation(repo)).unwrap()
}

/// Continues past step 1 to the conflict at step 2, then past step 2 to the end.
fn continued_to_the_end(root: &Path, repo: &Repo) {
    resolve(root, CART);
    let to_step_two = continued(repo);
    assert!(
        !to_step_two.succeeded,
        "{}",
        String::from_utf8_lossy(&to_step_two.output)
    );
    resolve(root, STEP_TWO_FILE);
    let to_the_end = continued(repo);
    assert!(
        to_the_end.succeeded,
        "{}",
        String::from_utf8_lossy(&to_the_end.output)
    );
    assert_eq!(repo.stop().unwrap().operation, None);
}

// `merge --abort` for a squash merge refuses; an abort that keeps what a sequence replayed loses the branch.
#[test]
fn abort_gives_back_the_status_branch_tips_and_stash_list_of_before_the_operation() {
    for (run, after_one) in [
        (Run::Merge, None),
        (Run::SquashMerge, None),
        (Run::Rebase, Some("rebase")),
        (Run::RebaseApply, Some("rebase")),
        (Run::CherryPick, None),
        (Run::CherryPickRange, Some("cherry-pick")),
        (Run::Revert, None),
        (Run::RevertRange, Some("revert")),
        (Run::Am, Some("am")),
    ] {
        let dir = ready_repo(run, &FILES).unwrap();
        let root = dir.path();
        let before = repository_state(root);
        start(run, root).unwrap();
        if let Some(command) = after_one {
            resolve(root, CART);
            let next = git(root, &[command, "--continue"]).unwrap();
            assert!(!next.status.success(), "{run:?} did not stop at step 2");
        }
        let repo = Repo::discover(root).unwrap();

        repo.abort(&operation(&repo)).unwrap();

        assert_eq!(repository_state(root), before, "{run:?}");
        assert_eq!(repo.stop().unwrap().operation, None, "{run:?}");
    }
}

#[test]
fn an_abort_git_refuses_is_git_s_text_and_changes_nothing() {
    let dir = conflict_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    resolve(root, CART);
    fs::write(root.join(CART), "saved again\n").unwrap();
    let before = (repository_state(root), text(root, &["ls-files", "-s"]));

    let error = repo.abort(&operation(&repo)).unwrap_err();

    let Error::GitFailed { stderr, .. } = error else {
        panic!("expected git's refusal, got {error:?}");
    };
    assert!(stderr.contains(&format!("'{CART}'")), "{stderr}");
    assert_eq!(
        (repository_state(root), text(root, &["ls-files", "-s"])),
        before
    );
    assert!(matches!(operation(&repo), Operation::Merge { .. }));
}

#[test]
fn a_continue_git_refuses_is_no_err_and_carries_git_s_message() {
    let (dir, repo) = stopped(Run::Rebase);
    let before = repository_state(dir.path());

    let refused = continued(&repo);

    assert!(!refused.succeeded);
    let output = String::from_utf8_lossy(&refused.output);
    assert!(output.contains(CART), "{output}");
    assert_eq!(repository_state(dir.path()), before);
}

// With GIT_EDITOR, VISUAL and EDITOR gone and `core.editor=false`, only yamt's `GIT_EDITOR=:` lets a commit through.
#[test]
fn continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment() {
    let child = Command::new(std::env::current_exe().unwrap())
        .args(["--ignored", "--exact", "--test-threads=1"])
        .args(WITHOUT_AN_EDITOR)
        .env_remove("GIT_EDITOR")
        .env_remove("VISUAL")
        .env_remove("EDITOR")
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&child.stdout);
    let passed = format!("test result: ok. {} passed", WITHOUT_AN_EDITOR.len());
    assert!(
        child.status.success() && stdout.contains(&passed),
        "{stdout}{}",
        String::from_utf8_lossy(&child.stderr)
    );
}

#[test]
#[ignore = "run by continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment"]
fn a_merge_commits_git_s_message_without_its_conflicts_comment() {
    let (dir, repo) = stopped(Run::Merge);
    resolve(dir.path(), CART);

    let run = continued(&repo);

    assert!(run.succeeded, "{}", String::from_utf8_lossy(&run.output));
    assert_eq!(
        message(dir.path(), "HEAD"),
        "Merge branch 'remote' into local"
    );
    assert_eq!(repo.stop().unwrap().operation, None);
}

#[test]
#[ignore = "run by continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment"]
fn a_squash_merge_commits_git_s_squash_message() {
    let (dir, repo) = stopped(Run::SquashMerge);
    let root = dir.path();
    resolve(root, CART);
    resolve(root, STEP_TWO_FILE);

    let run = continued(&repo);

    assert!(run.succeeded, "{}", String::from_utf8_lossy(&run.output));
    let squashed = message(root, "HEAD");
    assert!(
        squashed.starts_with("Squashed commit of the following:"),
        "{squashed}"
    );
    assert!(
        squashed.contains(STEP_ONE_MESSAGE.lines().last().unwrap().trim()),
        "{squashed}"
    );
    assert!(!squashed.contains("Conflicts"), "{squashed}");
    assert_eq!(message(root, "HEAD~1"), "local");
    assert_eq!(repo.stop().unwrap().operation, None);
}

#[test]
#[ignore = "run by continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment"]
fn a_rebase_of_either_backend_keeps_each_commit_s_message() {
    for run in [Run::Rebase, Run::RebaseApply] {
        let (dir, repo) = stopped(run);
        let root = dir.path();

        continued_to_the_end(root, &repo);

        assert_eq!(message(root, "HEAD~2"), STEP_ONE_MESSAGE, "{run:?}");
        assert_eq!(message(root, "HEAD~1"), "step 2", "{run:?}");
        assert_eq!(message(root, "HEAD"), "step 3", "{run:?}");
        assert_eq!(message(root, "HEAD~3"), "local", "{run:?}");
    }
}

#[test]
#[ignore = "run by continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment"]
fn a_pick_range_keeps_each_commit_s_message() {
    let (dir, repo) = stopped(Run::CherryPickRange);
    let root = dir.path();

    continued_to_the_end(root, &repo);

    assert_eq!(message(root, "HEAD~2"), STEP_ONE_MESSAGE);
    assert_eq!(message(root, "HEAD~1"), "step 2");
    assert_eq!(message(root, "HEAD"), "step 3");
}

#[test]
#[ignore = "run by continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment"]
fn a_revert_commits_git_s_revert_message() {
    let (dir, repo) = stopped(Run::Revert);
    let root = dir.path();
    let reverted = text(root, &["rev-parse", "HEAD~1"]);
    resolve(root, CART);

    let run = continued(&repo);

    assert!(run.succeeded, "{}", String::from_utf8_lossy(&run.output));
    let expected = format!(
        "Revert \"step 1\"\n\nThis reverts commit {}.",
        reverted.trim_end()
    );
    assert_eq!(message(root, "HEAD"), expected);
    assert_eq!(repo.stop().unwrap().operation, None);
}

#[test]
#[ignore = "run by continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment"]
fn am_keeps_the_patch_s_message() {
    let (dir, repo) = stopped(Run::Am);
    let root = dir.path();

    continued_to_the_end(root, &repo);

    assert_eq!(message(root, "HEAD~2"), STEP_ONE_MESSAGE);
    assert_eq!(message(root, "HEAD~1"), "step 2");
    assert_eq!(message(root, "HEAD"), "step 3");
}

#[test]
#[ignore = "run by continue_commits_git_s_prepared_messages_without_an_editor_in_the_environment"]
fn a_squash_step_continued_past_gives_the_combined_message() {
    let (dir, repo) = stopped(Run::RebaseSquash);
    let root = dir.path();

    continued_to_the_end(root, &repo);

    assert_eq!(
        message(root, "HEAD~1"),
        format!("{STEP_ONE_MESSAGE}\n\nstep 2")
    );
    assert_eq!(message(root, "HEAD"), "step 3");
    assert_eq!(message(root, "HEAD~2"), "local");
}
