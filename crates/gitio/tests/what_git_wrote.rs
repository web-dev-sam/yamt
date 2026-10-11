#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{
    ConflictFile, FileKind, Setup, TempDir, conflict_repo, conflict_repo_with, git_ok, hash_object,
};
use yamt_gitio::{
    AttributeValue, Error, GitVersion, MergeAttributes, MergeFileOptions, MergeInputs, Repo,
};

const FIRST: &str = "a.txt";
const SECOND: &str = "b c.txt";
const PLAIN: MergeFileOptions = MergeFileOptions {
    marker_size: 7,
    union: false,
    histogram: false,
};

fn text_conflict(path: &str) -> ConflictFile<'_> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base: Some(b"one\ntwo\n"),
        local: Some(b"one\nlocal\n"),
        remote: Some(b"one\nremote\n"),
    }
}

fn two_conflicts(setup: &Setup) -> (TempDir, Repo) {
    let dir = conflict_repo_with(&[text_conflict(FIRST), text_conflict(SECOND)], setup).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    (dir, repo)
}

fn text(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes).unwrap()
}

#[test]
fn version_is_the_one_git_prints() {
    let (dir, repo) = two_conflicts(&Setup::default());
    let printed = text(git_ok(dir.path(), &["version"]).unwrap());

    let GitVersion { major, minor } = repo.version().unwrap();

    assert!(
        printed.starts_with(&format!("git version {major}.{minor}.")),
        "{printed}"
    );
}

#[test]
fn attributes_reads_marker_size_merge_driver_and_encoding_of_every_path_in_one_call() {
    use AttributeValue::{Unset, Unspecified, Value};
    let attributes =
        "a.txt conflict-marker-size=12 -merge\n*.md merge=union working-tree-encoding=UTF-16\n";
    let setup = Setup {
        attributes: Some(attributes),
        ..Setup::default()
    };
    let (_dir, repo) = two_conflicts(&setup);

    let found = repo
        .attributes(&[Path::new(FIRST), Path::new("docs/x.md"), Path::new(SECOND)])
        .unwrap();

    let expected = [
        (Value(b"12".to_vec()), Unset, Unspecified),
        (
            Unspecified,
            Value(b"union".to_vec()),
            Value(b"UTF-16".to_vec()),
        ),
        (Unspecified, Unspecified, Unspecified),
    ]
    .map(
        |(conflict_marker_size, merge, working_tree_encoding)| MergeAttributes {
            conflict_marker_size,
            merge,
            working_tree_encoding,
        },
    );
    assert_eq!(found, expected);
    assert_eq!(repo.attributes(&[]).unwrap(), []);
}

#[test]
fn hash_objects_cleans_each_file_through_autocrlf_like_git_add() {
    let setup = Setup {
        config: &[("core.autocrlf", "true")],
        ..Setup::default()
    };
    let (dir, repo) = two_conflicts(&setup);
    fs::write(dir.path().join(FIRST), "one\r\ncrlf\r\n").unwrap();
    fs::write(dir.path().join(SECOND), "plain\n").unwrap();

    let oids = repo
        .hash_objects(&[Path::new(FIRST), Path::new(SECOND)])
        .unwrap();

    let expected = [
        hash_object(dir.path(), b"one\ncrlf\n").unwrap(),
        hash_object(dir.path(), b"plain\n").unwrap(),
    ];
    let found: Vec<&str> = oids.iter().map(yamt_gitio::Oid::as_str).collect();
    assert_eq!(found, expected);
    assert_eq!(repo.hash_objects(&[]).unwrap(), Vec::new());
}

fn merged(repo: &Repo, scratch: &Path, inputs: [&[u8]; 3], options: &MergeFileOptions) -> String {
    let [base, local, remote] = inputs;
    let inputs = MergeInputs {
        base,
        local,
        remote,
    };
    text(repo.merge_file(scratch, &inputs, options).unwrap())
}

const BASE: &[u8] = b"a\nb\nc\nd\ne\n";
const ONE_CONFLICT: [&[u8]; 3] = [BASE, b"a\nB\nc\nd\ne\n", b"a\nX\nc\nd\ne\n"];

#[test]
fn merge_file_returns_the_merge_with_one_or_two_conflicts() {
    let (_dir, repo) = two_conflicts(&Setup::default());
    let scratch = TempDir::new().unwrap();
    let two_blocks = [BASE, b"A\nb\nc\nd\nE\n", b"X\nb\nc\nd\nY\n"];

    let one = merged(&repo, scratch.path(), ONE_CONFLICT, &PLAIN);
    let two = merged(&repo, scratch.path(), two_blocks, &PLAIN);

    // The base section depends on the user's `merge.conflictStyle`, which gitio reads (plan §2 #8).
    assert!(one.starts_with("a\n<<<<<<< ours\nB\n"), "{one}");
    assert!(
        one.ends_with("=======\nX\n>>>>>>> theirs\nc\nd\ne\n"),
        "{one}"
    );
    assert_eq!(two.matches("<<<<<<< ours\n").count(), 2, "{two}");
}

