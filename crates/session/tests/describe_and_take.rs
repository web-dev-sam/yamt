#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git, git_ok};
use yamt_session::{FileStatus, MergeSession, Side, SideContent, UnsupportedReason};

const TEXT: &str = "a_text.txt";
const LOCAL_DELETED: &str = "b_local_deleted.txt";
const REMOTE_DELETED: &str = "c_remote_deleted.txt";
const BINARY: &str = "d_binary.bin";
const LATIN1: &str = "e_latin1.txt";
const SYMLINK: &str = "f_symlink";
const SUBMODULE: &str = "g_submodule";

const LOCAL_COMMIT: &str = "2222222222222222222222222222222222222222";
const REMOTE_COMMIT: &str = "3333333333333333333333333333333333333333";

const fn conflict(
    path: &'static str,
    kind: FileKind,
    sides: [Option<&'static [u8]>; 3],
) -> ConflictFile<'static> {
    let [base, local, remote] = sides;
    ConflictFile {
        path,
        kind,
        base,
        local,
        remote,
    }
}

const EVERY_KIND_OF_CONFLICT: [ConflictFile<'static>; 7] = {
    use FileKind::{Regular, Submodule, Symlink};
    [
        conflict(
            TEXT,
            Regular,
            [
                Some(b"one\ntwo\nthree\n"),
                Some(b"one\nlocal\nthree\n"),
                Some(b"one\nremote\nthree\nfour\n"),
            ],
        ),
        conflict(
            LOCAL_DELETED,
            Regular,
            [Some(b"kept\nbase\n"), None, Some(b"kept\nremote\n")],
        ),
        conflict(
            REMOTE_DELETED,
            Regular,
            [Some(b"kept\nbase\n"), Some(b"kept\nlocal\nmore\n"), None],
        ),
        conflict(
            BINARY,
            Regular,
            [Some(b"\0base"), Some(b"\0local"), Some(b"\0remote!")],
        ),
        conflict(
            LATIN1,
            Regular,
            [
                Some(b"caf\xe9\n"),
                Some(b"caf\xe9!\n"),
                Some(b"caf\xe9 remote\n"),
            ],
        ),
        conflict(
            SYMLINK,
            Symlink,
            [
                Some(b"base-target"),
                Some(b"local-target"),
                Some(b"remote-target"),
            ],
        ),
        conflict(
            SUBMODULE,
            Submodule,
            [
                Some(b"1111111111111111111111111111111111111111"),
                Some(LOCAL_COMMIT.as_bytes()),
                Some(REMOTE_COMMIT.as_bytes()),
            ],
        ),
    ]
};

fn every_kind_of_conflict() -> TempDir {
    conflict_repo(&EVERY_KIND_OF_CONFLICT).unwrap()
}

const FILE_OR_LINK: &str = "readme";
const FILE_OR_LINK_RENAMED: &str = "readme~HEAD";

// git's ort merge records a file against a symlink as two paths: "CONFLICT (distinct types): …
// renamed one of them so each can be recorded somewhere" (observed on git 2.56).
fn file_against_link() -> TempDir {
    let dir = TempDir::new().unwrap();
    let root = dir.path();
    let commit = |message: &str| {
        git_ok(root, &["add", "--all"]).unwrap();
        git_ok(root, &["commit", "--quiet", "-m", message]).unwrap();
    };
    git_ok(root, &["init", "--quiet"]).unwrap();
    fs::write(root.join(FILE_OR_LINK), "base\n").unwrap();
    commit("base");
    git_ok(root, &["checkout", "--quiet", "-b", "local"]).unwrap();
    fs::write(root.join(FILE_OR_LINK), "local\nfile\n").unwrap();
    commit("local");
    git_ok(root, &["checkout", "--quiet", "-b", "remote", "main"]).unwrap();
    fs::remove_file(root.join(FILE_OR_LINK)).unwrap();
    std::os::unix::fs::symlink("docs/README.md", root.join(FILE_OR_LINK)).unwrap();
    commit("remote");
    git_ok(root, &["checkout", "--quiet", "local"]).unwrap();
    assert!(
        !git(root, &["merge", "--quiet", "remote"])
            .unwrap()
            .status
            .success()
    );
    dir
}

fn unmerged(dir: &TempDir) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-u"]).unwrap()).unwrap()
}

fn staged(dir: &TempDir, path: &str) -> String {
    String::from_utf8(git_ok(dir.path(), &["ls-files", "-s", "--", path]).unwrap()).unwrap()
}

fn status_of(session: &MergeSession, path: &str) -> FileStatus {
    let files = session.files();
    files.iter().find(|file| file.path == path).unwrap().status
}

