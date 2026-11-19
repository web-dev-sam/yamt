use std::fs;
use std::path::{Path, PathBuf};

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_range::{FileSides, Range, RangeFileId, RangeSpec, Resolved, fnv1a_64};
use yamt_reviewed::{Error, ReviewMark, ReviewOf, ReviewedStore};

pub(crate) const REVIEWED_FILE: &str = "reviewed.json";
pub(crate) const TEXTS_FOLDER: &str = "texts";
pub(crate) const THREE_DOTS: &str = "main...HEAD";

fn changed<'a>(path: &'a str, base: Option<&'a [u8]>, local: Option<&'a [u8]>) -> ConflictFile<'a> {
    ConflictFile {
        path,
        kind: FileKind::Regular,
        base,
        local,
        remote: base,
    }
}

/// On branch `local`, `main...HEAD` lists `a.txt` and `b.txt` (edited, `b.txt` enough alike to be found renamed),
/// `bin.dat` (binary) and `gone.txt` (deleted).
pub(crate) fn repo() -> TempDir {
    diverged_repo(&[
        changed("a.txt", Some(b"a\n"), Some(b"a1\n")),
        changed("b.txt", Some(b"b\nb\nb\nb\n"), Some(b"b\nb\nb\nb1\n")),
        changed("bin.dat", Some(b"\0x"), Some(b"\0y")),
        changed("gone.txt", Some(b"g\n"), None),
    ])
    .unwrap()
}

pub(crate) fn range(repo: &TempDir, text: &str) -> Range {
    let spec = RangeSpec::parse(text).unwrap();
    Resolved::resolve(repo.path(), &spec)
        .unwrap()
        .list()
        .unwrap()
}

pub(crate) fn review_of(range: &Range) -> ReviewOf {
    ReviewOf::Range(range.side_names().unwrap())
}

pub(crate) fn open(data: &TempDir, range: &Range) -> ReviewedStore {
    ReviewedStore::open(data.path(), review_of(range), range).unwrap()
}

pub(crate) fn refused(data: &TempDir, range: &Range) -> Error {
    match ReviewedStore::open(data.path(), review_of(range), range) {
        Ok(_) => panic!("the store opened"),
        Err(error) => error,
    }
}

pub(crate) fn id(range: &Range, path: &str) -> RangeFileId {
    let entry = range.entries().iter().find(|entry| entry.path == path);
    entry.unwrap().id
}

/// The store's marks by path, in list order.
pub(crate) fn marked(store: &ReviewedStore, range: &Range) -> Vec<(String, ReviewMark)> {
    let mut marks = Vec::new();
    for review in store.marks() {
        let entry = range.entry(review.file).unwrap();
        marks.push((entry.path.clone(), review.mark));
    }
    marks
}

pub(crate) fn reviewed(paths: &[&str]) -> Vec<(String, ReviewMark)> {
    paths
        .iter()
        .map(|path| ((*path).to_owned(), ReviewMark::Reviewed))
        .collect()
}

pub(crate) fn mark(store: &mut ReviewedStore, range: &Range, paths: &[&str]) {
    for path in paths {
        store.mark(range, id(range, path)).unwrap();
    }
}

/// Writes `path` and commits it on the checked-out branch.
pub(crate) fn commit(repo: &TempDir, path: &str, bytes: &[u8]) {
    let root = repo.path();
    fs::write(root.join(path), bytes).unwrap();
    git_ok(root, &["add", "--", path]).unwrap();
    git_ok(root, &["commit", "--quiet", "-m", path]).unwrap();
}

pub(crate) fn object_id(repo: &TempDir, revision: &str) -> String {
    let output = git_ok(repo.path(), &["rev-parse", revision]).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

pub(crate) fn review_folder(data: &Path, range: &Range, review: &ReviewOf) -> PathBuf {
    let name = format!("{:016x}", fnv1a_64(review.key_text().as_bytes()));
    data.join(range.repo_key().unwrap()).join(name)
}

pub(crate) fn range_folder(data: &TempDir, range: &Range) -> PathBuf {
    review_folder(data.path(), range, &review_of(range))
}

pub(crate) fn sides_of(range: &Range, path: &str) -> FileSides {
    range.sides(id(range, path)).unwrap()
}

pub(crate) fn json_on_disk(folder: &Path) -> serde_json::Value {
    let bytes = fs::read(folder.join(REVIEWED_FILE)).unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

pub(crate) fn stored_paths(folder: &Path) -> Vec<String> {
    let json = json_on_disk(folder);
    let marks = json["marks"].as_array().unwrap();
    marks
        .iter()
        .map(|mark| mark["path"].as_str().unwrap().to_owned())
        .collect()
}

/// The file names in `texts/`, sorted.
pub(crate) fn kept_texts(folder: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(folder.join(TEXTS_FOLDER))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .collect();
    names.sort();
    names
}