#[test]
fn merge_file_honours_union_histogram_and_marker_size() {
    let (_dir, repo) = two_conflicts(&Setup::default());
    let scratch = TempDir::new().unwrap();
    let union = MergeFileOptions {
        marker_size: 9,
        union: true,
        histogram: true,
    };
    let wide = MergeFileOptions {
        marker_size: 9,
        ..PLAIN
    };

    let unioned = merged(&repo, scratch.path(), ONE_CONFLICT, &union);
    let nine = merged(&repo, scratch.path(), ONE_CONFLICT, &wide);

    assert_eq!(unioned, "a\nB\nX\nc\nd\ne\n");
    assert!(
        nine.contains("\n<<<<<<<<< ours\n") && nine.contains("\n>>>>>>>>> theirs\n"),
        "{nine}"
    );
}

#[test]
fn merge_file_of_binary_input_is_a_git_failure_and_a_missing_scratch_dir_a_write_failure() {
    let (_dir, repo) = two_conflicts(&Setup::default());
    let scratch = TempDir::new().unwrap();
    let binary = MergeInputs {
        base: b"\0base",
        local: b"\0local",
        remote: b"\0remote",
    };

    let error = repo
        .merge_file(scratch.path(), &binary, &PLAIN)
        .unwrap_err();
    let gone = scratch.path().join("gone");
    let missing = repo.merge_file(&gone, &binary, &PLAIN).unwrap_err();

    assert!(
        matches!(error, Error::GitFailed { status: Some(code), .. } if code >= 128),
        "{error:?}"
    );
    assert!(matches!(missing, Error::WriteFailed { .. }), "{missing:?}");
}

#[test]
fn submodule_head_is_the_checked_out_commit_or_none() {
    let (dir, repo) = two_conflicts(&Setup::default());
    let checked_out = dir.path().join("lib/checked-out");
    fs::create_dir_all(&checked_out).unwrap();
    git_ok(&checked_out, &["init", "--quiet"]).unwrap();
    git_ok(
        &checked_out,
        &["commit", "--quiet", "--allow-empty", "-m", "first"],
    )
    .unwrap();
    let head = text(git_ok(&checked_out, &["rev-parse", "HEAD"]).unwrap());
    let unborn = dir.path().join("lib/unborn");
    fs::create_dir_all(&unborn).unwrap();
    git_ok(&unborn, &["init", "--quiet"]).unwrap();
    fs::create_dir_all(dir.path().join("lib/empty")).unwrap();

    let found = |path: &str| {
        repo.submodule_head(Path::new(path))
            .unwrap()
            .map(|oid| oid.as_str().to_owned())
    };

    assert_eq!(found("lib/checked-out"), Some(head.trim_end().to_owned()));
    assert_eq!(found("lib/unborn"), None);
    assert_eq!(found("lib/empty"), None);
    assert_eq!(found("lib/absent"), None);
}

fn unmerged(dir: &TempDir) -> String {
    text(git_ok(dir.path(), &["ls-files", "-u"]).unwrap())
}

#[test]
fn add_paths_and_remove_paths_stage_every_path_in_one_call() {
    let (dir, repo) = two_conflicts(&Setup::default());
    fs::write(dir.path().join(FIRST), "first\n").unwrap();
    fs::write(dir.path().join(SECOND), "second\n").unwrap();

    repo.add_paths(&[Path::new(FIRST), Path::new(SECOND)])
        .unwrap();

    assert_eq!(unmerged(&dir), "");
    let staged = text(git_ok(dir.path(), &["ls-files", "-s"]).unwrap());
    let first_oid = hash_object(dir.path(), b"first\n").unwrap();
    assert!(
        staged.contains(&format!("{first_oid} 0\t{FIRST}")),
        "{staged}"
    );

    let conflicts = conflict_repo(&[text_conflict(FIRST), text_conflict(SECOND)]).unwrap();
    let repo = Repo::discover(conflicts.path()).unwrap();
    fs::remove_file(conflicts.path().join(FIRST)).unwrap();

    repo.remove_paths(&[Path::new(FIRST), Path::new(SECOND)])
        .unwrap();

    assert_eq!(unmerged(&conflicts), "");
    assert_eq!(
        text(git_ok(conflicts.path(), &["ls-files", "-s"]).unwrap()),
        ""
    );
    assert!(conflicts.path().join(SECOND).exists());
}
