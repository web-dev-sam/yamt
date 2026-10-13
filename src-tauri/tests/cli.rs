#![cfg(test)]

use std::process::{Command, Output};

use yamt_conflict_repo::{TempDir, git_ok};

fn yamt(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_yamt"))
        .args(args)
        .env_remove("YAMT_LOG")
        .output()
        .unwrap()
}

fn stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
}

#[test]
fn help_prints_usage_and_exits_zero() {
    let output = yamt(&["--help"]);
    assert_eq!(output.status.code(), Some(0));
    assert!(String::from_utf8_lossy(&output.stdout).starts_with("usage: yamt [--repo <path>]"));
}

#[test]
fn version_prints_the_workspace_version() {
    let output = yamt(&["--version"]);
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(
        String::from_utf8_lossy(&output.stdout),
        format!("yamt {}\n", env!("CARGO_PKG_VERSION"))
    );
}

#[test]
fn usage_errors_exit_two_with_usage_on_stderr() {
    for args in [&["--repo"][..], &["--bogus"]] {
        let output = yamt(args);
        assert_eq!(output.status.code(), Some(2), "{args:?}");
        assert!(
            stderr(&output).contains("usage: yamt"),
            "{}",
            stderr(&output)
        );
    }
}

#[test]
fn repository_without_conflicts_exits_zero_with_nothing_to_merge() {
    let dir = TempDir::new().unwrap();
    git_ok(dir.path(), &["init", "--quiet"]).unwrap();
    let root = dir.path().canonicalize().unwrap();
    let output = yamt(&["--repo", dir.path().to_str().unwrap()]);
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(
        stderr(&output),
        format!("yamt: nothing to merge in {}\n", root.display())
    );
}

#[test]
fn plain_directory_exits_two_with_the_git_error() {
    let dir = TempDir::new().unwrap();
    let output = yamt(&["--repo", dir.path().to_str().unwrap()]);
    assert_eq!(output.status.code(), Some(2));
    let stderr = stderr(&output);
    assert!(stderr.starts_with("yamt: "), "{stderr}");
    assert!(stderr.contains("not a git repository"), "{stderr}");
}
