//! Test fixture: real git repositories whose merge stops with scripted conflicts.
#![forbid(unsafe_code)]

mod operation;
mod rerere;

use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};

pub use operation::{
    Run, STEP_ONE_MESSAGE, STEP_TWO_FILE, edit_stop_repo, operation_repo, ready_repo, start,
};
pub use rerere::{Remembered, Replay, rerere_repo};
pub use tempfile::TempDir;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("i/o error while running git: {0}")]
    Io(#[from] std::io::Error),
    #[error("`git {}` failed: {stderr}", args.join(" "))]
    GitFailed { args: Vec<String>, stderr: String },
    #[error("`{run:?}` did not stop on conflicts")]
    DidNotStop { run: Run },
    #[error("git started without a stdin pipe")]
    NoStdin,
    #[error("the ignored tests run in a child did not all pass:\n{output}")]
    ChildTestsFailed { output: String },
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

const SUBMODULE_MODE: &str = "160000";
const GITATTRIBUTES: &str = ".gitattributes";
const HASH_OBJECT_ARGS: [&str; 2] = ["hash-object", "--stdin"];
const REPOSITORY_CONFIG: [(&str, &str); 4] = [
    ("core.autocrlf", "false"),
    ("user.name", "yamt test"),
    ("user.email", "test@yamt.invalid"),
    ("commit.gpgsign", "false"),
];
const HOOKS_DIR: &str = ".git/hooks";
#[cfg(unix)]
const HOOK_MODE: u32 = 0o755;

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
    /// Unix only: Windows creates a symlink only in Developer Mode or with an admin right (`CreateSymbolicLinkW`).
    #[cfg(unix)]
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
        .env("GIT_EDITOR", ":")
        .env_remove("GIT_SEQUENCE_EDITOR")
        .env_remove("GIT_CONFIG_PARAMETERS")
        .env_remove("GIT_CONFIG_COUNT");
    for (key, value) in REPOSITORY_CONFIG {
        command.arg("-c").arg(format!("{key}={value}"));
    }
    command.args([
        "-c",
        "init.defaultBranch=main",
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
    let output = git_with_input(dir, &HASH_OBJECT_ARGS, content)?;
    let stdout = stdout_or_failure(&HASH_OBJECT_ARGS, output)?;
    Ok(String::from_utf8_lossy(&stdout).trim_end().to_owned())
}

fn git_with_input(dir: &Path, args: &[&str], input: &[u8]) -> Result<Output> {
    let mut child = isolated_git(dir)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let mut stdin = child.stdin.take().ok_or(Error::NoStdin)?;
    stdin.write_all(input)?;
    drop(stdin);
    Ok(child.wait_with_output()?)
}

/// What a test sets before the merge runs: repository config (also in force for the merge, so it
/// wins over the fixture's own `core.autocrlf=false`) and a `.gitattributes` committed with base.
#[derive(Clone, Copy, Debug, Default)]
pub struct Setup<'a> {
    pub config: &'a [(&'a str, &'a str)],
    pub attributes: Option<&'a str>,
}

/// A repo where `git merge remote` on branch `local` has stopped with `files` conflicted.
pub fn conflict_repo(files: &[ConflictFile]) -> Result<TempDir> {
    conflict_repo_with(files, &Setup::default())
}

/// `conflict_repo`, with `setup` applied before the merge.
pub fn conflict_repo_with(files: &[ConflictFile], setup: &Setup) -> Result<TempDir> {
    let dir = diverged_repo_with(files, setup)?;
    let mut merge_args: Vec<String> = Vec::new();
    for (key, value) in setup.config {
        git_ok(dir.path(), &["config", key, value])?;
        merge_args.extend(["-c".to_owned(), format!("{key}={value}")]);
    }
    merge_args.extend(["merge", "--quiet", "remote"].map(str::to_owned));
    let merge_args: Vec<&str> = merge_args.iter().map(String::as_str).collect();
    stopped(Run::Merge, dir.path(), &merge_args, None)?;
    Ok(dir)
}

/// A repo on branch `local` with commits `base` (branch `main`), `local` and `remote` (branch `remote`), not merged.
pub fn diverged_repo(files: &[ConflictFile]) -> Result<TempDir> {
    diverged_repo_with(files, &Setup::default())
}

fn diverged_repo_with(files: &[ConflictFile], setup: &Setup) -> Result<TempDir> {
    let dir = empty_repo()?;
    let root = dir.path();
    if let Some(attributes) = setup.attributes {
        fs::write(root.join(GITATTRIBUTES), attributes)?;
        git_ok(root, &["add", "--", GITATTRIBUTES])?;
    }
    commit_side(root, files, |file| file.base, "base")?;
    git_ok(root, &["checkout", "--quiet", "-b", "local"])?;
    commit_side(root, files, |file| file.local, "local")?;
    git_ok(root, &["checkout", "--quiet", "-b", "remote", "main"])?;
    commit_side(root, files, |file| file.remote, "remote")?;
    git_ok(root, &["checkout", "--quiet", "local"])?;
    Ok(dir)
}

/// A new repository with no commit. Its own config names the committer and turns signing off, so
/// that git run outside this sandbox (`yamt_gitio::Repo`) can commit in it too.
fn empty_repo() -> Result<TempDir> {
    let dir = tempfile::tempdir()?;
    let root = dir.path();
    git_ok(root, &["init", "--quiet"])?;
    for (key, value) in REPOSITORY_CONFIG {
        git_ok(root, &["config", key, value])?;
    }
    Ok(dir)
}

/// Installs `script` as the hook `name` and points `core.hooksPath` at it, over any user setting.
pub fn install_hook(root: &Path, name: &str, script: &str) -> Result<()> {
    let hooks = root.join(HOOKS_DIR);
    fs::create_dir_all(&hooks)?;
    let hook = hooks.join(name);
    fs::write(&hook, script)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook, fs::Permissions::from_mode(HOOK_MODE))?;
    }
    git_ok(root, &["config", "core.hooksPath", HOOKS_DIR])?;
    Ok(())
}

