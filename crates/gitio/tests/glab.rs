#![cfg(test)]
#![cfg(unix)]

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use yamt_conflict_repo::{
    ConflictFile, FileKind, TempDir, diverged_repo, git_ok, run_ignored_in_child,
};
use yamt_gitio::{Error, Glab, GlabRun, Oid, Repo};

const SHORT_TIMEOUT: Duration = Duration::from_millis(300);
const HANG_SECONDS: u64 = 5;
const PLAIN: u32 = 0o644;
const BODY_PAST_ANY_PIPE_BUFFER: usize = 1 << 20;
const POST: [&str; 6] = [
    "api",
    "--method",
    "POST",
    "projects/7/merge_requests/12/draft_notes",
    "--input",
    "-",
];
const NOT_FOUND_TEST: &str = "glab_is_none_on_a_path_without_a_runnable_glab";
const FOUND_TEST: &str = "glab_found_on_path_is_the_one_run";
const OVERRIDES_TEST: &str = "glab_runs_in_the_repository_with_no_color_and_stdin_closed";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

fn in_this_repository(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(relative)
}

fn fake_glab_folder() -> PathBuf {
    in_this_repository("scripts/fake-glab")
}

fn runner_scenario() -> PathBuf {
    in_this_repository("tests/glab/runner")
}

fn runner_file(name: &str) -> Vec<u8> {
    fs::read(runner_scenario().join(name)).unwrap()
}

/// The fake glab on the `runner` scenario through a symlink in `dir`, beside the `glab.env` naming its variables (a
/// test cannot change its own environment, which glab inherits); the post count and log live in `dir` too. A link,
/// not a written script: a parallel test's fork could still hold a written file open for writing at its exec
/// (ETXTBSY).
struct Fake {
    dir: TempDir,
    glab: Glab,
}

impl Fake {
    fn new(posts_before: u32) -> Fake {
        let dir = tempfile::tempdir().unwrap();
        let state = dir.path().join("state");
        fs::write(&state, format!("{posts_before}\n")).unwrap();
        let settings = format!(
            "YAMT_FAKE_GLAB={}\nYAMT_FAKE_GLAB_STATE={}\nYAMT_FAKE_GLAB_LOG={}\n",
            runner_scenario().display(),
            state.display(),
            dir.path().join("log").display(),
        );
        fs::write(dir.path().join("glab.env"), settings).unwrap();
        let link = dir.path().join("glab");
        std::os::unix::fs::symlink(fake_glab_folder().join("glab"), &link).unwrap();
        Fake {
            glab: Glab::at(link),
            dir,
        }
    }

    fn log(&self) -> String {
        fs::read_to_string(self.dir.path().join("log")).unwrap()
    }

    fn run(&self, args: &[&str], stdin: Option<Vec<u8>>) -> GlabRun {
        self.glab.run(self.dir.path(), args, stdin).unwrap()
    }
}

fn without_final_newline(mut bytes: Vec<u8>) -> Vec<u8> {
    assert_eq!(bytes.pop(), Some(b'\n'));
    bytes
}

#[test]
fn stdin_reaches_glab_and_stdout_comes_back() {
    let fake = Fake::new(0);
    let body = br#"{"note":"Why 300?","position":{"new_line":12}}"#;

    let ran = fake.run(&POST, Some(body.to_vec()));

    let answer = without_final_newline(runner_file("post-1.json"));
    assert_eq!(ran, GlabRun::Printed { stdout: answer });
    let logged = format!("stdin: {}\n", String::from_utf8_lossy(body));
    assert!(fake.log().ends_with(&logged), "{}", fake.log());
}

