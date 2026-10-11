#![cfg(test)]

use std::fs;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok};
use yamt_merge_core::ChunkKind;
use yamt_session::{
    DiskVersion, Eol, Error, FileStatus, MergeSession, Middle, Side, UnsupportedReason,
};

const LOCAL_DELETED: &str = "a_local_deleted.ts";
const REMOTE_DELETED: &str = "b_remote_deleted.ts";
const KEPT_BINARY: &str = "c_kept_binary.bin";
const BASE_BINARY: &str = "d_base_binary.txt";
const KEPT_LATIN1: &str = "e_kept_latin1.txt";
const KEPT_LINK: &str = "f_kept_link";
const EMPTY_BASE_CRLF: &str = "g_empty_base_crlf.ts";
const BASE: &[u8] = b"one\ntwo\nthree\nfour\n";
const KEPT: &[u8] = b"one\nTWO\nthree\nfour\nfive\n";

const fn deleted(
    path: &'static str,
    kind: FileKind,
    base: &'static [u8],
    local: Option<&'static [u8]>,
    remote: Option<&'static [u8]>,
) -> ConflictFile<'static> {
    ConflictFile {
        path,
        kind,
        base: Some(base),
        local,
        remote,
    }
}

const DELETED_ON_ONE_SIDE: [ConflictFile<'static>; 7] = {
    use FileKind::{Regular, Symlink};
    [
        deleted(LOCAL_DELETED, Regular, BASE, None, Some(KEPT)),
        deleted(REMOTE_DELETED, Regular, BASE, Some(KEPT), None),
        deleted(KEPT_BINARY, Regular, b"base\n", Some(b"\0kept"), None),
        deleted(BASE_BINARY, Regular, b"\0base", None, Some(b"kept\n")),
        deleted(KEPT_LATIN1, Regular, b"base\n", None, Some(b"caf\xe9\n")),
        deleted(
            KEPT_LINK,
            Symlink,
            b"base-target",
            Some(b"kept-target"),
            None,
        ),
        deleted(
            EMPTY_BASE_CRLF,
            Regular,
            b"",
            None,
            Some(b"kept\r\nlines\r\n"),
        ),
    ]
};

fn deleted_on_one_side() -> TempDir {
    conflict_repo(&DELETED_ON_ONE_SIDE).unwrap()
}

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

#[test]
fn a_text_file_deleted_on_one_side_loads_with_base_as_the_deleted_side() {
    let dir = deleted_on_one_side();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let base = std::str::from_utf8(BASE).unwrap();
    let kept = std::str::from_utf8(KEPT).unwrap();
    let cases = [
        (LOCAL_DELETED, Side::Local, ChunkKind::RemoteOnly),
        (REMOTE_DELETED, Side::Remote, ChunkKind::LocalOnly),
    ];
    for (path, side, kept_side_change) in cases {
        let data = session.load(path).unwrap();

        assert_eq!(data.deleted, Some(side), "{path}");
        let base_text = Middle::Stages {
            text: base.to_owned(),
        };
        assert_eq!(data.middle, base_text);
        let (deleted_text, kept_text) = match side {
            Side::Local => (&data.local, &data.remote),
            Side::Remote => (&data.remote, &data.local),
        };
        assert_eq!((deleted_text.as_str(), kept_text.as_str()), (base, kept));
        let kinds: Vec<ChunkKind> = data.chunks.iter().map(|chunk| chunk.chunk.kind).collect();
        let one_sided = kinds.iter().all(|kind| *kind == kept_side_change);
        assert!(!kinds.is_empty() && one_sided, "{path}: {kinds:?}");
    }
}

#[test]
fn a_deleted_file_with_an_empty_base_takes_its_line_endings_from_the_kept_side() {
    let dir = deleted_on_one_side();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let data = session.load(EMPTY_BASE_CRLF).unwrap();

    assert_eq!(data.deleted, Some(Side::Local));
    assert_eq!(data.eol, Eol::CrLf);
}

#[test]
fn a_deleted_file_whose_other_side_or_base_is_not_text_keeps_its_deleted_reason() {
    let dir = deleted_on_one_side();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let listed: Vec<_> = session
        .files()
        .into_iter()
        .map(|file| (file.path, file.unsupported))
        .collect();
    let expected = [
        (LOCAL_DELETED, None),
        (REMOTE_DELETED, None),
        (KEPT_BINARY, Some(UnsupportedReason::RemoteDeleted)),
        (BASE_BINARY, Some(UnsupportedReason::LocalDeleted)),
        (KEPT_LATIN1, Some(UnsupportedReason::LocalDeleted)),
        (KEPT_LINK, Some(UnsupportedReason::Symlink)),
        (EMPTY_BASE_CRLF, None),
    ]
    .map(|(path, reason)| (path.to_owned(), reason));
    assert_eq!(listed, expected);
    let error = session.load(KEPT_BINARY).unwrap_err();
    assert!(
        matches!(
            error,
            Error::Unsupported {
                reason: UnsupportedReason::RemoteDeleted,
                ..
            }
        ),
        "{error:?}"
    );
}

#[test]
fn keep_or_delete_then_reset_brings_the_stages_back_and_leaves_the_worktree() {
    let dir = deleted_on_one_side();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before = unmerged(&dir);
    for side in [Side::Remote, Side::Local] {
        session.take(LOCAL_DELETED, side, DiskVersion(0)).unwrap();
        let worktree_after_take = fs::read(dir.path().join(LOCAL_DELETED)).ok();
        assert!(!unmerged(&dir).contains(LOCAL_DELETED), "{side:?}");
        git_ok(dir.path(), &["update-index", "--clear-resolve-undo"]).unwrap();

        session.reset(LOCAL_DELETED, DiskVersion(0)).unwrap();

        assert_eq!(unmerged(&dir), before, "{side:?}");
        let worktree = fs::read(dir.path().join(LOCAL_DELETED)).ok();
        assert_eq!(worktree, worktree_after_take, "{side:?}");
        assert_eq!(session.files()[0].status, FileStatus::Unresolved);
    }
}

#[test]
fn keep_writes_and_stages_the_kept_side_and_delete_removes_the_file() {
    let dir = deleted_on_one_side();
    let mut session = MergeSession::open(dir.path()).unwrap();

    session
        .take(LOCAL_DELETED, Side::Remote, DiskVersion(0))
        .unwrap();
    session
        .take(REMOTE_DELETED, Side::Remote, DiskVersion(0))
        .unwrap();

    assert_eq!(fs::read(dir.path().join(LOCAL_DELETED)).unwrap(), KEPT);
    let staged = git_ok(dir.path(), &["ls-files", "-s", "--", LOCAL_DELETED]).unwrap();
    assert!(String::from_utf8(staged).unwrap().contains(" 0\t"));
    assert!(!dir.path().join(REMOTE_DELETED).exists());
    let staged = git_ok(dir.path(), &["ls-files", "-s", "--", REMOTE_DELETED]).unwrap();
    assert_eq!(staged, b"");
}

#[test]
fn finish_of_a_deleted_on_one_side_file_writes_and_stages_the_result() {
    let dir = deleted_on_one_side();
    let mut session = MergeSession::open(dir.path()).unwrap();

    session
        .finish(REMOTE_DELETED, "merged\n", DiskVersion(0))
        .unwrap();

    assert_eq!(
        fs::read(dir.path().join(REMOTE_DELETED)).unwrap(),
        b"merged\n"
    );
    assert!(!unmerged(&dir).contains(REMOTE_DELETED));
}
