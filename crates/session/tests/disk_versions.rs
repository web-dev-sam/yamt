#![cfg(test)]

use std::fs;

use yamt_conflict_repo::{ConflictFile, FileKind, conflict_repo, edit_stop_repo};
use yamt_session::{DiskVersion, MergeSession};

mod listing;
use listing::listed;

const FIRST: &str = "a.txt";
const SECOND: &str = "b.txt";

fn text_conflict(path: &str) -> ConflictFile<'_> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(b"local\n"),
        remote: Some(b"remote\n"),
    }
}

#[test]
fn the_highest_disk_version_is_the_most_settled_file_s_even_when_it_is_not_the_first() {
    let dir = conflict_repo(&[text_conflict(FIRST), text_conflict(SECOND)]).unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();

    for text in ["edited once\n", "edited twice\n"] {
        fs::write(dir.path().join(SECOND), text).unwrap();
        assert_eq!(listed(&mut session).disk_changes.len(), 1);
    }

    assert_eq!(session.highest_disk_version(), DiskVersion(2));
}

#[test]
fn a_stop_without_unmerged_files_opened_after_a_version_has_the_next_one_as_its_highest() {
    let dir = edit_stop_repo(&[text_conflict(FIRST)]).unwrap();
    let previous = DiskVersion(7);

    let session = MergeSession::open_after(dir.path(), previous).unwrap();

    assert_eq!(session.files(), []);
    assert_eq!(session.highest_disk_version(), DiskVersion(8));
}
