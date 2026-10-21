use std::fs;
use std::path::Path;

use crate::{
    ConflictFile, Result, TempDir, commit_side, conflict_repo, diverged_repo, empty_repo, git_ok,
    stopped,
};

/// The file a sequence's step 2 conflicts in, whatever step 1's conflict was resolved to.
pub const STEP_TWO_FILE: &str = "steps.txt";
const STEP_THREE_FILE: &str = "step-three.txt";
/// Step 1's message in every sequence: a subject and a body.
pub const STEP_ONE_MESSAGE: &str = "step 1\n\nThe first step's body.";
const REWORD_STEP_THREE: &str = "sequence.editor=sed -i -e 3s/^pick/reword/";
const SQUASH_STEP_TWO: &str = "sequence.editor=sed -i -e 2s/^pick/squash/";
const EDIT_STEP_ONE: &str = "sequence.editor=sed -i -e 1s/^pick/edit/";

/// What stopped on the scripted conflicts. Sequences (every rebase but `RebaseMerges`, the
/// ranges, `Am`) run three steps: step 1 conflicts in the caller's files, step 2 in
/// `STEP_TWO_FILE`, step 3 applies cleanly.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Run {
    Merge,
    /// `merge --squash` of the three steps.
    SquashMerge,
    Rebase,
    RebaseApply,
    /// The merge backend with step 3 turned into a `reword`, left in the todo at both stops.
    RebaseInteractive,
    /// The merge backend with step 2 turned into a `squash` into step 1.
    RebaseSquash,
    RebaseMerges,
    CherryPick,
    CherryPickRange,
    Revert,
    RevertRange,
    Am,
    StashPop,
}

/// A repository where `run` stopped on conflicts; HEAD's side of each file is `local`, the
/// applied side `remote`, the merge base `base`, as in `conflict_repo`.
pub fn operation_repo(run: Run, files: &[ConflictFile]) -> Result<TempDir> {
    let dir = ready_repo(run, files)?;
    start(run, dir.path())?;
    Ok(dir)
}

/// The repository `run` starts in: everything committed (a stash for `StashPop`), nothing run yet.
pub fn ready_repo(run: Run, files: &[ConflictFile]) -> Result<TempDir> {
    match run {
        Run::Merge => diverged_repo(files),
        Run::SquashMerge
        | Run::Rebase
        | Run::RebaseApply
        | Run::RebaseInteractive
        | Run::RebaseSquash
        | Run::CherryPick
        | Run::CherryPickRange
        | Run::Am => sequence_repo(files),
        Run::RebaseMerges => merge_commit_repo(files),
        Run::Revert | Run::RevertRange => reverting_repo(files),
        Run::StashPop => stashed_repo(files),
    }
}

/// Runs `run` in the repository `ready_repo` built; it must stop on conflicts.
pub fn start(run: Run, root: &Path) -> Result<()> {
    match run {
        Run::Merge => stopped(run, root, &["merge", "--quiet", "remote"], None),
        Run::SquashMerge => stopped(run, root, &["merge", "--squash", "remote"], None),
        Run::Rebase => stopped(run, root, &["rebase", "local", "remote"], None),
        Run::RebaseApply => stopped(run, root, &["rebase", "--apply", "local", "remote"], None),
        Run::RebaseInteractive => interactive(run, root, REWORD_STEP_THREE),
        Run::RebaseSquash => interactive(run, root, SQUASH_STEP_TWO),
        Run::RebaseMerges => {
            let args = [
                "rebase", "--quiet", "-r", "--onto", "local", "HEAD^", "merged",
            ];
            stopped(run, root, &args, None)
        }
        Run::CherryPick => stopped(run, root, &["cherry-pick", "remote~2"], None),
        Run::CherryPickRange => stopped(run, root, &["cherry-pick", "main..remote"], None),
        Run::Revert => stopped(run, root, &["revert", "HEAD~1"], None),
        Run::RevertRange => stopped(run, root, &["revert", "HEAD~4..HEAD~1"], None),
        Run::Am => {
            let mailbox = git_ok(root, &["format-patch", "--stdout", "main..remote"])?;
            stopped(run, root, &["am", "-3"], Some(&mailbox))
        }
        Run::StashPop => stopped(run, root, &["stash", "pop", "--quiet"], None),
    }
}

