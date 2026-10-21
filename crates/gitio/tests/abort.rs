#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{ConflictFile, FileKind, conflict_repo, git_ok};
use yamt_gitio::Repo;

const ADDED: &str = "src/added.ts";
const REMOVED: &str = "docs/removed.md";
const CRLF: &str = "notes/crlf.txt";
const CRLF_AT_HEAD: &[u8] = b"a\r\nlocal\r\n";
const UNTRACKED: &str = "scratch.txt";

fn regular<'a>(
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

fn files() -> [ConflictFile<'static>; 3] {
    [
        regular(ADDED, None, Some(b"local\n"), Some(b"remote\n")),
        regular(REMOVED, Some(b"one\n"), None, Some(b"remote\n")),
        regular(
            CRLF,
            Some(b"a\r\nb\r\n"),
            Some(CRLF_AT_HEAD),
            Some(b"a\r\nremote\r\n"),
        ),
    ]
}

fn output_text(root: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(root, args).unwrap()).unwrap()
}

#[test]
fn a_merge_abort_drops_resolutions_saves_and_merge_head_but_keeps_untracked_files() {
    let dir = conflict_repo(&files()).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    let root = dir.path();
    fs::write(root.join(ADDED), "resolved\n").unwrap();
    git_ok(root, &["add", "--", ADDED]).unwrap();
    git_ok(root, &["rm", "--quiet", "--", REMOVED]).unwrap();
    fs::write(root.join(CRLF), "a\r\nsaved\r\n").unwrap();
    fs::write(root.join(UNTRACKED), "mine\n").unwrap();
    let operation = repo.stop().unwrap().operation.unwrap();

    repo.abort(&operation).unwrap();

    assert_eq!(
        output_text(root, &["status", "--porcelain"]),
        format!("?? {UNTRACKED}\n")
    );
    assert_eq!(repo.commit_named("MERGE_HEAD").unwrap(), None);
    assert_eq!(fs::read(root.join(CRLF)).unwrap(), CRLF_AT_HEAD);
}
