use std::os::unix::fs::symlink;
use std::thread;

use tauri::http::header::{CONTENT_TYPE, X_CONTENT_TYPE_OPTIONS};
use tauri::http::{Response, StatusCode};

use super::through_glab::{glab_log, in_this_repository, run_with_fakes};
use super::*;
use crate::merge_requests::description::description_reply;
use crate::merge_requests::pictures::picture_answer;

const OFFERED_TEST: &str = "merge_requests::tests::picture_scheme::offered_pictures_on_path_s_glab";
const ONCE_TEST: &str =
    "merge_requests::tests::picture_scheme::one_fetch_per_picture_on_path_s_glab";
const AT_ONCE_TEST: &str = "merge_requests::tests::picture_scheme::slow_pictures_on_path_s_glab";
const MIXED_TEST: &str = "merge_requests::tests::picture_scheme::slow_mixed_names_on_path_s_glab";
const SCENARIO: &str = "mr-row-details";
const CROWD: &str = "mr-row-details/crowd";
const PICTURES: &str = "tests/glab/mr-row-details/pictures/uploads/-/system/user/avatar";
const FETCH_START: &str = "argv: api https://";
const API_CALL: &str = "argv: api ";
const UPLOADS_SEGMENT: &str = "/uploads/";
const FETCH_END: &str = "answered: ";
const SLOW_PICTURES: usize = 6;
/// `mr-description`'s three uploads under the uploads API: A served there, B on its web path, C on neither.
const SLOW_UPLOADS: [&str; 3] = [
    "0a1b2c3d4e5f60718293a4b5c6d7e8f9/shot.png",
    "f9e8d7c6b5a4938271605f4e3d2c1b0a/old.png",
    "1111aaaa2222bbbb3333cccc4444dddd/gone.png",
];
/// glab runs the slow uploads take: A one, B and C two each (the API, then the web path).
const SLOW_UPLOAD_RUNS: usize = 5;

/// The picture the window gets for `path` (`/<username>`) through PATH's glab.
fn asked(window: &MergeRequestWindow, path: &str) -> Response<Vec<u8>> {
    picture_answer(&window.webview.state(), Glab::find().as_ref(), path)
}

fn is_not_found(answer: &Response<Vec<u8>>) -> bool {
    answer.status() == StatusCode::NOT_FOUND && answer.body().is_empty()
}

fn listed_window(scenario_repo: TempDir) -> MergeRequestWindow {
    let window = open_window_in(scenario_repo);
    let messages = list(&window);
    assert_eq!(messages.last().unwrap()["end"], json!({ "kind": "loaded" }));
    window
}

