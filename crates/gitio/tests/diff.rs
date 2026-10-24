#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use yamt_conflict_repo::{
    ConflictFile, FileKind, TempDir, diverged_repo, git_ok, hash_object, run_ignored_in_child,
};
use yamt_gitio::{Changed, ChangedFile, Error, Numstat, Oid, Repo, TreeSide};

const REGULAR: u32 = 0o100_644;
const EXECUTABLE: u32 = 0o100_755;
const LINK: u32 = 0o120_000;
const GITLINK: u32 = 0o160_000;
const FIRST_COMMIT: &str = "1111111111111111111111111111111111111111";
const SECOND_COMMIT: &str = "2222222222222222222222222222222222222222";
const USERS_DIFF_CONFIG_TEST: &str = "listing_under_the_users_diff_config";

fn oid_of(root: &Path, revision: &str) -> Oid {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    Oid::parse(String::from_utf8(output).unwrap().trim_end()).unwrap()
}

fn blob(root: &Path, content: &[u8]) -> Oid {
    Oid::parse(&hash_object(root, content).unwrap()).unwrap()
}

fn side(path: &str, mode: u32, oid: Oid) -> TreeSide {
    TreeSide {
        path: PathBuf::from(path),
        mode,
        oid,
    }
}

fn lines(added: u32, removed: u32) -> Numstat {
    Numstat::Lines { added, removed }
}

fn counted(change: Changed, added: u32, removed: u32) -> ChangedFile {
    let numstat = lines(added, removed);
    ChangedFile { change, numstat }
}

/// A file of the scripted repository: `base` on `main`, `local` on the checked-out branch `local`.
fn regular<'a>(path: &'a str, base: Option<&'a [u8]>, local: Option<&'a [u8]>) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote: base,
    }
}

/// What changed from `main` to HEAD.
fn listed(root: &Path) -> Vec<ChangedFile> {
    let repo = Repo::discover(root).unwrap();
    repo.changed_files(&oid_of(root, "main"), &oid_of(root, "HEAD"))
        .unwrap()
}

fn commit(root: &Path, message: &str) {
    git_ok(root, &["commit", "--quiet", "-m", message]).unwrap();
}

fn stage_blob(root: &Path, mode: &str, oid: &Oid, path: &str) {
    let cacheinfo = format!("{mode},{},{path}", oid.as_str());
    git_ok(root, &["update-index", "--add", "--cacheinfo", &cacheinfo]).unwrap();
}

#[test]
fn added_modified_deleted_files_are_listed_with_git_s_counts() {
    let added: &[u8] = b"a\nb\n";
    let (edited_before, edited_after): (&[u8], &[u8]) =
        (b"one\ntwo\nthree\n", b"one\n2\nthree\nfour\n");
    let removed: &[u8] = b"x\ny\nz\n";
    let dir = diverged_repo(&[
        regular("added.txt", None, Some(added)),
        regular("edited.txt", Some(edited_before), Some(edited_after)),
        regular("removed.txt", Some(removed), None),
    ])
    .unwrap();
    let root = dir.path();

    let files = listed(root);

    let expected = vec![
        ChangedFile {
            change: Changed::Added {
                new: side("added.txt", REGULAR, blob(root, added)),
            },
            numstat: lines(2, 0),
        },
        ChangedFile {
            change: Changed::Modified {
                old: side("edited.txt", REGULAR, blob(root, edited_before)),
                new: side("edited.txt", REGULAR, blob(root, edited_after)),
            },
            numstat: lines(2, 1),
        },
        ChangedFile {
            change: Changed::Deleted {
                old: side("removed.txt", REGULAR, blob(root, removed)),
            },
            numstat: lines(0, 3),
        },
    ];
    assert_eq!(files, expected);
}

