//! Test fixture: real git repositories whose merge stops with scripted conflicts.
#![forbid(unsafe_code)]

use std::ffi::OsStr;
use std::fs;
use std::io::Write;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::symlink;
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
    #[error("`git hash-object` started without a stdin pipe")]
    NoStdin,
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

const SUBMODULE_MODE: &str = "160000";
const HASH_OBJECT_ARGS: [&str; 2] = ["hash-object", "--stdin"];

/// One path in the scripted merge; `None` means the file does not exist on that side.
#[derive(Clone, Copy, Debug)]
pub struct ConflictFile<'a> {
    pub path: &'a str,
    pub kind: FileKind,
    pub base: Option<&'a [u8]>,
    pub local: Option<&'a [u8]>,
    pub remote: Option<&'a [u8]>,
}

/// What a side's bytes are: file content, a symlink's target, or a submodule's commit oid in hex.
#[derive(Clone, Copy, Debug)]
pub enum FileKind {
    Regular,
    Symlink,
    Submodule,
}

fn isolated_git(dir: &Path) -> Command {
    let mut command = Command::new("git");
    command
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("LC_ALL", "C")
        .env_remove("GIT_CONFIG_PARAMETERS")
        .env_remove("GIT_CONFIG_COUNT")
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
        .args(["-c", "core.autocrlf=false"])
        .args([
            "-c",
            "core.attributesFile=/dev/null",
            "-c",
            "core.excludesFile=/dev/null",
        ]);
    command
}

pub fn git(dir: &Path, args: &[&str]) -> Result<Output> {
    Ok(isolated_git(dir).args(args).output()?)
}

pub fn git_ok(dir: &Path, args: &[&str]) -> Result<Vec<u8>> {
    stdout_or_failure(args, git(dir, args)?)
}

fn stdout_or_failure(args: &[&str], output: Output) -> Result<Vec<u8>> {
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
        .args(HASH_OBJECT_ARGS)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let mut stdin = child.stdin.take().ok_or(Error::NoStdin)?;
    stdin.write_all(content)?;
    drop(stdin);
    let stdout = stdout_or_failure(&HASH_OBJECT_ARGS, child.wait_with_output()?)?;
    Ok(String::from_utf8_lossy(&stdout).trim_end().to_owned())
}

/// A repo where `git merge remote` on branch `local` has stopped with `files` conflicted.
pub fn conflict_repo(files: &[ConflictFile]) -> Result<TempDir> {
    let dir = diverged_repo(files)?;
    let merge = git(dir.path(), &["merge", "--quiet", "remote"])?;
    if merge.status.success() {
        return Err(Error::MergeDidNotConflict);
    }
    Ok(dir)
}

/// A repo on branch `local` with commits `base` (branch `main`), `local` and `remote` (branch `remote`), not merged.
pub fn diverged_repo(files: &[ConflictFile]) -> Result<TempDir> {
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
    Ok(dir)
}

fn commit_side<'a>(
    root: &Path,
    files: &[ConflictFile<'a>],
    side: fn(&ConflictFile<'a>) -> Option<&'a [u8]>,
    message: &str,
) -> Result<()> {
    for file in files {
        match side(file) {
            Some(bytes) => write_side(root, file, bytes)?,
            None => {
                git_ok(
                    root,
                    &["rm", "--quiet", "--ignore-unmatch", "--", file.path],
                )?;
            }
        }
    }
    git_ok(root, &["commit", "--quiet", "--allow-empty", "-m", message])?;
    Ok(())
}

fn write_side(root: &Path, file: &ConflictFile, bytes: &[u8]) -> Result<()> {
    let worktree_file = root.join(file.path);
    if let Some(parent) = worktree_file.parent() {
        fs::create_dir_all(parent)?;
    }
    match file.kind {
        FileKind::Regular => {
            fs::write(&worktree_file, bytes)?;
            git_ok(root, &["add", "--", file.path])?;
        }
        FileKind::Symlink => {
            if worktree_file.symlink_metadata().is_ok() {
                fs::remove_file(&worktree_file)?;
            }
            symlink(OsStr::from_bytes(bytes), &worktree_file)?;
            git_ok(root, &["add", "--", file.path])?;
        }
        FileKind::Submodule => {
            fs::create_dir_all(&worktree_file)?;
            let oid = String::from_utf8_lossy(bytes);
            let cacheinfo = format!("{SUBMODULE_MODE},{oid},{}", file.path);
            git_ok(root, &["update-index", "--add", "--cacheinfo", &cacheinfo])?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const CHILD_TEST: &str = "tests::ordinary_conflict_in_the_inherited_environment";

    #[test]
    #[ignore = "run by hostile_user_git_environment_does_not_reach_the_conflict_repo"]
    fn ordinary_conflict_in_the_inherited_environment() {
        let repo = conflict_repo(&[ConflictFile {
            path: "notes.txt",
            kind: FileKind::Regular,
            base: Some(b"base\n"),
            local: Some(b"local\n"),
            remote: Some(b"remote\n"),
        }])
        .unwrap();
        let merged = fs::read_to_string(repo.path().join("notes.txt")).unwrap();
        for marker in ["<<<<<<< ", "=======\n", ">>>>>>> "] {
            assert!(merged.contains(marker), "no `{marker}` in:\n{merged}");
        }
        assert!(!merged.contains("|||||||"), "base section in:\n{merged}");
        let stages = git_ok(repo.path(), &["ls-files", "-u", "--format=%(stage)"]).unwrap();
        assert_eq!(String::from_utf8_lossy(&stages), "1\n2\n3\n");
    }

    #[test]
    fn hostile_user_git_environment_does_not_reach_the_conflict_repo() {
        let xdg_config_home = tempfile::tempdir().unwrap();
        let git_dir = xdg_config_home.path().join("git");
        fs::create_dir(&git_dir).unwrap();
        fs::write(git_dir.join("attributes"), "* -merge\n").unwrap();
        fs::write(git_dir.join("ignore"), "*\n").unwrap();
        let child = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", CHILD_TEST, "--ignored"])
            .env("XDG_CONFIG_HOME", xdg_config_home.path())
            .env("GIT_CONFIG_PARAMETERS", "'merge.conflictstyle'='diff3'")
            .env("GIT_CONFIG_COUNT", "1")
            .env("GIT_CONFIG_KEY_0", "merge.conflictStyle")
            .env("GIT_CONFIG_VALUE_0", "zdiff3")
            .output()
            .unwrap();
        let stdout = String::from_utf8_lossy(&child.stdout);
        assert!(
            child.status.success() && stdout.contains("test result: ok. 1 passed"),
            "{stdout}{}",
            String::from_utf8_lossy(&child.stderr)
        );
    }
}
