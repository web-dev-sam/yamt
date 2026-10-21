#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Run, STEP_TWO_FILE, TempDir, edit_stop_repo, git, git_ok, hash_object,
    operation_repo,
};
use yamt_merge_core::ChunkKind;
use yamt_session::{
    DiskVersion, FileMergeData, MergeSession, Middle, Side, SideContent, SideName, Waiting,
};

mod window;
use window::{lines, middle_text, saved_with_everything_waiting};

const TEXT: &str = "a_text.txt";
const GONE: &str = "b_gone.txt";
const PICTURE: &str = "c_picture.bin";
const BASE_TEXT: &str = "one\ntwo\nthree\nfour\nfive\nsix\nseven\n";
const HEAD_TEXT: &str = "one\nTWO-head\nthree\nfour\nfive\nsix\nseven\n";
/// The replayed commit's text: own work in a rebase; its first change is one line longer than HEAD's.
const OWN_TEXT: &str = "one\nTWO-own\nTWO-own-b\nthree\nfour\nfive\nsix\nSEVEN-own\n";
const HEAD_GONE: &[u8] = b"kept, changed by HEAD\n";
const HEAD_PICTURE: &[u8] = b"\0HEAD's picture";
const OWN_PICTURE: &[u8] = b"\0own picture";

/// `local` is HEAD's side and `remote` the applied commit's, as `operation_repo` takes them.
const TEXT_FILE: ConflictFile<'static> = ConflictFile {
    path: TEXT,
    kind: FileKind::Regular,
    base: Some(BASE_TEXT.as_bytes()),
    local: Some(HEAD_TEXT.as_bytes()),
    remote: Some(OWN_TEXT.as_bytes()),
};

const FILES: &[ConflictFile<'static>] = &[
    TEXT_FILE,
    ConflictFile {
        path: GONE,
        kind: FileKind::Regular,
        base: Some(b"kept\n"),
        local: Some(HEAD_GONE),
        remote: None,
    },
    ConflictFile {
        path: PICTURE,
        kind: FileKind::Regular,
        base: Some(b"\0base picture"),
        local: Some(HEAD_PICTURE),
        remote: Some(OWN_PICTURE),
    },
];

fn rebase() -> TempDir {
    operation_repo(Run::Rebase, FILES).unwrap()
}

fn staged_oid(root: &Path, path: &str) -> String {
    let staged = String::from_utf8(git_ok(root, &["ls-files", "-s", "--", path]).unwrap()).unwrap();
    let [_mode, oid, stage_and_path] = staged.split(' ').collect::<Vec<_>>()[..] else {
        panic!("one stage-0 entry expected: {staged:?}");
    };
    assert_eq!(stage_and_path, format!("0\t{path}\n"));
    oid.to_owned()
}

fn chunk_kinds(data: &FileMergeData) -> Vec<ChunkKind> {
    data.chunks.iter().map(|chunk| chunk.chunk.kind).collect()
}

#[test]
fn a_rebase_shows_the_replayed_commit_on_the_left_with_its_own_change_as_local_only() {
    let dir = rebase();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let data = session.load(TEXT).unwrap();

    assert_eq!(data.local, OWN_TEXT);
    assert_eq!(data.remote, HEAD_TEXT);
    assert_eq!(
        chunk_kinds(&data),
        [ChunkKind::Conflict, ChunkKind::LocalOnly]
    );
}

#[test]
fn taking_local_in_a_rebase_stages_the_replayed_commit_s_blob() {
    let dir = rebase();
    let root = dir.path();
    let mut session = MergeSession::open(root).unwrap();

    session.take(TEXT, Side::Local, DiskVersion(0)).unwrap();

    let own_blob = hash_object(root, OWN_TEXT.as_bytes()).unwrap();
    assert_eq!(staged_oid(root, TEXT), own_blob);
    assert_eq!(fs::read_to_string(root.join(TEXT)).unwrap(), OWN_TEXT);
}

#[test]
fn a_file_the_replayed_commit_deleted_is_deleted_on_the_left_and_keep_keeps_head_s_change() {
    let dir = rebase();
    let root = dir.path();
    let mut session = MergeSession::open(root).unwrap();

    assert_eq!(session.load(GONE).unwrap().deleted, Some(Side::Local));
    session.take(GONE, Side::Remote, DiskVersion(0)).unwrap();
    assert_eq!(fs::read(root.join(GONE)).unwrap(), HEAD_GONE);
    assert_eq!(
        staged_oid(root, GONE),
        hash_object(root, HEAD_GONE).unwrap()
    );

    session.reset(GONE, DiskVersion(0)).unwrap();
    session.take(GONE, Side::Local, DiskVersion(0)).unwrap();
    assert!(!root.join(GONE).exists());
    assert_eq!(git_ok(root, &["ls-files", "-s", "--", GONE]).unwrap(), b"");
}

#[test]
fn a_binary_file_s_sides_are_described_and_taken_in_pane_order() {
    let dir = rebase();
    let root = dir.path();
    let mut session = MergeSession::open(root).unwrap();

    let sides = session.describe(PICTURE).unwrap();
    session.take(PICTURE, Side::Local, DiskVersion(0)).unwrap();

    let size = |bytes: &[u8]| SideContent::Binary {
        bytes: bytes.len() as u64,
    };
    assert_eq!(sides.local, size(OWN_PICTURE));
    assert_eq!(sides.remote, size(HEAD_PICTURE));
    let own_blob = hash_object(root, OWN_PICTURE).unwrap();
    assert_eq!(staged_oid(root, PICTURE), own_blob);
}

