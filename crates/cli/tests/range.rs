#![cfg(test)]

use serde_json::{Value, json};
use tempfile::TempDir;
use yamt_conflict_repo::{ConflictFile, FileKind, diverged_repo};

mod yamt_cli;

use yamt_cli::{path, yamt_cli};

fn changed<'a>(path: &'a str, base: Option<&'a [u8]>, local: Option<&'a [u8]>) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote: base,
    }
}

fn three_file_repo() -> TempDir {
    diverged_repo(&[
        changed("a.txt", Some(b"one\ntwo\n"), Some(b"one\n2\n")),
        changed("b.txt", Some(b"gone\n"), None),
        changed("c.bin", None, Some(b"\0bytes")),
    ])
    .unwrap()
}

// Catches a file answer printed out of list order, so the window's id (the index) would show another file.
#[test]
fn range_prints_the_start_and_every_file_at_its_id() {
    let root = three_file_repo();

    let output = yamt_cli(&["range", path(root.path()), "main..local"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    let data: Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(data["start"]["range"], "main..local");
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

// Catches a range git cannot resolve exiting 1 like a read failure.
#[test]
fn an_unknown_name_exits_2_with_the_range_error() {
    let root = three_file_repo();

    let output = yamt_cli(&["range", path(root.path()), "nope..local"]);

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
