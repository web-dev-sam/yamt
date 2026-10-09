use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};

use tempfile::TempDir;

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

pub fn git(dir: &Path, args: &[&str]) -> Output {
    isolated_git(dir).args(args).output().unwrap()
}

pub fn git_ok(dir: &Path, args: &[&str]) -> Vec<u8> {
    let output = git(dir, args);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "git {args:?} failed: {stderr}");
    output.stdout
}

pub fn hash_object(dir: &Path, content: &[u8]) -> String {
    let mut child = isolated_git(dir)
        .args(["hash-object", "--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(content).unwrap();
    let output = child.wait_with_output().unwrap();
    String::from_utf8(output.stdout)
        .unwrap()
        .trim_end()
        .to_owned()
}

/// A repo whose `git merge` of branch `remote` into `local` conflicts on `path`.
/// `None` means the file does not exist on that side.
pub fn conflict_repo(
    path: &str,
    base: Option<&[u8]>,
    local: Option<&[u8]>,
    remote: Option<&[u8]>,
) -> TempDir {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    git_ok(root, &["init", "--quiet"]);
    git_ok(root, &["config", "core.autocrlf", "false"]);
    commit_side(root, path, base, "base");
    git_ok(root, &["checkout", "--quiet", "-b", "local"]);
    commit_side(root, path, local, "local");
    git_ok(root, &["checkout", "--quiet", "-b", "remote", "main"]);
    commit_side(root, path, remote, "remote");
    git_ok(root, &["checkout", "--quiet", "local"]);
    let merge = git(root, &["merge", "--quiet", "remote"]);
    assert!(!merge.status.success(), "merge was expected to conflict");
    dir
}

fn commit_side(root: &Path, path: &str, content: Option<&[u8]>, message: &str) {
    let file = root.join(path);
    match content {
        Some(bytes) => {
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(&file, bytes).unwrap();
            git_ok(root, &["add", "--", path]);
        }
        None => {
            if file.exists() {
                git_ok(root, &["rm", "--quiet", "--", path]);
            }
        }
    }
    git_ok(root, &["commit", "--quiet", "--allow-empty", "-m", message]);
}
