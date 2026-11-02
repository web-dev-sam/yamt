use super::through_glab::run_with_fakes;
use super::*;

const REREQUEST_TEST: &str =
    "merge_requests::tests::rerequest::rerequest_review_replies_on_paths_glab";

fn rerequest(window: &MergeRequestWindow, iid: u32, username: &str) -> Value {
    let reply = block_on(rerequest_review(
        window.webview.clone(),
        MergeRequestIid(iid),
        username.to_owned(),
    ));
    serde_json::to_value(reply.unwrap()).unwrap()
}

#[test]
fn rerequest_review_answers_through_the_command() {
    run_with_fakes(REREQUEST_TEST, "mr-row-details");
}

#[test]
#[ignore = "run by rerequest_review_answers_through_the_command"]
fn rerequest_review_replies_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let no_project = open_window_in(plain);

    let requested = rerequest(&window, 52, "ben");

    assert_eq!(requested["kind"], "requested");
    let ben = &requested["reviewers"][0];
    assert_eq!(
        (&ben["person"]["username"], &ben["state"]),
        (&json!("ben"), &json!("requested"))
    );
    assert_eq!(
        rerequest(&window, 52, "anna"),
        json!({ "kind": "notReviewer" })
    );
    assert_eq!(rerequest(&window, 50, "anna"), json!({ "kind": "notOpen" }));
    let failed = json!({ "kind": "failed", "message": NO_PROJECT });
    assert_eq!(rerequest(&no_project, 52, "ben"), failed);
}
