#![cfg(test)]

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok};
use yamt_merge_core::{ChunkKind, Options, compute_chunks, word_changes};
use yamt_session::{Eol, Error, FileEntry, FileStatus, MergeSession, UnsupportedReason};

const MODIFY_TS: &str = "a_modify.ts";
const ADD_ADD: &str = "b_added.txt";
const LOCAL_DELETED: &str = "c_local_deleted.txt";
const REMOTE_DELETED: &str = "d_remote_deleted.txt";
const BINARY: &str = "e_binary.bin";
const LATIN1: &str = "f_latin1.txt";
const CRLF: &str = "g_crlf.txt";
const SUBMODULE: &str = "h_submodule";
const SYMLINK: &str = "i_symlink";

const MODIFY_SIDES: [&str; 3] = [
    "one\ntwo\nthree\n",
    "one\nlocal\nthree\n",
    "one\nremote\nthree\n",
];

const EVERY_KIND_OF_CONFLICT: [ConflictFile<'static>; 7] = [
    ConflictFile {
        path: MODIFY_TS,
        kind: FileKind::Regular,
        base: Some(MODIFY_SIDES[0].as_bytes()),
        local: Some(MODIFY_SIDES[1].as_bytes()),
        remote: Some(MODIFY_SIDES[2].as_bytes()),
    },
    ConflictFile {
        path: ADD_ADD,
        kind: FileKind::Regular,
        base: None,
        local: Some(b"alpha added by local\n"),
        remote: Some(b"bravo added by remote\n"),
    },
    ConflictFile {
        path: LOCAL_DELETED,
        kind: FileKind::Regular,
        base: Some(b"charlie\ndelta\n"),
        local: None,
        remote: Some(b"charlie\nchanged by remote\n"),
    },
    ConflictFile {
        path: REMOTE_DELETED,
        kind: FileKind::Regular,
        base: Some(b"echo\nfoxtrot\n"),
        local: Some(b"echo\nchanged by local\n"),
        remote: None,
    },
    ConflictFile {
        path: BINARY,
        kind: FileKind::Regular,
        base: Some(b"\0binary base"),
        local: Some(b"\0binary local"),
        remote: Some(b"\0binary remote"),
    },
    ConflictFile {
        path: LATIN1,
        kind: FileKind::Regular,
        base: Some(b"caf\xe9 base\n"),
        local: Some(b"caf\xe9 local\n"),
        remote: Some(b"caf\xe9 remote\n"),
    },
    ConflictFile {
        path: CRLF,
        kind: FileKind::Regular,
        base: Some(b"golf\r\nhotel\r\n"),
        local: Some(b"golf\r\nlocal\r\n"),
        remote: Some(b"golf\r\nremote\r\n"),
    },
];

fn every_kind_of_conflict() -> TempDir {
    conflict_repo(&EVERY_KIND_OF_CONFLICT).unwrap()
}

fn unmerged_paths_in_git_order(dir: &TempDir) -> Vec<String> {
    let output = git_ok(dir.path(), &["ls-files", "-u", "-z"]).unwrap();
    let mut paths: Vec<String> = Vec::new();
    for record in output
        .split(|&byte| byte == b'\0')
        .filter(|r| !r.is_empty())
    {
        let tab = record.iter().position(|&byte| byte == b'\t').unwrap();
        let path = String::from_utf8(record[tab + 1..].to_vec()).unwrap();
        if paths.last() != Some(&path) {
            paths.push(path);
        }
    }
    paths
}

fn unsupported_error(session: &mut MergeSession, path: &str) -> UnsupportedReason {
    let error = session.load(path).unwrap_err();
    let Error::Unsupported {
        path: error_path,
        reason,
    } = error
    else {
        panic!("expected Unsupported for {path}, got {error:?}");
    };
    assert_eq!(error_path, path);
    reason
}

#[test]
fn open_lists_each_conflicted_file_once_in_git_order_with_its_unsupported_reason() {
    let dir = every_kind_of_conflict();

    let session = MergeSession::open(dir.path()).unwrap();

    let expected = [
        (MODIFY_TS, None),
        (ADD_ADD, None),
        (LOCAL_DELETED, Some(UnsupportedReason::LocalDeleted)),
        (REMOTE_DELETED, Some(UnsupportedReason::RemoteDeleted)),
        (BINARY, Some(UnsupportedReason::Binary)),
        (LATIN1, Some(UnsupportedReason::NonUtf8)),
        (CRLF, None),
    ]
    .map(|(path, unsupported)| FileEntry {
        path: path.to_owned(),
        status: FileStatus::Unresolved,
        unsupported,
    });
    let files = session.files();
    assert_eq!(files, expected);
    let listed: Vec<String> = files.into_iter().map(|file| file.path).collect();
    assert_eq!(listed, unmerged_paths_in_git_order(&dir));
    assert_eq!(session.remaining(), expected.len());
}

#[test]
fn load_modify_modify_typescript_returns_three_sides_and_their_chunks() {
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let data = session.load(MODIFY_TS).unwrap();

    let [base, local, remote] = MODIFY_SIDES;
    assert_eq!(data.path, MODIFY_TS);
    assert_eq!(
        [&data.base, &data.local, &data.remote],
        [base, local, remote]
    );
    assert_eq!(data.eol, Eol::Lf);
    assert_eq!(
        data.chunks,
        compute_chunks(base, local, remote, &Options::default())
    );
    assert_eq!(
        data.word_changes,
        word_changes(base, local, remote, &data.chunks)
    );
    let word_chunks: Vec<_> = data.word_changes.iter().map(|words| words.chunk).collect();
    let chunk_ids: Vec<_> = data.chunks.iter().map(|chunk| chunk.id).collect();
    assert_eq!(word_chunks, chunk_ids);
}

