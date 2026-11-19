#![cfg(test)]

mod fixture;
mod stored_file;

use std::fs;

use yamt_conflict_repo::git_ok;
use yamt_merge_core::compare;
use yamt_range::RangeFileId;
use yamt_reviewed::{Error, ReviewMark, SinceReview};

use fixture::{
    THREE_DOTS, commit, id, kept_texts, mark, marked, object_id, open, range, range_folder, repo,
    reviewed, stored_paths,
};

fn changed_since(path: &str) -> (String, ReviewMark) {
    (path.to_owned(), ReviewMark::ChangedSinceReview)
}

fn texts(reviewed: &str, current: &str) -> SinceReview {
    SinceReview::Texts {
        reviewed: reviewed.to_owned(),
        current: current.to_owned(),
        differences: compare(reviewed, current),
    }
}

#[test]
fn a_missing_file_is_no_marks_and_nothing_is_written() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let range = range(&repo, THREE_DOTS);

    let store = open(&data, &range);

    assert_eq!(store.marks(), []);
    assert_eq!(fs::read_dir(data.path()).unwrap().count(), 0);
}

#[test]
fn a_mark_is_reviewed_again_after_a_new_commit_that_leaves_its_right_side() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["a.txt", "bin.dat"]);

    commit(&repo, "new.txt", b"new\n");
    let after = range(&repo, THREE_DOTS);

    assert_eq!(after.entries().len(), before.entries().len() + 1);
    let store = open(&data, &after);
    assert_eq!(marked(&store, &after), reviewed(&["a.txt", "bin.dat"]));
}

#[test]
fn a_moved_left_side_keeps_the_mark_reviewed() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, "main..HEAD");
    mark(&mut open(&data, &before), &before, &["a.txt"]);

    git_ok(repo.path(), &["checkout", "--quiet", "main"]).unwrap();
    commit(&repo, "a.txt", b"a on main\n");
    git_ok(repo.path(), &["checkout", "--quiet", "local"]).unwrap();
    let after = range(&repo, "main..HEAD");

    let left = |range| fixture::sides_of(range, "a.txt").left;
    assert_ne!(left(&after), left(&before));
    let store = open(&data, &after);
    assert_eq!(marked(&store, &after), reviewed(&["a.txt"]));
}

#[test]
fn a_changed_right_side_is_changed_since_review() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["a.txt", "b.txt"]);

    commit(&repo, "a.txt", b"a2\n");
    let after = range(&repo, THREE_DOTS);

    let store = open(&data, &after);
    let expected = vec![
        changed_since("a.txt"),
        ("b.txt".to_owned(), ReviewMark::Reviewed),
    ];
    assert_eq!(marked(&store, &after), expected);
}

#[test]
fn a_mark_on_a_path_no_longer_listed_is_dropped_written_and_its_text_swept() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["a.txt", "b.txt"]);
    let folder = range_folder(&data, &before);
    let a_text = object_id(&repo, "local:a.txt");
    let b_text = object_id(&repo, "local:b.txt");
    let mut both = vec![a_text.clone(), b_text];
    both.sort();
    assert_eq!(kept_texts(&folder), both);

    git_ok(repo.path(), &["mv", "b.txt", "c.txt"]).unwrap();
    git_ok(repo.path(), &["commit", "--quiet", "-m", "rename"]).unwrap();
    let after = range(&repo, THREE_DOTS);

    let store = open(&data, &after);
    assert_eq!(marked(&store, &after), reviewed(&["a.txt"]));
    assert_eq!(stored_paths(&folder), ["a.txt"]);
    assert_eq!(kept_texts(&folder), [a_text]);
}

#[test]
fn marking_again_records_the_current_contents() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["a.txt"]);
    commit(&repo, "a.txt", b"a2\n");
    let after = range(&repo, THREE_DOTS);
    let mut store = open(&data, &after);
    assert_eq!(marked(&store, &after), [changed_since("a.txt")]);

    mark(&mut store, &after, &["a.txt"]);

    assert_eq!(marked(&store, &after), reviewed(&["a.txt"]));
    let reopened = open(&data, &after);
    assert_eq!(marked(&reopened, &after), reviewed(&["a.txt"]));
    let folder = range_folder(&data, &after);
    assert_eq!(kept_texts(&folder), [object_id(&repo, "local:a.txt")]);
    let a = fixture::json_on_disk(&folder)["marks"][0].clone();
    assert_eq!(a["left"]["id"], object_id(&repo, "main:a.txt"));
    assert_eq!(a["right"]["id"], object_id(&repo, "local:a.txt"));
}

