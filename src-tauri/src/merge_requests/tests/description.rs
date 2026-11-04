use tauri::http::StatusCode;
use tauri::http::header::{CONTENT_TYPE, X_CONTENT_TYPE_OPTIONS};

use super::through_glab::{
    asked, glab_log, in_this_repository, is_not_found, log_after, open, opened_log, run_with_fakes,
};
use super::*;
use crate::merge_requests::description::{description_reply, read_description};

const SCENARIO: &str = "mr-description";
const PAGES_TEST: &str = "merge_requests::tests::description::described_pages_on_paths_opener";
const UNNAMED_TEST: &str = "merge_requests::tests::description::unnamed_addresses_on_paths_opener";
const UPLOAD_TEST: &str = "merge_requests::tests::description::an_upload_on_paths_glab";
const WEB_PATH_TEST: &str = "merge_requests::tests::description::a_web_path_upload_on_paths_glab";
const UNOFFERED_TEST: &str = "merge_requests::tests::description::unoffered_uploads_on_paths_glab";
const OTHER_SITES_TEST: &str = "merge_requests::tests::description::other_sites_on_paths_glab";
const COMMAND_TEST: &str = "merge_requests::tests::description::the_command_on_paths_glab";
const HEX_A: &str = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const HEX_B: &str = "f9e8d7c6b5a4938271605f4e3d2c1b0a";
const HEX_C: &str = "1111aaaa2222bbbb3333cccc4444dddd";
const SHOT: &str =
    "tests/glab/mr-description/uploads/7/uploads/0a1b2c3d4e5f60718293a4b5c6d7e8f9/shot.png";
const OLD: &str = "tests/glab/mr-description/pictures/-/project/7/uploads/f9e8d7c6b5a4938271605f4e3d2c1b0a/old.png";
const DOCS_PAGE: &str = "https://docs.example/x";
const ISSUE_PAGE: &str = "https://gitlab.com/taskboard/taskboard/-/issues/12";
const PLAIN_PAGE: &str = "http://plain.example/";

/// The reply the window gets for `iid` through the command.
fn read(window: &MergeRequestWindow, iid: u32) -> Value {
    let reply = block_on(read_description(
        window.webview.clone(),
        MergeRequestIid(iid),
    ));
    serde_json::to_value(reply.unwrap()).unwrap()
}

/// Every uploaded image's key in `reply`, in document order.
fn uploaded_keys(reply: &Value) -> Vec<String> {
    let mut keys = Vec::new();
    let mut pending = vec![reply];
    while let Some(value) = pending.pop() {
        match value {
            Value::Object(fields) => {
                if fields.get("kind") == Some(&json!("uploaded")) {
                    keys.push(fields["key"].as_str().unwrap().to_owned());
                }
                pending.extend(fields.values().rev());
            }
            Value::Array(items) => pending.extend(items.iter().rev()),
            Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
        }
    }
    keys
}