/// `git` with `args` (and `stdin` when given), which must stop on conflicts: a non-zero exit.
pub(crate) fn stopped(run: Run, root: &Path, args: &[&str], stdin: Option<&[u8]>) -> Result<()> {
    let output = match stdin {
        Some(input) => git_with_input(root, args, input)?,
        None => git(root, args)?,
    };
    if output.status.success() {
        return Err(Error::DidNotStop { run });
    }
    Ok(())
}

/// Runs `tests`, ignored tests of the running test binary named exactly, one at a time in a child process
/// that `configure` sets up; `ChildTestsFailed` with the child's output unless every one passed.
pub fn run_ignored_in_child(tests: &[&str], configure: impl FnOnce(&mut Command)) -> Result<()> {
    let mut child = Command::new(std::env::current_exe()?);
    child
        .args(["--ignored", "--exact", "--test-threads=1"])
        .args(tests);
    configure(&mut child);
    let output = child.output()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let all_passed = format!("test result: ok. {} passed", tests.len());
    if output.status.success() && stdout.contains(&all_passed) {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(Error::ChildTestsFailed {
        output: format!("{stdout}{stderr}"),
    })
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
        #[cfg(unix)]
        FileKind::Symlink => {
            if worktree_file.symlink_metadata().is_ok() {
                fs::remove_file(&worktree_file)?;
            }
            link_to(bytes, &worktree_file)?;
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

#[cfg(unix)]
fn link_to(target: &[u8], link: &Path) -> std::io::Result<()> {
    use std::os::unix::ffi::OsStrExt;
    std::os::unix::fs::symlink(std::ffi::OsStr::from_bytes(target), link)
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

        let ran = run_ignored_in_child(&[CHILD_TEST], |child| {
            child
                .env("XDG_CONFIG_HOME", xdg_config_home.path())
                .env("GIT_CONFIG_PARAMETERS", "'merge.conflictstyle'='diff3'")
                .env("GIT_CONFIG_COUNT", "1")
                .env("GIT_CONFIG_KEY_0", "merge.conflictStyle")
                .env("GIT_CONFIG_VALUE_0", "zdiff3");
        });

        ran.unwrap_or_else(|error| panic!("{error}"));
    }

    // An `--exact` name that matches no test runs nothing, and the child still exits 0 with "0 passed".
    #[test]
    fn a_child_that_ran_no_test_is_an_error() {
        let ran = run_ignored_in_child(&["tests::no_such_test"], |_| {});

        assert!(
            matches!(ran, Err(Error::ChildTestsFailed { .. })),
            "{ran:?}"
        );
    }
}
