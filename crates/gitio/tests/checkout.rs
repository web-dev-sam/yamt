#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git, git_ok};
use yamt_gitio::{Oid, Repo, StatusEntry};

const CHECKOUT: &str = "checkout";
const ORIGIN: &str = "origin";

fn oid_of(root: &Path, revision: &str) -> Oid {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    Oid::parse(String::from_utf8(output).unwrap().trim_end()).unwrap()
}

fn text_of(root: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(root, args).unwrap()).unwrap()
}

/// `base` on `main`, `local` on the checked-out branch `local`, `remote` on branch `remote`.
fn file<'a>(path: &'a str, local: &'a [u8], remote: &'a [u8]) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base: Some(b"base\n"),
        local: Some(local),
        remote: Some(remote),
    }
}

/// A source repository, and a folder the clone goes into as `CHECKOUT`.
fn source_and_folder(files: &[ConflictFile]) -> (TempDir, TempDir) {
    (diverged_repo(files).unwrap(), tempfile::tempdir().unwrap())
}

/// The clone without `origin`, checked out detached at the source's `remote` commit.
fn checkout_at_remote(source: &Path, folder: &Path) -> (Repo, Oid) {
    let clone = Repo::discover(source)
        .unwrap()
        .clone_shared_into(&folder.join(CHECKOUT))
        .unwrap();
    clone.remove_remote(ORIGIN).unwrap();
    let remote = oid_of(source, "remote");
    clone.checkout_detached(&remote).unwrap();
    (clone, remote)
}

fn commit_everything(root: &Path, message: &str) {
    git_ok(root, &["add", "--all"]).unwrap();
    git_ok(root, &["commit", "--quiet", "--allow-empty", "-m", message]).unwrap();
}

#[test]
fn a_shared_clone_without_origin_checks_out_the_commit_detached() {
    let (source, folder) = source_and_folder(&[file("a.txt", b"local\n", b"remote\n")]);

    let (clone, remote) = checkout_at_remote(source.path(), folder.path());

    let root = clone.root();
    assert_eq!(
        fs::canonicalize(root).unwrap(),
        fs::canonicalize(folder.path().join(CHECKOUT)).unwrap()
    );
    assert_eq!(clone.head_commit().unwrap(), remote);
    let symbolic = git(root, &["symbolic-ref", "--quiet", "HEAD"]).unwrap();
    assert_eq!(symbolic.status.code(), Some(1), "HEAD is not detached");
    assert_eq!(fs::read(root.join("a.txt")).unwrap(), b"remote\n");
    assert_eq!(clone.status_entries().unwrap(), Vec::new());
    assert_eq!(text_of(root, &["remote"]), "");
}

#[test]
fn the_clone_borrows_objects_and_keeps_no_refs_of_the_source() {
    let (source, folder) = source_and_folder(&[file("a.txt", b"local\n", b"remote\n")]);
    let into = folder.path().join(CHECKOUT);

    let clone = Repo::discover(source.path())
        .unwrap()
        .clone_shared_into(&into)
        .unwrap();
    clone.remove_remote(ORIGIN).unwrap();

    let alternates = fs::read_to_string(into.join(".git/objects/info/alternates")).unwrap();
    let source_objects = fs::canonicalize(source.path().join(".git/objects")).unwrap();
    let borrowed = fs::canonicalize(PathBuf::from(alternates.trim_end())).unwrap();
    assert_eq!(borrowed, source_objects);
    assert_eq!(
        text_of(&into, &["for-each-ref"]),
        "",
        "refs left in the clone"
    );
    assert_eq!(text_of(&into, &["remote"]), "");
    assert_eq!(clone.head_commit().unwrap(), oid_of(source.path(), "local"));
}

#[test]
fn status_lists_modified_added_deleted_and_untracked_files_but_not_ignored_ones() {
    let (source, folder) = source_and_folder(&[
        file("edited.txt", b"local\n", b"remote\n"),
        file("staged.txt", b"local\n", b"remote\n"),
        file("removed.txt", b"local\n", b"remote\n"),
    ]);
    let (clone, _) = checkout_at_remote(source.path(), folder.path());
    let root = clone.root();
    fs::write(root.join(".git/info/exclude"), "ignored.txt\n").unwrap();
    fs::write(root.join("ignored.txt"), "ignored\n").unwrap();
    fs::write(root.join("edited.txt"), "edited\n").unwrap();
    fs::write(root.join("staged.txt"), "staged\n").unwrap();
    fs::write(root.join("added.txt"), "added\n").unwrap();
    git_ok(root, &["add", "--", "staged.txt", "added.txt"]).unwrap();
    fs::remove_file(root.join("removed.txt")).unwrap();
    fs::create_dir(root.join("new folder")).unwrap();
    fs::write(root.join("new folder/untracked.txt"), "new\n").unwrap();

    let mut entries = clone.status_entries().unwrap();

    entries.sort_by(|a, b| a.path.cmp(&b.path));
    let entry = |xy: &[u8; 2], path: &str| StatusEntry {
        xy: *xy,
        path: PathBuf::from(path),
    };
    let expected = vec![
        entry(b"A ", "added.txt"),
        entry(b" M", "edited.txt"),
        entry(b"??", "new folder/untracked.txt"),
        entry(b" D", "removed.txt"),
        entry(b"M ", "staged.txt"),
    ];
    assert_eq!(entries, expected);
}

#[test]
fn head_commit_moves_after_a_commit_in_the_clone() {
    let (source, folder) = source_and_folder(&[file("a.txt", b"local\n", b"remote\n")]);
    let (clone, remote) = checkout_at_remote(source.path(), folder.path());
    let root = clone.root();
    fs::write(root.join("a.txt"), "the AI's edit\n").unwrap();

    commit_everything(root, "the AI's commit");

    let head = clone.head_commit().unwrap();
    assert_ne!(head, remote);
    assert_eq!(head, oid_of(root, "HEAD"));
    assert_eq!(oid_of(root, "HEAD^"), remote);
}

#[test]
fn a_commit_in_the_clone_leaves_the_source_refs_and_config_untouched() {
    let (source, folder) = source_and_folder(&[file("a.txt", b"local\n", b"remote\n")]);
    let source_root = source.path();
    let refs_before = text_of(source_root, &["for-each-ref"]);
    let config_before = fs::read(source_root.join(".git/config")).unwrap();
    let head_before = text_of(source_root, &["symbolic-ref", "HEAD"]);
    let (clone, _) = checkout_at_remote(source_root, folder.path());
    let root = clone.root();
    fs::write(root.join("a.txt"), "the AI's edit\n").unwrap();
    git_ok(root, &["branch", "ai-branch"]).unwrap();

    commit_everything(root, "the AI's commit");

    let commit = clone.head_commit().unwrap();
    assert_eq!(text_of(source_root, &["for-each-ref"]), refs_before);
    assert_eq!(
        fs::read(source_root.join(".git/config")).unwrap(),
        config_before
    );
    assert_eq!(text_of(source_root, &["symbolic-ref", "HEAD"]), head_before);
    let in_source = git(source_root, &["cat-file", "-e", commit.as_str()]).unwrap();
    assert!(
        !in_source.status.success(),
        "the commit went into the source's objects"
    );
}
