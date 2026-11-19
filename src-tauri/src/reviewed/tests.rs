use std::fs;

use serde_json::{Value, json};
use yamt_conflict_repo::{TempDir, git_ok};

use crate::args::{Ai, MarksOf};
use crate::mock_window::invoke_on;
use crate::range::tests::{
    RangeWindow, open_marked_window, open_range_window, open_range_window_in, repo,
};

const FILE: u32 = 0;
const UNKNOWN_ID: u32 = 7;
const PROJECT: &str = "taskboard/taskboard";
const OTHER_PROJECT: &str = "taskboard/other";

fn invoke(window: &RangeWindow, cmd: &str, file: u32) -> Result<Value, Value> {
    invoke_on(&window.webview, cmd, json!({ "file": file }))
}

fn listed(window: &RangeWindow) -> Value {
    invoke_on(&window.webview, "list_reviewed", json!({})).unwrap()
}

fn reviewed(file: u32) -> Value {
    json!([{ "file": file, "mark": "reviewed" }])
}

/// Commits `path` with `text` on branch `remote`, the range's right side, and checks `local` out again.
fn commit_on_the_right_branch(repo: &TempDir, path: &str, text: &str) {
    let root = repo.path();
    git_ok(root, &["checkout", "--quiet", "remote"]).unwrap();
    fs::write(root.join(path), text).unwrap();
    git_ok(root, &["add", "--", path]).unwrap();
    git_ok(root, &["commit", "--quiet", "-m", path]).unwrap();
    git_ok(root, &["checkout", "--quiet", "local"]).unwrap();
}

/// A window marking `a.txt` reviewed: its repository and a data folder holding the mark.
fn after_a_mark() -> (TempDir, TempDir) {
    let window = open_range_window();
    invoke(&window, "mark_reviewed", FILE).unwrap();
    window.with_marks_copied()
}

fn merge_request(iid: u32) -> MarksOf {
    merge_request_of(PROJECT, iid)
}

fn merge_request_of(project: &str, iid: u32) -> MarksOf {
    MarksOf::MergeRequest {
        project: project.to_owned(),
        iid,
    }
}

#[test]
fn mark_reviewed_then_list_reviewed_answers_it() {
    let window = open_range_window();
    assert_eq!(listed(&window), json!([]));

    assert_eq!(invoke(&window, "mark_reviewed", FILE), Ok(Value::Null));

    assert_eq!(listed(&window), reviewed(FILE));
}

#[test]
fn a_window_on_a_new_commit_of_the_same_branch_keeps_the_mark() {
    let (repo, data) = after_a_mark();
    commit_on_the_right_branch(&repo, "b.txt", "new\n");

    let window = open_range_window_in(repo, data, Ai::Off);

    assert_eq!(listed(&window), reviewed(FILE));
}

#[test]
fn a_changed_right_side_lists_changed_since_review_and_load_since_review_answers_texts() {
    let (repo, data) = after_a_mark();
    commit_on_the_right_branch(&repo, "a.txt", "three\n");

    let window = open_range_window_in(repo, data, Ai::Off);

    let changed = json!([{ "file": FILE, "mark": "changedSinceReview" }]);
    assert_eq!(listed(&window), changed);
    let since = invoke(&window, "load_since_review", FILE).unwrap();
    assert_eq!(since["kind"], "texts");
    assert_eq!(since["reviewed"], "two\n");
    assert_eq!(since["current"], "three\n");
    assert_eq!(since["differences"].as_array().unwrap().len(), 1, "{since}");
}

#[test]
fn two_merge_request_reviews_do_not_share_marks() {
    let first = open_marked_window(repo(), TempDir::new().unwrap(), merge_request(1));
    invoke(&first, "mark_reviewed", FILE).unwrap();
    let (repo, data) = first.with_marks_copied();

    let second = open_marked_window(repo, data, merge_request(2));
    assert_eq!(listed(&second), json!([]));
    let (repo, data) = second.with_marks_copied();

    let first_again = open_marked_window(repo, data, merge_request(1));
    assert_eq!(listed(&first_again), reviewed(FILE));
    let (repo, data) = first_again.with_marks_copied();

    let other_project = open_marked_window(repo, data, merge_request_of(OTHER_PROJECT, 1));
    assert_eq!(listed(&other_project), json!([]));
}

#[test]
fn unmark_reviewed_forgets() {
    let window = open_range_window();
    invoke(&window, "mark_reviewed", FILE).unwrap();

    assert_eq!(invoke(&window, "unmark_reviewed", FILE), Ok(Value::Null));

    assert_eq!(listed(&window), json!([]));
    let (repo, data) = window.with_marks_copied();
    let reopened = open_range_window_in(repo, data, Ai::Off);
    assert_eq!(listed(&reopened), json!([]));
}

#[test]
fn an_unknown_file_answers_unknown_range_file() {
    let window = open_range_window();
    let unknown = Err(json!({ "kind": "UnknownRangeFile", "file": UNKNOWN_ID }));
    for cmd in ["mark_reviewed", "unmark_reviewed", "load_since_review"] {
        assert_eq!(invoke(&window, cmd, UNKNOWN_ID), unknown, "{cmd}");
    }
}
