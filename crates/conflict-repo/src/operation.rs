use std::fs;
use std::path::Path;

use crate::{
    ConflictFile, Error, Result, TempDir, commit_side, conflict_repo, diverged_repo, git, git_ok,
    git_with_input, rebase_merges_repo,
};

/// The file a sequence's step 2 conflicts in, whatever step 1's conflict was resolved to.
pub const STEP_TWO_FILE: &str = "steps.txt";
const STEP_THREE_FILE: &str = "step-three.txt";
const STEP_ONE_MESSAGE: &str = "step 1\n\nThe first step's body.";
const REWORD_STEP_THREE: &str = "sequence.editor=sed -i -e 3s/^pick/reword/";

/// What stopped on the scripted conflicts. Sequences (every rebase but `RebaseMerges`, the
/// ranges, `Am`) run three steps: step 1 conflicts in the caller's files, step 2 in
/// `STEP_TWO_FILE`, step 3 applies cleanly.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Run {
    Merge,
    SquashMerge,
    Rebase,
    RebaseApply,
    /// The merge backend with step 3 turned into a `reword`, left in the todo at both stops.
    RebaseInteractive,
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
    match run {
        Run::Merge => conflict_repo(files),
        Run::SquashMerge => stopped(run, diverged_repo(files)?, &["merge", "--squash", "remote"]),
        Run::Rebase => stopped(run, sequence_repo(files)?, &["rebase", "local", "remote"]),
        Run::RebaseApply => stopped(
            run,
            sequence_repo(files)?,
            &["rebase", "--apply", "local", "remote"],
        ),
        Run::RebaseInteractive => stopped(
            run,
            sequence_repo(files)?,
            &["-c", REWORD_STEP_THREE, "rebase", "-i", "local", "remote"],
        ),
        Run::RebaseMerges => rebase_merges_repo(files),
        Run::CherryPick => stopped(run, sequence_repo(files)?, &["cherry-pick", "remote~2"]),
        Run::CherryPickRange => {
            stopped(run, sequence_repo(files)?, &["cherry-pick", "main..remote"])
        }
        Run::Revert => stopped(run, reverting_repo(files)?, &["revert", "HEAD~1"]),
        Run::RevertRange => stopped(run, reverting_repo(files)?, &["revert", "HEAD~4..HEAD~1"]),
        Run::Am => am_repo(files),
        Run::StashPop => stash_pop_repo(files),
    }
}

fn stopped(run: Run, dir: TempDir, args: &[&str]) -> Result<TempDir> {
    if git(dir.path(), args)?.status.success() {
        return Err(Error::DidNotStop { run });
    }
    Ok(dir)
}

fn sequence_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = tempfile::tempdir()?;
    let root = dir.path();
    git_ok(root, &["init", "--quiet"])?;
    git_ok(root, &["config", "core.autocrlf", "false"])?;
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

// git reverts a range newest first (gitio's `revert_range_progress_moves_from_one_to_two_of_three`),
// so HEAD~4..HEAD~1 meets step 1, then step 2, then step 3.
fn reverting_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = tempfile::tempdir()?;
    let root = dir.path();
    git_ok(root, &["init", "--quiet"])?;
    git_ok(root, &["config", "core.autocrlf", "false"])?;
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

fn am_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = sequence_repo(files)?;
    let mailbox = git_ok(dir.path(), &["format-patch", "--stdout", "main..remote"])?;
    if git_with_input(dir.path(), &["am", "-3"], &mailbox)?
        .status
        .success()
    {
        return Err(Error::DidNotStop { run: Run::Am });
    }
    Ok(dir)
}

fn stash_pop_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = diverged_repo(files)?;
    let root = dir.path();
    git_ok(root, &["checkout", "--quiet", "--detach", "main"])?;
    git_ok(root, &["read-tree", "--reset", "-u", "remote"])?;
    git_ok(root, &["stash", "--quiet"])?;
    git_ok(root, &["checkout", "--quiet", "local"])?;
    stopped(Run::StashPop, dir, &["stash", "pop", "--quiet"])
}

fn stage_file(root: &Path, path: &str, bytes: &[u8]) -> Result<()> {
    fs::write(root.join(path), bytes)?;
    git_ok(root, &["add", "--", path])?;
    Ok(())
}
