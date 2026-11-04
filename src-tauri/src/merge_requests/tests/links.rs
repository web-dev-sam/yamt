use super::through_glab::{log_after, open, opened_log, run_with_fakes};
use super::*;
use crate::merge_requests::links::{links_reply, read_links};

const SCENARIO: &str = "mr-links";
const OFFERED_TEST: &str = "merge_requests::tests::links::line_and_parent_pages_on_paths_opener";
const UNNAMED_TEST: &str = "merge_requests::tests::links::unnamed_pages_on_paths_opener";
const UNSEEN_TEST: &str = "merge_requests::tests::links::an_unseen_page_on_paths_opener";
const COMMAND_TEST: &str = "merge_requests::tests::links::the_command_on_paths_glab";
const ISSUE_PAGE: &str = "https://gitlab.example/taskboard/taskboard/-/work_items/12";
const PARENT_PAGE: &str = "https://gitlab.example/groups/taskboard/-/work_items/3";
const UNSEEN_PAGE: &str = "https://gitlab.example/secret/vault/-/issues/9";

/// Reads merge request `iid`'s links through the command, as the window does.
fn read(window: &MergeRequestWindow, iid: u32) {
    block_on(read_links(window.webview.clone(), MergeRequestIid(iid))).unwrap();
}

#[test]
fn a_line_and_a_parent_page_are_offered_before_the_reply() {
    run_with_fakes(OFFERED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_line_and_a_parent_page_are_offered_before_the_reply"]
fn line_and_parent_pages_on_paths_opener() {
    let window = open_window_in(gitlab_repo());
    let not_offered = json!({ "kind": "notOffered" });
    for page in [ISSUE_PAGE, PARENT_PAGE] {
        assert_eq!(open(&window, page), not_offered, "{page}");
    }
    assert_eq!(opened_log(), "");

    read(&window, 62);

    // macOS starts `/usr/bin/open` by its path (`yamt_merge_requests` `web_page.rs`), not PATH's fake: it would
    // open the real browser.
    if cfg!(target_os = "macos") {
        return;
    }
    let mut before = String::new();
    for page in [ISSUE_PAGE, PARENT_PAGE] {
        assert_eq!(open(&window, page), json!({ "kind": "opened" }), "{page}");
        let logged = format!("{before}argv: {page}\n");
        assert_eq!(log_after(&before), logged);
        before = logged;
    }
}

#[test]
fn a_page_the_links_reply_did_not_name_is_not_offered() {
    run_with_fakes(UNNAMED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_page_the_links_reply_did_not_name_is_not_offered"]
fn unnamed_pages_on_paths_opener() {
    let window = open_window_in(gitlab_repo());

    read(&window, 62);

    let not_offered = json!({ "kind": "notOffered" });
    for page in [
        "https://evil.example/groups/x/-/work_items/1",
        "https://gitlab.example/taskboard/taskboard/-/milestones/1",
        "https://gitlab.other/x/y/-/issues/1",
    ] {
        assert_eq!(open(&window, page), not_offered, "{page}");
    }
    assert_eq!(opened_log(), "");
}

#[test]
fn an_unseen_things_address_is_offered() {
    run_with_fakes(UNSEEN_TEST, SCENARIO);
}

#[test]
#[ignore = "run by an_unseen_things_address_is_offered"]
fn an_unseen_page_on_paths_opener() {
    let window = open_window_in(gitlab_repo());

    read(&window, 62);

    if cfg!(target_os = "macos") {
        return;
    }
    assert_eq!(open(&window, UNSEEN_PAGE), json!({ "kind": "opened" }));
    assert_eq!(log_after(""), format!("argv: {UNSEEN_PAGE}\n"));
}

#[test]
fn no_gitlab_project_fails_the_read() {
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let window = open_window_in(plain);

    let reply = links_reply(&window.webview.state(), None, MergeRequestIid(62));

    let failed = json!({ "kind": "failed", "message": NO_PROJECT });
    assert_eq!(serde_json::to_value(reply).unwrap(), failed);
}

#[test]
fn read_links_answers_through_the_command() {
    run_with_fakes(COMMAND_TEST, SCENARIO);
}

#[test]
#[ignore = "run by read_links_answers_through_the_command"]
fn the_command_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    let reply = |iid: u32| invoke(&window, "read_links", json!({ "iid": iid })).unwrap();

    let read = reply(62);
    let failed = reply(60);

    assert_eq!(read["kind"], "read");
    let length = |group: &str| read["links"][group].as_array().unwrap().len();
    assert_eq!(
        [length("epics"), length("issues"), length("commits")],
        [3, 6, 4]
    );
    assert_eq!(
        failed,
        json!({ "kind": "failed", "message": "glab: a deadline line" })
    );
}
