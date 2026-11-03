use tauri::http::StatusCode;
use yamt_merge_requests::{PeopleAction, PeopleChangeReply, PeopleGroup, PeopleSearchReply};

use super::through_glab::{in_this_repository, run_with_fakes};
use super::*;
use crate::merge_requests::people::{change_reply, search_reply};
use crate::merge_requests::pictures::picture_answer;

const SCENARIO: &str = "mr-people";
const SEARCHED_TEST: &str = "merge_requests::tests::people::a_searched_picture_on_paths_glab";
const CHANGED_TEST: &str = "merge_requests::tests::people::changed_pictures_on_paths_glab";
const COMMANDS_TEST: &str = "merge_requests::tests::people::search_and_change_reply_on_paths_glab";
const AVATARS: &str = "tests/glab/mr-people/pictures/uploads/-/system/user/avatar";

fn add_erik_as_assignee() -> PeopleChange {
    PeopleChange {
        group: PeopleGroup::Assignees,
        action: PeopleAction::Add,
        username: "erik".to_owned(),
    }
}

/// The picture scheme's status and body for `path` (`/<username>`) through PATH's glab.
fn picture(window: &MergeRequestWindow, path: &str) -> (StatusCode, Vec<u8>) {
    let answer = picture_answer(&window.webview.state(), Glab::find().as_ref(), path);
    (answer.status(), answer.body().clone())
}

fn avatar(number: u32) -> (StatusCode, Vec<u8>) {
    let file = in_this_repository(&format!("{AVATARS}/{number}/avatar.png"));
    (StatusCode::OK, std::fs::read(file).unwrap())
}

fn not_found() -> (StatusCode, Vec<u8>) {
    (StatusCode::NOT_FOUND, Vec::new())
}

#[test]
fn a_searched_persons_uploaded_picture_is_offered_before_the_reply() {
    run_with_fakes(SEARCHED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by a_searched_persons_uploaded_picture_is_offered_before_the_reply"]
fn a_searched_picture_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    assert_eq!(picture(&window, "/erik"), not_found());

    let reply = search_reply(&window.webview.state(), Glab::find().as_ref(), "er");

    let PeopleSearchReply::Found { people } = reply else {
        panic!("{reply:?}");
    };
    assert_eq!(people.len(), 2);
    assert_eq!(picture(&window, "/erik"), avatar(7));
    assert_eq!(picture(&window, "/ben"), not_found());
}

#[test]
fn every_person_in_a_change_answer_gets_their_picture_offered() {
    run_with_fakes(CHANGED_TEST, SCENARIO);
}

#[test]
#[ignore = "run by every_person_in_a_change_answer_gets_their_picture_offered"]
fn changed_pictures_on_paths_glab() {
    let window = open_window_in(gitlab_repo());
    assert_eq!(picture(&window, "/sam"), not_found());

    let reply = change_reply(
        &window.webview.state(),
        Glab::find().as_ref(),
        MergeRequestIid(52),
        &add_erik_as_assignee(),
    );

    assert!(
        matches!(reply, PeopleChangeReply::Changed { .. }),
        "{reply:?}"
    );
    assert_eq!(picture(&window, "/sam"), avatar(1));
    assert_eq!(picture(&window, "/erik"), avatar(7));
    assert_eq!(picture(&window, "/chiara"), not_found());
}

#[test]
fn no_gitlab_project_fails_search_and_change() {
    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let window = open_window_in(plain);
    let state = window.webview.state();

    let searched = search_reply(&state, None, "er");
    let changed = change_reply(&state, None, MergeRequestIid(52), &add_erik_as_assignee());

    let message = NO_PROJECT.to_owned();
    let search_failed = PeopleSearchReply::Failed {
        message: message.clone(),
    };
    assert_eq!(searched, search_failed);
    assert_eq!(changed, PeopleChangeReply::Failed { message });
}

#[test]
fn search_and_change_answer_through_the_commands() {
    run_with_fakes(COMMANDS_TEST, SCENARIO);
}

#[test]
#[ignore = "run by search_and_change_answer_through_the_commands"]
fn search_and_change_reply_on_paths_glab() {
    let window = open_window_in(gitlab_repo());

    let searched = invoke(&window, "search_people", json!({ "text": "an" })).unwrap();
    let change = json!({ "group": "assignees", "action": "add", "username": "erik" });
    let args = json!({ "iid": 52, "change": change });
    let changed = invoke(&window, "change_people", args).unwrap();

    let anna =
        json!({ "username": "anna", "name": "Anna Berg", "picture": { "kind": "uploaded" } });
    assert_eq!(searched, json!({ "kind": "found", "people": [anna] }));
    assert_eq!(changed["kind"], "changed");
    let assignees = changed["people"]["assignees"].as_array().unwrap();
    let usernames: Vec<&Value> = assignees.iter().map(|person| &person["username"]).collect();
    assert_eq!(usernames, ["sam", "erik"]);
}
