#![cfg(test)]

use std::fs;
use std::os::unix::fs::symlink;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Setup, TempDir, conflict_repo_with, git_ok, hash_object,
};
use yamt_session::{
    DiskChange, DiskResult, DiskVersion, FileList, FileStatus, MergeSession, Middle, NotText, Side,
    WriteReply,
};

const TEXT: &str = "f.txt";
const BINARY: &str = "logo.bin";
const LINK: &str = "link";
const SUBMODULE: &str = "vendor/lib";

mod samples;
use samples::{BASE, OURS, THEIRS, WORKED_MIDDLE, with_block_resolved};

const USER_TEXT: &[u8] = b"written by the user\n";

const FILES: [ConflictFile<'static>; 4] = [
    ConflictFile {
        path: TEXT,
        kind: FileKind::Regular,
        base: Some(BASE.as_bytes()),
        local: Some(OURS.as_bytes()),
        remote: Some(THEIRS.as_bytes()),
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
    ConflictFile {
        path: SUBMODULE,
        kind: FileKind::Submodule,
        base: Some(b"1111111111111111111111111111111111111111"),
        local: Some(b"2222222222222222222222222222222222222222"),
        remote: Some(b"3333333333333333333333333333333333333333"),
    },
];

fn merged_in(style: &str, config: &[(&str, &str)]) -> TempDir {
    let mut all_config = vec![("merge.conflictStyle", style)];
    all_config.extend_from_slice(config);
    let setup = Setup {
        config: &all_config,
        ..Setup::default()
    };
    conflict_repo_with(&FILES, &setup).unwrap()
}

fn merged() -> TempDir {
    merged_in("zdiff3", &[])
}

fn opened(dir: &TempDir) -> MergeSession {
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert_eq!(session.refresh().unwrap().disk_changes, []);
    session
}

fn changes(list: &FileList) -> Vec<(&str, &DiskResult)> {
    let changes = list.disk_changes.iter();
    changes
        .map(|change| (change.path.as_str(), &change.result))
        .collect()
}

fn read(dir: &TempDir, path: &str) -> Vec<u8> {
    fs::read(dir.path().join(path)).unwrap()
}

fn write(dir: &TempDir, path: &str, bytes: &[u8]) {
    fs::write(dir.path().join(path), bytes).unwrap();
}

fn text(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes).unwrap()
}

fn staged(dir: &TempDir, path: &str) -> String {
    text(git_ok(dir.path(), &["ls-files", "-s", "--", path]).unwrap())
}

fn unmerged(dir: &TempDir) -> String {
    text(git_ok(dir.path(), &["ls-files", "-u"]).unwrap())
}

fn stage_zero_blob(dir: &TempDir, path: &str, bytes: &[u8]) -> String {
    let oid = hash_object(dir.path(), bytes).unwrap();
    format!("100644 {oid} 0\t{path}\n")
}

fn status_of(session: &MergeSession, path: &str) -> FileStatus {
    let files = session.files();
    files.iter().find(|file| file.path == path).unwrap().status
}

fn splice_local(middle: &str, local: &str, data_chunk: &yamt_session::MergeChunk) -> String {
    let middle: Vec<&str> = middle.split_inclusive('\n').collect();
    let local: Vec<&str> = local.split_inclusive('\n').collect();
    let start = data_chunk.middle.start.0 as usize;
    let end = start + data_chunk.middle.len as usize;
    let local_start = data_chunk.chunk.local.start.0 as usize;
    let local_end = local_start + data_chunk.chunk.local.len as usize;
    middle[..start].concat() + &local[local_start..local_end].concat() + &middle[end..].concat()
}

#[test]
fn a_regenerated_file_without_markers_is_staged_once() {
    let dir = merged();
    let mut session = opened(&dir);
    write(&dir, TEXT, USER_TEXT);

    let first = session.refresh().unwrap();
    let second = session.refresh().unwrap();

    assert_eq!(changes(&first), [(TEXT, &DiskResult::Staged)]);
    assert!(!unmerged(&dir).contains(TEXT), "{}", unmerged(&dir));
    assert_eq!(staged(&dir, TEXT), stage_zero_blob(&dir, TEXT, USER_TEXT));
    assert_eq!(status_of(&session, TEXT), FileStatus::Resolved);
    assert_eq!(second.disk_changes, []);
}

