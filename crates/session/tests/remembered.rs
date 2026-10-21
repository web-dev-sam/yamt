#![cfg(test)]

use std::fs;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Remembered, Replay, TempDir, conflict_repo, git_ok, rerere_repo,
};
use yamt_merge_core::{BaseLine, ChunkKind, LineRange, LocalLine, RemoteLine};
use yamt_session::{
    DiskChange, DiskResult, DiskVersion, FileStatus, MergeSession, Middle, MiddleLine, Waiting,
};

mod listing;
use listing::listed;
mod window;
use window::saved_with_everything_waiting;

const TEXT: &str = "src/board.ts";
const FRESH: &str = "src/card.ts";
const BASE: &[u8] = b"top\none\nbottom\n";
/// The line added at the end is a one-sided change git merged cleanly: already in rerere's text.
const LOCAL: &[u8] = b"top\nlocal\nbottom\nadded\n";
const REMOTE: &[u8] = b"top\nremote\nbottom\n";
const RESOLUTION: &str = "top\nlocal and remote\nbottom\nadded\n";
const HAND_FIX: &str = "fixed by hand\n";
const EDITED: &str = "top\nedited in yamt\nbottom\nadded\n";

const BOARD: ConflictFile<'static> = ConflictFile {
    path: TEXT,
    kind: FileKind::Regular,
    base: Some(BASE),
    local: Some(LOCAL),
    remote: Some(REMOTE),
};
const CARD: ConflictFile<'static> = ConflictFile {
    path: FRESH,
    kind: FileKind::Regular,
    base: Some(b"card\n"),
    local: Some(b"card, mine\n"),
    remote: Some(b"card, theirs\n"),
};
const REMEMBERED: [Remembered<'static>; 1] = [Remembered {
    file: BOARD,
    resolution: RESOLUTION.as_bytes(),
}];

fn remembered_repo(fresh: &[ConflictFile], replay: Replay) -> (TempDir, MergeSession) {
    let dir = rerere_repo(&REMEMBERED, fresh, replay).unwrap();
    let session = MergeSession::open(dir.path()).unwrap();
    (dir, session)
}

fn status_of(session: &MergeSession, path: &str) -> FileStatus {
    let files = session.files();
    files.iter().find(|file| file.path == path).unwrap().status
}

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

fn read(dir: &TempDir, path: &str) -> String {
    fs::read_to_string(dir.path().join(path)).unwrap()
}

fn write(dir: &TempDir, path: &str, text: &str) {
    fs::write(dir.path().join(path), text).unwrap();
}

fn one_line<L>(start: L) -> LineRange<L> {
    LineRange { start, len: 1 }
}

fn staged(path: &str) -> DiskChange {
    DiskChange {
        path: path.to_owned(),
        result: DiskResult::Staged,
    }
}

// Catches rerere's text settled as a disk change at the first list and staged unseen (#52 at open).
#[test]
fn a_replayed_resolution_is_listed_remembered_and_stays_unmerged_after_a_list() {
    let (dir, mut session) = remembered_repo(&[], Replay::Review);
    assert_eq!(read(&dir, TEXT), RESOLUTION);

    let list = listed(&mut session);

    assert_eq!(list.disk_changes, []);
    assert_eq!(status_of(&session, TEXT), FileStatus::Remembered);
    assert!(unmerged(&dir).contains(TEXT), "{}", unmerged(&dir));
    assert_eq!(session.remaining(), 1);
}

// Catches today's disk view (no change to review) and a conflict placed away from rerere's lines.
#[test]
fn load_gives_the_remembered_text_and_one_waiting_remembered_conflict_whose_sides_differ_from_base()
{
    let (_dir, mut session) = remembered_repo(&[], Replay::Review);

    let data = session.load(TEXT).unwrap();

    assert_eq!(
        data.middle,
        Middle::Disk {
            text: RESOLUTION.to_owned()
        }
    );
    let [chunk] = data.chunks.as_slice() else {
        panic!("{:?}", data.chunks);
    };
    assert_eq!(chunk.waiting, Waiting::Remembered);
    assert_eq!(chunk.chunk.kind, ChunkKind::Conflict);
    assert_eq!(chunk.middle, one_line(MiddleLine(1)));
    assert_eq!(chunk.chunk.base, one_line(BaseLine(1)));
    assert_eq!(chunk.chunk.local, one_line(LocalLine(1)));
    assert_eq!(chunk.chunk.remote, one_line(RemoteLine(1)));
}