#[test]
fn a_renamed_file_lists_both_paths_and_counts_only_its_edits() {
    let before: &[u8] = b"1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n";
    let after: &[u8] = b"1\n2\n3\n4\nfive\n6\n7\n8\n9\n10\n";
    let dir = diverged_repo(&[
        regular("old/name.txt", Some(before), None),
        regular("new/name.txt", None, Some(after)),
    ])
    .unwrap();
    let root = dir.path();

    let files = listed(root);

    let expected = vec![ChangedFile {
        change: Changed::Renamed {
            old: side("old/name.txt", REGULAR, blob(root, before)),
            new: side("new/name.txt", REGULAR, blob(root, after)),
        },
        numstat: lines(1, 1),
    }];
    assert_eq!(files, expected);
}

#[test]
fn a_binary_file_is_listed_without_counts() {
    let (before, after): (&[u8], &[u8]) = (b"\x89PNG\0\x01\n", b"\x89PNG\0\x02\n");
    let dir = diverged_repo(&[
        regular("logo.png", Some(before), Some(after)),
        regular("added.bin", None, Some(b"\0\0\0")),
    ])
    .unwrap();
    let root = dir.path();

    let files = listed(root);

    let expected = vec![
        ChangedFile {
            change: Changed::Added {
                new: side("added.bin", REGULAR, blob(root, b"\0\0\0")),
            },
            numstat: Numstat::Binary,
        },
        ChangedFile {
            change: Changed::Modified {
                old: side("logo.png", REGULAR, blob(root, before)),
                new: side("logo.png", REGULAR, blob(root, after)),
            },
            numstat: Numstat::Binary,
        },
    ];
    assert_eq!(files, expected);
}

#[test]
fn a_mode_only_change_lists_both_modes_and_one_blob_id() {
    let script: &[u8] = b"echo hi\n";
    let dir = diverged_repo(&[regular("run.sh", Some(script), Some(script))]).unwrap();
    let root = dir.path();
    git_ok(root, &["update-index", "--chmod=+x", "run.sh"]).unwrap();
    commit(root, "executable");

    let files = listed(root);

    let expected = vec![ChangedFile {
        change: Changed::Modified {
            old: side("run.sh", REGULAR, blob(root, script)),
            new: side("run.sh", EXECUTABLE, blob(root, script)),
        },
        numstat: lines(0, 0),
    }];
    assert_eq!(files, expected);
}

#[test]
fn a_submodule_commit_change_is_listed_as_a_gitlink() {
    let dir = diverged_repo(&[ConflictFile {
        path: "vendor/lib",
        kind: FileKind::Submodule,
        base: Some(FIRST_COMMIT.as_bytes()),
        local: Some(SECOND_COMMIT.as_bytes()),
        remote: Some(FIRST_COMMIT.as_bytes()),
    }])
    .unwrap();

    let files = listed(dir.path());

    let expected = vec![ChangedFile {
        change: Changed::Modified {
            old: side("vendor/lib", GITLINK, Oid::parse(FIRST_COMMIT).unwrap()),
            new: side("vendor/lib", GITLINK, Oid::parse(SECOND_COMMIT).unwrap()),
        },
        numstat: lines(1, 1),
    }];
    assert_eq!(files, expected);
}

#[cfg(unix)]
#[test]
fn a_file_replaced_by_a_link_is_one_modified_entry_with_both_modes() {
    let text: &[u8] = b"text\n";
    let dir = diverged_repo(&[
        regular("entry", Some(text), Some(text)),
        regular("target.txt", Some(b"hello\n"), Some(b"hello\n")),
    ])
    .unwrap();
    let root = dir.path();
    fs::remove_file(root.join("entry")).unwrap();
    std::os::unix::fs::symlink("target.txt", root.join("entry")).unwrap();
    git_ok(root, &["add", "--", "entry"]).unwrap();
    commit(root, "link");

    let files = listed(root);

    let expected = vec![ChangedFile {
        change: Changed::Modified {
            old: side("entry", REGULAR, blob(root, text)),
            new: side("entry", LINK, blob(root, b"target.txt")),
        },
        numstat: lines(1, 1),
    }];
    assert_eq!(files, expected);
}