fn stage_zero_of(unmerged: &str, path: &str, side: Side) -> String {
    let stage = match side {
        Side::Local => " 2\t",
        Side::Remote => " 3\t",
    };
    let record_end = format!("{stage}{path}");
    let line = unmerged.lines().find(|line| line.ends_with(&record_end));
    line.map(|line| format!("{}\n", line.replace(stage, " 0\t")))
        .unwrap_or_default()
}

fn described_sides(session: &mut MergeSession, path: &str) -> (SideContent, SideContent) {
    let sides = session.describe(path).unwrap();
    assert_eq!(sides.path, path);
    (sides.local, sides.remote)
}

#[test]
fn describe_counts_the_lines_of_text_sides_and_names_a_deleted_side_missing() {
    use SideContent::{Missing, Text};
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let mut described = |path| described_sides(&mut session, path);
    assert_eq!(described(TEXT), (Text { lines: 3 }, Text { lines: 4 }));
    assert_eq!(described(LOCAL_DELETED), (Missing, Text { lines: 2 }));
    assert_eq!(described(REMOTE_DELETED), (Text { lines: 3 }, Missing));
}

#[test]
fn describe_gives_sizes_of_unreadable_sides_link_targets_and_commit_ids() {
    use SideContent::{Binary, Commit, Link, NonUtf8};
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let mut described = |path| described_sides(&mut session, path);
    let link = |target: &str| Link {
        target: target.to_owned(),
    };
    let commit = |id: &str| Commit { id: id.to_owned() };
    assert_eq!(
        described(BINARY),
        (Binary { bytes: 6 }, Binary { bytes: 8 })
    );
    assert_eq!(
        described(LATIN1),
        (NonUtf8 { bytes: 6 }, NonUtf8 { bytes: 12 })
    );
    assert_eq!(
        described(SYMLINK),
        (link("local-target"), link("remote-target"))
    );
    assert_eq!(
        described(SUBMODULE),
        (commit(LOCAL_COMMIT), commit(REMOTE_COMMIT))
    );
}

#[test]
fn describe_reports_the_file_reason_and_none_for_a_text_file() {
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let reasons = [
        (TEXT, None),
        (LOCAL_DELETED, Some(UnsupportedReason::LocalDeleted)),
        (REMOTE_DELETED, Some(UnsupportedReason::RemoteDeleted)),
        (BINARY, Some(UnsupportedReason::Binary)),
        (LATIN1, Some(UnsupportedReason::NonUtf8)),
        (SYMLINK, Some(UnsupportedReason::Symlink)),
        (SUBMODULE, Some(UnsupportedReason::Submodule)),
    ];
    for (path, reason) in reasons {
        assert_eq!(session.describe(path).unwrap().reason, reason, "{path}");
    }
}

#[test]
fn describe_a_file_against_a_link_shows_the_file_and_the_link_target() {
    use SideContent::{Link, Missing, Text};
    let dir = file_against_link();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let link = Link {
        target: "docs/README.md".to_owned(),
    };

    assert_eq!(described_sides(&mut session, FILE_OR_LINK), (Missing, link));
    let renamed = described_sides(&mut session, FILE_OR_LINK_RENAMED);
    assert_eq!(renamed, (Text { lines: 2 }, Missing));
    let reason = session.describe(FILE_OR_LINK).unwrap().reason;
    assert_eq!(reason, Some(UnsupportedReason::Symlink));
}

fn assert_take_resolves_to_that_side(dir: &TempDir, path: &str, side: Side) {
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before = unmerged(dir);
    let remaining = session.remaining();

    session.take(path, side).unwrap();

    let tab_path = format!("\t{path}");
    let still_unmerged = unmerged(dir).lines().any(|line| line.ends_with(&tab_path));
    assert!(!still_unmerged, "{}", unmerged(dir));
    assert_eq!(staged(dir, path), stage_zero_of(&before, path, side));
    assert_eq!(status_of(&session, path), FileStatus::Resolved);
    assert_eq!(session.remaining(), remaining - 1);
}

fn taken(path: &str, side: Side) -> TempDir {
    let dir = every_kind_of_conflict();
    assert_take_resolves_to_that_side(&dir, path, side);
    dir
}

#[test]
fn take_of_a_binary_file_stages_and_writes_the_chosen_side_with_fresh_stat_data() {
    for (side, bytes) in [
        (Side::Local, b"\0local".as_slice()),
        (Side::Remote, b"\0remote!"),
    ] {
        let dir = taken(BINARY, side);
        assert_eq!(fs::read(dir.path().join(BINARY)).unwrap(), bytes);
        let diff_files = git(dir.path(), &["diff-files", "--quiet", "--", BINARY]).unwrap();
        assert!(diff_files.status.success(), "{diff_files:?}");
    }
}

#[test]
fn take_of_a_symlink_makes_the_worktree_a_link_to_the_chosen_target() {
    for (side, target) in [
        (Side::Local, "local-target"),
        (Side::Remote, "remote-target"),
    ] {
        let dir = taken(SYMLINK, side);
        assert_eq!(
            fs::read_link(dir.path().join(SYMLINK)).unwrap(),
            Path::new(target)
        );
    }
}

