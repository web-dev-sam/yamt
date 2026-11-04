use tauri::http::StatusCode;

use super::through_glab::{
    asked, glab_log, in_this_repository, is_not_found, log_after, open, opened_log, run_with_fakes,
};
use super::*;

const SCENARIO: &str = "mr-threads";
const REFUSED_SCENARIO: &str = "mr-threads-refused";
const THREAD_PAGES_TEST: &str =
    "merge_requests::tests::thread_commands::thread_pages_on_paths_opener";
const PREVIEW_PAGES_TEST: &str =
    "merge_requests::tests::thread_commands::preview_pages_on_paths_opener";
const WHOLE_TEST: &str = "merge_requests::tests::thread_commands::a_whole_thread_on_paths_glab";
const WRITES_TEST: &str = "merge_requests::tests::thread_commands::panel_writes_on_paths_glab";
const REFUSED_TEST: &str = "merge_requests::tests::thread_commands::refused_writes_on_paths_glab";
const EMPTY_TEST: &str = "merge_requests::tests::thread_commands::an_empty_reply_on_paths_glab";
const NOT_HEX_TEST: &str = "merge_requests::tests::thread_commands::a_bad_discussion_on_paths_glab";
const UPLOAD: &str = "/upload~903a1b2c3d4e5f60718293a4b5c6d7e8";
const SHOT: &str =
    "tests/glab/mr-threads/uploads/7/uploads/903a1b2c3d4e5f60718293a4b5c6d7e8/shot.png";
const D01_PAGES: [&str; 5] = [
    "https://gitlab.com/taskboard/taskboard/-/merge_requests/90#note_901",
    "https://docs.example/board",
    "https://gitlab.com/taskboard/taskboard/-/merge_requests/90#note_903",
    "https://gitlab.com/taskboard/taskboard/-/merge_requests/90#note_904",
    "https://gitlab.com/taskboard/taskboard/-/merge_requests/90#note_905",
];
const ANNA_S_PAGE: &str = "https://gitlab.com/anna";
const ROUTE: &str = "projects/taskboard%2Ftaskboard/merge_requests/90";

/// Discussion `dNN`: `NN` behind zeros, as the fixtures name it.
fn d(nn: &str) -> String {
    format!("{nn:0>40}")
}

/// Merge request !90's thread `dNN` through the command, as the window reads it.
fn read(window: &MergeRequestWindow, nn: &str) -> Value {
    let args = json!({ "iid": 90, "discussion": d(nn) });
    invoke(window, "read_discussion_thread", args).unwrap()
}

fn reply(window: &MergeRequestWindow, kind: &str, text: &str) -> Value {
    let args = json!({ "iid": 90, "discussion": d("01"), "kind": kind, "text": text });
    invoke(window, "reply_to_discussion", args).unwrap()
}

fn resolve(window: &MergeRequestWindow, resolve: bool) -> Value {
    let args = json!({ "iid": 90, "discussion": d("01"), "resolve": resolve });
    invoke(window, "resolve_discussion", args).unwrap()
}

fn submit(window: &MergeRequestWindow) -> Value {
    invoke(window, "submit_review", json!({ "iid": 90 })).unwrap()
}

/// Each write the fake glab logged (`api --include`), its argv after that and the JSON it read on stdin.
fn writes() -> Vec<(String, Value)> {
    let lines = glab_log("");
    let mut writes = Vec::new();
    for (at, line) in lines.iter().enumerate() {
        if let Some(argv) = line.strip_prefix("argv: api --include ") {
            let stdin = lines[at..]
                .iter()
                .find_map(|line| line.strip_prefix("stdin: "));
            let body = serde_json::from_str(stdin.unwrap()).unwrap();
            writes.push((argv.to_owned(), body));
        }
    }
    writes
}

/// The posts the fake glab counted in its state file.
fn posts_counted() -> String {
    let state = std::env::var_os("YAMT_FAKE_GLAB_STATE").unwrap();
    std::fs::read_to_string(state).unwrap_or_default()
}