#[test]
fn load_add_add_has_empty_base_and_one_conflict_chunk() {
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let data = session.load(ADD_ADD).unwrap();

    assert_eq!(data.base, "");
    let kinds: Vec<ChunkKind> = data.chunks.iter().map(|chunk| chunk.kind).collect();
    assert_eq!(kinds, [ChunkKind::Conflict]);
}

#[test]
fn load_refuses_deleted_binary_and_non_utf8_files_with_their_reason() {
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let cases = [
        (LOCAL_DELETED, UnsupportedReason::LocalDeleted),
        (REMOTE_DELETED, UnsupportedReason::RemoteDeleted),
        (BINARY, UnsupportedReason::Binary),
        (LATIN1, UnsupportedReason::NonUtf8),
    ];
    for (path, reason) in cases {
        assert_eq!(unsupported_error(&mut session, path), reason);
    }
}

#[test]
fn load_refuses_a_side_over_eight_mib_as_too_large() {
    const PATH: &str = "huge.txt";
    const EIGHT_MIB: usize = 8 * 1024 * 1024;
    let huge_local = "x".repeat(EIGHT_MIB) + "\n";
    let dir = conflict_repo(&[ConflictFile {
        path: PATH,
        kind: FileKind::Regular,
        base: Some(b"base\n"),
        local: Some(huge_local.as_bytes()),
        remote: Some(b"remote\n"),
    }])
    .unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();

    assert_eq!(
        session.files()[0].unsupported,
        Some(UnsupportedReason::TooLarge)
    );
    assert_eq!(
        unsupported_error(&mut session, PATH),
        UnsupportedReason::TooLarge
    );
}

#[test]
fn load_add_add_crlf_file_takes_its_eol_from_local() {
    const PATH: &str = "added_crlf.txt";
    let dir = conflict_repo(&[ConflictFile {
        path: PATH,
        kind: FileKind::Regular,
        base: None,
        local: Some(b"india\r\nlocal\r\n"),
        remote: Some(b"india\r\nremote\r\n"),
    }])
    .unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();

    let data = session.load(PATH).unwrap();

    assert_eq!(data.base, "");
    assert_eq!(data.eol, Eol::CrLf);
}

const NON_REGULAR_NEXT_TO_TEXT: [ConflictFile<'static>; 3] = [
    ConflictFile {
        path: MODIFY_TS,
        kind: FileKind::Regular,
        base: Some(MODIFY_SIDES[0].as_bytes()),
        local: Some(MODIFY_SIDES[1].as_bytes()),
        remote: Some(MODIFY_SIDES[2].as_bytes()),
    },
    ConflictFile {
        path: SUBMODULE,
        kind: FileKind::Submodule,
        base: Some(b"1111111111111111111111111111111111111111"),
        local: Some(b"2222222222222222222222222222222222222222"),
        remote: Some(b"3333333333333333333333333333333333333333"),
    },
    ConflictFile {
        path: SYMLINK,
        kind: FileKind::Symlink,
        base: Some(b"base-target"),
        local: Some(b"local-target"),
        remote: Some(b"remote-target"),
    },
];

#[test]
fn submodule_and_symlink_conflicts_are_unsupported_and_the_text_file_still_loads() {
    let dir = conflict_repo(&NON_REGULAR_NEXT_TO_TEXT).unwrap();

    let mut session = MergeSession::open(dir.path()).unwrap();

    let listed: Vec<(String, Option<UnsupportedReason>)> = session
        .files()
        .into_iter()
        .map(|file| (file.path, file.unsupported))
        .collect();
    let expected = [
        (MODIFY_TS.to_owned(), None),
        (SUBMODULE.to_owned(), Some(UnsupportedReason::Submodule)),
        (SYMLINK.to_owned(), Some(UnsupportedReason::Symlink)),
    ];
    assert_eq!(listed, expected);
    for (path, reason) in [
        (SUBMODULE, UnsupportedReason::Submodule),
        (SYMLINK, UnsupportedReason::Symlink),
    ] {
        assert_eq!(unsupported_error(&mut session, path), reason);
        let error = session.finish(path, "text\n").unwrap_err();
        assert!(
            matches!(&error, Error::Unsupported { reason: refused, .. } if *refused == reason),
            "{error:?}"
        );
    }
    assert_eq!(session.load(MODIFY_TS).unwrap().local, MODIFY_SIDES[1]);
}

#[test]
fn reset_of_a_submodule_conflict_keeps_its_stages_and_leaves_it_unresolved() {
    let dir = conflict_repo(&NON_REGULAR_NEXT_TO_TEXT).unwrap();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before = git_ok(dir.path(), &["ls-files", "-u"]).unwrap();

    session.reset(SUBMODULE).unwrap();

    assert_eq!(git_ok(dir.path(), &["ls-files", "-u"]).unwrap(), before);
    let files = session.files();
    let submodule = files.iter().find(|file| file.path == SUBMODULE).unwrap();
    assert_eq!(submodule.status, FileStatus::Unresolved);
}
