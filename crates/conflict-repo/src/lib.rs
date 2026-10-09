//! Test fixture: real git repositories whose merge stops with scripted conflicts.
#![forbid(unsafe_code)]

use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};

pub use tempfile::TempDir;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("i/o error while running git: {0}")]
    Io(#[from] std::io::Error),
    #[error("`git {}` failed: {stderr}", args.join(" "))]
    GitFailed { args: Vec<String>, stderr: String },
    #[error("merging `remote` into `local` did not conflict")]
    MergeDidNotConflict,
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

/// One path in the scripted merge; `None` means the file does not exist on that side.
#[derive(Clone, Copy, Debug)]
pub struct ConflictFile<'a> {
    pub path: &'a str,
    pub base: Option<&'a [u8]>,
    pub local: Option<&'a [u8]>,
    pub remote: Option<&'a [u8]>,
}

fn isolated_git(dir: &Path) -> Command {
    let mut command = Command::new("git");
    command
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("LC_ALL", "C")
        .args([
            "-c",
            "user.name=yamt test",
            "-c",
            "user.email=test@yamt.invalid",
        ])
        .args([
            "-c",
            "init.defaultBranch=main",
            "-c",
            "commit.gpgsign=false",
        ])
        .args(["-c", "core.autocrlf=false"]);
    command
}

pub fn git(dir: &Path, args: &[&str]) -> Result<Output> {
    Ok(isolated_git(dir).args(args).output()?)
}

pub fn git_ok(dir: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let output = git(dir, args)?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(Error::GitFailed {
            args: args.iter().map(|arg| (*arg).to_owned()).collect(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

pub fn hash_object(dir: &Path, content: &[u8]) -> Result<String> {
    let mut child = isolated_git(dir)
        .args(["hash-object", "--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(content)?;
    }
    let output = child.wait_with_output()?;
    Ok(String::from_utf8_lossy(&output.stdout)
        .trim_end()
        .to_owned())
}

/// A repo where `git merge remote` on branch `local` has stopped with `files` conflicted.
pub fn conflict_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = tempfile::tempdir()?;
    let root = dir.path();
    git_ok(root, &["init", "--quiet"])?;
    git_ok(root, &["config", "core.autocrlf", "false"])?;
    commit_side(root, files, |file| file.base, "base")?;
    git_ok(root, &["checkout", "--quiet", "-b", "local"])?;
    commit_side(root, files, |file| file.local, "local")?;
    git_ok(root, &["checkout", "--quiet", "-b", "remote", "main"])?;
    commit_side(root, files, |file| file.remote, "remote")?;
    git_ok(root, &["checkout", "--quiet", "local"])?;
    let merge = git(root, &["merge", "--quiet", "remote"])?;
    if merge.status.success() {
        return Err(Error::MergeDidNotConflict);
    }
    Ok(dir)
}

fn commit_side<'a>(
    root: &Path,
    files: &[ConflictFile<'a>],
    side: fn(&ConflictFile<'a>) -> Option<&'a [u8]>,
    message: &str,
) -> Result<()> {
    for file in files {
        let worktree_file = root.join(file.path);
        match side(file) {
            Some(bytes) => {
                if let Some(parent) = worktree_file.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::write(&worktree_file, bytes)?;
                git_ok(root, &["add", "--", file.path])?;
            }
            None => {
                if worktree_file.exists() {
                    git_ok(root, &["rm", "--quiet", "--", file.path])?;
                }
            }
        }
    }
    git_ok(root, &["commit", "--quiet", "--allow-empty", "-m", message])?;
    Ok(())
}