/// Opens each of `pages` through the command and expects the fake opener to log them in order.
fn opens_each(window: &MergeRequestWindow, pages: &[&str]) {
    let mut before = String::new();
    for page in pages {
        assert_eq!(open(window, page), json!({ "kind": "opened" }), "{page}");
        let logged = format!("{before}argv: {page}\n");
        assert_eq!(log_after(&before), logged);
        before = logged;
    }
}

#[test]
fn a_threads_pages_and_uploads_are_offered_before_the_reply() {
    run_with_fakes(THREAD_PAGES_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_threads_pages_and_uploads_are_offered_before_the_reply"]
fn thread_pages_on_paths_opener() {
    let window = open_window_in(gitlab_repo());
    let not_offered = json!({ "kind": "notOffered" });
    for page in D01_PAGES {
        assert_eq!(open(&window, page), not_offered, "{page}");
    }
    assert!(is_not_found(&asked(&window, UPLOAD)));

    assert_eq!(read(&window, "01")["kind"], "read");

    let answer = asked(&window, UPLOAD);
    assert_eq!(answer.status(), StatusCode::OK);
    assert_eq!(
        answer.body(),
        &std::fs::read(in_this_repository(SHOT)).unwrap()
    );
    // macOS starts `/usr/bin/open` by its path (`yamt_merge_requests` `web_page.rs`), not PATH's fake: it would
    // open the real browser.
    if cfg!(not(target_os = "macos")) {
        opens_each(&window, &D01_PAGES);
    }
}

#[test]
fn a_previews_pages_are_offered_before_the_reply() {
    run_with_fakes(PREVIEW_PAGES_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_previews_pages_are_offered_before_the_reply"]
fn preview_pages_on_paths_opener() {
    let window = open_window_in(gitlab_repo());
    assert_eq!(open(&window, ANNA_S_PAGE), json!({ "kind": "notOffered" }));

    let args = json!({ "iid": 90, "text": "**Preview** of @anna" });
    let preview = invoke(&window, "preview_markdown", args).unwrap();

    assert_eq!(preview["kind"], "read");
    assert_eq!(opened_log(), "");
    if cfg!(not(target_os = "macos")) {
        opens_each(&window, &[ANNA_S_PAGE]);
    }
}

#[test]
fn read_discussion_thread_comes_back_whole_with_edits_and_drafts() {
    run_with_fakes(WHOLE_TEST, SCENARIO);
}

#[test]
#[ignore = "run by read_discussion_thread_comes_back_whole_with_edits_and_drafts"]
fn a_whole_thread_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let reply = read(&window, "01");

    assert_eq!(reply["kind"], "read");
    let thread = &reply["thread"];
    let comments = thread["comments"].as_array().unwrap();
    let shown: Vec<Value> = comments
        .iter()
        .map(|comment| {
            let edited = &comment["edited"];
            json!([
                comment["author"]["username"],
                edited["by"]["username"],
                edited["at"]
            ])
        })
        .collect();
    let expected = [
        json!(["anna", "anna", "2026-11-03T09:00:00Z"]),
        json!(["sam", "dmitri", "2026-11-01T12:30:00Z"]),
        json!(["dmitri", null, null]),
        json!(["anna", null, null]),
    ];
    assert_eq!(shown, expected);
    let drafts = json!([{ "text": "I'll take the second option." }]);
    assert_eq!(thread["drafts"], drafts);
    assert_eq!(thread["pending"], 2);
    assert_eq!(thread["discussion"]["id"], d("01"));
}

#[test]
fn each_panel_write_is_one_post() {
    run_with_fakes(WRITES_TEST, SCENARIO);
}

#[test]
#[ignore = "run by each_panel_write_is_one_post"]
fn panel_writes_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let replies = [
        reply(&window, "comment", "Thanks"),
        reply(&window, "draft", "Later"),
        resolve(&window, true),
        resolve(&window, false),
        submit(&window),
    ];

    assert_eq!(replies.to_vec(), vec![json!({ "kind": "sent" }); 5]);
    let thread = format!("{ROUTE}/discussions/{}", d("01"));
    let expected = [
        (
            format!("--method POST {thread}/notes --input -"),
            json!({ "body": "Thanks" }),
        ),
        (
            format!("--method POST {ROUTE}/draft_notes --input -"),
            json!({ "note": "Later", "in_reply_to_discussion_id": d("01") }),
        ),
        (
            format!("--method PUT {thread} --input -"),
            json!({ "resolved": true }),
        ),
        (
            format!("--method PUT {thread} --input -"),
            json!({ "resolved": false }),
        ),
        (
            format!("--method POST {ROUTE}/draft_notes/bulk_publish --input -"),
            json!({}),
        ),
    ];
    assert_eq!(writes(), expected);
    assert_eq!(posts_counted(), "5\n");
    let after = read(&window, "01");
    assert_eq!(after["thread"]["discussion"]["last"]["text"], "Later");
    assert_eq!(after["thread"]["pending"], 0);
}

#[test]
fn a_refused_write_comes_back_with_gitlabs_reason() {
    run_with_fakes(REFUSED_TEST, REFUSED_SCENARIO);
}

#[test]
#[ignore = "run by a_refused_write_comes_back_with_gitlabs_reason"]
fn refused_writes_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let replies = [
        reply(&window, "comment", "Hi"),
        reply(&window, "draft", "Hi"),
        resolve(&window, true),
        submit(&window),
    ];

    let deadline = "glab: Post \"https://gitlab.com/api/v4/projects/taskboard%2Ftaskboard/merge_requests/90/\
                    discussions/0000000000000000000000000000000000000001/notes\": context deadline exceeded";
    let expected = [
        json!({ "kind": "refused", "reason": "403 Forbidden" }),
        json!({ "kind": "refused", "reason": "note is missing" }),
        json!({ "kind": "failed", "message": deadline }),
        json!({ "kind": "failed", "message": "500 Internal Server Error" }),
    ];
    assert_eq!(replies, expected);
}

#[test]
fn an_empty_reply_runs_no_glab() {
    run_with_fakes(EMPTY_TEST, SCENARIO);
}

#[test]
#[ignore = "run by an_empty_reply_runs_no_glab"]
fn an_empty_reply_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let replies = [
        reply(&window, "comment", " \n"),
        reply(&window, "draft", ""),
    ];

    let refused = json!({ "kind": "refused", "reason": "There is nothing to send." });
    assert_eq!(replies, [refused.clone(), refused]);
    assert_eq!(glab_log(""), Vec::<String>::new());
}