#[test]
fn one_of_two_blocks_resolved_on_disk_leaves_one_conflict_over_its_base_lines() {
    for style in ["zdiff3", "merge"] {
        let dir = merged_in(style, &[]);
        let mut session = opened(&dir);
        let git_output = text(read(&dir, TEXT));
        write(
            &dir,
            TEXT,
            with_block_resolved(&git_output, 1, "eight-theirs\n").as_bytes(),
        );

        let list = session.refresh().unwrap();
        let data = session.load(TEXT).unwrap();

        let markers_left = DiskResult::MarkersLeft { conflicts: 1 };
        assert_eq!(changes(&list), [(TEXT, &markers_left)], "{style}");
        assert_eq!(status_of(&session, TEXT), FileStatus::Unresolved);
        let middle = Middle::Disk {
            text: WORKED_MIDDLE.to_owned(),
        };
        assert_eq!(data.middle, middle, "{style}");
        assert_eq!(data.disk_version, DiskVersion(1));
        let [chunk] = data.chunks.as_slice() else {
            panic!("{style}: {:?}", data.chunks);
        };
        assert_eq!((chunk.middle.start.0, chunk.middle.len), (2, 3));
        assert_eq!((chunk.chunk.local.start.0, chunk.chunk.local.len), (2, 4));
        assert_eq!((chunk.chunk.remote.start.0, chunk.chunk.remote.len), (2, 4));
        let by_hand = with_block_resolved(&git_output, 1, "eight-theirs\n");
        let by_hand = with_block_resolved(&by_hand, 0, "one\nTWO\nshared-a\nthree-ours\n");
        assert_eq!(splice_local(WORKED_MIDDLE, OURS, chunk), by_hand, "{style}");
    }
}

#[test]
fn the_first_block_resolved_on_disk_leaves_the_second_one_open() {
    let dir = merged();
    let mut session = opened(&dir);
    let git_output = text(read(&dir, TEXT));
    write(
        &dir,
        TEXT,
        with_block_resolved(&git_output, 0, "one\nTWO\nshared-a\nthree-ours\n").as_bytes(),
    );

    session.refresh().unwrap();
    let data = session.load(TEXT).unwrap();

    let [chunk] = data.chunks.as_slice() else {
        panic!("{:?}", data.chunks);
    };
    assert_eq!((chunk.middle.start.0, chunk.middle.len), (11, 1));
    let Middle::Disk { text: middle } = &data.middle else {
        panic!("{:?}", data.middle);
    };
    assert_eq!(splice_local(middle, OURS, chunk), OURS);
}

#[test]
fn a_file_deleted_on_disk_is_staged_as_deleted_and_loads_as_deleted() {
    let dir = merged();
    let mut session = opened(&dir);
    fs::remove_file(dir.path().join(TEXT)).unwrap();

    let list = session.refresh().unwrap();

    assert_eq!(changes(&list), [(TEXT, &DiskResult::Staged)]);
    assert_eq!(staged(&dir, TEXT), "");
    assert_eq!(status_of(&session, TEXT), FileStatus::Resolved);
    let deleted = Middle::DiskNotText {
        found: NotText::Deleted,
    };
    assert_eq!(session.load(TEXT).unwrap().middle, deleted);
}

fn assert_changed_on_disk(reply: WriteReply) {
    let WriteReply::ChangedOnDisk { files, change } = reply else {
        panic!("expected ChangedOnDisk, got {reply:?}");
    };
    let staged_change = DiskChange {
        path: TEXT.to_owned(),
        result: DiskResult::Staged,
    };
    assert_eq!(change, staged_change);
    let entry = files.iter().find(|file| file.path == TEXT).unwrap();
    assert_eq!(entry.status, FileStatus::Resolved);
}

#[test]
fn a_change_not_yet_seen_stops_finish_take_and_reset_and_is_staged_instead() {
    type Write = fn(&mut MergeSession) -> WriteReply;
    let writes: [Write; 3] = [
        |session| session.finish(TEXT, "merged\n", DiskVersion(0)).unwrap(),
        |session| session.take(TEXT, Side::Remote, DiskVersion(0)).unwrap(),
        |session| session.reset(TEXT, DiskVersion(0)).unwrap(),
    ];
    for write_now in writes {
        let dir = merged();
        let mut session = opened(&dir);
        write(&dir, TEXT, USER_TEXT);

        assert_changed_on_disk(write_now(&mut session));

        assert_eq!(read(&dir, TEXT), USER_TEXT);
        assert_eq!(staged(&dir, TEXT), stage_zero_blob(&dir, TEXT, USER_TEXT));
        assert_eq!(session.refresh().unwrap().disk_changes, []);
    }
}

#[test]
fn a_write_from_a_view_older_than_the_last_settle_changes_nothing() {
    let dir = merged();
    let mut session = opened(&dir);
    write(&dir, TEXT, USER_TEXT);
    session.refresh().unwrap();
    let staged_before = staged(&dir, TEXT);

    let reply = session.finish(TEXT, "merged\n", DiskVersion(0)).unwrap();

    assert_changed_on_disk(reply);
    assert_eq!(read(&dir, TEXT), USER_TEXT);
    assert_eq!(staged(&dir, TEXT), staged_before);
    let current = session.finish(TEXT, "merged\n", DiskVersion(1)).unwrap();
    assert!(matches!(current, WriteReply::Written { .. }), "{current:?}");
    assert_eq!(read(&dir, TEXT), b"merged\n");
}