#[test]
fn saving_a_rebase_s_waiting_conflict_writes_git_s_file_byte_for_byte_in_both_styles() {
    for style in ["merge", "zdiff3"] {
        let dir = rebase();
        let root = dir.path();
        let conflict_style = format!("--conflict={style}");
        git_ok(root, &["checkout", &conflict_style, "--", TEXT]).unwrap();
        let git_wrote = fs::read_to_string(root.join(TEXT)).unwrap();
        let mut session = MergeSession::open(root).unwrap();
        let data = session.load(TEXT).unwrap();
        assert!(matches!(data.middle, Middle::Stages { .. }), "{style}");

        let saved = saved_with_everything_waiting(&data);
        session.save(TEXT, &saved, data.disk_version).unwrap();

        assert_eq!(
            fs::read_to_string(root.join(TEXT)).unwrap(),
            git_wrote,
            "{style}"
        );
    }
}

#[test]
fn a_disk_view_block_is_written_back_as_it_was_and_its_left_section_is_own_work() {
    let dir = rebase();
    let root = dir.path();
    let git_wrote = fs::read_to_string(root.join(TEXT)).unwrap();
    let edited = git_wrote.replacen("one\n", "ONE, by hand\n", 1);
    fs::write(root.join(TEXT), &edited).unwrap();
    let mut session = MergeSession::open(root).unwrap();
    session.refresh().unwrap();

    let data = session.load(TEXT).unwrap();

    assert!(matches!(data.middle, Middle::Disk { .. }), "{data:?}");
    assert_eq!(saved_with_everything_waiting(&data), edited);
    let [chunk] = &data.chunks[..] else {
        panic!("one block expected: {:?}", data.chunks);
    };
    assert!(
        matches!(
            chunk.waiting,
            Waiting::Markers {
                first: Side::Remote,
                ..
            }
        ),
        "{chunk:?}"
    );
    let local: Vec<&str> = data.local.split('\n').collect();
    let remote: Vec<&str> = data.remote.split('\n').collect();
    let left = (chunk.chunk.local.start.0, chunk.chunk.local.len);
    let right = (chunk.chunk.remote.start.0, chunk.chunk.remote.len);
    assert_eq!(lines(&local, left), ["TWO-own", "TWO-own-b"]);
    assert_eq!(lines(&remote, right), ["TWO-head"]);
    assert!(middle_text(&data).starts_with("ONE, by hand\n"));
}

#[test]
fn every_other_operation_keeps_head_on_the_left() {
    for run in [Run::Merge, Run::CherryPick, Run::Revert, Run::RebaseMerges] {
        let dir = operation_repo(run, &[TEXT_FILE]).unwrap();
        let root = dir.path();
        let mut session = MergeSession::open(root).unwrap();

        let data = session.load(TEXT).unwrap();
        session.take(TEXT, Side::Local, DiskVersion(0)).unwrap();

        assert_eq!(data.local, HEAD_TEXT, "{run:?}");
        let head_blob = hash_object(root, HEAD_TEXT.as_bytes()).unwrap();
        assert_eq!(staged_oid(root, TEXT), head_blob, "{run:?}");
    }
}

fn commit_subject(name: Option<&SideName>) -> Option<&str> {
    match name? {
        SideName::Commit { subject, .. } => Some(subject),
        SideName::Branch { .. } | SideName::Revert { .. } | SideName::Patch { .. } => None,
    }
}

// git writes `amend` at a conflicted squash step too; read as an edit stop, the step's own text would be on the right, unnamed.
#[test]
fn a_conflicted_squash_step_shows_its_own_commit_on_the_left_and_names_both_sides() {
    let dir = operation_repo(Run::RebaseSquash, &[TEXT_FILE]).unwrap();
    let root = dir.path();
    git_ok(root, &["add", "--", TEXT]).unwrap();
    assert!(
        !git(root, &["rebase", "--continue"])
            .unwrap()
            .status
            .success()
    );
    let mut session = MergeSession::open(root).unwrap();

    let data = session.load(STEP_TWO_FILE).unwrap();

    assert_eq!(
        (data.local.as_str(), data.remote.as_str()),
        ("remote\n", "local\n")
    );
    let names = session.side_names();
    assert_eq!(commit_subject(names.local.as_ref()), Some("step 2"));
    assert_eq!(commit_subject(names.remote.as_ref()), Some("step 1"));
}

// At an `edit` stop git replays nothing: a pick or a stash pop there is applied onto HEAD, the commit being edited.
#[test]
fn a_pick_or_a_stash_pop_at_a_rebase_s_edit_stop_keeps_head_on_the_left() {
    let dir = edit_stop_repo(&[TEXT_FILE]).unwrap();
    let root = dir.path();
    assert!(
        !git(root, &["cherry-pick", "local"])
            .unwrap()
            .status
            .success()
    );

    let picked = MergeSession::open(root).unwrap().load(TEXT).unwrap();

    assert_eq!(
        (picked.local.as_str(), picked.remote.as_str()),
        (OWN_TEXT, HEAD_TEXT)
    );

    git_ok(root, &["cherry-pick", "--abort"]).unwrap();
    let stashed = OWN_TEXT.replace("SEVEN-own", "SEVEN-stash");
    let later = OWN_TEXT.replace("SEVEN-own", "SEVEN-later");
    fs::write(root.join(TEXT), &stashed).unwrap();
    git_ok(root, &["stash", "--quiet"]).unwrap();
    fs::write(root.join(TEXT), &later).unwrap();
    git_ok(root, &["commit", "--quiet", "--all", "-m", "later"]).unwrap();
    assert!(
        !git(root, &["stash", "pop", "--quiet"])
            .unwrap()
            .status
            .success()
    );

    let popped = MergeSession::open(root).unwrap().load(TEXT).unwrap();

    assert_eq!((popped.local, popped.remote), (later, stashed));
}
