#![cfg(test)]

use std::fs;
use std::path::Path;
use std::process::Command;

use serde_json::{Value, json};
use tempfile::TempDir;

mod yamt_cli;

use yamt_cli::{path, yamt_cli};

fn git(repo: &Path, args: &[&str]) {
    let status = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args([
            "-c",
            "user.name=yamt",
            "-c",
            "user.email=yamt@example.invalid",
            "-c",
            "commit.gpgsign=false",
        ])
        .args(args)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?}");
}

fn two_commit_repo(root: &Path) {
    git(root, &["init", "-q"]);
    fs::write(root.join("a.txt"), "one\ntwo\n").unwrap();
    fs::write(root.join("b.txt"), "gone\n").unwrap();
    git(root, &["add", "."]);
    git(root, &["commit", "-q", "-m", "first"]);
    fs::write(root.join("a.txt"), "one\n2\n").unwrap();
    fs::remove_file(root.join("b.txt")).unwrap();
    fs::write(root.join("c.bin"), b"\0bytes").unwrap();
    git(root, &["add", "-A"]);
    git(root, &["commit", "-q", "-m", "second"]);
}

// Catches a file answer printed out of list order, so the window's id (the index) would show another file.
#[test]
fn range_prints_the_start_and_every_file_at_its_id() {
    let root = TempDir::new().unwrap();
    two_commit_repo(root.path());

    let output = yamt_cli(&["range", path(root.path()), "HEAD~1..HEAD"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    let data: Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(data["start"]["range"], "HEAD~1..HEAD");
    let listed: Vec<(&Value, &Value)> = data["start"]["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| (&entry["id"], &entry["path"]))
        .collect();
    assert_eq!(
        listed,
        [
            (&json!(0), &json!("a.txt")),
            (&json!(1), &json!("b.txt")),
            (&json!(2), &json!("c.bin"))
        ]
    );
    let files = data["files"].as_array().unwrap();
    assert_eq!(files.len(), 3);
    assert_eq!(files[0]["left"], "one\ntwo\n");
    assert_eq!(files[0]["right"], "one\n2\n");
    assert_eq!(files[1]["left"], "gone\n");
    assert_eq!(files[1]["right"], "");
    assert_eq!(files[2], json!({ "kind": "binary" }));
}

// Catches a malformed range reaching git, or failing without the usage that says how to type one.
#[test]
fn a_malformed_range_exits_2_with_its_usage_line() {
    let root = TempDir::new().unwrap();

    let output = yamt_cli(&["range", path(root.path()), "main"]);

    assert_eq!(output.code, 2);
    assert_eq!(output.stdout, "");
    assert!(
        output.stderr.starts_with(
            "yamt-cli: --diff=main: a range needs two dots (a..b) or three (a...b); \
             yamt does not compare the working tree\nusage:"
        ),
        "{}",
        output.stderr
    );
    assert!(
        output
            .stderr
            .contains("  yamt-cli range <repo-dir> <range>")
    );
}

// Catches a range git cannot resolve exiting 1 like a read failure, or printing a half document.
#[test]
fn an_unknown_name_exits_2_with_the_range_error() {
    let root = TempDir::new().unwrap();
    two_commit_repo(root.path());

    let output = yamt_cli(&["range", path(root.path()), "nope..HEAD"]);

    assert_eq!(output.code, 2);
    assert_eq!(output.stdout, "");
    assert_eq!(output.stderr, "yamt-cli: git names no commit \"nope\"\n");
}

#[test]
fn range_without_both_arguments_is_a_usage_error() {
    let output = yamt_cli(&["range", "."]);

    assert_eq!(output.code, 2);
    assert!(
        output
            .stderr
            .starts_with("yamt-cli: range needs exactly <repo-dir> <range>\nusage:"),
        "{}",
        output.stderr
    );
}
