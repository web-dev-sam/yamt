#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_merge_core::{MAX_TEXT_BYTES, line_changes};
use yamt_range::{Error, Range, RangeFile, RangeFileId, RangeSpec, Resolved, SearchTexts};

const FIRST_COMMIT: &str = "1111111111111111111111111111111111111111";
const LINK_MODE: &str = "120000";
const MIB: usize = 1024 * 1024;

/// A file only `local` changes: `base` on `main`, `local` on the checked-out branch `local`.
fn changed<'a>(path: &'a str, base: Option<&'a [u8]>, local: Option<&'a [u8]>) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote: base,
    }
}

fn repo_with(files: &[ConflictFile]) -> TempDir {
    diverged_repo(files).unwrap()
}

fn range(root: &Path) -> Range {
    let spec = RangeSpec::parse("main..local").unwrap();
    Resolved::resolve(root, &spec).unwrap().list().unwrap()
}

fn id_of(range: &Range, path: &str) -> RangeFileId {
    let start = range.start();
    start
        .files
        .iter()
        .find(|entry| entry.path == path)
        .unwrap()
        .id
}

fn paths_of(range: &Range, page: &SearchTexts) -> Vec<String> {
    page.files
        .iter()
        .map(|text| range.entry(text.file).unwrap().path.clone())
        .collect()
}

/// Lines `a`, `size` bytes in all for an even `size`.
fn text_of(size: usize) -> Vec<u8> {
    "a\n".repeat(size / 2).into_bytes()
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

#[test]
fn search_texts_skips_every_file_load_does_not_answer_as_texts() {
    let too_large = text_of(MAX_TEXT_BYTES + 2);
    let dir = repo_with(&[
        changed("added.txt", None, Some(b"new\n")),
        changed("binary.bin", Some(b"\0one"), Some(b"\0two")),
        changed("entry", Some(b"text\n"), Some(b"text\n")),
        changed("gone.txt", Some(b"old\n"), None),
        changed("large.txt", None, Some(&too_large)),
        changed("lines.txt", Some(b"one\ntwo\n"), Some(b"one\n2\nthree\n")),
        changed("not-utf8.txt", Some(b"caf\xe9\n"), Some(b"cafe\n")),
        changed("run.sh", Some(b"echo hi\n"), Some(b"echo hi\n")),
        ConflictFile {
            path: "vendor/lib",
            kind: FileKind::Submodule,
            base: None,
            local: Some(FIRST_COMMIT.as_bytes()),
            remote: None,
        },
    ]);
    let root = dir.path();
    git_ok(root, &["update-index", "--chmod=+x", "run.sh"]).unwrap();
    stage_link(root, "entry", "target.txt");
    commit(root, "modes");
    let range = range(root);

    let page = range.search_texts(RangeFileId(0)).unwrap();

    assert_eq!(
        paths_of(&range, &page),
        ["added.txt", "gone.txt", "lines.txt"]
    );
    assert_eq!(page.next, None);
    for text in &page.files {
        let RangeFile::Texts { left, right, .. } = range.load(text.file).unwrap() else {
            panic!("{text:?} is not loaded as texts");
        };
        assert_eq!((&text.left, &text.right), (&left, &right));
        assert_eq!(text.changes, line_changes(&left, &right));
    }
    let lines = &page.files[2];
    assert_eq!(lines.file, id_of(&range, "lines.txt"));
    assert_eq!(lines.changes.len(), 1);
}

#[test]
fn a_page_reads_at_least_one_file_and_ends_after_about_4_mib() {
    let (first, second, third) = (text_of(5 * MIB), text_of(MIB), text_of(3 * MIB + MIB / 2));
    let dir = repo_with(&[
        changed("a.txt", None, Some(&first)),
        changed("b.txt", None, Some(&second)),
        changed("c.txt", None, Some(&third)),
        changed("d.txt", None, Some(b"d\n")),
    ]);
    let range = range(dir.path());

    let alone = range.search_texts(RangeFileId(0)).unwrap();
    assert_eq!(paths_of(&range, &alone), ["a.txt"]);
    assert_eq!(alone.next, Some(RangeFileId(1)));

    let two = range.search_texts(RangeFileId(1)).unwrap();
    assert_eq!(paths_of(&range, &two), ["b.txt", "c.txt"]);
    assert_eq!(two.next, Some(RangeFileId(3)));

    let last = range.search_texts(RangeFileId(3)).unwrap();
    assert_eq!(paths_of(&range, &last), ["d.txt"]);
    assert_eq!(last.next, None);
}

#[test]
fn from_the_list_s_end_is_an_empty_last_page_and_past_it_unknown_file() {
    let dir = repo_with(&[changed("a.txt", Some(b"a\n"), Some(b"b\n"))]);
    let range = range(dir.path());

    let end = range.search_texts(RangeFileId(1)).unwrap();
    assert_eq!(
        end,
        SearchTexts {
            files: Vec::new(),
            next: None
        }
    );
    let error = range.search_texts(RangeFileId(2)).unwrap_err();
    assert!(matches!(
        error,
        Error::UnknownFile {
            file: RangeFileId(2)
        }
    ));
}
