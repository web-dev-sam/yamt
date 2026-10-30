#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use std::fs;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_gitio::{Glab, TIMED_OUT};
use yamt_merge_requests::{
    GitLabRepository, ListEnd, MergeRequestPage, gitlab_repository, list_merge_requests,
};

use fake_glab::Fake;

const SHORT_TIMEOUT: Duration = Duration::from_secs(2);
const TIMEOUT_SCENARIO_SLEEP: Duration = Duration::from_secs(25);
const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const FIRST_PAGE_FIELDS: &str = " -f fullPath=taskboard/taskboard -F first=100";
const QUERY_START: &str = "argv: api graphql -f query=query MergeRequestPage(";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

/// A repository whose `origin` is on gitlab.example, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let dir = diverged_repo(&FILES).unwrap();
    git_ok(dir.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(dir.path()).unwrap();
    (dir, repository)
}

/// The end of a load and the pages sent before it.
fn listed(repository: &GitLabRepository, glab: Option<&Glab>) -> (ListEnd, Vec<MergeRequestPage>) {
    let (sender, sent) = mpsc::channel();
    let on_page = |page: MergeRequestPage| sender.send(page).unwrap();
    let end = list_merge_requests(repository, glab, &on_page);
    (end, sent.try_iter().collect())
}

fn iids(page: &MergeRequestPage) -> Vec<u32> {
    page.rows.iter().map(|row| row.iid.0).collect()
}

#[test]
fn the_list_comes_page_by_page_from_glab_graphql_after_each_cursor() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("merge-requests");

    let (end, pages) = listed(&repository, Some(&fake.glab));

    assert_eq!(end, ListEnd::Loaded);
    let sent: Vec<Vec<u32>> = pages.iter().map(iids).collect();
    assert_eq!(sent, [vec![13, 12, 11], vec![9, 8]]);
    assert_eq!(pages[0].me.as_deref(), Some("sam"));
    let failed = pages[0].rows[0].pipeline.as_ref().unwrap();
    let job_page = failed.failed_jobs[0].page.as_ref().unwrap();
    assert_eq!(
        job_page.as_str(),
        "https://gitlab.example/taskboard/taskboard/-/jobs/302"
    );
    let argv = fake.logged("argv: ");
    assert_eq!(
        argv[..2],
        ["argv: auth status", "argv: api projects/:fullpath"]
    );
    let [first, second] = &argv[2..] else {
        panic!("{argv:?}");
    };
    assert!(first.starts_with(QUERY_START), "{first}");
    assert!(first.ends_with(FIRST_PAGE_FIELDS), "{first}");
    assert!(second.starts_with(QUERY_START), "{second}");
    let after = format!("{FIRST_PAGE_FIELDS} -f after=page-2");
    assert!(second.ends_with(&after), "{second}");
}

#[test]
fn glab_runs_in_the_repository_with_no_color_and_no_terminal_prompt() {
    let (repo, repository) = gitlab_repo();
    let fake = Fake::new("merge-requests");

    listed(&repository, Some(&fake.glab));

    let root = fs::canonicalize(repo.path()).unwrap();
    let cwd = format!("cwd: {}", root.display());
    assert_eq!(fake.logged("cwd: "), vec![cwd; 4]);
    let env = "env: NO_COLOR=1 GIT_TERMINAL_PROMPT=0".to_owned();
    assert_eq!(fake.logged("env: "), vec![env; 4]);
    assert_eq!(fs::canonicalize(repository.root()).unwrap(), root);
}

#[test]
fn glab_missing_or_logged_out_ends_the_list_before_any_page() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("logged-out");

    let missing = listed(&repository, None);
    let logged_out = listed(&repository, Some(&fake.glab));

    assert_eq!(missing, (ListEnd::GlabMissing, Vec::new()));
    let detail = "gitlab.com".to_owned();
    assert_eq!(logged_out, (ListEnd::NotLoggedIn { detail }, Vec::new()));
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}

#[test]
fn a_page_past_glab_s_deadline_fails_the_list_in_glab_s_timeout_words() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("merge-requests-timeout");
    let glab = Glab::at(fake.dir.path().join("glab")).with_timeout(SHORT_TIMEOUT);
    let started = Instant::now();

    let timed_out = listed(&repository, Some(&glab));

    let message = TIMED_OUT.to_owned();
    assert_eq!(timed_out, (ListEnd::Failed { message }, Vec::new()));
    assert!(
        started.elapsed() < TIMEOUT_SCENARIO_SLEEP,
        "{:?}",
        started.elapsed()
    );
}

#[test]
fn a_project_glab_cannot_find_fails_the_list_in_glab_s_words() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("lined-up");

    let not_found = listed(&repository, Some(&fake.glab));

    let message = "glab: 404 Not Found (HTTP 404)".to_owned();
    assert_eq!(not_found, (ListEnd::Failed { message }, Vec::new()));
}