#[test]
fn a_discussion_argument_not_40_hex_is_refused_by_the_command() {
    run_with_fakes(NOT_HEX_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_discussion_argument_not_40_hex_is_refused_by_the_command"]
fn a_bad_discussion_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    let upper = "A".repeat(40);
    let short = d("1")[1..].to_owned();

    for discussion in [upper, short, "../../projects".to_owned()] {
        let named = json!({ "iid": 90, "discussion": discussion });
        let comment =
            json!({ "iid": 90, "discussion": discussion, "kind": "comment", "text": "Hi" });
        let resolve = json!({ "iid": 90, "discussion": discussion, "resolve": true });
        for (command, args) in [
            ("read_discussion_thread", named),
            ("reply_to_discussion", comment),
            ("resolve_discussion", resolve),
        ] {
            let refused = invoke(&window, command, args).unwrap_err();
            let message = refused.as_str().unwrap();
            assert!(
                message.contains("not a discussion id"),
                "{command}: {refused}"
            );
        }
    }
    assert_eq!(glab_log(""), Vec::<String>::new());
}

#[test]
fn no_gitlab_project_fails_every_thread_command() {
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let window = open_window_in(plain);

    let replies = [
        read(&window, "01"),
        reply(&window, "comment", "Hi"),
        resolve(&window, true),
        submit(&window),
        invoke(
            &window,
            "preview_markdown",
            json!({ "iid": 90, "text": "Hi" }),
        )
        .unwrap(),
    ];

    let failed = json!({ "kind": "failed", "message": NO_PROJECT });
    assert_eq!(replies.to_vec(), vec![failed; 5]);
}
