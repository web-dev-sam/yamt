#![cfg(test)]

use std::fs;
use std::path::Path;

use serde_json::{Value, json};
use tempfile::TempDir;
use yamt_conflict_repo::{ConflictFile, FileKind, conflict_repo};

mod yamt_cli;

use yamt_cli::{Output, path, yamt_cli};

const BASE: &str = "a\nb\nc\nd\ne\nf\ng\nh\ni\n";
const LOCAL: &str = "a\nB\nc\nd\ne\nf\ng\nL\ni\n";
const REMOTE: &str = "a\nb\nc\nd\nE\nf\ng\nR\ni\n";

fn write_case(root: &Path, name: &str, extension: &str) -> std::path::PathBuf {
    let dir = root.join(name);
    fs::create_dir(&dir).unwrap();
    for (side, text) in [("base", BASE), ("local", LOCAL), ("remote", REMOTE)] {
        fs::write(dir.join(format!("{side}.{extension}")), text).unwrap();
    }
    dir
}

fn classify(extra: &[&str]) -> Output {
    let dir = TempDir::new().unwrap();
    let case = write_case(dir.path(), "triple", "txt");
    let sides = ["base", "local", "remote"].map(|side| case.join(format!("{side}.txt")));
    let mut args = vec![
        "classify",
        path(&sides[0]),
        path(&sides[1]),
        path(&sides[2]),
    ];
    args.extend_from_slice(extra);
    yamt_cli(&args)
}

#[test]
fn classify_prints_one_row_per_chunk_and_a_summary_per_kind() {
    let output = classify(&[]);
    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stdout,
        "0 LocalOnly base[1+1] local[1+1] remote[1+1]\n\
         1 RemoteOnly base[4+1] local[4+1] remote[4+1]\n\
         2 Conflict base[7+1] local[7+1] remote[7+1]\n\
         total 3: LocalOnly 1, RemoteOnly 1, BothSame 0, Conflict 1\n"
    );
}

#[test]
fn classify_gap_joins_changes_separated_by_up_to_gap_lines() {
    let output = classify(&["--gap", "2"]);
    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stdout,
        "0 Conflict base[1+7] local[1+7] remote[1+7]\n\
         total 1: LocalOnly 0, RemoteOnly 0, BothSame 0, Conflict 1\n"
    );
}

#[test]
fn classify_json_round_trips_into_the_chunk_array_shape() {
    let output = classify(&["--json"]);
    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(output.stdout.ends_with("]\n"));
    let chunks: Value = serde_json::from_str(&output.stdout).unwrap();
    let range = |start: u32| json!({ "start": start, "len": 1 });
    let chunk = |id: u32, kind: &str, start: u32| json!({ "id": id, "kind": kind, "base": range(start), "local": range(start), "remote": range(start) });
    assert_eq!(
        chunks,
        json!([
            chunk(0, "LocalOnly", 1),
            chunk(1, "RemoteOnly", 4),
            chunk(2, "Conflict", 7)
        ])
    );
}

#[test]
fn unknown_command_is_a_usage_error_with_exit_code_two() {
    let output = yamt_cli(&["frobnicate"]);
    assert_eq!(output.code, 2);
    assert!(
        output
            .stderr
            .starts_with("yamt-cli: unknown command `frobnicate`\nusage:")
    );
}

#[cfg(unix)]
#[test]
fn non_utf8_argument_is_a_usage_error_with_exit_code_two() {
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt;
    let output = yamt_cli(&[OsStr::new("classify"), OsStr::from_bytes(b"\xff")]);
    assert_eq!(output.code, 2);
    assert!(
        output
            .stderr
            .starts_with("yamt-cli: argument `\u{fffd}` is not UTF-8\nusage:"),
        "{}",
        output.stderr
    );
}

