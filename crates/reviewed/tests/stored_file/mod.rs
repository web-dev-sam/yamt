use std::fs;
use std::path::PathBuf;

use tempfile::TempDir;
use yamt_gitio::Oid;
use yamt_range::{Dots, PairLock, RangeSpec, Resolved, SideName, SideNames, pair_folders};
use yamt_reviewed::{Error, ReviewOf, ReviewedStore};

use crate::fixture::{
    REVIEWED_FILE, TEXTS_FOLDER, THREE_DOTS, id, kept_texts, mark, marked, object_id, open, range,
    range_folder, refused, repo, review_folder, review_of, reviewed,
};

fn reference(full_name: &str) -> SideName {
    SideName::Ref {
        full_name: full_name.to_owned(),
    }
}

fn merge_request() -> ReviewOf {
    ReviewOf::MergeRequest {
        project: "group/project".to_owned(),
        iid: 12,
    }
}

/// A `reviewed.json` written into the folder of `main...HEAD`'s review before the store opens it.
fn stored(json: &str) -> (TempDir, TempDir, PathBuf) {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let folder = range_folder(&data, &range(&repo, THREE_DOTS));
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join(REVIEWED_FILE), json).unwrap();
    (repo, data, folder)
}

fn broken_message(json: &str) -> String {
    let (repo, data, folder) = stored(json);
    let error = refused(&data, &range(&repo, THREE_DOTS));
    assert_eq!(
        fs::read_to_string(folder.join(REVIEWED_FILE)).unwrap(),
        json
    );
    let Error::Broken { path, message } = error else {
        panic!("expected Broken, got {error:?}");
    };
    assert_eq!(path, folder.join(REVIEWED_FILE));
    message
}

const RANGE_REVIEW: &str = r#"{"kind":"range","left":{"kind":"ref","name":"refs/heads/main"},"dots":"three","right":{"kind":"ref","name":"refs/heads/local"}}"#;

fn with_marks(marks: &str) -> String {
    format!(r#"{{"format":1,"review":{RANGE_REVIEW},"marks":[{marks}]}}"#)
}

#[test]
fn the_review_key_text_names_refs_commits_dots_and_merge_requests() {
    let on_branches = ReviewOf::Range(SideNames {
        left: reference("refs/heads/dev"),
        dots: Dots::Three,
        right: reference("refs/heads/feature-x"),
    });
    let hex = "ab".repeat(20);
    let by_commit = ReviewOf::Range(SideNames {
        left: SideName::Commit {
            id: Oid::parse(&hex).unwrap(),
        },
        dots: Dots::Two,
        right: reference("refs/heads/x"),
    });

    assert_eq!(
        on_branches.key_text(),
        "range ref:refs/heads/dev...ref:refs/heads/feature-x"
    );
    assert_eq!(
        by_commit.key_text(),
        format!("range commit:{hex}..ref:refs/heads/x")
    );
    assert_eq!(merge_request().key_text(), "merge-request group/project!12");
}

/// `reviewed.json` with one mark on `a.txt`, as format 1 writes it.
fn merge_request_file(left: &str, right: &str) -> String {
    format!(
        r#"{{
  "format": 1,
  "review": {{
    "kind": "mergeRequest",
    "project": "group/project",
    "iid": 12
  }},
  "marks": [
    {{
      "path": "a.txt",
      "left": {{
        "id": "{left}",
        "kind": "file"
      }},
      "right": {{
        "id": "{right}",
        "kind": "file"
      }},
      "keptText": true
    }}
  ]
}}
"#
    )
}

#[test]
fn the_folder_name_is_the_pinned_fnv_of_the_key_text() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let range = range(&repo, THREE_DOTS);
    let mut store = ReviewedStore::open(data.path(), merge_request(), &range).unwrap();

    store.mark(&range, id(&range, "a.txt")).unwrap();

    let folder = data
        .path()
        .join(range.repo_key().unwrap())
        .join("d4da12ac15071dca");
    let json = fs::read_to_string(folder.join(REVIEWED_FILE)).unwrap();
    let right = object_id(&repo, "local:a.txt");
    let left = object_id(&repo, "main:a.txt");
    assert_eq!(json, merge_request_file(&left, &right));
    assert_eq!(
        fs::read_to_string(folder.join(TEXTS_FOLDER).join(&right)).unwrap(),
        "a1\n"
    );
}

#[test]
fn a_newer_format_is_refused_by_name_and_left_unchanged() {
    let json = r#"{"format":2,"anything":"new"}"#;
    let (repo, data, folder) = stored(json);

    let error = refused(&data, &range(&repo, THREE_DOTS));

    assert!(
        matches!(&error, Error::NewerFormat { path, format: 2 } if *path == folder.join(REVIEWED_FILE)),
        "{error:?}"
    );
    assert!(
        error
            .to_string()
            .ends_with("were written by a newer yamt (format 2)")
    );
    assert_eq!(
        fs::read_to_string(folder.join(REVIEWED_FILE)).unwrap(),
        json
    );
}

