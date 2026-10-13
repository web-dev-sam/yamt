//! A merge stopped on every kind of conflicted path, and a file against a link.

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo};

pub const TEXT: &str = "a_text.txt";
pub const LOCAL_DELETED: &str = "b_local_deleted.txt";
pub const REMOTE_DELETED: &str = "c_remote_deleted.txt";
pub const BINARY: &str = "d_binary.bin";
pub const LATIN1: &str = "e_latin1.txt";
#[cfg(unix)]
pub const SYMLINK: &str = "f_symlink";
pub const SUBMODULE: &str = "g_submodule";

pub const LOCAL_COMMIT: &str = "2222222222222222222222222222222222222222";
pub const REMOTE_COMMIT: &str = "3333333333333333333333333333333333333333";

pub const fn conflict(
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

const EVERY_KIND_OF_CONFLICT: &[ConflictFile<'static>] = {
    use FileKind::{Regular, Submodule};
    &[
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
        #[cfg(unix)]
        conflict(
            SYMLINK,
            FileKind::Symlink,
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

pub fn every_kind_of_conflict() -> TempDir {
    conflict_repo(EVERY_KIND_OF_CONFLICT).unwrap()
}

#[cfg(unix)]
pub const FILE_OR_LINK: &str = "readme";
#[cfg(unix)]
pub const FILE_OR_LINK_RENAMED: &str = "readme~HEAD";

// git's ort merge records a file against a symlink as two paths: "CONFLICT (distinct types): …
// renamed one of them so each can be recorded somewhere" (observed on git 2.56).
#[cfg(unix)]
pub fn file_against_link() -> TempDir {
    use std::fs;
    use yamt_conflict_repo::{git, git_ok};
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
