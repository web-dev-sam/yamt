#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_merge_core::MAX_TEXT_BYTES;
use yamt_range::{Range, RangeEntryKind, RangeFile, RangeSpec, Resolved};

const FIRST_COMMIT: &str = "1111111111111111111111111111111111111111";
const SECOND_COMMIT: &str = "2222222222222222222222222222222222222222";
const LINK_MODE: &str = "120000";

/// A file of the scripted repository: `base` on `main`, `local` on the checked-out branch `local`, `remote` on `remote`.
fn file<'a>(
    path: &'a str,
    base: Option<&'a [u8]>,
    local: Option<&'a [u8]>,
    remote: Option<&'a [u8]>,
) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote,
    }
}

/// A file only `local` changes.
fn changed<'a>(path: &'a str, base: Option<&'a [u8]>, local: Option<&'a [u8]>) -> ConflictFile<'a> {
    file(path, base, local, base)
}

fn repo_with(files: &[ConflictFile]) -> TempDir {
    diverged_repo(files).unwrap()
}

fn rev_parse(root: &Path, revision: &str) -> String {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn range(root: &Path, text: &str) -> Range {
    let resolved = Resolved::resolve(root, &RangeSpec::parse(text).unwrap()).unwrap();
    resolved.list().unwrap()
}

fn load(range: &Range, path: &str) -> RangeFile {
    let start = range.start();
    let entry = start.files.iter().find(|entry| entry.path == path).unwrap();
    range.load(entry.id).unwrap()
}

fn commit(root: &Path, message: &str) {
    git_ok(root, &["commit", "--quiet", "-m", message]).unwrap();
}

/// Stages `path` as a symbolic link to `target` without making one on disk (Windows needs a right for that).
fn stage_link(root: &Path, path: &str, target: &str) {
    let scratch = root.join(".git").join("link-target");
    fs::write(&scratch, target).unwrap();
    let scratch_arg = scratch.to_str().unwrap();
    let output = git_ok(root, &["hash-object", "-w", "--", scratch_arg]).unwrap();
    let oid = String::from_utf8(output).unwrap().trim_end().to_owned();
    let cacheinfo = format!("{LINK_MODE},{oid},{path}");
    git_ok(root, &["update-index", "--add", "--cacheinfo", &cacheinfo]).unwrap();
}

/// Removes a loose object, so any read of it fails: what the listing answers is never read.
fn drop_object(root: &Path, revision: &str) {
    let oid = rev_parse(root, revision);
    let (folder, name) = oid.split_at(2);
    fs::remove_file(root.join(".git").join("objects").join(folder).join(name)).unwrap();
}

#[test]
fn binary_is_answered_before_size_and_without_reading() {
    let large_binary = vec![0_u8; MAX_TEXT_BYTES + 1];
    let dir = repo_with(&[changed("big.bin", None, Some(&large_binary))]);
    let root = dir.path();
    let range = range(root, "main..local");
    drop_object(root, "local:big.bin");

    assert_eq!(load(&range, "big.bin"), RangeFile::Binary);
}

#[test]
fn exactly_8_mib_loads_and_one_byte_more_is_too_large() {
    let exact = "a\n".repeat(MAX_TEXT_BYTES / 2);
    let over = format!("{exact}a");
    let gone = format!("{}b", "b\n".repeat(MAX_TEXT_BYTES / 2));
    let dir = repo_with(&[
        changed("exact.txt", None, Some(exact.as_bytes())),
        changed("over.txt", None, Some(over.as_bytes())),
        changed("gone.txt", Some(gone.as_bytes()), None),
    ]);
    let root = dir.path();
    let range = range(root, "main..local");
    drop_object(root, "local:over.txt");
    drop_object(root, "main:gone.txt");

    let loaded = load(&range, "exact.txt");
    let RangeFile::Texts { left, right, .. } = &loaded else {
        panic!("{loaded:?}");
    };
    assert_eq!((left.len(), right.len()), (0, MAX_TEXT_BYTES));
    let limit = u32::try_from(MAX_TEXT_BYTES).unwrap();
    assert_eq!(load(&range, "over.txt"), RangeFile::TooLarge { limit });
    assert_eq!(load(&range, "gone.txt"), RangeFile::TooLarge { limit });
}

/// A submodule at `local` on `local`, at `base` on `main` and `remote`.
fn submodule(
    path: &'static str,
    base: Option<&'static str>,
    local: Option<&'static str>,
) -> ConflictFile<'static> {
    ConflictFile {
        path,
        kind: FileKind::Submodule,
        base: base.map(str::as_bytes),
        local: local.map(str::as_bytes),
        remote: base.map(str::as_bytes),
    }
}

fn submodule_file(old: Option<&str>, new: Option<&str>) -> RangeFile {
    RangeFile::Submodule {
        old: old.map(str::to_owned),
        new: new.map(str::to_owned),
    }
}

#[test]
fn mode_only_kind_changed_and_submodule_are_sentences() {
    let dir = repo_with(&[
        changed("entry", Some(b"text\n"), Some(b"text\n")),
        changed("run.sh", Some(b"echo hi\n"), Some(b"echo hi\n")),
        submodule("vendor/lib", Some(FIRST_COMMIT), Some(SECOND_COMMIT)),
        submodule("vendor/new", None, Some(SECOND_COMMIT)),
        submodule("vendor/gone", Some(FIRST_COMMIT), None),
    ]);
    let root = dir.path();
    git_ok(root, &["update-index", "--chmod=+x", "run.sh"]).unwrap();
    stage_link(root, "entry", "target.txt");
    commit(root, "modes");
    let range = range(root, "main..local");
    drop_object(root, "local:run.sh");
    drop_object(root, "local:entry");
    drop_object(root, "main:entry");

    let mode_only = RangeFile::ModeOnly {
        old: RangeEntryKind::File,
        new: RangeEntryKind::Executable,
    };
    let kind_changed = RangeFile::KindChanged {
        old: RangeEntryKind::File,
        new: RangeEntryKind::Link,
    };
    assert_eq!(load(&range, "run.sh"), mode_only);
    assert_eq!(load(&range, "entry"), kind_changed);
    let changed_submodule = submodule_file(Some(FIRST_COMMIT), Some(SECOND_COMMIT));
    assert_eq!(load(&range, "vendor/lib"), changed_submodule);
    let added_submodule = submodule_file(None, Some(SECOND_COMMIT));
    assert_eq!(load(&range, "vendor/new"), added_submodule);
    let removed_submodule = submodule_file(Some(FIRST_COMMIT), None);
    assert_eq!(load(&range, "vendor/gone"), removed_submodule);
}
