use super::through_glab::{glab_log, run_with_fakes};
use super::*;

const SCENARIO: &str = "mr-threads";
const REFRESH_TEST: &str = "merge_requests::tests::remembered::refresh_on_paths_glab";
const NO_PROJECT_TEST: &str = "merge_requests::tests::remembered::no_project_on_paths_glab";
const AUTH_STATUS: &str = "argv: auth status";
const PROJECT: &str = "argv: api projects/:fullpath";

fn preview(window: &MergeRequestWindow) -> Value {
    let args = json!({ "iid": 90, "text": "Hi" });
    invoke(window, "preview_markdown", args).unwrap()
}

fn asked_both() -> (usize, usize) {
    (glab_log(AUTH_STATUS).len(), glab_log(PROJECT).len())
}

#[test]
fn refresh_asks_again() {
    run_with_fakes(REFRESH_TEST, SCENARIO);
}

#[test]
#[ignore = "run by refresh_asks_again"]
fn refresh_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    assert_eq!(preview(&window)["kind"], "read");
    assert_eq!(preview(&window)["kind"], "read");
    assert_eq!(asked_both(), (1, 1));
    assert_eq!(
        invoke(&window, "ask_gitlab_again", json!({})),
        Ok(Value::Null)
    );
    assert_eq!(preview(&window)["kind"], "read");
    assert_eq!(asked_both(), (2, 2));
}

#[test]
fn ask_gitlab_again_without_a_project_does_nothing() {
    run_with_fakes(NO_PROJECT_TEST, SCENARIO);
}

#[test]
#[ignore = "run by ask_gitlab_again_without_a_project_does_nothing"]
fn no_project_on_paths_glab() {
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let window = open_window_in(plain);

    assert_eq!(
        invoke(&window, "ask_gitlab_again", json!({})),
        Ok(Value::Null)
    );
    assert_eq!(glab_log(""), Vec::<String>::new());
}