#[test]
fn golden_update_then_run_passes_and_an_edited_expected_json_is_a_diff() {
    let root = TempDir::new().unwrap();
    write_case(root.path(), "first", "ts");
    let second = write_case(root.path(), "second", "rs");
    fs::write(root.path().join("README.md"), "not a case").unwrap();

    let update = yamt_cli(&["golden", "update", path(root.path())]);
    assert_eq!(update.code, 0, "{}", update.stderr);
    assert_eq!(update.stdout, "wrote first\nwrote second\n");
    let classified = classify(&["--json"]).stdout;
    assert_eq!(
        fs::read_to_string(second.join("expected.json")).unwrap(),
        classified
    );

    let run = yamt_cli(&["golden", "run", path(root.path())]);
    assert_eq!(run.code, 0, "{}", run.stderr);
    assert_eq!(run.stdout, "ok first\nok second\n");

    let edited = classified.replace("\"Conflict\"", "\"BothSame\"");
    fs::write(second.join("expected.json"), edited).unwrap();
    let run = yamt_cli(&["golden", "run", path(root.path())]);
    assert_eq!(run.code, 1);
    assert_eq!(
        run.stdout,
        "ok first\nDIFF second: line 36: expected `\"kind\": \"BothSame\",`, got `\"kind\": \"Conflict\",`\n"
    );
    assert_eq!(run.stderr, "yamt-cli: 1 of 2 golden cases failed\n");
}

#[test]
fn golden_run_fails_on_a_missing_expected_json() {
    let root = TempDir::new().unwrap();
    write_case(root.path(), "fresh", "txt");
    let run = yamt_cli(&["golden", "run", path(root.path())]);
    assert_eq!(run.code, 1);
    assert_eq!(run.stdout, "DIFF fresh: expected.json is missing\n");
}

#[test]
fn golden_run_reports_an_unreadable_expected_json_as_a_read_error_not_as_missing() {
    let root = TempDir::new().unwrap();
    let case = write_case(root.path(), "unreadable", "txt");
    let expected = case.join("expected.json");
    fs::create_dir(&expected).unwrap();
    let run = yamt_cli(&["golden", "run", path(root.path())]);
    assert_eq!(run.code, 1);
    assert_eq!(run.stdout, "");
    let os_error = fs::read(&expected).unwrap_err();
    assert_eq!(
        run.stderr,
        format!("yamt-cli: cannot read {}: {os_error}\n", path(&expected))
    );
}

fn golden_run_with_expected(edit: impl Fn(&str) -> String) -> Output {
    let root = TempDir::new().unwrap();
    let case = write_case(root.path(), "edited", "txt");
    let update = yamt_cli(&["golden", "update", path(root.path())]);
    assert_eq!(update.code, 0, "{}", update.stderr);
    let expected = case.join("expected.json");
    let written = fs::read_to_string(&expected).unwrap();
    fs::write(&expected, edit(&written)).unwrap();
    yamt_cli(&["golden", "run", path(root.path())])
}

#[test]
fn golden_run_fails_on_an_expected_json_with_crlf_line_endings() {
    let run = golden_run_with_expected(|json| json.replace('\n', "\r\n"));
    assert_eq!(run.code, 1);
    assert_eq!(
        run.stdout,
        "DIFF edited: same lines, different line endings\n"
    );
}

#[test]
fn golden_run_fails_on_an_expected_json_without_a_final_newline() {
    let run = golden_run_with_expected(|json| json.trim_end_matches('\n').to_owned());
    assert_eq!(run.code, 1);
    assert_eq!(run.stdout, "DIFF edited: trailing newline differs\n");
}

#[test]
fn golden_run_fails_on_a_case_without_remote() {
    let root = TempDir::new().unwrap();
    let case = write_case(root.path(), "broken", "txt");
    fs::remove_file(case.join("remote.txt")).unwrap();
    let run = yamt_cli(&["golden", "run", path(root.path())]);
    assert_eq!(run.code, 1);
    assert_eq!(
        run.stderr,
        "yamt-cli: broken is not a golden case: missing remote.*\n"
    );
}

#[test]
fn golden_run_fails_on_sides_with_different_extensions() {
    let root = TempDir::new().unwrap();
    let case = write_case(root.path(), "mixed", "txt");
    fs::rename(case.join("local.txt"), case.join("local.ts")).unwrap();
    let run = yamt_cli(&["golden", "run", path(root.path())]);
    assert_eq!(run.code, 1);
    assert_eq!(
        run.stderr,
        "yamt-cli: mixed is not a golden case: base.txt, local.ts and remote.txt differ in extension\n"
    );
}

#[test]
fn golden_run_fails_without_cases() {
    let root = TempDir::new().unwrap();
    let run = yamt_cli(&["golden", "run", path(root.path())]);
    assert_eq!(run.code, 1);
    assert_eq!(
        run.stderr,
        format!("yamt-cli: no golden cases in {}\n", path(root.path()))
    );
}