#[test]
fn the_users_diff_config_does_not_change_the_list() {
    let ran = run_ignored_in_child(&[USERS_DIFF_CONFIG_TEST], |child| {
        child
            .env("GIT_EXTERNAL_DIFF", "false")
            .env("GIT_DIFF_OPTS", "--unified=0");
    });

    ran.unwrap_or_else(|error| panic!("{error}"));
}

#[test]
#[ignore = "run by the_users_diff_config_does_not_change_the_list"]
fn listing_under_the_users_diff_config() {
    let moved: &[u8] = b"1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n";
    let moved_and_edited: &[u8] = b"1\n2\n3\n4\n5\n6\n7\n8\n9\nten\n";
    let (counted_before, counted_after): (&[u8], &[u8]) = (b"x\nx\nx\nx\nU\n", b"U\nx\nx\nx\nx\n");
    let gitmodules: &[u8] = b"[submodule \"lib\"]\n\tpath = vendor/lib\n\tignore = all\n";
    let dir = diverged_repo(&[
        regular(".gitmodules", None, Some(gitmodules)),
        regular("a/moved.txt", Some(moved), None),
        regular("z/moved.txt", None, Some(moved_and_edited)),
        regular("z/counted.txt", Some(counted_before), Some(counted_after)),
        ConflictFile {
            path: "vendor/lib",
            kind: FileKind::Submodule,
            base: Some(FIRST_COMMIT.as_bytes()),
            local: Some(SECOND_COMMIT.as_bytes()),
            remote: Some(FIRST_COMMIT.as_bytes()),
        },
    ])
    .unwrap();
    let root = dir.path();
    fs::write(root.join("order"), "z/*\nvendor/*\n").unwrap();
    for (key, value) in [
        ("diff.relative", "true"),
        ("diff.orderFile", "order"),
        ("diff.renames", "false"),
        ("diff.algorithm", "minimal"),
        ("diff.external", "false"),
        ("diff.ignoreSubmodules", "all"),
        ("diff.noprefix", "true"),
        ("submodule.lib.ignore", "all"),
    ] {
        git_ok(root, &["config", key, value]).unwrap();
    }

    let files = listed(root);

    let expected = vec![
        counted(
            Changed::Added {
                new: side(".gitmodules", REGULAR, blob(root, gitmodules)),
            },
            3,
            0,
        ),
        ChangedFile {
            change: Changed::Modified {
                old: side("vendor/lib", GITLINK, Oid::parse(FIRST_COMMIT).unwrap()),
                new: side("vendor/lib", GITLINK, Oid::parse(SECOND_COMMIT).unwrap()),
            },
            numstat: lines(1, 1),
        },
        ChangedFile {
            change: Changed::Modified {
                old: side("z/counted.txt", REGULAR, blob(root, counted_before)),
                new: side("z/counted.txt", REGULAR, blob(root, counted_after)),
            },
            numstat: lines(4, 4),
        },
        ChangedFile {
            change: Changed::Renamed {
                old: side("a/moved.txt", REGULAR, blob(root, moved)),
                new: side("z/moved.txt", REGULAR, blob(root, moved_and_edited)),
            },
            numstat: lines(1, 1),
        },
    ];
    assert_eq!(files, expected);
}