#[test]
fn a_broken_file_names_line_and_column_and_is_left_unchanged() {
    assert_eq!(
        broken_message("{\"format\":1,\n\"marks\": ["),
        "EOF while parsing a list at line 2 column 10"
    );
    assert_eq!(
        broken_message(&with_marks(r#"{"path":"a.txt"}"#)),
        "missing field `keptText` at line 1 column 174"
    );
    assert_eq!(broken_message(r#"{"format":0}"#), "format 0 is not 1");
}

#[test]
fn marks_out_of_path_order_or_with_a_foreign_id_are_broken() {
    let side = r#"{"id":"1111111111111111111111111111111111111111","kind":"file"}"#;
    let mark =
        |path: &str| format!(r#"{{"path":"{path}","left":null,"right":{side},"keptText":false}}"#);
    let unsorted = with_marks(&format!("{},{}", mark("b.txt"), mark("a.txt")));
    assert_eq!(
        broken_message(&unsorted),
        "the marks are not sorted by path at \"a.txt\""
    );
    let twice = with_marks(&format!("{},{}", mark("a.txt"), mark("a.txt")));
    assert_eq!(
        broken_message(&twice),
        "the marks are not sorted by path at \"a.txt\""
    );
    let foreign = with_marks(
        r#"{"path":"a.txt","left":{"id":"../x","kind":"file"},"right":null,"keptText":false}"#,
    );
    assert_eq!(
        broken_message(&foreign),
        "\"../x\" of a.txt is not an object id"
    );
}

#[test]
fn a_file_naming_another_review_is_broken() {
    let other = r#"{"format":1,"review":{"kind":"mergeRequest","project":"group/project","iid":12},"marks":[]}"#;
    assert_eq!(broken_message(other), "`review` names another review");
}

fn read_failed_at(data: &TempDir, range: &yamt_range::Range) -> PathBuf {
    let error = refused(data, range);
    let Error::ReadFailed { path, .. } = error else {
        panic!("expected ReadFailed, got {error:?}");
    };
    path
}

#[test]
fn a_reviewed_file_or_texts_folder_that_cannot_be_read_is_read_failed() {
    let repo = repo();
    let range = range(&repo, THREE_DOTS);

    let a_folder = tempfile::tempdir().unwrap();
    let folder = range_folder(&a_folder, &range);
    fs::create_dir_all(folder.join(REVIEWED_FILE)).unwrap();
    assert_eq!(
        read_failed_at(&a_folder, &range),
        folder.join(REVIEWED_FILE)
    );

    let a_file = tempfile::tempdir().unwrap();
    let folder = range_folder(&a_file, &range);
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join(REVIEWED_FILE), with_marks("")).unwrap();
    fs::write(folder.join(TEXTS_FOLDER), "not a folder").unwrap();
    assert_eq!(read_failed_at(&a_file, &range), folder.join(TEXTS_FOLDER));
}

#[test]
fn a_failed_write_changes_nothing_in_memory() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let range = range(&repo, THREE_DOTS);
    let mut store = open(&data, &range);
    mark(&mut store, &range, &["a.txt"]);
    let folder = range_folder(&data, &range);
    let written = fs::read(folder.join(REVIEWED_FILE)).unwrap();
    let blocking_temp = folder.join(format!("{REVIEWED_FILE}.tmp"));
    fs::create_dir(&blocking_temp).unwrap();

    let marking = store.mark(&range, id(&range, "b.txt")).unwrap_err();
    let unmarking = store.unmark(&range, id(&range, "a.txt")).unwrap_err();

    for error in [marking, unmarking] {
        assert!(
            matches!(&error, Error::WriteFailed { path, .. } if *path == folder.join(REVIEWED_FILE)),
            "{error:?}"
        );
    }
    assert_eq!(marked(&store, &range), reviewed(&["a.txt"]));
    assert_eq!(fs::read(folder.join(REVIEWED_FILE)).unwrap(), written);
}

#[test]
fn a_leftover_temp_file_is_ignored() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let range = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &range), &range, &["a.txt"]);
    let folder = range_folder(&data, &range);
    fs::write(folder.join(format!("{REVIEWED_FILE}.tmp")), "{\"form").unwrap();
    let a_text = object_id(&repo, "local:a.txt");
    fs::write(folder.join(TEXTS_FOLDER).join(format!("{a_text}.tmp")), "a").unwrap();

    let mut store = open(&data, &range);
    assert_eq!(marked(&store, &range), reviewed(&["a.txt"]));
    assert_eq!(kept_texts(&folder), [a_text]);
    mark(&mut store, &range, &["b.txt"]);

    let reopened = open(&data, &range);
    assert_eq!(marked(&reopened, &range), reviewed(&["a.txt", "b.txt"]));
}

#[test]
fn the_reviewed_folder_is_not_a_pair_folder() {
    let repo = repo();
    let app = tempfile::tempdir().unwrap();
    let range_dir = app.path().join("range");
    let reviewed_dir = app.path().join("reviewed");
    let spec = RangeSpec::parse(THREE_DOTS).unwrap();
    let resolved = Resolved::resolve(repo.path(), &spec).unwrap();
    let lock = PairLock::take(&range_dir, &resolved).unwrap();
    let range = resolved.list().unwrap();
    let review = review_of(&range);
    let folder = review_folder(&reviewed_dir, &range, &review);
    let mut store = ReviewedStore::open(&reviewed_dir, review, &range).unwrap();

    store.mark(&range, id(&range, "a.txt")).unwrap();

    assert_eq!(pair_folders(&range_dir), [lock.folder().to_owned()]);
    assert!(folder.join(REVIEWED_FILE).is_file());
}