#[test]
fn fixture_prints_file_merge_data_named_after_the_case() {
    let root = TempDir::new().unwrap();
    let case = write_case(root.path(), "cart", "ts");
    let output = yamt_cli(&["fixture", path(&case)]);
    assert_eq!(output.code, 0, "{}", output.stderr);
    let data: Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(data["path"], "cart.ts");
    assert_eq!(data["middle"], json!({ "kind": "Stages", "text": BASE }));
    assert_eq!(data["local"], LOCAL);
    assert_eq!(data["remote"], REMOTE);
    assert_eq!(data["eol"], "Lf");
    assert_eq!(data["disk_version"], 0);
    let classified: Value = serde_json::from_str(&classify(&["--json"]).stdout).unwrap();
    let chunks = data["chunks"].as_array().unwrap();
    let merge_chunks: Vec<&Value> = chunks.iter().map(|chunk| &chunk["chunk"]).collect();
    let classified = classified.as_array().unwrap();
    assert_eq!(merge_chunks, classified.iter().collect::<Vec<_>>());
    assert_eq!(chunks.len(), 3);
    for chunk in chunks {
        assert_eq!(chunk["words"]["chunk"], chunk["chunk"]["id"]);
        assert_eq!(chunk["middle"], chunk["chunk"]["base"]);
    }
}

// Catches a remembered showcase case printed as the stages view, which fixture mode would list as a
// plain conflict.
#[test]
fn fixture_of_a_case_with_a_remembered_text_prints_the_remembered_view() {
    const GIT_OUTPUT: &str =
        "a\nB\nc\nd\nE\nf\ng\n<<<<<<< ours\nL\n=======\nR\n>>>>>>> theirs\ni\n";
    const REMEMBERED: &str = "a\nB\nc\nd\nE\nf\ng\nL and R\ni\n";
    let root = TempDir::new().unwrap();
    let case = write_case(root.path(), "cart", "ts");
    fs::write(case.join("remembered.ts"), REMEMBERED).unwrap();
    fs::write(case.join("git-output.ts"), GIT_OUTPUT).unwrap();

    let output = yamt_cli(&["fixture", path(&case)]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    let data: Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(
        data["middle"],
        json!({ "kind": "Disk", "text": REMEMBERED })
    );
    let chunks = data["chunks"].as_array().unwrap();
    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0]["waiting"], json!({ "kind": "Remembered" }));
    assert_eq!(chunks[0]["chunk"]["kind"], "Conflict");
    assert_eq!(chunks[0]["middle"], json!({ "start": 7, "len": 1 }));
    assert_eq!(chunks[0]["chunk"]["base"], json!({ "start": 7, "len": 1 }));
}

// Catches a `git-output.<ext>` left stale after a side changed, which `just fixtures` would turn into
// conflicts placed by guesswork.
#[test]
fn fixture_refuses_a_git_output_not_made_from_the_case_s_sides() {
    const STALE: &str =
        "a\nB\nc\nd\nE\nf\ng\n<<<<<<< ours\nL, before\n=======\nR\n>>>>>>> theirs\ni\n";
    let root = TempDir::new().unwrap();
    let case = write_case(root.path(), "cart", "ts");
    fs::write(
        case.join("remembered.ts"),
        "a\nB\nc\nd\nE\nf\ng\nL and R\ni\n",
    )
    .unwrap();
    fs::write(case.join("git-output.ts"), STALE).unwrap();

    let output = yamt_cli(&["fixture", path(&case)]);

    assert_eq!(output.code, 1);
    assert_eq!(
        output.stderr,
        "yamt-cli: cart is not a golden case: git-output.ts was not made from these sides\n"
    );
}

#[test]
fn scan_lists_each_conflicted_file_with_chunk_counts_or_reason_and_remaining() {
    let repo = conflict_repo(&[
        ConflictFile {
            path: "notes.txt",
            kind: FileKind::Regular,
            base: Some(BASE.as_bytes()),
            local: Some(LOCAL.as_bytes()),
            remote: Some(REMOTE.as_bytes()),
        },
        ConflictFile {
            path: "image.bin",
            kind: FileKind::Regular,
            base: Some(b"\0base"),
            local: Some(b"\0local"),
            remote: Some(b"\0remote"),
        },
    ])
    .unwrap();
    let output = yamt_cli(&["scan", path(repo.path())]);
    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stdout,
        "image.bin Unresolved unsupported Binary\n\
         notes.txt Unresolved total 3: LocalOnly 1, RemoteOnly 1, BothSame 0, Conflict 1\n\
         remaining: 2\n"
    );
}