#[test]
fn take_of_a_file_against_a_link_writes_the_link_and_the_file() {
    let dir = file_against_link();
    fs::remove_file(dir.path().join(FILE_OR_LINK)).unwrap();
    fs::remove_file(dir.path().join(FILE_OR_LINK_RENAMED)).unwrap();
    assert_take_resolves_to_that_side(&dir, FILE_OR_LINK, Side::Remote);
    assert_take_resolves_to_that_side(&dir, FILE_OR_LINK_RENAMED, Side::Local);
    assert_eq!(
        fs::read_link(dir.path().join(FILE_OR_LINK)).unwrap(),
        Path::new("docs/README.md")
    );
    assert_eq!(
        fs::read(dir.path().join(FILE_OR_LINK_RENAMED)).unwrap(),
        b"local\nfile\n"
    );
}

#[test]
fn take_of_the_deleting_side_removes_index_entry_and_worktree_file() {
    for (path, side) in [(LOCAL_DELETED, Side::Local), (REMOTE_DELETED, Side::Remote)] {
        let dir = taken(path, side);
        assert_eq!(staged(&dir, path), "");
        assert!(dir.path().join(path).symlink_metadata().is_err());
    }
}

#[test]
fn take_of_the_deleting_side_accepts_a_worktree_file_already_gone() {
    let dir = every_kind_of_conflict();
    fs::remove_file(dir.path().join(LOCAL_DELETED)).unwrap();
    assert_take_resolves_to_that_side(&dir, LOCAL_DELETED, Side::Local);
    assert_eq!(staged(&dir, LOCAL_DELETED), "");
}

#[test]
fn take_of_the_deleting_side_of_a_submodule_unstages_it_and_leaves_its_directory() {
    const DELETED_SUBMODULE: &str = "vendor/lib";
    let dir = conflict_repo(&[conflict(
        DELETED_SUBMODULE,
        FileKind::Submodule,
        [
            Some(LOCAL_COMMIT.as_bytes()),
            Some(REMOTE_COMMIT.as_bytes()),
            None,
        ],
    )])
    .unwrap();
    fs::create_dir_all(dir.path().join(DELETED_SUBMODULE)).unwrap();

    assert_take_resolves_to_that_side(&dir, DELETED_SUBMODULE, Side::Remote);

    assert_eq!(staged(&dir, DELETED_SUBMODULE), "");
    assert!(dir.path().join(DELETED_SUBMODULE).is_dir());
}

#[test]
fn take_of_the_kept_side_of_a_deleted_file_restores_it() {
    for (path, side, bytes) in [
        (LOCAL_DELETED, Side::Remote, b"kept\nremote\n".as_slice()),
        (REMOTE_DELETED, Side::Local, b"kept\nlocal\nmore\n"),
    ] {
        let dir = every_kind_of_conflict();
        fs::remove_file(dir.path().join(path)).unwrap();
        assert_take_resolves_to_that_side(&dir, path, side);
        assert_eq!(fs::read(dir.path().join(path)).unwrap(), bytes);
    }
}

#[test]
fn take_of_a_submodule_stages_the_chosen_commit_and_leaves_its_worktree_alone() {
    for (side, commit) in [(Side::Local, LOCAL_COMMIT), (Side::Remote, REMOTE_COMMIT)] {
        let dir = every_kind_of_conflict();
        fs::remove_dir(dir.path().join(SUBMODULE)).unwrap();
        assert_take_resolves_to_that_side(&dir, SUBMODULE, side);
        assert_eq!(
            staged(&dir, SUBMODULE),
            format!("160000 {commit} 0\t{SUBMODULE}\n")
        );
        assert!(dir.path().join(SUBMODULE).symlink_metadata().is_err());
    }
}

#[test]
fn reset_after_take_brings_back_the_stages_of_every_kind() {
    let kinds = [
        (TEXT, Side::Remote),
        (LOCAL_DELETED, Side::Local),
        (REMOTE_DELETED, Side::Local),
        (BINARY, Side::Remote),
        (LATIN1, Side::Local),
        (SYMLINK, Side::Remote),
        (SUBMODULE, Side::Local),
    ];
    let dir = every_kind_of_conflict();
    let mut session = MergeSession::open(dir.path()).unwrap();
    let before = unmerged(&dir);
    for (path, side) in kinds {
        session.take(path, side).unwrap();
    }
    assert_eq!(unmerged(&dir), "");
    git_ok(dir.path(), &["update-index", "--clear-resolve-undo"]).unwrap();

    for (path, _) in kinds {
        session.reset(path).unwrap();
    }

    assert_eq!(unmerged(&dir), before);
    assert_eq!(session.remaining(), kinds.len());
}
