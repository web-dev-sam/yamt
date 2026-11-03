use super::through_glab::{in_this_repository, run_with_fakes};
use super::*;

const SCENARIO: &str = "ci-job-log";
const NOT_OFFERED_TEST: &str = "merge_requests::tests::job_log::an_unlisted_job_on_paths_glab";
const KEPT_TEST: &str = "merge_requests::tests::job_log::a_kept_log_on_paths_glab";
const NOT_KEPT_TEST: &str = "merge_requests::tests::job_log::a_missing_log_on_paths_glab";
const READ_TEST: &str = "merge_requests::tests::job_log::read_job_log_replies_on_paths_glab";
const JOB_302: &str = "https://gitlab.example/taskboard/taskboard/-/jobs/302";
const JOB_304: &str = "https://gitlab.example/taskboard/taskboard/-/jobs/304";
const UNLISTED_JOB: &str = "https://gitlab.example/taskboard/taskboard/-/jobs/999";
const MERGE_REQUEST_71: &str = "https://gitlab.example/taskboard/taskboard/-/merge_requests/71";
const TRACE_302: &str = "argv: api projects/taskboard%2Ftaskboard/jobs/302/trace";
const TRACE_304: &str = "argv: api projects/taskboard%2Ftaskboard/jobs/304/trace";
const AUTH_STATUS: &str = "argv: auth status";

/// The reply the window gets for `page` through the command.
fn read(window: &MergeRequestWindow, page: &str) -> Value {
    let page = serde_json::from_value(json!(page)).unwrap();
    let reply = block_on(read_job_log(window.webview.clone(), page));
    serde_json::to_value(reply.unwrap()).unwrap()
}

fn glab_log(prefix: &str) -> Vec<String> {
    let log = std::env::var_os("YAMT_FAKE_GLAB_LOG").unwrap();
    let log = std::fs::read_to_string(log).unwrap_or_default();
    let lines = log.lines().filter(|line| line.starts_with(prefix));
    lines.map(str::to_owned).collect()
}

fn count(lines: &[String], line: &str) -> usize {
    lines.iter().filter(|logged| *logged == line).count()
}

fn listed_window() -> MergeRequestWindow {
    let window = open_window_in(gitlab_repo());
    let messages = list(&window);
    assert_eq!(messages.last().unwrap()["end"], json!({ "kind": "loaded" }));
    window
}

fn trace_text(number: u32) -> String {
    let path = format!("tests/glab/{SCENARIO}/traces/{number}.log");
    std::fs::read_to_string(in_this_repository(&path)).unwrap()
}

#[test]
fn a_job_no_list_offered_gets_no_log_and_runs_no_glab() {
    run_with_fakes(NOT_OFFERED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_job_no_list_offered_gets_no_log_and_runs_no_glab"]
fn an_unlisted_job_on_paths_glab() {
    let not_offered = json!({ "kind": "notOffered" });
    let unlisted = open_window_in(gitlab_repo());
    assert_eq!(read(&unlisted, JOB_302), not_offered);
    assert_eq!(glab_log("argv: "), Vec::<String>::new());
    let window = listed_window();
    let after_the_list = glab_log("argv: ");

    assert_eq!(read(&window, UNLISTED_JOB), not_offered);
    assert_eq!(read(&window, MERGE_REQUEST_71), not_offered);

    assert_eq!(glab_log("argv: "), after_the_list);
}

#[test]
fn a_second_request_for_the_same_job_runs_no_glab() {
    run_with_fakes(KEPT_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_second_request_for_the_same_job_runs_no_glab"]
fn a_kept_log_on_paths_glab() {
    let window = listed_window();
    let auth_after_the_list = count(&glab_log("argv: "), AUTH_STATUS);

    let first = read(&window, JOB_302);
    let second = read(&window, JOB_302);

    let log = json!({ "kind": "log", "log": { "text": trace_text(302), "cut": false } });
    assert_eq!(first, log);
    assert_eq!(second, log);
    let argv = glab_log("argv: ");
    assert_eq!(count(&argv, TRACE_302), 1, "{argv:?}");
    assert_eq!(
        count(&argv, AUTH_STATUS),
        auth_after_the_list + 1,
        "{argv:?}"
    );
}

#[test]
fn a_failure_is_not_kept_and_the_next_request_asks_again() {
    run_with_fakes(NOT_KEPT_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_failure_is_not_kept_and_the_next_request_asks_again"]
fn a_missing_log_on_paths_glab() {
    let window = listed_window();

    let first = read(&window, JOB_304);
    let second = read(&window, JOB_304);

    let no_log = json!({ "kind": "noLog" });
    assert_eq!((first, second), (no_log.clone(), no_log));
    let argv = glab_log("argv: ");
    assert_eq!(count(&argv, TRACE_304), 2, "{argv:?}");
}

#[test]
fn read_job_log_answers_through_the_command() {
    run_with_fakes(READ_TEST, SCENARIO);
}

#[test]
#[ignore = "run by read_job_log_answers_through_the_command"]
fn read_job_log_replies_on_paths_glab() {
    let window = listed_window();
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let no_project = open_window_in(plain);

    let read_302 = read(&window, JOB_302);

    assert_eq!(read_302["kind"], "log");
    assert_eq!(read_302["log"]["text"], trace_text(302));
    assert_eq!(read(&no_project, JOB_302), json!({ "kind": "notOffered" }));
    let failed = json!({ "kind": "failed", "message": NO_PROJECT });
    let state: State<'_, MergeRequestState> = no_project.webview.state();
    offered(&state.pages).insert(serde_json::from_value(json!(JOB_302)).unwrap());
    assert_eq!(read(&no_project, JOB_302), failed);
}