// Catches a Save that writes git's markers back over the resolution rerere replayed.
#[test]
fn a_save_of_the_untouched_file_is_byte_equal_to_the_remembered_text_and_keeps_it_remembered() {
    let (dir, mut session) = remembered_repo(&[], Replay::Review);
    let saved = saved_with_everything_waiting(&session.load(TEXT).unwrap());

    session.save(TEXT, &saved, DiskVersion(0)).unwrap();

    assert_eq!(read(&dir, TEXT), RESOLUTION);
    assert_eq!(listed(&mut session).disk_changes, []);
    assert_eq!(status_of(&session, TEXT), FileStatus::Remembered);
    assert!(unmerged(&dir).contains(TEXT));
}

// Catches Mark resolved leaving a remembered file unmerged.
#[test]
fn finish_stages_a_remembered_file() {
    let (dir, mut session) = remembered_repo(&[], Replay::Review);

    session.finish(TEXT, RESOLUTION, DiskVersion(0)).unwrap();

    assert_eq!(status_of(&session, TEXT), FileStatus::Resolved);
    assert_eq!(unmerged(&dir), "");
    assert_eq!(listed(&mut session).disk_changes, []);
    assert_eq!(session.remaining(), 0);
}

// Catches Reset writing git's markers (or the stages view) instead of what this run found at open.
#[test]
fn reset_gives_the_remembered_bytes_back_and_keeps_it_remembered() {
    let (dir, mut session) = remembered_repo(&[], Replay::Review);
    session.save(TEXT, EDITED, DiskVersion(0)).unwrap();
    assert_eq!(status_of(&session, TEXT), FileStatus::Remembered);
    session.finish(TEXT, EDITED, DiskVersion(0)).unwrap();

    session.reset(TEXT, DiskVersion(0)).unwrap();

    assert_eq!(read(&dir, TEXT), RESOLUTION);
    assert_eq!(status_of(&session, TEXT), FileStatus::Remembered);
    assert!(unmerged(&dir).contains(TEXT));
    assert_eq!(listed(&mut session).disk_changes, []);
    let middle = session.load(TEXT).unwrap().middle;
    assert_eq!(
        middle,
        Middle::Disk {
            text: RESOLUTION.to_owned()
        }
    );
}

// Catches a remembered file that never settles again once something else writes it (#52 after open).
#[test]
fn a_later_change_on_disk_to_a_remembered_file_is_staged_as_today() {
    let (dir, mut session) = remembered_repo(&[], Replay::Review);
    write(&dir, TEXT, HAND_FIX);

    let list = listed(&mut session);

    assert_eq!(list.disk_changes, [staged(TEXT)]);
    assert_eq!(status_of(&session, TEXT), FileStatus::Resolved);
}

// Catches a file git staged itself (`rerere.autoUpdate`) reported as one to review.
#[test]
fn with_auto_update_git_stages_the_replayed_file_and_it_is_not_listed() {
    let (_dir, session) = remembered_repo(&[CARD], Replay::Stage);

    let paths: Vec<String> = session.files().into_iter().map(|file| file.path).collect();

    assert_eq!(paths, [FRESH]);
}

// Catches every conflict of a rerere repository read as remembered.
#[test]
fn a_path_rerere_sees_for_the_first_time_opens_as_a_normal_conflict() {
    let (_dir, mut session) = remembered_repo(&[CARD], Replay::Review);

    assert_eq!(status_of(&session, FRESH), FileStatus::Unresolved);
    assert_eq!(status_of(&session, TEXT), FileStatus::Remembered);
    let data = session.load(FRESH).unwrap();
    assert!(matches!(data.middle, Middle::Stages { .. }), "{data:?}");
    assert!(
        matches!(data.chunks[0].waiting, Waiting::Markers { .. }),
        "{data:?}"
    );
}