#[test]
fn a_failing_glab_keeps_its_exit_stdout_and_stderr() {
    let fake = Fake::new(1);
    let mut with_headers = vec!["api", "--include"];
    with_headers.extend_from_slice(&POST[1..]);

    let refused = fake.run(&with_headers, Some(b"{}".to_vec()));
    let failed = fake.run(&POST, Some(b"{}".to_vec()));
    let not_found = fake.run(&["api", "projects/7/unknown"], None);

    let refusal_body = without_final_newline(runner_file("post-2.json"));
    let mut refusal =
        b"HTTP/2.0 400 Bad Request\r\nContent-Type: application/json\r\n\r\n".to_vec();
    refusal.extend_from_slice(&refusal_body);
    let refusal_line = b"glab: 400 Bad request - note is missing (HTTP 400)\n".to_vec();
    let expected = [
        (Some(1), refusal, refusal_line),
        (Some(1), Vec::new(), runner_file("post-3.err")),
        (
            Some(1),
            br#"{"message":"404 Not Found"}"#.to_vec(),
            b"glab: 404 Not Found (HTTP 404)\n".to_vec(),
        ),
    ];
    let failures = expected.map(|(status, stdout, stderr)| GlabRun::Failed {
        status,
        stdout,
        stderr,
    });
    assert_eq!([refused, failed, not_found], failures);
}

#[test]
fn the_fake_invents_no_stderr_for_an_error_body_without_a_message() {
    let fake = Fake::new(4);

    let ran = fake.run(&POST, Some(b"{}".to_vec()));

    let expected = GlabRun::Failed {
        status: Some(2),
        stdout: without_final_newline(runner_file("post-5.json")),
        stderr: b"fake glab: no recorded stderr for this body\n".to_vec(),
    };
    assert_eq!(ran, expected);
}

#[test]
fn a_hanging_glab_times_out() {
    let fake = Fake::new(3);
    let glab = fake.glab.with_timeout(SHORT_TIMEOUT);
    let started = Instant::now();

    let ran = glab
        .run(fake.dir.path(), &POST, Some(b"{}".to_vec()))
        .unwrap();

    assert_eq!(ran, GlabRun::TimedOut);
    assert!(
        started.elapsed() < Duration::from_secs(HANG_SECONDS),
        "{:?}",
        started.elapsed()
    );
}

#[test]
fn glab_overrides_no_color_and_the_terminal_prompt_and_closes_stdin() {
    let dir = tempfile::tempdir().unwrap();
    let leaked = dir.path().join("stdin");
    fs::write(&leaked, "leaked").unwrap();
    let stdin = fs::File::open(&leaked).unwrap();

    let ran = run_ignored_in_child(&[OVERRIDES_TEST], |child| {
        child
            .env("NO_COLOR", "0")
            .env("GIT_TERMINAL_PROMPT", "1")
            .stdin(stdin);
    });

    ran.unwrap_or_else(|error| panic!("{error}"));
}

#[test]
#[ignore = "run by glab_overrides_no_color_and_the_terminal_prompt_and_closes_stdin"]
fn glab_runs_in_the_repository_with_no_color_and_stdin_closed() {
    let fake = Fake::new(0);
    let repo = diverged_repo(&FILES).unwrap();

    let ran = fake.glab.run(repo.path(), &POST, None).unwrap();

    assert!(matches!(ran, GlabRun::Printed { .. }), "{ran:?}");
    let root = fs::canonicalize(repo.path()).unwrap();
    let expected = format!(
        "argv: {}\ncwd: {}\nenv: NO_COLOR=1 GIT_TERMINAL_PROMPT=0\nstdin: \n",
        POST.join(" "),
        root.display()
    );
    assert_eq!(fake.log(), expected);
}

#[test]
fn a_body_glab_left_unread_fails_only_a_run_that_exited_0() {
    let fake = Fake::new(0);
    let body = vec![b'x'; BODY_PAST_ANY_PIPE_BUFFER];
    let merge_request = ["api", "projects/7/merge_requests/12"];

    let printed = fake
        .glab
        .run(fake.dir.path(), &merge_request, Some(body.clone()));
    let failed = fake.run(&["api", "projects/7/unknown"], Some(body));

    assert!(matches!(printed, Err(Error::GlabIo { .. })), "{printed:?}");
    assert!(
        matches!(
            failed,
            GlabRun::Failed {
                status: Some(1),
                ..
            }
        ),
        "{failed:?}"
    );
}

