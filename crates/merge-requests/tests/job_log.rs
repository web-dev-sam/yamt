#![cfg(test)]
#![cfg(unix)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod fake_glab;

use serde_json::json;
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    GitLabRepository, JobLog, JobLogReply, MAX_LOG_BYTES, WebPage, gitlab_repository, read_job_log,
};

use fake_glab::{Fake, in_this_repository};

const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const SCENARIO: &str = "ci-job-log";
const JOBS: &str = "https://gitlab.example/taskboard/taskboard/-/jobs";
const FORK_JOB: &str = "https://gitlab.example/sam/taskboard/-/jobs/310";
const FIRST_LINE_OF_303: &str = "FIRST LINE OF THE LONG LOG";

/// A repository whose `origin` is on gitlab.example, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    (repo, repository)
}

fn page(address: &str) -> WebPage {
    serde_json::from_value(json!(address)).unwrap()
}

fn job(number: u32) -> WebPage {
    page(&format!("{JOBS}/{number}"))
}

fn trace_file(number: u32) -> Vec<u8> {
    let path = format!("tests/glab/{SCENARIO}/traces/{number}.log");
    std::fs::read(in_this_repository(&path)).unwrap()
}

fn read(fake: &Fake, repository: &GitLabRepository, page: &WebPage) -> JobLogReply {
    read_job_log(repository, Some(&fake.glab), page)
}

fn log_of(reply: JobLogReply) -> JobLog {
    let JobLogReply::Log { log } = reply else {
        panic!("not a log: {reply:?}");
    };
    log
}

#[test]
fn an_offered_jobs_log_comes_byte_for_byte_with_its_colour_codes() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let log = log_of(read(&fake, &repository, &job(302)));

    let file = String::from_utf8(trace_file(302)).unwrap();
    assert_eq!(
        log,
        JobLog {
            text: file,
            cut: false
        }
    );
    assert!(log.text.contains("\u{1b}[38;5;208m"));
}

#[test]
fn a_log_over_500_kib_is_cut_at_a_line_start_and_flagged() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let log = log_of(read(&fake, &repository, &job(303)));

    let file = trace_file(303);
    assert!(file.len() > MAX_LOG_BYTES);
    assert!(log.cut);
    assert!(log.text.len() <= MAX_LOG_BYTES);
    assert!(file.ends_with(log.text.as_bytes()));
    let before_the_tail = file[file.len() - log.text.len() - 1];
    assert_eq!(before_the_tail, b'\n');
    assert!(!log.text.contains(FIRST_LINE_OF_303));
}

#[test]
fn a_jobs_log_is_asked_by_its_own_projects_path() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let log = log_of(read(&fake, &repository, &page(FORK_JOB)));

    let file = String::from_utf8(trace_file(310)).unwrap();
    assert_eq!(log.text, file);
    let argv = fake.logged("argv: ");
    assert_eq!(
        argv.last().unwrap(),
        "argv: api projects/sam%2Ftaskboard/jobs/310/trace"
    );
}

#[test]
fn a_missing_trace_is_no_log() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    assert_eq!(read(&fake, &repository, &job(304)), JobLogReply::NoLog);
    assert_eq!(
        fake.logged("answered: "),
        ["answered: projects/taskboard%2Ftaskboard/jobs/304/trace"]
    );
}

#[test]
fn an_empty_trace_is_no_log() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    assert_eq!(read(&fake, &repository, &job(305)), JobLogReply::NoLog);
    assert_eq!(fake.logged("answered: ").len(), 1);
}

#[test]
fn glab_missing_is_glab_missing() {
    let (_repo, repository) = gitlab_repo();

    let reply = read_job_log(&repository, None, &job(302));

    assert_eq!(reply, JobLogReply::GlabMissing);
}

#[test]
fn logged_out_is_not_logged_in() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("logged-out");

    let reply = read(&fake, &repository, &job(302));

    let detail = "gitlab.com".to_owned();
    assert_eq!(reply, JobLogReply::NotLoggedIn { detail });
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}

#[test]
fn a_merge_request_page_is_not_a_job_and_runs_no_glab() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let merge_request = page("https://gitlab.example/taskboard/taskboard/-/merge_requests/71");

    let reply = read(&fake, &repository, &merge_request);

    assert_eq!(reply, JobLogReply::NotOffered);
    assert_eq!(fake.logged("argv: "), Vec::<String>::new());
}

#[test]
fn a_job_page_of_another_gitlab_asks_for_no_log() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let elsewhere = page("https://other.example/taskboard/taskboard/-/jobs/302");

    let reply = read(&fake, &repository, &elsewhere);

    assert_eq!(reply, JobLogReply::NotOffered);
    let asked_a_trace = fake
        .logged("argv: ")
        .iter()
        .any(|line| line.contains("/trace"));
    assert!(!asked_a_trace);
}