// Catches a hand fix of a conflict rerere still tracks taken for a replayed resolution.
#[test]
fn a_hand_fix_before_open_of_a_path_rerere_tracks_is_staged_at_the_first_list() {
    let dir = rerere_repo(&REMEMBERED, &[CARD], Replay::Review).unwrap();
    write(&dir, FRESH, HAND_FIX);
    let mut session = MergeSession::open(dir.path()).unwrap();

    let list = listed(&mut session);

    assert_eq!(list.disk_changes, [staged(FRESH)]);
    assert_eq!(status_of(&session, FRESH), FileStatus::Resolved);
    assert_eq!(status_of(&session, TEXT), FileStatus::Remembered);
}

// Catches a hand fix with rerere off read as a remembered resolution (no `MERGE_RR`).
#[test]
fn with_rerere_off_markers_removed_by_hand_before_open_are_staged_at_the_first_list() {
    let dir = conflict_repo(&[BOARD]).unwrap();
    write(&dir, TEXT, RESOLUTION);
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert_eq!(status_of(&session, TEXT), FileStatus::Unresolved);

    let list = listed(&mut session);

    assert_eq!(list.disk_changes, [staged(TEXT)]);
    assert_eq!(status_of(&session, TEXT), FileStatus::Resolved);
}

// Catches the empty `MERGE_RR` a commit made with rerere on leaves behind, read once rerere is off as
// "rerere replayed this path": the hand fix would stay unmerged as Remembered (#1402).
#[test]
fn with_rerere_switched_off_after_a_committed_rerere_merge_a_hand_fix_before_open_is_staged_at_the_first_list()
 {
    let dir = rerere_repo(&REMEMBERED, &[CARD], Replay::Off).unwrap();
    assert!(dir.path().join(".git/MERGE_RR").is_file());
    write(&dir, FRESH, HAND_FIX);
    let mut session = MergeSession::open(dir.path()).unwrap();

    let list = listed(&mut session);

    assert_eq!(list.disk_changes, [staged(FRESH)]);
    assert_eq!(status_of(&session, FRESH), FileStatus::Resolved);
}

// Catches an unreadable `MERGE_RR` read as "rerere off", which stages a replayed resolution unseen
// at the first list (#1404).
#[test]
fn with_a_merge_rr_record_without_a_tab_a_replayed_resolution_stays_remembered() {
    let dir = rerere_repo(&REMEMBERED, &[], Replay::Review).unwrap();
    fs::write(dir.path().join(".git/MERGE_RR"), "0a1b src/card.ts\0").unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let list = listed(&mut session);

    assert_eq!(list.disk_changes, []);
    assert_eq!(status_of(&session, TEXT), FileStatus::Remembered);
    assert!(unmerged(&dir).contains(TEXT), "{}", unmerged(&dir));
}

// Catches a file whose disk still has git's markers taken for a replayed resolution (#1403).
#[test]
fn a_replayed_path_checked_out_again_with_markers_and_edited_opens_unresolved_in_the_disk_view() {
    let dir = rerere_repo(&REMEMBERED, &[], Replay::Review).unwrap();
    git_ok(dir.path(), &["checkout", "-m", "--", TEXT]).unwrap();
    let markers = read(&dir, TEXT);
    assert!(markers.contains("<<<<<<<"), "{markers}");
    write(&dir, TEXT, &markers.replace("top\n", "top, edited\n"));
    let mut session = MergeSession::open(dir.path()).unwrap();
    assert_eq!(status_of(&session, TEXT), FileStatus::Unresolved);

    let list = listed(&mut session);

    assert_eq!(status_of(&session, TEXT), FileStatus::Unresolved);
    assert!(unmerged(&dir).contains(TEXT), "{list:?}");
    let data = session.load(TEXT).unwrap();
    assert!(matches!(data.middle, Middle::Disk { .. }), "{data:?}");
    let [chunk] = data.chunks.as_slice() else {
        panic!("{:?}", data.chunks);
    };
    assert!(
        matches!(chunk.waiting, Waiting::Markers { .. }),
        "{chunk:?}"
    );
}