#[test]
fn yamt_reads_its_own_writes_back_so_they_are_never_reported_also_with_autocrlf() {
    for config in [&[][..], &[("core.autocrlf", "true")][..]] {
        let dir = merged_in("zdiff3", config);
        let mut session = opened(&dir);

        session.finish(TEXT, "a\nb\n", DiskVersion(0)).unwrap();
        assert_eq!(session.refresh().unwrap().disk_changes, [], "{config:?}");
        session.take(TEXT, Side::Remote, DiskVersion(0)).unwrap();
        assert_eq!(session.refresh().unwrap().disk_changes, [], "{config:?}");
        session.reset(TEXT, DiskVersion(0)).unwrap();
        assert_eq!(session.refresh().unwrap().disk_changes, [], "{config:?}");
        assert!(text(read(&dir, TEXT)).contains("<<<<<<<"));
    }
}

#[test]
fn a_resolved_file_changed_again_is_staged_again_with_its_new_bytes() {
    let dir = merged();
    let mut session = opened(&dir);
    session.finish(TEXT, "merged\n", DiskVersion(0)).unwrap();
    write(&dir, TEXT, USER_TEXT);

    let list = session.refresh().unwrap();

    assert_eq!(changes(&list), [(TEXT, &DiskResult::Staged)]);
    assert_eq!(staged(&dir, TEXT), stage_zero_blob(&dir, TEXT, USER_TEXT));
}

#[test]
fn a_binary_a_symlink_and_a_submodule_are_staged_by_any_change() {
    let dir = merged();
    let mut session = opened(&dir);
    write(&dir, BINARY, b"\0new");
    fs::remove_file(dir.path().join(LINK)).unwrap();
    symlink("new-target", dir.path().join(LINK)).unwrap();
    let submodule = dir.path().join(SUBMODULE);
    git_ok(&submodule, &["init", "--quiet"]).unwrap();
    git_ok(
        &submodule,
        &["commit", "--quiet", "--allow-empty", "-m", "moved"],
    )
    .unwrap();
    let head = text(git_ok(&submodule, &["rev-parse", "HEAD"]).unwrap());

    let list = session.refresh().unwrap();

    let staged_paths: Vec<&str> = changes(&list).into_iter().map(|(path, _)| path).collect();
    assert_eq!(staged_paths, [LINK, BINARY, SUBMODULE]);
    assert!(
        changes(&list)
            .iter()
            .all(|(_, result)| **result == DiskResult::Staged)
    );
    let binary_oid = hash_object(dir.path(), b"\0new").unwrap();
    assert_eq!(
        staged(&dir, BINARY),
        format!("100644 {binary_oid} 0\t{BINARY}\n")
    );
    let link_oid = hash_object(dir.path(), b"new-target").unwrap();
    assert_eq!(staged(&dir, LINK), format!("120000 {link_oid} 0\t{LINK}\n"));
    let head = head.trim_end();
    assert_eq!(
        staged(&dir, SUBMODULE),
        format!("160000 {head} 0\t{SUBMODULE}\n")
    );
}

#[test]
fn a_held_index_lock_fails_the_staging_reports_every_file_and_is_retried() {
    let dir = merged();
    let mut session = opened(&dir);
    write(&dir, BINARY, b"\0new");
    let git_output = text(read(&dir, TEXT));
    write(
        &dir,
        TEXT,
        with_block_resolved(&git_output, 1, "eight-theirs\n").as_bytes(),
    );
    let lock = dir.path().join(".git/index.lock");
    fs::write(&lock, "").unwrap();

    let list = session.refresh().unwrap();

    let [(text_path, markers_left), (binary, failed)] = changes(&list)[..] else {
        panic!("{list:?}");
    };
    assert_eq!((binary, text_path), (BINARY, TEXT));
    assert!(
        matches!(failed, DiskResult::StageFailed { message } if message.contains("index.lock")),
        "{failed:?}"
    );
    assert_eq!(*markers_left, DiskResult::MarkersLeft { conflicts: 1 });
    assert_eq!(read(&dir, BINARY), b"\0new");
    fs::remove_file(lock).unwrap();
    let retried = session.refresh().unwrap();
    assert_eq!(changes(&retried), [(BINARY, &DiskResult::Staged)]);
    assert_eq!(status_of(&session, BINARY), FileStatus::Resolved);
}

#[test]
fn an_unchanged_disk_reports_nothing_and_writes_nothing_to_git() {
    let dir = merged();
    let mut session = opened(&dir);
    let index = dir.path().join(".git/index");
    let before = fs::metadata(&index).unwrap().modified().unwrap();

    let list = session.refresh().unwrap();

    assert_eq!(list.disk_changes, []);
    assert_eq!(fs::metadata(&index).unwrap().modified().unwrap(), before);
    assert_eq!(list.files.len(), FILES.len());
}
