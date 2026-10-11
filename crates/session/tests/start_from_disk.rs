#![cfg(test)]

use std::fs;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Setup, TempDir, conflict_repo_with, git, git_ok, hash_object,
};
use yamt_session::{DiskResult, FileList, FileStatus, MergeSession, Middle};

const TEXT: &str = "f.txt";
const DELETED: &str = "gone.txt";
const BINARY: &str = "logo.bin";
const LINK: &str = "link";

mod samples;
use samples::{BASE, OURS, THEIRS, WORKED_MIDDLE, with_block_resolved};

const FILES: [ConflictFile<'static>; 4] = [
    ConflictFile {
        path: TEXT,
        kind: FileKind::Regular,
        base: Some(BASE.as_bytes()),
        local: Some(OURS.as_bytes()),
        remote: Some(THEIRS.as_bytes()),
    },
    ConflictFile {
        path: DELETED,
        kind: FileKind::Regular,
        base: Some(b"kept\nbase\n"),
        local: None,
        remote: Some(b"kept\nremote\n"),
    },
    ConflictFile {
        path: BINARY,
        kind: FileKind::Regular,
        base: Some(b"\0base"),
        local: Some(b"\0local"),
        remote: Some(b"\0remote"),
    },
    ConflictFile {
        path: LINK,
        kind: FileKind::Symlink,
        base: Some(b"base-target"),
        local: Some(b"local-target"),
        remote: Some(b"remote-target"),
    },
];

fn merged(config: &[(&str, &str)], attributes: Option<&str>) -> TempDir {
    let setup = Setup { config, attributes };
    conflict_repo_with(&FILES, &setup).unwrap()
}

fn zdiff3() -> TempDir {
    merged(&[("merge.conflictStyle", "zdiff3")], None)
}

fn first_list(dir: &TempDir) -> (MergeSession, FileList) {
    let mut session = MergeSession::open(dir.path()).unwrap();
    let list = session.refresh().unwrap();
    (session, list)
}

fn changes(list: &FileList) -> Vec<(&str, &DiskResult)> {
    let changes = list.disk_changes.iter();
    changes
        .map(|change| (change.path.as_str(), &change.result))
        .collect()
}

fn text(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes).unwrap()
}

fn read(dir: &TempDir, path: &str) -> String {
    fs::read_to_string(dir.path().join(path)).unwrap()
}

fn write(dir: &TempDir, path: &str, bytes: &[u8]) {
    fs::write(dir.path().join(path), bytes).unwrap();
}

fn unmerged(dir: &TempDir) -> String {
    text(git_ok(dir.path(), &["ls-files", "-u"]).unwrap())
}

fn assert_untouched(dir: &TempDir) {
    let unmerged_before = unmerged(dir);
    let (mut session, list) = first_list(dir);
    assert_eq!(list.disk_changes, []);
    assert_eq!(unmerged(dir), unmerged_before);
    let base = Middle::Stages {
        text: BASE.to_owned(),
    };
    assert_eq!(session.load(TEXT).unwrap().middle, base);
}

#[test]
fn files_git_wrote_in_any_conflict_style_are_untouched() {
    for style in ["zdiff3", "merge", "diff3"] {
        let dir = merged(&[("merge.conflictStyle", style)], None);
        assert_untouched(&dir);
    }
}

#[test]
fn a_file_rewritten_by_checkout_conflict_diff3_is_untouched() {
    let dir = zdiff3();
    git_ok(dir.path(), &["checkout", "--conflict=diff3", "--", TEXT]).unwrap();
    assert!(read(&dir, TEXT).contains("|||||||"));
    assert_untouched(&dir);
}

#[test]
fn a_crlf_worktree_over_lf_blobs_is_untouched() {
    let dir = merged(&[("core.autocrlf", "true")], None);
    assert!(read(&dir, TEXT).contains("<<<<<<< HEAD\r\n"));
    assert!(read(&dir, DELETED).contains("\r\n"));
    assert_untouched(&dir);
}

#[test]
fn markers_of_the_size_set_in_gitattributes_are_untouched() {
    let dir = merged(&[], Some("f.txt conflict-marker-size=12\n"));
    assert!(read(&dir, TEXT).contains("<<<<<<<<<<<< HEAD\n"));
    assert_untouched(&dir);
}

#[test]
fn an_edit_inside_a_base_section_only_is_untouched() {
    let dir = zdiff3();
    let edited = read(&dir, TEXT).replace("\neight\n", "\neight, edited in base\n");
    write(&dir, TEXT, edited.as_bytes());
    assert_untouched(&dir);
}

#[test]
fn a_rename_conflict_with_branch_and_path_labels_is_untouched() {
    let dir = TempDir::new().unwrap();
    let root = dir.path();
    let commit = |message: &str| {
        git_ok(root, &["add", "--all"]).unwrap();
        git_ok(root, &["commit", "--quiet", "-m", message]).unwrap();
    };
    git_ok(root, &["init", "--quiet"]).unwrap();
    fs::write(root.join("old.txt"), BASE).unwrap();
    commit("base");
    git_ok(root, &["checkout", "--quiet", "-b", "local"]).unwrap();
    git_ok(root, &["mv", "old.txt", TEXT]).unwrap();
    fs::write(root.join(TEXT), OURS).unwrap();
    commit("local");
    git_ok(root, &["checkout", "--quiet", "-b", "remote", "main"]).unwrap();
    fs::write(root.join("old.txt"), THEIRS).unwrap();
    commit("remote");
    git_ok(root, &["checkout", "--quiet", "local"]).unwrap();
    assert!(
        !git(root, &["merge", "--quiet", "remote"])
            .unwrap()
            .status
            .success()
    );
    assert!(
        read(&dir, TEXT).contains(">>>>>>> remote:old.txt"),
        "{}",
        read(&dir, TEXT)
    );

    let (_, list) = first_list(&dir);

    assert_eq!(list.disk_changes, []);
}

