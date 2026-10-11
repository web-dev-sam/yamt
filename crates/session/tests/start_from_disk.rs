#![cfg(test)]

use std::fs;
use std::os::unix::fs::PermissionsExt;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Setup, TempDir, conflict_repo_with, git, git_ok, hash_object,
};
use yamt_session::{DiskResult, DiskVersion, Error, FileList, FileStatus, MergeSession, Middle};

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

// gitattributes(5) "Defining a custom merge driver": `%A` is the file to leave the result in, and a
// non-zero exit marks a conflict.
const TEXT_MERGING_DRIVER: &str = "git merge-file -L ours -L base -L theirs %A %O %B; exit 1";

#[test]
fn a_configured_merge_driver_with_markers_opens_from_disk_at_the_first_list() {
    let config = [("merge.mergiraf.driver", TEXT_MERGING_DRIVER)];
    let dir = merged(&config, Some("f.txt merge=mergiraf\n"));
    assert!(read(&dir, TEXT).contains("\n<<<<<<< ours\n"));

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

#[test]
fn a_merge_driver_name_without_a_configured_driver_is_merged_as_text_and_untouched() {
    let dir = merged(&[], Some("f.txt merge=lfs\n"));
    assert!(read(&dir, TEXT).contains("<<<<<<<"));
    assert_untouched(&dir);
}

#[test]
fn merge_default_binary_keeps_ours_and_the_file_is_untouched() {
    let dir = merged(&[("merge.default", "binary")], None);
    assert_eq!(read(&dir, TEXT), OURS);
    assert_untouched(&dir);
}

#[test]
fn a_file_merge_ort_aligned_with_histogram_is_untouched() {
    let file = ConflictFile {
        path: TEXT,
        kind: FileKind::Regular,
        base: Some(b"{\na\n}\nx\nx\nb\n"),
        local: Some(b"{\nx\nx\n}\nb\n"),
        remote: Some(b"a\n}\nx\nx\nb\n"),
    };
    let dir = conflict_repo_with(&[file], &Setup::default()).unwrap();
    let git_output = read(&dir, TEXT);
    assert!(
        git_output.ends_with("=======\na\n>>>>>>> remote\n}\nb\n"),
        "{git_output}"
    );

    let (_, list) = first_list(&dir);

    assert_eq!(list.disk_changes, []);
}

#[test]
fn a_file_unreadable_at_start_opens_and_is_settled_once_it_can_be_read() {
    const NO_ACCESS: u32 = 0o000;
    const READ_WRITE: u32 = 0o644;
    let dir = zdiff3();
    let path = dir.path().join(TEXT);
    fs::set_permissions(&path, fs::Permissions::from_mode(NO_ACCESS)).unwrap();

    let mut session = MergeSession::open(dir.path()).unwrap();

    assert_eq!(session.refresh().unwrap().disk_changes, []);
    let finished = session.finish(TEXT, "merged\n", DiskVersion(0));
    assert!(
        matches!(finished, Err(Error::ReadFailed { .. })),
        "{finished:?}"
    );
    fs::set_permissions(&path, fs::Permissions::from_mode(READ_WRITE)).unwrap();
    assert_eq!(
        changes(&session.refresh().unwrap()),
        [(TEXT, &DiskResult::MarkersLeft { conflicts: 2 })]
    );
}
