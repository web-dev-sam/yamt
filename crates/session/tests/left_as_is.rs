#![cfg(test)]

use std::fs;

use yamt_conflict_repo::{ConflictFile, FileKind, Setup, TempDir, conflict_repo_with, git_ok};
use yamt_session::{DiskChange, DiskResult, MergeSession};

mod listing;
use listing::listed;

fn opened(dir: &TempDir) -> MergeSession {
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert_eq!(listed(&mut session).disk_changes, []);
    session
}

fn left_as_is(path: &str) -> Vec<DiskChange> {
    vec![DiskChange {
        path: path.to_owned(),
        result: DiskResult::LeftAsIs,
    }]
}

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

fn utf16(text: &str) -> Vec<u8> {
    let mut bytes = vec![0xFF, 0xFE];
    for unit in text.encode_utf16() {
        bytes.extend_from_slice(&unit.to_le_bytes());
    }
    bytes
}

#[test]
fn a_working_tree_encoding_file_is_never_staged() {
    const ENCODED: &str = "u.txt";
    let sides = [
        utf16("one\ntwo\n"),
        utf16("one\nlocal\n"),
        utf16("one\nremote\n"),
    ];
    let file = ConflictFile {
        path: ENCODED,
        kind: FileKind::Regular,
        base: Some(&sides[0]),
        local: Some(&sides[1]),
        remote: Some(&sides[2]),
    };
    let setup = Setup {
        attributes: Some("u.txt working-tree-encoding=UTF-16\n"),
        ..Setup::default()
    };
    let dir = conflict_repo_with(&[file], &setup).unwrap();
    let mut session = opened(&dir);
    fs::write(dir.path().join(ENCODED), utf16("resolved\n")).unwrap();

    let changed = listed(&mut session);

    assert_eq!(changed.disk_changes, left_as_is(ENCODED));
    assert!(unmerged(&dir).contains(ENCODED));
}

#[test]
fn a_submodule_no_longer_checked_out_is_left_as_is() {
    const SUBMODULE: &str = "vendor/lib";
    let file = ConflictFile {
        path: SUBMODULE,
        kind: FileKind::Submodule,
        base: Some(b"1111111111111111111111111111111111111111"),
        local: Some(b"2222222222222222222222222222222222222222"),
        remote: Some(b"3333333333333333333333333333333333333333"),
    };
    let dir = conflict_repo_with(&[file], &Setup::default()).unwrap();
    let submodule = dir.path().join(SUBMODULE);
    git_ok(&submodule, &["init", "--quiet"]).unwrap();
    git_ok(
        &submodule,
        &["commit", "--quiet", "--allow-empty", "-m", "c"],
    )
    .unwrap();
    let mut session = opened(&dir);
    let unmerged_before = unmerged(&dir);
    fs::remove_dir_all(submodule.join(".git")).unwrap();

    let changed = listed(&mut session);

    assert_eq!(changed.disk_changes, left_as_is(SUBMODULE));
    assert_eq!(unmerged(&dir), unmerged_before);
}
