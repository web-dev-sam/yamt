#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use tempfile::TempDir;

mod yamt_cli;

use yamt_cli::{path, yamt_cli};

const LEFT: &str = "a\nb\nc\nd\ne\nf\ng\nh\ni\n";
const RIGHT: &str = "a\nB\nc\nX\nd\ne\ng\nH\ni\n";

fn write_compare_case(root: &Path) -> PathBuf {
    let dir = root.join("pair");
    fs::create_dir(&dir).unwrap();
    fs::write(dir.join("left.txt"), LEFT).unwrap();
    fs::write(dir.join("right.txt"), RIGHT).unwrap();
    dir
}

// Catches the compare fixtures losing a text or the differences, swapping the columns, or changing
// between two runs of `just fixtures` (which `just fixtures-check` would report as a stale file).
#[test]
fn compare_prints_both_texts_and_their_differences_the_same_way_twice() {
    let root = TempDir::new().unwrap();
    let case = write_compare_case(root.path());

    let output = yamt_cli(&["compare", path(&case)]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(output.stdout.ends_with("}\n"));
    let data: Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(data["left"], LEFT);
    assert_eq!(data["right"], RIGHT);
    let ranges: Vec<(&Value, &Value)> = data["differences"]
        .as_array()
        .unwrap()
        .iter()
        .map(|difference| (&difference["left"], &difference["right"]))
        .collect();
    let lines = |start: u32, len: u32| json!({ "start": start, "len": len });
    assert_eq!(
        ranges,
        [
            (&lines(1, 1), &lines(1, 1)),
            (&lines(3, 0), &lines(3, 1)),
            (&lines(5, 1), &lines(6, 0)),
            (&lines(7, 1), &lines(7, 1))
        ]
    );
    assert_eq!(yamt_cli(&["compare", path(&case)]).stdout, output.stdout);
}

// Catches a missing column read as empty text, which would show every line as inserted.
#[test]
fn compare_fails_with_a_read_error_without_right_txt() {
    let root = TempDir::new().unwrap();
    let case = write_compare_case(root.path());
    let right = case.join("right.txt");
    fs::remove_file(&right).unwrap();

    let output = yamt_cli(&["compare", path(&case)]);

    assert_eq!(output.code, 1);
    assert_eq!(output.stdout, "");
    let os_error = fs::read(&right).unwrap_err();
    assert_eq!(
        output.stderr,
        format!("yamt-cli: cannot read {}: {os_error}\n", path(&right))
    );
}