#[test]
fn a_described_page_is_offered_before_the_reply() {
    run_with_fakes(PAGES_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_described_page_is_offered_before_the_reply"]
fn described_pages_on_paths_opener() {
    let window = open_window_in(gitlab_repo());
    let not_offered = json!({ "kind": "notOffered" });
    for page in [DOCS_PAGE, ISSUE_PAGE, PLAIN_PAGE] {
        assert_eq!(open(&window, page), not_offered, "{page}");
    }
    assert_eq!(opened_log(), "");

    read(&window, 52);

    // macOS starts `/usr/bin/open` by its path (`yamt_merge_requests` `web_page.rs`), not PATH's fake: it would
    // open the real browser.
    if cfg!(target_os = "macos") {
        return;
    }
    let mut before = String::new();
    for page in [DOCS_PAGE, ISSUE_PAGE, PLAIN_PAGE] {
        assert_eq!(open(&window, page), json!({ "kind": "opened" }), "{page}");
        let logged = format!("{before}argv: {page}\n");
        assert_eq!(log_after(&before), logged);
        before = logged;
    }
}

#[test]
fn an_address_no_reply_named_is_not_offered() {
    run_with_fakes(UNNAMED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by an_address_no_reply_named_is_not_offered"]
fn unnamed_addresses_on_paths_opener() {
    let window = open_window_in(gitlab_repo());

    read(&window, 52);

    let not_offered = json!({ "kind": "notOffered" });
    for page in [
        "mailto:anna@example.com",
        "javascript:alert(1)",
        "https://evil.example/",
    ] {
        assert_eq!(open(&window, page), not_offered, "{page}");
    }
    assert_eq!(opened_log(), "");
}

#[test]
fn an_upload_is_offered_before_the_reply_and_served() {
    run_with_fakes(UPLOAD_TEST, SCENARIO);
}

#[test]
#[ignore = "run by an_upload_is_offered_before_the_reply_and_served"]
fn an_upload_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    let path = format!("/upload~{HEX_A}");
    assert!(is_not_found(&asked(&window, &path)));

    read(&window, 52);

    let answer = asked(&window, &path);
    assert_eq!(answer.status(), StatusCode::OK);
    assert_eq!(
        answer.body(),
        &std::fs::read(in_this_repository(SHOT)).unwrap()
    );
    assert_eq!(answer.headers()[CONTENT_TYPE], "image/png");
    assert_eq!(answer.headers()[X_CONTENT_TYPE_OPTIONS], "nosniff");
    let argv = glab_log("argv: ");
    let rest = format!("argv: api projects/7/uploads/{HEX_A}/shot.png");
    assert_eq!(argv.last(), Some(&rest));
}

#[test]
fn an_upload_the_api_does_not_know_is_served_from_its_web_path() {
    run_with_fakes(WEB_PATH_TEST, SCENARIO);
}

#[test]
#[ignore = "run by an_upload_the_api_does_not_know_is_served_from_its_web_path"]
fn a_web_path_upload_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    read(&window, 52);

    let answer = asked(&window, &format!("/upload~{HEX_B}"));

    assert_eq!(answer.status(), StatusCode::OK);
    assert_eq!(
        answer.body(),
        &std::fs::read(in_this_repository(OLD)).unwrap()
    );
    let argv = glab_log("argv: ");
    let asked = [
        format!("argv: api projects/7/uploads/{HEX_B}/old.png"),
        format!("argv: api https://gitlab.com/-/project/7/uploads/{HEX_B}/old.png"),
    ];
    assert_eq!(argv[argv.len() - 2..], asked);
}

#[test]
fn an_upload_no_reply_offered_gets_404_and_runs_no_glab() {
    run_with_fakes(UNOFFERED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by an_upload_no_reply_offered_gets_404_and_runs_no_glab"]
fn unoffered_uploads_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    read(&window, 52);
    let before = glab_log("argv: ");

    let refused = [
        "/upload~5555eeee6666ffff7777000088881111".to_owned(),
        "/upload~xyz".to_owned(),
        format!("/upload~{HEX_A}/../x"),
        format!("/upload~{}", HEX_A.to_uppercase()),
        format!("upload~{HEX_A}"),
    ];
    for path in refused {
        assert!(is_not_found(&asked(&window, &path)), "{path}");
    }
    assert_eq!(glab_log("argv: "), before);
}

#[test]
fn another_sites_image_is_never_fetched() {
    run_with_fakes(OTHER_SITES_TEST, SCENARIO);
}

#[test]
#[ignore = "run by another_sites_image_is_never_fetched"]
fn other_sites_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let keys = uploaded_keys(&read(&window, 52));

    let offered = [HEX_A, HEX_B, HEX_C].map(|hex| format!("upload~{hex}"));
    assert_eq!(keys, offered);
    for key in &keys {
        asked(&window, &format!("/{key}"));
    }
    let argv = glab_log("argv: ");
    for site in ["images.example", "evil.example"] {
        let named = argv.iter().find(|line| line.contains(site));
        assert_eq!(named, None, "{site}");
    }
}

#[test]
fn no_gitlab_project_fails_the_read() {
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let window = open_window_in(plain);

    let reply = description_reply(&window.webview.state(), None, MergeRequestIid(52));

    let failed = json!({ "kind": "failed", "message": NO_PROJECT });
    assert_eq!(serde_json::to_value(reply).unwrap(), failed);
}

#[test]
fn read_description_answers_through_the_command() {
    run_with_fakes(COMMAND_TEST, SCENARIO);
}

#[test]
#[ignore = "run by read_description_answers_through_the_command"]
fn the_command_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    let reply = |iid: u32| invoke(&window, "read_description", json!({ "iid": iid })).unwrap();

    let described = reply(52);
    let empty = reply(51);

    assert_eq!(described["kind"], "read");
    assert_eq!(described["description"]["blocks"][0]["kind"], "heading");
    let direct = description_reply(
        &window.webview.state(),
        Glab::find().as_ref(),
        MergeRequestIid(52),
    );
    assert_eq!(described, serde_json::to_value(direct).unwrap());
    assert_eq!(
        empty,
        json!({ "kind": "read", "description": { "blocks": [] } })
    );
}