#[test]
fn paths_with_spaces_newlines_and_non_utf8_bytes_round_trip() {
    let text: &[u8] = b"same\ntext\n";
    let dir = diverged_repo(&[regular("old name.txt", Some(text), Some(text))]).unwrap();
    let root = dir.path();
    let oid = blob(root, text);
    let added = blob(root, b"new\n");
    git_ok(root, &["update-index", "--force-remove", "old name.txt"]).unwrap();
    stage_blob(root, "100644", &oid, "renamed\tname.txt");
    stage_blob(root, "100644", &added, "new\nline.txt");
    #[cfg(unix)]
    let non_utf8 = stage_non_utf8_name(root, b"new\n");
    commit(root, "odd names");

    let files = listed(root);

    let new = side("new\nline.txt", REGULAR, added.clone());
    let (old, renamed) = (
        side("old name.txt", REGULAR, oid.clone()),
        side("renamed\tname.txt", REGULAR, oid),
    );
    let mut expected = vec![
        counted(Changed::Added { new }, 1, 0),
        counted(Changed::Renamed { old, new: renamed }, 0, 0),
    ];
    #[cfg(unix)]
    expected.push(counted(
        Changed::Added {
            new: TreeSide {
                path: non_utf8,
                mode: REGULAR,
                oid: added,
            },
        },
        1,
        0,
    ));
    assert_eq!(files.len(), expected.len(), "{files:?}");
    for file in &expected {
        assert!(files.contains(file), "{file:?} not in {files:?}");
    }
}

#[cfg(unix)]
fn stage_non_utf8_name(root: &Path, content: &[u8]) -> PathBuf {
    use std::os::unix::ffi::OsStrExt;
    let name = PathBuf::from(std::ffi::OsStr::from_bytes(b"bytes \xff\xfe.txt"));
    fs::write(root.join(&name), content).unwrap();
    git_ok(root, &["add", "--", "bytes *"]).unwrap();
    name
}

#[test]
fn merge_base_is_the_fork_point_and_none_for_unrelated_histories() {
    let dir = diverged_repo(&[regular("a.txt", Some(b"base\n"), Some(b"local\n"))]).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    git_ok(root, &["checkout", "--quiet", "--orphan", "unrelated"]).unwrap();
    commit(root, "unrelated");
    let (local, remote) = (oid_of(root, "local"), oid_of(root, "remote"));

    assert_eq!(
        repo.merge_base(&local, &remote).unwrap(),
        Some(oid_of(root, "main"))
    );
    assert_eq!(
        repo.merge_base(&local, &oid_of(root, "unrelated")).unwrap(),
        None
    );
    let unknown = Oid::parse(SECOND_COMMIT).unwrap();
    let error = repo.merge_base(&local, &unknown).unwrap_err();
    assert!(matches!(error, Error::GitFailed { .. }), "{error:?}");
}

#[test]
fn blob_sizes_answer_in_order_and_missing_as_none() {
    let dir = diverged_repo(&[regular("a.txt", Some(b"abc"), Some(b""))]).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    let (three, empty) = (blob(root, b"abc"), blob(root, b""));
    let missing = Oid::parse(SECOND_COMMIT).unwrap();

    let sizes = repo.blob_sizes(&[three, missing, empty]).unwrap();

    assert_eq!(sizes, [Some(3), None, Some(0)]);
    assert_eq!(repo.blob_sizes(&[]).unwrap(), []);
}

#[test]
fn common_dir_is_the_same_from_a_linked_worktree() {
    let dir: TempDir = diverged_repo(&[regular("a.txt", Some(b"a\n"), Some(b"b\n"))]).unwrap();
    let root = dir.path();
    let linked = root.join("linked");
    let linked_arg = linked.to_str().unwrap();
    git_ok(
        root,
        &[
            "worktree", "add", "--quiet", "--detach", linked_arg, "local",
        ],
    )
    .unwrap();

    let from_main = Repo::discover(root).unwrap().common_dir().unwrap();
    let from_linked = Repo::discover(&linked).unwrap().common_dir().unwrap();

    assert_eq!(from_linked, from_main);
    assert_eq!(
        fs::canonicalize(&from_main).unwrap(),
        fs::canonicalize(root.join(".git")).unwrap()
    );
    assert!(from_main.is_absolute(), "{from_main:?}");
}