#[test]
fn only_an_offered_username_gets_a_picture() {
    run_with_fakes(OFFERED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by only_an_offered_username_gets_a_picture"]
fn offered_pictures_on_path_s_glab() {
    let unlisted = open_window_in(gitlab_repo());
    assert!(is_not_found(&asked(&unlisted, "/anna")));
    let window = listed_window(gitlab_repo());

    for (path, number) in [("/anna", 2), ("/sam", 1)] {
        let answer = asked(&window, path);
        let file = in_this_repository(&format!("{PICTURES}/{number}/avatar.png"));
        assert_eq!(answer.status(), StatusCode::OK, "{path}");
        assert_eq!(answer.body(), &std::fs::read(file).unwrap(), "{path}");
        assert_eq!(answer.headers()[CONTENT_TYPE], "image/png");
        assert_eq!(answer.headers()[X_CONTENT_TYPE_OPTIONS], "nosniff");
    }
    let refused = [
        "/ben", "/chiara", "/dmitri", "/erik", "/nobody", "/an%6ea", "/../anna", "/anna/",
        "/anna/x", "anna", "/", "", "/sam?x=1",
    ];
    for path in refused {
        assert!(is_not_found(&asked(&window, path)), "{path}");
    }
    assert!(is_not_found(&picture_answer(
        &window.webview.state(),
        None,
        "/anna"
    )));
    let log = glab_log("");
    let fetched: Vec<&String> = log
        .iter()
        .filter(|line| line.starts_with(FETCH_START))
        .collect();
    assert_eq!(fetched.len(), 2, "{log:?}");
    assert!(log.iter().all(|line| !line.contains("gravatar")), "{log:?}");
}

#[test]
fn a_picture_is_fetched_once_per_run() {
    run_with_fakes(ONCE_TEST, CROWD);
}

#[test]
#[ignore = "run by a_picture_is_fetched_once_per_run"]
fn one_fetch_per_picture_on_path_s_glab() {
    let window = listed_window(gitlab_repo());

    let first = asked(&window, "/anna");
    let second = asked(&window, "/anna");
    list(&window);
    let after_a_second_list = asked(&window, "/anna");
    let refused = [asked(&window, "/erik"), asked(&window, "/erik")];

    assert_eq!(first.status(), StatusCode::OK);
    assert_eq!(second.body(), first.body());
    assert_eq!(after_a_second_list.body(), first.body());
    assert!(refused.iter().all(is_not_found));
    let offered_but_not_a_username = asked(&window, "/plus+one");
    assert!(is_not_found(&offered_but_not_a_username));
    let log = glab_log("");
    let fetches = |address: &str| {
        let started = format!("{FETCH_START}gitlab.example/uploads/-/system/user/avatar/{address}");
        log.iter().filter(|line| **line == started).count()
    };
    assert_eq!(fetches("2/avatar.png"), 1, "{log:?}");
    assert_eq!(fetches("3/avatar.png"), 1, "{log:?}");
}

#[test]
fn at_most_four_pictures_are_fetched_at_once() {
    run_with_fakes(AT_ONCE_TEST, CROWD);
}

#[test]
#[ignore = "run by at_most_four_pictures_are_fetched_at_once"]
fn slow_pictures_on_path_s_glab() {
    let window = listed_window(gitlab_repo());

    ask_at_once(&window, slow_avatars());

    assert_eq!(fetches_at_once(), (4, SLOW_PICTURES));
}

#[test]
fn an_avatar_and_an_upload_share_the_four_fetches_at_once() {
    let scenario = crowd_and_description();
    run_with_fakes(MIXED_TEST, scenario.path().to_str().unwrap());
}

#[test]
#[ignore = "run by an_avatar_and_an_upload_share_the_four_fetches_at_once"]
fn slow_mixed_names_on_path_s_glab() {
    let window = listed_window(gitlab_repo());
    description_reply(
        &window.webview.state(),
        Glab::find().as_ref(),
        MergeRequestIid(52),
    );
    let mut paths = slow_avatars();
    for upload in SLOW_UPLOADS {
        let (secret, _) = upload.split_once('/').unwrap();
        paths.push(format!("/upload~{secret}"));
    }

    ask_at_once(&window, paths);

    assert_eq!(fetches_at_once(), (4, SLOW_PICTURES + SLOW_UPLOAD_RUNS));
}

fn slow_avatars() -> Vec<String> {
    (11..11 + SLOW_PICTURES)
        .map(|number| format!("/user{number}"))
        .collect()
}

/// Asks for every path in `paths` at once, each on its own thread, and returns when all are answered.
fn ask_at_once(window: &MergeRequestWindow, paths: Vec<String>) {
    let state = window.webview.state::<MergeRequestState>();
    let state = state.inner();
    thread::scope(|scope| {
        for path in paths {
            scope.spawn(move || picture_answer(state, Glab::find().as_ref(), &path));
        }
    });
}

/// The most picture and upload glab runs the fake glab's log shows under way at once, and how many ended.
fn fetches_at_once() -> (usize, usize) {
    let mut running = 0;
    let mut most = 0;
    let mut ended = 0;
    for line in glab_log("") {
        if line.starts_with(API_CALL) && line.contains(UPLOADS_SEGMENT) {
            running += 1;
            most = most.max(running);
        } else if line.starts_with(FETCH_END) {
            running -= 1;
            ended += 1;
        }
    }
    (most, ended)
}

/// A scenario with `mr-row-details/crowd`'s list and slow avatars and `mr-description`'s !52, whose three uploads
/// each wait a second on the uploads API.
fn crowd_and_description() -> TempDir {
    let scenario = TempDir::new().unwrap();
    let root = scenario.path();
    let crowd = in_this_repository("tests/glab").join(CROWD);
    let description = in_this_repository("tests/glab/mr-description");
    let linked = [
        (crowd.join("project.json"), "project.json"),
        (crowd.join("graphql-page-1.json"), "graphql-page-1.json"),
        (
            description.join("graphql-description-52.json"),
            "graphql-description-52.json",
        ),
        (crowd.join("pictures/uploads"), "pictures/uploads"),
        (description.join("pictures/-"), "pictures/-"),
    ];
    std::fs::create_dir(root.join("pictures")).unwrap();
    for (original, link) in linked {
        symlink(original, root.join(link)).unwrap();
    }
    for upload in SLOW_UPLOADS {
        let file = root.join("uploads/7/uploads").join(upload);
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(format!("{}.sleep", file.display()), "1").unwrap();
        let original = description.join("uploads/7/uploads").join(upload);
        if original.exists() {
            symlink(original, file).unwrap();
        }
    }
    scenario
}
