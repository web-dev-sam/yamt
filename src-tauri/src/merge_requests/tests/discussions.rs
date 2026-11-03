use tauri::http::StatusCode;

use super::through_glab::{glab_log, in_this_repository, run_with_fakes};
use super::*;
use crate::frontend_log::tests::logged;
use crate::merge_requests::discussions::discussions_reply;
use crate::merge_requests::pictures::picture_answer;

const SCENARIO: &str = "mr-discussions";
const OFFERED_TEST: &str = "merge_requests::tests::discussions::note_pages_on_paths_glab";
const PICTURE_TEST: &str = "merge_requests::tests::discussions::an_authors_picture_on_paths_glab";
const READ_TEST: &str =
    "merge_requests::tests::discussions::read_discussions_replies_on_paths_glab";
const LOG_TEST: &str = "merge_requests::tests::discussions::the_log_line_on_paths_glab";
const BATCH: [u32; 4] = [82, 81, 79, 78];
const NOTE_103: &str = "https://gitlab.example/taskboard/taskboard/-/merge_requests/82#note_103";
const UNLISTED_NOTE: &str =
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/82#note_999";
const EVIL_NOTE: &str = "https://evil.example/x#note_1";
const ANNA_S_PICTURE: &str =
    "tests/glab/mr-discussions/pictures/uploads/-/system/user/avatar/2/avatar.png";

/// The rows the window gets for `iids` through the command.
fn read(window: &MergeRequestWindow, iids: &[u32]) -> Value {
    let iids = iids.iter().map(|&iid| MergeRequestIid(iid)).collect();
    let reply = block_on(read_discussions(window.webview.clone(), iids));
    serde_json::to_value(reply.unwrap()).unwrap()
}

fn open(window: &MergeRequestWindow, page: &str) -> Value {
    invoke(window, "open_page", json!({ "page": page })).unwrap()
}

fn is_offered(window: &MergeRequestWindow, page: &str) -> bool {
    let page = serde_json::from_value(json!(page)).unwrap();
    let state: State<'_, MergeRequestState> = window.webview.state();
    offered(&state.pages).contains(&page)
}

#[test]
fn a_note_page_is_offered_before_the_reply() {
    run_with_fakes(OFFERED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_note_page_is_offered_before_the_reply"]
fn note_pages_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    let not_offered = json!({ "kind": "notOffered" });
    assert_eq!(open(&window, NOTE_103), not_offered);

    let rows = read(&window, &BATCH);

    assert_eq!(
        rows[0]["answer"]["discussions"][0]["last"]["page"],
        NOTE_103
    );
    assert!(is_offered(&window, NOTE_103));
    assert_eq!(open(&window, UNLISTED_NOTE), not_offered);
    assert_eq!(open(&window, EVIL_NOTE), not_offered);
    // macOS starts `/usr/bin/open` by its path (`yamt_merge_requests` `web_page.rs`), not PATH's fake: it would
    // open the real browser.
    if cfg!(not(target_os = "macos")) {
        assert_eq!(open(&window, NOTE_103), json!({ "kind": "opened" }));
    }
}

#[test]
fn an_authors_uploaded_picture_is_offered() {
    run_with_fakes(PICTURE_TEST, SCENARIO);
}

#[test]
#[ignore = "run by an_authors_uploaded_picture_is_offered"]
fn an_authors_picture_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    let asked = |path| picture_answer(&window.webview.state(), Glab::find().as_ref(), path);
    assert_eq!(asked("/anna").status(), StatusCode::NOT_FOUND);

    read(&window, &BATCH);

    let answer = asked("/anna");
    assert_eq!(answer.status(), StatusCode::OK);
    let file = std::fs::read(in_this_repository(ANNA_S_PICTURE)).unwrap();
    assert_eq!(answer.body(), &file);
    assert_eq!(asked("/ben").status(), StatusCode::NOT_FOUND);
    assert_eq!(asked("/sam").status(), StatusCode::NOT_FOUND);
}

#[test]
fn no_gitlab_project_fails_each_asked_row() {
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let window = open_window_in(plain);
    let iids = [
        MergeRequestIid(82),
        MergeRequestIid(81),
        MergeRequestIid(82),
    ];

    let rows = discussions_reply(&window.webview.state(), None, &iids);

    let failed = json!({ "kind": "failed", "message": NO_PROJECT });
    let expected = json!([{ "iid": 82, "answer": failed }, { "iid": 81, "answer": failed }]);
    assert_eq!(serde_json::to_value(rows).unwrap(), expected);
}

#[test]
fn read_discussions_answers_through_the_command() {
    run_with_fakes(READ_TEST, SCENARIO);
}

#[test]
#[ignore = "run by read_discussions_answers_through_the_command"]
fn read_discussions_replies_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let rows = read(&window, &[81]);

    let ben = json!({
        "username": "ben",
        "name": "Ben Okafor",
        "picture": {
            "kind": "gravatar",
            "address": "https://secure.gravatar.com/avatar/0f3a9c2e5b7d14f6a8c0e2b4d6f8a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d2f4?s=80&d=identicon",
        },
    });
    let last = json!({
        "author": ben,
        "createdAt": "2026-11-02T10:00:00Z",
        "text": "Please **check** <b>THIS</b> & that\non a dark theme\n<script>alert(1)</script>",
        "page": "https://gitlab.example/taskboard/taskboard/-/merge_requests/81#note_201",
    });
    let discussion = json!({ "place": { "kind": "overview" }, "last": last });
    let answer = json!({ "kind": "open", "discussions": [discussion] });
    assert_eq!(rows, json!([{ "iid": 81, "answer": answer }]));
    assert_eq!(read(&window, &[]), json!([]));
    let queries = glab_log("argv: api graphql");
    assert_eq!(queries.len(), 1, "{queries:?}");
}

#[test]
fn a_read_logs_its_counts_and_score_but_no_name_or_body() {
    run_with_fakes(LOG_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_read_logs_its_counts_and_score_but_no_name_or_body"]
fn the_log_line_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let iids = BATCH.map(MergeRequestIid);
    let reply = || discussions_reply(&window.webview.state(), Glab::find().as_ref(), &iids);
    let (_, log) = logged(reply);

    let lines: Vec<&str> = log.lines().filter(|line| line.contains(" INFO ")).collect();
    let line = " INFO yamt_merge_requests::discussions: read merge requests' open discussions asked=4 \
                answered=3 failed=1 queries=2 score=58 limit=250";
    assert_eq!(lines, [line], "{log}");
}
