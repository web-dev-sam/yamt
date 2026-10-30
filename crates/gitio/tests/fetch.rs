#![cfg(test)]

use std::path::Path;
use std::time::Instant;

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_gitio::{FETCH_TIMEOUT, Repo};

const MR_REF: &str = "refs/merge-requests/1/head";
const DEAD_SERVER: &str = "https://127.0.0.1:1/x";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

fn text(dir: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(dir, args).unwrap()).unwrap()
}

/// A repository with a remote `gitlab`, a bare clone of it whose `MR_REF` names a commit only the clone has.
struct Fixture {
    repo: TempDir,
    _server: TempDir,
    merge_request_head: String,
}

fn fixture() -> Fixture {
    let repo = diverged_repo(&FILES).unwrap();
    let server = tempfile::tempdir().unwrap();
    let bare = server.path().join("gitlab.git");
    let bare_path = bare.display().to_string();
    let root = repo.path().display().to_string();
    git_ok(server.path(), &["clone", "-q", "--bare", &root, &bare_path]).unwrap();
    let head = text(
        &bare,
        &[
            "commit-tree",
            "-p",
            "main",
            "-m",
            "merge request",
            "main^{tree}",
        ],
    );
    let head = head.trim_end().to_owned();
    git_ok(&bare, &["update-ref", MR_REF, &head]).unwrap();
    git_ok(repo.path(), &["remote", "add", "gitlab", &bare_path]).unwrap();
    Fixture {
        repo,
        _server: server,
        merge_request_head: head,
    }
}

/// What a fetch must leave as it was: every ref, the status, the index and HEAD.
fn untouched(root: &Path) -> [String; 4] {
    [
        text(root, &["for-each-ref"]),
        text(root, &["status", "--porcelain=v1"]),
        text(root, &["hash-object", ".git/index"]),
        text(root, &["rev-parse", "HEAD"]),
    ]
}

fn has_commit(root: &Path, id: &str) -> bool {
    let repo = Repo::discover(root).unwrap();
    repo.commit_named(id).unwrap().is_some()
}

#[test]
fn a_merge_request_head_is_fetched_without_writing_any_ref_or_fetch_head() {
    let fixture = fixture();
    let root = fixture.repo.path();
    let before = untouched(root);
    assert!(!has_commit(root, &fixture.merge_request_head));

    let repo = Repo::discover(root).unwrap();
    let fetched = repo.fetch_without_refs("gitlab", &[MR_REF, "refs/heads/main"], FETCH_TIMEOUT);

    assert_eq!(fetched, Ok(()));
    assert!(has_commit(root, &fixture.merge_request_head));
    assert_eq!(untouched(root), before);
    assert!(!root.join(".git/FETCH_HEAD").exists());
}

// git runs a local remote's `remote.<name>.uploadpack` through the shell with fetch's environment
// (git-config(1)), so it can record that environment.
#[cfg(unix)]
#[test]
fn the_fetch_runs_with_no_prompt_of_git_ssh_or_a_credential_manager() {
    let fixture = fixture();
    let root = fixture.repo.path();
    let recorded = root.join("fetch.env");
    let upload_pack = format!("env > '{}'; git-upload-pack", recorded.display());
    git_ok(root, &["config", "remote.gitlab.uploadpack", &upload_pack]).unwrap();

    let repo = Repo::discover(root).unwrap();
    repo.fetch_without_refs("gitlab", &[MR_REF], FETCH_TIMEOUT)
        .unwrap();

    let environment = std::fs::read_to_string(recorded).unwrap();
    let lines: Vec<&str> = environment.lines().collect();
    for wanted in [
        "GIT_TERMINAL_PROMPT=0",
        "GCM_INTERACTIVE=never",
        "SSH_ASKPASS_REQUIRE=force",
        "SSH_ASKPASS=false",
        "LC_ALL=C",
    ] {
        assert!(lines.contains(&wanted), "{wanted} not in {environment}");
    }
}

#[test]
fn a_server_that_is_not_there_fails_in_git_s_words_before_the_deadline() {
    let fixture = fixture();
    let root = fixture.repo.path();
    git_ok(root, &["remote", "add", "dead", DEAD_SERVER]).unwrap();
    let before = untouched(root);

    let started = Instant::now();
    let repo = Repo::discover(root).unwrap();
    let fetched = repo.fetch_without_refs("dead", &[MR_REF], FETCH_TIMEOUT);

    assert!(started.elapsed() < FETCH_TIMEOUT, "{:?}", started.elapsed());
    let message = fetched.unwrap_err();
    assert!(
        message.starts_with("fatal: unable to access 'https://127.0.0.1:1/x/'"),
        "{message}"
    );
    assert_eq!(untouched(root), before);
}

#[test]
fn a_ref_the_server_lacks_fails_in_git_s_words() {
    let fixture = fixture();
    let repo = Repo::discover(fixture.repo.path()).unwrap();

    let fetched = repo.fetch_without_refs("gitlab", &["refs/merge-requests/2/head"], FETCH_TIMEOUT);

    assert_eq!(
        fetched,
        Err("fatal: couldn't find remote ref refs/merge-requests/2/head".to_owned())
    );
}

// git runs a local remote's `remote.<name>.uploadpack` through the shell (git-config(1)), so a sleeping one stands
// in for a server that never answers.
#[cfg(unix)]
#[test]
fn a_fetch_that_gets_no_answer_fails_at_its_deadline() {
    use std::time::Duration;

    const SHORT_TIMEOUT: Duration = Duration::from_secs(1);
    const HANG: Duration = Duration::from_secs(5);
    let fixture = fixture();
    let root = fixture.repo.path();
    let upload_pack = format!("sleep {}; git-upload-pack", HANG.as_secs());
    git_ok(root, &["config", "remote.gitlab.uploadpack", &upload_pack]).unwrap();
    let repo = Repo::discover(root).unwrap();

    let started = Instant::now();
    let fetched = repo.fetch_without_refs("gitlab", &[MR_REF], SHORT_TIMEOUT);

    assert_eq!(
        fetched,
        Err("git fetch got no answer within 1 s".to_owned())
    );
    assert!(started.elapsed() < HANG, "{:?}", started.elapsed());
}