#[test]
fn a_file_regenerated_before_start_is_staged_by_the_first_list() {
    let dir = zdiff3();
    write(&dir, TEXT, b"regenerated\n");

    let (session, list) = first_list(&dir);

    assert_eq!(changes(&list), [(TEXT, &DiskResult::Staged)]);
    let oid = hash_object(dir.path(), b"regenerated\n").unwrap();
    let staged = text(git_ok(dir.path(), &["ls-files", "-s", "--", TEXT]).unwrap());
    assert_eq!(staged, format!("100644 {oid} 0\t{TEXT}\n"));
    assert_eq!(session.remaining(), FILES.len() - 1);
}

#[test]
fn a_block_resolved_before_start_opens_from_disk_with_the_other_block() {
    let dir = zdiff3();
    write(
        &dir,
        TEXT,
        with_block_resolved(&read(&dir, TEXT), 1, "eight-theirs\n").as_bytes(),
    );

    let (mut session, list) = first_list(&dir);

    assert_eq!(
        changes(&list),
        [(TEXT, &DiskResult::MarkersLeft { conflicts: 1 })]
    );
    let data = session.load(TEXT).unwrap();
    assert_eq!(
        data.middle,
        Middle::Disk {
            text: WORKED_MIDDLE.to_owned()
        }
    );
    let [chunk] = data.chunks.as_slice() else {
        panic!("{:?}", data.chunks);
    };
    assert_eq!((chunk.middle.start.0, chunk.middle.len), (2, 3));
}

#[test]
fn settled_text_edited_before_start_opens_from_disk_with_both_blocks() {
    let dir = zdiff3();
    write(
        &dir,
        TEXT,
        read(&dir, TEXT)
            .replace("five\n", "five, edited\n")
            .as_bytes(),
    );

    let (session, list) = first_list(&dir);

    assert_eq!(
        changes(&list),
        [(TEXT, &DiskResult::MarkersLeft { conflicts: 2 })]
    );
    let text_status = session.files().into_iter().find(|file| file.path == TEXT);
    assert_eq!(
        text_status.map(|file| file.status),
        Some(FileStatus::Unresolved)
    );
}

#[test]
fn a_deleted_side_file_is_untouched_under_autocrlf_and_staged_once_removed() {
    let dir = merged(&[("core.autocrlf", "true")], None);
    let (_, untouched) = first_list(&dir);
    assert_eq!(untouched.disk_changes, []);

    let dir = zdiff3();
    fs::remove_file(dir.path().join(DELETED)).unwrap();
    let (_, list) = first_list(&dir);

    assert_eq!(changes(&list), [(DELETED, &DiskResult::Staged)]);
    assert_eq!(
        git_ok(dir.path(), &["ls-files", "-s", "--", DELETED]).unwrap(),
        b""
    );
}

#[test]
fn a_binary_file_is_untouched_as_ours_and_staged_once_replaced_by_theirs() {
    let dir = zdiff3();
    assert_eq!(fs::read(dir.path().join(BINARY)).unwrap(), b"\0local");
    write(&dir, BINARY, b"\0remote");

    let (_, list) = first_list(&dir);

    assert_eq!(changes(&list), [(BINARY, &DiskResult::Staged)]);
}

#[test]
fn a_text_file_git_did_not_merge_and_a_symlink_kept_as_ours_are_untouched() {
    let dir = merged(&[], Some("f.txt -merge\n"));
    assert_eq!(read(&dir, TEXT), OURS);
    let (_, list) = first_list(&dir);
    assert_eq!(list.disk_changes, []);
    let target = fs::read_link(dir.path().join(LINK)).unwrap();
    assert_eq!(target.to_str(), Some("local-target"));
}

#[test]
fn a_custom_merge_driver_with_markers_opens_from_disk_at_the_first_list() {
    let dir = merged(&[], Some("f.txt merge=mergiraf\n"));
    assert!(read(&dir, TEXT).contains("<<<<<<<"));

    let (mut session, list) = first_list(&dir);

    assert_eq!(
        changes(&list),
        [(TEXT, &DiskResult::MarkersLeft { conflicts: 2 })]
    );
    assert!(matches!(
        session.load(TEXT).unwrap().middle,
        Middle::Disk { .. }
    ));
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
    let (mut session, list) = first_list(&dir);
    assert_eq!(list.disk_changes, []);
    write(&dir, ENCODED, &utf16("resolved\n"));

    let changed = session.refresh().unwrap();

    assert_eq!(
        changes(&changed),
        [(ENCODED, &DiskResult::MarkersLeft { conflicts: 0 })]
    );
    assert!(unmerged(&dir).contains(ENCODED));
}
