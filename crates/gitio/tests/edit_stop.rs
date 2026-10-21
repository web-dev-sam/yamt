#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use yamt_conflict_repo::{
    ConflictFile, FileKind, Run, STEP_TWO_FILE, TempDir, edit_stop_repo, git, git_ok,
    operation_repo, ready_repo,
};
use yamt_gitio::{Oid, Operation, Rebase, Repo};

const CART: &str = "cart.ts";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: CART,
    kind: FileKind::Regular,
    base: Some(b"one\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];
const REWORD_STEP_TWO_DROP_THREE: &str = "sequence.editor=sed -i -e 2s/^pick/reword/ -e 3d";

/// Step 2 joins step 1's chain as `chain_step`, and step 3 becomes a `fixup` of `local`, which conflicts.
fn chain_sequence_editor(chain_step: &str, root: &Path) -> String {
    let local = oid(root, "local");
    let local = local.as_str();
    format!(
        "sequence.editor=sed -i -e 2s/^pick/{chain_step}/ -e '3s/^pick [0-9a-f]*/fixup {local}/'"
    )
}

fn oid(root: &Path, revision: &str) -> Oid {
    let output = git_ok(root, &["rev-parse", "--verify", revision]).unwrap();
    Oid::parse(String::from_utf8(output).unwrap().trim_end()).unwrap()
}

fn git_path(root: &Path, name: &str) -> PathBuf {
    let path = git_ok(root, &["rev-parse", "--git-path", name]).unwrap();
    root.join(String::from_utf8(path).unwrap().trim_end())
}

fn operation(repo: &Repo) -> Operation {
    repo.stop().unwrap().operation.unwrap()
}

fn rebase_of(repo: &Repo) -> Rebase {
    let Operation::Rebase(rebase) = operation(repo) else {
        panic!("not a rebase");
    };
    rebase
}

fn conflicted(root: &Path, args: &[&str]) {
    let output = git(root, args).unwrap();
    assert!(!output.status.success(), "{args:?} did not stop");
}

/// Resolves step 1's conflict and continues in a terminal; git stops at step 2's conflict.
fn at_step_two(dir: &TempDir) -> Repo {
    let root = dir.path();
    git_ok(root, &["add", "--", CART]).unwrap();
    conflicted(root, &["rebase", "--continue"]);
    let unmerged = git_ok(root, &["ls-files", "-u", "--", STEP_TWO_FILE]).unwrap();
    assert!(!unmerged.is_empty(), "step 2 did not conflict");
    Repo::discover(root).unwrap()
}

// A pick at an `edit` stop read as the rebase would show the picked commit as own work, and Abort would end the rebase.
#[test]
fn an_edit_stop_replays_nothing_and_a_pick_there_is_that_pick_with_its_own_abort() {
    let dir = edit_stop_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    let at_edit = rebase_of(&repo);
    assert_eq!(at_edit.replaying, None);
    assert!(git_ok(root, &["rev-parse", "--verify", "REBASE_HEAD"]).is_ok());

    conflicted(root, &["cherry-pick", "local"]);

    let picking = Some(oid(root, "local"));
    let progress = None;
    assert_eq!(
        operation(&repo),
        Operation::CherryPick { picking, progress }
    );
    repo.abort(&operation(&repo)).unwrap();
    assert_eq!(operation(&repo), Operation::Rebase(at_edit));
}

#[test]
fn a_revert_at_an_edit_stop_is_that_revert_and_its_continue_leaves_the_rebase_at_the_edit() {
    let dir = edit_stop_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    let at_edit = rebase_of(&repo);
    fs::write(root.join(CART), "later\n").unwrap();
    git_ok(root, &["commit", "--quiet", "--all", "-m", "later"]).unwrap();
    let reverting = Some(oid(root, "HEAD~1"));

    conflicted(root, &["revert", "--no-edit", "HEAD~1"]);

    let progress = None;
    assert_eq!(
        operation(&repo),
        Operation::Revert {
            reverting,
            progress
        }
    );
    fs::write(root.join(CART), "resolved\n").unwrap();
    git_ok(root, &["add", "--", CART]).unwrap();
    let run = repo.continue_operation(&operation(&repo)).unwrap();
    assert!(run.succeeded, "{}", String::from_utf8_lossy(&run.output));
    assert_eq!(operation(&repo), Operation::Rebase(at_edit));
}

// Read as a `rebase -r` merge step, Abort would run `rebase --abort` and drop the whole rebase.
#[test]
fn a_merge_at_an_edit_stop_is_that_merge_and_its_abort_leaves_the_rebase_at_the_edit() {
    let dir = edit_stop_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    let at_edit = rebase_of(&repo);

    conflicted(root, &["merge", "local"]);

    let merging = oid(root, "local");
    assert_eq!(operation(&repo), Operation::Merge { merging });
    repo.abort(&operation(&repo)).unwrap();
    assert_eq!(operation(&repo), Operation::Rebase(at_edit));
}

// git writes `amend` at a conflicted squash step too: read as an edit stop, own work would show on the right, unnamed.
#[test]
fn a_conflicted_squash_step_replays_its_commit_and_is_an_editor_step() {
    let dir = operation_repo(Run::RebaseSquash, &FILES).unwrap();
    let repo = at_step_two(&dir);
    let root = dir.path();
    assert!(git_path(root, "rebase-merge/amend").exists());

    let rebase = rebase_of(&repo);

    assert_eq!(rebase.replaying, Some(oid(root, "remote~1")));
    assert_eq!(rebase.redoing_merge, None);
    assert!(rebase.editor_steps_ahead);
}

// `rebase --continue` runs the editor for the stopped reword itself, though the todo is empty.
#[test]
fn a_conflicted_reword_stop_with_an_empty_todo_has_an_editor_step_ahead() {
    let dir = ready_repo(Run::Rebase, &FILES).unwrap();
    let root = dir.path();
    let args = [
        "-c",
        REWORD_STEP_TWO_DROP_THREE,
        "rebase",
        "-i",
        "local",
        "remote",
    ];
    conflicted(root, &args);
    let repo = at_step_two(&dir);
    let todo = fs::read(git_path(root, "rebase-merge/git-rebase-todo")).unwrap();
    assert!(todo.trim_ascii().is_empty(), "{todo:?}");

    let rebase = rebase_of(&repo);

    assert_eq!(rebase.replaying, Some(oid(root, "remote~1")));
    assert!(rebase.editor_steps_ahead);
}

// Continuing this stop, git opens the editor (git 2.56): with the squash, on the chain's message "This is a combination of
// 3 commits" with step 1's and step 2's messages; with fixups only, on step 1's message alone.
#[test]
fn a_conflicted_fixup_has_an_editor_step_ahead_only_in_a_chain_with_a_squash() {
    for (chain_step, expected) in [("squash", true), ("fixup", false)] {
        let dir = ready_repo(Run::Rebase, &FILES).unwrap();
        let root = dir.path();
        let sequence_editor = chain_sequence_editor(chain_step, root);
        conflicted(
            root,
            &["-c", &sequence_editor, "rebase", "-i", "main", "remote"],
        );
        let done = fs::read_to_string(git_path(root, "rebase-merge/done")).unwrap();
        assert!(done.lines().last().unwrap().starts_with("fixup "), "{done}");
        let repo = Repo::discover(root).unwrap();

        let rebase = rebase_of(&repo);

        assert_eq!(rebase.replaying, Some(oid(root, "local")));
        assert_eq!(rebase.editor_steps_ahead, expected, "{chain_step}");
    }
}
