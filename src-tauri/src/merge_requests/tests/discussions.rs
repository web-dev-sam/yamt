use tauri::http::StatusCode;

use super::through_glab::{
    asked, glab_log, in_this_repository, is_not_found, open, opens_each, run_with_fakes,
};
use super::*;
use crate::frontend_log::tests::logged;
use crate::merge_requests::discussions::discussions_reply;
use crate::merge_requests::pictures::picture_answer;

const SCENARIO: &str = "mr-discussions";
const OFFERED_TEST: &str = "merge_requests::tests::discussions::note_pages_on_paths_glab";
const PICTURE_TEST: &str = "merge_requests::tests::discussions::an_authors_picture_on_paths_glab";
const READ_TEST: &str =
    "merge_requests::tests::discussions::read_discussions_replies_on_paths_glab";
const FIRST_TEST: &str = "merge_requests::tests::discussions::first_comments_on_paths_glab";
const FIRST_OFFERS_TEST: &str =
    "merge_requests::tests::discussions::first_comment_offers_on_paths_opener";
const LOG_TEST: &str = "merge_requests::tests::discussions::the_log_line_on_paths_glab";
const BATCH: [u32; 4] = [82, 81, 79, 78];
const NOTE_103: &str = "https://gitlab.com/taskboard/taskboard/-/merge_requests/82#note_103";
const UNLISTED_NOTE: &str = "https://gitlab.com/taskboard/taskboard/-/merge_requests/82#note_999";
const EVIL_NOTE: &str = "https://evil.example/x#note_1";
const ANNA_S_PICTURE: &str =
    "tests/glab/mr-discussions/pictures/uploads/-/system/user/avatar/2/avatar.png";
const ISSUE_12: &str = "https://gitlab.com/taskboard/taskboard/-/issues/12";
const UPLOAD: &str = "/upload~8201a1b2c3d4e5f60718293a4b5c6d7e";
const SORT: &str =
    "tests/glab/mr-discussions/uploads/7/uploads/8201a1b2c3d4e5f60718293a4b5c6d7e/sort.png";

/// The rows the window gets for `iids` through the command.
fn read(window: &MergeRequestWindow, iids: &[u32]) -> Value {
    let iids = iids.iter().map(|&iid| MergeRequestIid(iid)).collect();
    let reply = block_on(read_discussions(window.webview.clone(), iids));
    serde_json::to_value(reply.unwrap()).unwrap()
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
    opens_each(&window, &[NOTE_103]);
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

/// The first comment of !81's one discussion, ben's note 201: GitLab's escaped markup stays text.
fn bens_first() -> Value {
    json!({
        "createdAt": "2026-11-02T10:00:00Z",
        "body": { "blocks": [{ "kind": "paragraph", "inlines": [
            { "kind": "text", "text": "Please " },
            { "kind": "strong", "inlines": [{ "kind": "text", "text": "check" }] },
            { "kind": "text", "text": " " },
            { "kind": "strong", "inlines": [{ "kind": "text", "text": "THIS" }] },
            { "kind": "text", "text": " & that\non a dark theme\n<script>alert(1)</script>" },
        ] }] },
    })
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
        "page": "https://gitlab.com/taskboard/taskboard/-/merge_requests/81#note_201",
        "mentions": [],
    });
    let discussion = json!({
        "id": "0000000000000000000000000000000000008101",
        "place": { "kind": "overview" },
        "first": bens_first(),
        "earlier": [],
        "last": last,
    });
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
    let asked = " INFO yamt_merge_requests::project: asked glab for the login and the project outcome=\"found\"";
    let line = " INFO yamt_merge_requests::discussions: read merge requests' open discussions asked=4 \
                answered=3 failed=1 pages=5 uploads=1 queries=2 score=58 limit=250";
    assert_eq!(lines, [asked, line], "{log}");
}

/// A first comment's body that is one paragraph of `text`.
fn paragraph(text: &str) -> Value {
    json!({ "blocks": [{ "kind": "paragraph", "inlines": [{ "kind": "text", "text": text }] }] })
}

/// The first comment of !82's first discussion, anna's note 101: a link to issue #12 and an uploaded image.
fn annas_first() -> Value {
    let body = json!({ "blocks": [
        { "kind": "paragraph", "inlines": [
            { "kind": "text", "text": "Should a card without a due date sort last? As in " },
            { "kind": "link", "link": { "kind": "page", "page": ISSUE_12 },
              "inlines": [{ "kind": "text", "text": "#12" }] },
            { "kind": "text", "text": ":" },
        ] },
        { "kind": "paragraph", "inlines": [
            { "kind": "image", "image": { "kind": "uploaded", "key": &UPLOAD[1..] },
              "caption": "sort", "size": null },
        ] },
    ] });
    json!({ "createdAt": "2026-11-03T10:00:00Z", "body": body })
}

#[test]
fn each_discussion_carries_its_first_comment_in_one_read() {
    run_with_fakes(FIRST_TEST, SCENARIO);
}

#[test]
#[ignore = "run by each_discussion_carries_its_first_comment_in_one_read"]
fn first_comments_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let rows = read(&window, &BATCH);

    let firsts: Vec<Value> = rows
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|row| row["answer"]["discussions"].as_array())
        .flatten()
        .map(|discussion| discussion["first"].clone())
        .collect();
    let first = |at: &str, body: Value| json!({ "createdAt": at, "body": body });
    let expected = [
        annas_first(),
        first(
            "2026-11-03T10:10:00Z",
            paragraph("This removed line still has a caller."),
        ),
        first(
            "2026-11-03T10:20:00Z",
            paragraph("Please add a screenshot to the description."),
        ),
        bens_first(),
        first(
            "2026-10-31T10:20:00Z",
            paragraph("Search titles only, for now?"),
        ),
    ];
    assert_eq!(firsts, expected);
    let queries = glab_log("argv: api graphql");
    assert_eq!(queries.len(), 2, "{queries:?}");
    assert!(queries[0].ends_with(r#" -F iids=["82","81","79","78"] -F first=4"#));
    assert!(queries[1].ends_with(r#" -F iids=["79"] -F first=1 -f discussionsAfter=d-2"#));
}

#[test]
fn a_first_comments_link_and_upload_are_offered_before_the_reply() {
    run_with_fakes(FIRST_OFFERS_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_first_comments_link_and_upload_are_offered_before_the_reply"]
fn first_comment_offers_on_paths_opener() {
    let window = open_window_in(gitlab_repo());
    assert_eq!(open(&window, ISSUE_12), json!({ "kind": "notOffered" }));
    assert!(is_not_found(&asked(&window, UPLOAD)));

    read(&window, &BATCH);

    let answer = asked(&window, UPLOAD);
    assert_eq!(answer.status(), StatusCode::OK);
    let file = std::fs::read(in_this_repository(SORT)).unwrap();
    assert_eq!(answer.body(), &file);
    opens_each(&window, &[ISSUE_12]);
}
