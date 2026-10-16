#![cfg(test)]

use std::fs;
use std::path::Path;

use yamt_conflict_repo::{
    ConflictFile, FileKind, TempDir, conflict_repo, diverged_repo, git, git_ok, rebase_merges_repo,
};
use yamt_gitio::{Error, Repo};

const ADDED: &str = "src/added.ts";
const REMOVED: &str = "docs/removed.md";
const CRLF: &str = "notes/crlf.txt";
const CRLF_AT_HEAD: &[u8] = b"a\r\nlocal\r\n";
const UNTRACKED: &str = "scratch.txt";
const REFUSED_STATUS: i32 = 128;

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

fn merging() -> (TempDir, Repo) {
    let dir = conflict_repo(&files()).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();
    (dir, repo)
}

fn output_text(root: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(root, args).unwrap()).unwrap()
}

fn index_and_worktree(root: &Path) -> (String, String) {
    (
        output_text(root, &["status", "--porcelain"]),
        output_text(root, &["ls-files", "-s"]),
    )
}

#[test]
fn abort_merge_drops_resolutions_saves_and_merge_head_but_keeps_untracked_files() {
    let (dir, repo) = merging();
    let root = dir.path();
    fs::write(root.join(ADDED), "resolved\n").unwrap();
    git_ok(root, &["add", "--", ADDED]).unwrap();
    git_ok(root, &["rm", "--quiet", "--", REMOVED]).unwrap();
    fs::write(root.join(CRLF), "a\r\nsaved\r\n").unwrap();
    fs::write(root.join(UNTRACKED), "mine\n").unwrap();

    repo.abort_merge().unwrap();

    assert_eq!(
        output_text(root, &["status", "--porcelain"]),
        format!("?? {UNTRACKED}\n")
    );
    assert_eq!(repo.commit_named("MERGE_HEAD").unwrap(), None);
    assert_eq!(fs::read(root.join(CRLF)).unwrap(), CRLF_AT_HEAD);
}

#[test]
fn abort_merge_of_a_file_staged_then_changed_is_git_s_refusal_and_touches_nothing() {
    let (dir, repo) = merging();
    let root = dir.path();
    fs::write(root.join(ADDED), "resolved\n").unwrap();
    git_ok(root, &["add", "--", ADDED]).unwrap();
    fs::write(root.join(ADDED), "saved again\n").unwrap();
    let before = index_and_worktree(root);

    let error = repo.abort_merge().unwrap_err();

    let Error::GitFailed { status, stderr, .. } = error else {
        panic!("expected git's refusal, got {error:?}");
    };
    assert_eq!(status, Some(REFUSED_STATUS));
    assert!(
        stderr.contains(&format!(
            "error: Entry '{ADDED}' not uptodate. Cannot merge."
        )),
        "{stderr}"
    );
    assert_eq!(index_and_worktree(root), before);
    assert!(repo.commit_named("MERGE_HEAD").unwrap().is_some());
}

#[test]
fn rebase_in_progress_is_false_in_a_merge() {
    let (_dir, repo) = merging();
    assert!(!repo.rebase_in_progress().unwrap());
}

fn stopped_rebase(backend: &str) -> TempDir {
    let dir = diverged_repo(&files()).unwrap();
    let rebase = git(dir.path(), &["rebase", backend, "remote"]).unwrap();
    assert!(!rebase.status.success(), "the rebase did not stop");
    dir
}

#[test]
fn rebase_in_progress_is_true_in_a_stopped_rebase_of_either_backend() {
    for backend in ["--merge", "--apply"] {
        let dir = stopped_rebase(backend);

        let repo = Repo::discover(dir.path()).unwrap();

        assert!(repo.rebase_in_progress().unwrap(), "{backend}");
    }
}

#[test]
fn rebase_in_progress_is_true_in_a_rebase_stopped_on_a_merge_commit_with_merge_head() {
    let dir = rebase_merges_repo(&files()).unwrap();
    let repo = Repo::discover(dir.path()).unwrap();

    assert!(repo.commit_named("MERGE_HEAD").unwrap().is_some());
    assert!(repo.rebase_in_progress().unwrap());
}