#[test]
fn unmark_forgets_and_an_unmarked_file_writes_nothing() {
    let repo = repo();
    let range = range(&repo, THREE_DOTS);
    let untouched = tempfile::tempdir().unwrap();
    open(&untouched, &range)
        .unmark(&range, id(&range, "a.txt"))
        .unwrap();
    assert_eq!(fs::read_dir(untouched.path()).unwrap().count(), 0);

    let data = tempfile::tempdir().unwrap();
    let mut store = open(&data, &range);
    mark(&mut store, &range, &["a.txt", "b.txt"]);
    store.unmark(&range, id(&range, "a.txt")).unwrap();

    assert_eq!(marked(&store, &range), reviewed(&["b.txt"]));
    assert_eq!(marked(&open(&data, &range), &range), reviewed(&["b.txt"]));
    let folder = range_folder(&data, &range);
    let written = fs::read(folder.join(fixture::REVIEWED_FILE)).unwrap();
    store.unmark(&range, id(&range, "a.txt")).unwrap();
    assert_eq!(
        fs::read(folder.join(fixture::REVIEWED_FILE)).unwrap(),
        written
    );
}

#[test]
fn a_file_past_the_list_is_unknown_file() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let range = range(&repo, THREE_DOTS);
    let mut store = open(&data, &range);
    let past = RangeFileId(4);
    let is_unknown = |error: Error| matches!(error, Error::UnknownFile { file } if file == past);

    assert!(is_unknown(store.mark(&range, past).unwrap_err()));
    assert!(is_unknown(store.unmark(&range, past).unwrap_err()));
    assert!(is_unknown(store.since_review(&range, past).unwrap_err()));
    assert_eq!(fs::read_dir(data.path()).unwrap().count(), 0);
}

#[test]
fn since_review_shows_the_kept_text_against_today_s_right_side() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["a.txt"]);
    commit(&repo, "a.txt", b"a1\nmore\n");
    let after = range(&repo, THREE_DOTS);

    let store = open(&data, &after);

    let since = store.since_review(&after, id(&after, "a.txt")).unwrap();
    assert_eq!(since, texts("a1\n", "a1\nmore\n"));
    let unmarked = store.since_review(&after, id(&after, "b.txt")).unwrap();
    assert_eq!(unmarked, SinceReview::NoText);
}

#[test]
fn since_review_of_a_file_marked_as_binary_is_no_text() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["bin.dat"]);
    let folder = range_folder(&data, &before);
    assert_eq!(
        fixture::json_on_disk(&folder)["marks"][0]["keptText"],
        false
    );
    commit(&repo, "bin.dat", b"text now\n");
    let after = range(&repo, THREE_DOTS);

    let store = open(&data, &after);

    assert_eq!(marked(&store, &after), [changed_since("bin.dat")]);
    let since = store.since_review(&after, id(&after, "bin.dat")).unwrap();
    assert_eq!(since, SinceReview::NoText);
}

#[test]
fn a_deleted_right_side_reviewed_compares_from_empty_text() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["gone.txt"]);
    commit(&repo, "gone.txt", b"back\n");
    let after = range(&repo, THREE_DOTS);

    let store = open(&data, &after);

    assert_eq!(marked(&store, &after), [changed_since("gone.txt")]);
    let since = store.since_review(&after, id(&after, "gone.txt")).unwrap();
    assert_eq!(since, texts("", "back\n"));
}

#[test]
fn a_file_not_text_today_has_no_since_review_texts() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let before = range(&repo, THREE_DOTS);
    mark(&mut open(&data, &before), &before, &["a.txt"]);
    commit(&repo, "a.txt", b"caf\xe9\n");
    let after = range(&repo, THREE_DOTS);

    let store = open(&data, &after);

    let since = store.since_review(&after, id(&after, "a.txt")).unwrap();
    assert_eq!(since, SinceReview::NoText);
}

#[test]
fn two_stores_on_one_review_keep_both_changes() {
    let repo = repo();
    let data = tempfile::tempdir().unwrap();
    let first = range(&repo, THREE_DOTS);
    commit(&repo, "new.txt", b"new\n");
    let second = range(&repo, THREE_DOTS);
    assert_ne!(first.compared().right, second.compared().right);
    let mut on_first = open(&data, &first);
    let mut on_second = open(&data, &second);

    mark(&mut on_first, &first, &["a.txt"]);
    mark(&mut on_second, &second, &["b.txt"]);

    assert_eq!(marked(&on_first, &first), reviewed(&["a.txt"]));
    assert_eq!(marked(&on_second, &second), reviewed(&["b.txt"]));
    let reopened = open(&data, &second);
    assert_eq!(marked(&reopened, &second), reviewed(&["a.txt", "b.txt"]));
}
