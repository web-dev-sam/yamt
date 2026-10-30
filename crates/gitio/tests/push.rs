#![cfg(test)]

use std::path::{Path, PathBuf};

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_gitio::{PUSH_TIMEOUT, Repo};

fn text(dir: &Path, args: &[&str]) -> String {
    String::from_utf8(git_ok(dir, args).unwrap())
        .unwrap()
        .trim_end()
        .to_owned()
}

/// A bare "remote" with one commit on `main`, and a clone of it, `work`, whose `origin` it is.
struct Fixture {
    dir: TempDir,
    remote: PathBuf,
    work: PathBuf,
}

impl Fixture {
    fn new() -> Fixture {
        let dir = tempfile::tempdir().unwrap();
        let remote = dir.path().join("remote.git");
        git_ok(dir.path(), &["init", "-q", "--bare", &path_text(&remote)]).unwrap();
        let fixture = Fixture {
            work: fixture_clone(dir.path(), &remote, "work"),
            dir,
            remote,
        };
        commit_file(&fixture.work, "a.txt", "first\n");
        git_ok(&fixture.work, &["push", "-q", "origin", "main"]).unwrap();
        fixture
    }

    /// Another clone that pushes a commit of its own onto the remote's `main`; that commit.
    fn someone_else_pushes(&self) -> String {
        let other = fixture_clone(self.dir.path(), &self.remote, "other");
        commit_file(&other, "b.txt", "theirs\n");
        git_ok(&other, &["push", "-q", "origin", "main"]).unwrap();
        text(&other, &["rev-parse", "HEAD"])
    }

    fn remote_main(&self) -> String {
        text(&self.remote, &["rev-parse", "refs/heads/main"])
    }

    fn repo(&self) -> Repo {
        Repo::discover(&self.work).unwrap()
    }
}

fn path_text(path: &Path) -> String {
    path.display().to_string()
}

fn fixture_clone(dir: &Path, remote: &Path, name: &str) -> PathBuf {
    let clone = dir.join(name);
    git_ok(
        dir,
        &["clone", "-q", &path_text(remote), &path_text(&clone)],
    )
    .unwrap();
    git_ok(&clone, &["config", "user.name", "yamt test"]).unwrap();
    git_ok(&clone, &["config", "user.email", "test@yamt.invalid"]).unwrap();
    clone
}

fn commit_file(dir: &Path, name: &str, content: &str) {
    std::fs::write(dir.join(name), content).unwrap();
    git_ok(dir, &["add", name]).unwrap();
    git_ok(dir, &["commit", "-q", "-m", name]).unwrap();
}

#[test]
fn a_fast_forward_push_sends_only_the_branch_and_no_tag() {
    let fixture = Fixture::new();
    commit_file(&fixture.work, "c.txt", "mine\n");
    git_ok(&fixture.work, &["tag", "-a", "-m", "release", "v1"]).unwrap();
    git_ok(&fixture.work, &["config", "push.followTags", "true"]).unwrap();
    git_ok(&fixture.work, &["branch", "unpushed"]).unwrap();

    let pushed = fixture.repo().push_branch("origin", "main", PUSH_TIMEOUT);

    assert_eq!(pushed, Ok(()));
    assert_eq!(
        fixture.remote_main(),
        text(&fixture.work, &["rev-parse", "HEAD"])
    );
    assert_eq!(
        text(&fixture.remote, &["for-each-ref", "--format=%(refname)"]),
        "refs/heads/main"
    );
}

#[test]
fn a_rejected_push_names_the_ref_and_reason() {
    let fixture = Fixture::new();
    let theirs = fixture.someone_else_pushes();
    commit_file(&fixture.work, "c.txt", "mine\n");

    let pushed = fixture.repo().push_branch("origin", "main", PUSH_TIMEOUT);

    assert_eq!(pushed, Err("[rejected] (fetch first)".to_owned()));
    assert_eq!(fixture.remote_main(), theirs);
}

#[test]
fn a_push_never_forces() {
    let fixture = Fixture::new();
    let theirs = fixture.someone_else_pushes();
    commit_file(&fixture.work, "c.txt", "mine\n");
    git_ok(&fixture.work, &["fetch", "-q", "origin"]).unwrap();
    let forcing = "+refs/heads/main:refs/heads/main";
    git_ok(&fixture.work, &["config", "remote.origin.push", forcing]).unwrap();

    let pushed = fixture.repo().push_branch("origin", "main", PUSH_TIMEOUT);

    assert_eq!(pushed, Err("[rejected] (non-fast-forward)".to_owned()));
    assert_eq!(fixture.remote_main(), theirs);
}

#[test]
fn a_push_to_a_missing_remote_gives_gits_fatal_line() {
    let fixture = Fixture::new();

    let pushed = fixture.repo().push_branch("nowhere", "main", PUSH_TIMEOUT);

    assert_eq!(
        pushed,
        Err("fatal: 'nowhere' does not appear to be a git repository".to_owned())
    );
}

// git runs a local remote's `remote.<name>.receivepack` through the shell with push's environment
// (git-config(1)), so it can record that environment.
#[cfg(unix)]
#[test]
fn the_push_runs_with_no_prompt_of_git_ssh_or_a_credential_manager() {
    let fixture = Fixture::new();
    commit_file(&fixture.work, "c.txt", "mine\n");
    let recorded = fixture.dir.path().join("push.env");
    let receive_pack = format!("env > '{}'; git-receive-pack", recorded.display());
    git_ok(
        &fixture.work,
        &["config", "remote.origin.receivepack", &receive_pack],
    )
    .unwrap();

    let pushed = fixture.repo().push_branch("origin", "main", PUSH_TIMEOUT);

    assert_eq!(pushed, Ok(()));
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

#[cfg(unix)]
#[test]
fn a_push_that_gets_no_answer_fails_at_its_deadline() {
    use std::time::{Duration, Instant};

    const SHORT_TIMEOUT: Duration = Duration::from_secs(1);
    const HANG: Duration = Duration::from_secs(5);
    let fixture = Fixture::new();
    commit_file(&fixture.work, "c.txt", "mine\n");
    let receive_pack = format!("sleep {}; git-receive-pack", HANG.as_secs());
    git_ok(
        &fixture.work,
        &["config", "remote.origin.receivepack", &receive_pack],
    )
    .unwrap();

    let started = Instant::now();
    let pushed = fixture.repo().push_branch("origin", "main", SHORT_TIMEOUT);

    assert_eq!(pushed, Err("git push got no answer within 1 s".to_owned()));
    assert!(started.elapsed() < HANG, "{:?}", started.elapsed());
}