fn interactive(run: Run, root: &Path, sequence_editor: &str) -> Result<()> {
    let args = ["-c", sequence_editor, "rebase", "-i", "local", "remote"];
    stopped(run, root, &args, None)
}

/// A rebase of branch `remote` onto `main` stopped, without a conflict, at an `edit` of step 1: HEAD is step 1.
pub fn edit_stop_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = sequence_repo(files)?;
    git_ok(
        dir.path(),
        &["-c", EDIT_STEP_ONE, "rebase", "-i", "main", "remote"],
    )?;
    Ok(dir)
}

fn sequence_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = empty_repo()?;
    let root = dir.path();
    stage_file(root, STEP_TWO_FILE, b"base\n")?;
    commit_side(root, files, |file| file.base, "base")?;
    git_ok(root, &["checkout", "--quiet", "-b", "local"])?;
    stage_file(root, STEP_TWO_FILE, b"local\n")?;
    commit_side(root, files, |file| file.local, "local")?;
    git_ok(root, &["checkout", "--quiet", "-b", "remote", "main"])?;
    commit_side(root, files, |file| file.remote, STEP_ONE_MESSAGE)?;
    stage_file(root, STEP_TWO_FILE, b"remote\n")?;
    git_ok(root, &["commit", "--quiet", "-m", "step 2"])?;
    stage_file(root, STEP_THREE_FILE, b"three\n")?;
    git_ok(root, &["commit", "--quiet", "-m", "step 3"])?;
    git_ok(root, &["checkout", "--quiet", "local"])?;
    Ok(dir)
}

/// Branch `merged` holds the merge of `remote` into `local`; HEAD is one commit on top of `local`,
/// so `git rebase -r` re-does that merge and stops on its conflicts (`MERGE_HEAD` and `REBASE_HEAD`).
fn merge_commit_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = conflict_repo(files)?;
    let root = dir.path();
    commit_side(root, files, |file| file.local, "merge")?;
    git_ok(root, &["branch", "--quiet", "merged"])?;
    git_ok(root, &["reset", "--quiet", "--hard", "HEAD^"])?;
    git_ok(root, &["commit", "--quiet", "--allow-empty", "-m", "onto"])?;
    Ok(dir)
}

// git reverts a range newest first (gitio's `revert_range_progress_moves_from_one_to_two_of_three`),
// so HEAD~4..HEAD~1 meets step 1, then step 2, then step 3.
fn reverting_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = empty_repo()?;
    let root = dir.path();
    stage_file(root, STEP_TWO_FILE, b"before\n")?;
    commit_side(root, files, |file| file.remote, "before")?;
    stage_file(root, STEP_THREE_FILE, b"three\n")?;
    git_ok(root, &["commit", "--quiet", "-m", "step 3"])?;
    stage_file(root, STEP_TWO_FILE, b"reverted\n")?;
    git_ok(root, &["commit", "--quiet", "-m", "step 2"])?;
    commit_side(root, files, |file| file.base, STEP_ONE_MESSAGE)?;
    stage_file(root, STEP_TWO_FILE, b"local\n")?;
    commit_side(root, files, |file| file.local, "local")?;
    Ok(dir)
}

fn stashed_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = diverged_repo(files)?;
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "--detach", "main"])?;
    git_ok(root, &["read-tree", "--reset", "-u", "remote"])?;
    git_ok(root, &["stash", "--quiet"])?;
    git_ok(root, &["checkout", "--quiet", "local"])?;
    Ok(dir)
}

fn stage_file(root: &Path, path: &str, bytes: &[u8]) -> Result<()> {
    fs::write(root.join(path), bytes)?;
    git_ok(root, &["add", "--", path])?;
    Ok(())
}