#[test]
fn a_glab_that_cannot_start_is_an_i_o_error_naming_it() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("glab");

    let error = Glab::at(missing.clone()).run(dir.path(), &["--version"], None);

    assert!(
        matches!(&error, Err(Error::GlabIo { program, .. }) if *program == missing),
        "{error:?}"
    );
}

#[test]
fn glab_missing_on_path_is_none() {
    let (empty, plain) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
    let not_runnable = plain.path().join("glab");
    fs::write(&not_runnable, "#!/bin/sh\n").unwrap();
    fs::set_permissions(&not_runnable, fs::Permissions::from_mode(PLAIN)).unwrap();
    let path = std::env::join_paths([empty.path(), plain.path()]).unwrap();

    let ran = run_ignored_in_child(&[NOT_FOUND_TEST], |child| {
        child.env("PATH", path);
    });

    ran.unwrap_or_else(|error| panic!("{error}"));
}

#[test]
#[ignore = "run by glab_missing_on_path_is_none"]
fn glab_is_none_on_a_path_without_a_runnable_glab() {
    assert!(Glab::find().is_none());
}

#[test]
fn glab_on_path_is_found() {
    let inherited = std::env::var_os("PATH").unwrap_or_default();
    let mut folders = vec![fake_glab_folder()];
    folders.extend(std::env::split_paths(&inherited));
    let path = std::env::join_paths(folders).unwrap();

    let ran = run_ignored_in_child(&[FOUND_TEST], |child| {
        child
            .env("PATH", path)
            .env("YAMT_FAKE_GLAB", runner_scenario());
    });

    ran.unwrap_or_else(|error| panic!("{error}"));
}

#[test]
#[ignore = "run by glab_on_path_is_found"]
fn glab_found_on_path_is_the_one_run() {
    let dir = tempfile::tempdir().unwrap();
    let glab = Glab::find().unwrap();

    let ran = glab.run(dir.path(), &["auth", "status"], None).unwrap();

    let stderr = runner_file("auth-status.out");
    let expected = GlabRun::Failed {
        status: Some(1),
        stdout: Vec::new(),
        stderr,
    };
    assert_eq!(ran, expected);
}

fn oid_of(root: &Path, revision: &str) -> Oid {
    let output = git_ok(root, &["rev-parse", revision]).unwrap();
    Oid::parse(String::from_utf8(output).unwrap().trim_end()).unwrap()
}

#[test]
fn branch_names_from_heads_and_remote_tracking_and_none_for_a_commit_id() {
    let dir = diverged_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    git_ok(
        root,
        &["update-ref", "refs/remotes/origin/feature", "remote"],
    )
    .unwrap();
    let remote_commit = oid_of(root, "remote");
    let name = |name: &str| repo.symbolic_full_name(name).unwrap();

    let named: [(&str, Option<&[u8]>); 5] = [
        ("remote", Some(b"refs/heads/remote")),
        ("origin/feature", Some(b"refs/remotes/origin/feature")),
        ("HEAD", Some(b"refs/heads/local")),
        (remote_commit.as_str(), None),
        ("remote~1", None),
    ];
    for (typed, expected) in named {
        assert_eq!(name(typed), expected.map(<[u8]>::to_vec), "{typed}");
    }
    let range = repo.symbolic_full_name("main...remote");
    assert!(matches!(range, Err(Error::GitFailed { .. })), "{range:?}");
    git_ok(root, &["checkout", "--quiet", "--detach"]).unwrap();
    assert_eq!(name("HEAD"), Some(b"HEAD".to_vec()));
}

#[test]
fn remote_names_lists_every_remote() {
    let dir = diverged_repo(&FILES).unwrap();
    let root = dir.path();
    let repo = Repo::discover(root).unwrap();
    assert_eq!(repo.remote_names().unwrap(), Vec::<Vec<u8>>::new());

    for remote in ["upstream", "origin", "fork"] {
        let url = format!("https://gitlab.example/{remote}.git");
        git_ok(root, &["remote", "add", remote, &url]).unwrap();
    }

    let expected: [&[u8]; 3] = [b"fork", b"origin", b"upstream"];
    assert_eq!(repo.remote_names().unwrap(), expected);
}
