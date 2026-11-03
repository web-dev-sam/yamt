#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use serde_json::{Value, json};
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::PeopleAction::{Add, Remove};
use yamt_merge_requests::PeopleGroup::{Assignees, Reviewers};
use yamt_merge_requests::{
    GitLabRepository, MergeRequestIid, PeopleAction, PeopleChange, PeopleChangeReply, PeopleGroup,
    PeopleSearchReply, change_people, gitlab_repository, search_people,
};

use fake_glab::Fake;

const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const SCENARIO: &str = "mr-people";
const BEN_GRAVATAR: &str = "https://secure.gravatar.com/avatar/0f3a9c2e5b7d14f6a8c0e2b4d6f8a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d2f4?s=80&d=identicon";
const SEARCH: &str = "query PeopleSearch($fullPath: ID!, $search: String!) { \
     project(fullPath: $fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } } }";
const SET_ASSIGNEES: &str = "mutation SetAssignees($projectPath: ID!, $iid: String!, $usernames: [String!]!, \
     $mode: MutationOperationMode!) { changed: mergeRequestSetAssignees(input: { projectPath: $projectPath, \
     iid: $iid, assigneeUsernames: $usernames, operationMode: $mode }) { errors mergeRequest { \
     assignees { nodes { username name avatarUrl } } \
     reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } } } }";
const SET_REVIEWERS: &str = "mutation SetReviewers($projectPath: ID!, $iid: String!, $usernames: [String!]!, \
     $mode: MutationOperationMode!) { changed: mergeRequestSetReviewers(input: { projectPath: $projectPath, \
     iid: $iid, reviewerUsernames: $usernames, operationMode: $mode }) { errors mergeRequest { \
     assignees { nodes { username name avatarUrl } } \
     reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } } } }";
const DENIED: &str = "The resource that you are attempting to access does not exist or you don't have permission \
     to perform this action";
/// A change's whole glab run: the login and project are asked, then the one write, nothing read before it.
const CHANGE_ARGV: [&str; 3] = [
    "argv: auth status",
    "argv: api projects/:fullpath",
    "argv: api graphql --input -",
];

/// A repository whose `origin` is on gitlab.example, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    (repo, repository)
}

/// The search's reply as the window gets it.
fn searched(fake: &Fake, repository: &GitLabRepository, text: &str) -> Value {
    let found = search_people(repository, Some(&fake.glab), text);
    serde_json::to_value(found.reply).unwrap()
}

fn people_change(group: PeopleGroup, action: PeopleAction, username: &str) -> PeopleChange {
    PeopleChange {
        group,
        action,
        username: username.to_owned(),
    }
}

/// The reply to a change on !52 as the window gets it.
fn changed(fake: &Fake, repository: &GitLabRepository, change: &PeopleChange) -> Value {
    let changed = change_people(repository, Some(&fake.glab), MergeRequestIid(52), change);
    serde_json::to_value(changed.reply).unwrap()
}

fn bodies(fake: &Fake) -> Vec<Value> {
    let stdin = fake.logged("stdin: ");
    let body = |line: &String| serde_json::from_str(&line["stdin: ".len()..]).unwrap();
    stdin.iter().map(body).collect()
}

fn person(username: &str, name: &str, picture: &Value) -> Value {
    json!({ "username": username, "name": name, "picture": picture })
}

fn uploaded(username: &str, name: &str) -> Value {
    person(username, name, &json!({ "kind": "uploaded" }))
}

fn ben() -> Value {
    let gravatar = json!({ "kind": "gravatar", "address": BEN_GRAVATAR });
    person("ben", "Ben Okafor", &gravatar)
}

/// The usernames of a reply's assignees or reviewers, in GitLab's order.
fn usernames(people: &Value) -> Vec<&str> {
    people.as_array().unwrap().iter().map(username).collect()
}

fn username(person: &Value) -> &str {
    let person = person.get("person").unwrap_or(person);
    person["username"].as_str().unwrap()
}

#[test]
fn a_search_asks_autocomplete_users_with_the_text_as_a_raw_field() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let found = search_people(&repository, Some(&fake.glab), "er");

    let people = json!([uploaded("erik", "Erik Lund"), ben()]);
    let reply = serde_json::to_value(&found.reply).unwrap();
    assert_eq!(reply, json!({ "kind": "found", "people": people }));
    let offered: Vec<&str> = found
        .pictures
        .iter()
        .map(|picture| picture.username.as_str())
        .collect();
    assert_eq!(offered, ["erik"]);
    let fields = "-f fullPath=taskboard/taskboard -f search=er";
    let expected = format!("argv: api graphql -f query={SEARCH} {fields}");
    assert_eq!(fake.logged("argv: ").last().unwrap(), &expected);
}

#[test]
fn a_search_writes_nothing() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    for text in ["er", "an", "gh", "nobody", "broken"] {
        searched(&fake, &repository, text);
    }

    assert_eq!(fake.logged("stdin: "), Vec::<String>::new());
    let argv = fake.logged("argv: ");
    assert!(
        argv.iter().all(|line| !line.contains("--input")),
        "{argv:?}"
    );
}

#[test]
fn a_search_finding_nobody_is_found_with_nobody() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let nobody = searched(&fake, &repository, "nobody");

    assert_eq!(nobody, json!({ "kind": "found", "people": [] }));
}

#[test]
fn a_failed_search_keeps_glabs_words() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let broken = searched(&fake, &repository, "broken");

    let failed = json!({ "kind": "failed", "message": "glab: a deadline line" });
    assert_eq!(broken, failed);
}

#[test]
fn adding_an_assignee_sends_one_append_with_the_exact_body() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let reply = changed(&fake, &repository, &people_change(Assignees, Add, "erik"));

    assert_eq!(reply["kind"], "changed");
    let assignees = json!([uploaded("sam", "Sam Doe"), uploaded("erik", "Erik Lund")]);
    assert_eq!(reply["people"]["assignees"], assignees);
    let reviewers = &reply["people"]["reviewers"];
    assert_eq!(usernames(reviewers), ["ben", "chiara", "dmitri"]);
    let expected = json!({ "query": SET_ASSIGNEES, "variables": {
        "projectPath": "taskboard/taskboard", "iid": "52", "usernames": ["erik"], "mode": "APPEND" } });
    assert_eq!(bodies(&fake), [expected]);
    assert_eq!(fake.logged("argv: "), CHANGE_ARGV);
}

#[test]
fn adding_a_reviewer_answers_their_review_state_and_leaves_the_assignees() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    fake.answered_posts(1);

    let reply = changed(&fake, &repository, &people_change(Reviewers, Add, "erik"));

    assert_eq!(reply["kind"], "changed");
    let erik = json!({ "person": uploaded("erik", "Erik Lund"), "state": "requested" });
    assert_eq!(reply["people"]["reviewers"][3], erik);
    assert_eq!(usernames(&reply["people"]["assignees"]), ["sam", "erik"]);
    let bodies = bodies(&fake);
    assert_eq!(bodies.len(), 1);
    let query = bodies[0]["query"].as_str().unwrap();
    assert_eq!(query, SET_REVIEWERS);
    assert!(!query.contains("mergeRequestSetAssignees"), "{query}");
}

#[test]
fn removing_sends_one_remove_of_one_username() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    fake.answered_posts(2);

    let assignee = changed(&fake, &repository, &people_change(Assignees, Remove, "sam"));
    let reviewer = changed(
        &fake,
        &repository,
        &people_change(Reviewers, Remove, "chiara"),
    );

    assert_eq!(assignee["kind"], "changed");
    assert_eq!(usernames(&assignee["people"]["assignees"]), ["erik"]);
    assert_eq!(reviewer["kind"], "changed");
    let reviewers = &reviewer["people"]["reviewers"];
    assert_eq!(usernames(reviewers), ["ben", "dmitri", "erik"]);
    let variables = |username: &str| json!({ "projectPath": "taskboard/taskboard", "iid": "52", "usernames": [username], "mode": "REMOVE" });
    let expected = [
        json!({ "query": SET_ASSIGNEES, "variables": variables("sam") }),
        json!({ "query": SET_REVIEWERS, "variables": variables("chiara") }),
    ];
    assert_eq!(bodies(&fake), expected);
    assert_eq!(fake.logged("argv: "), [CHANGE_ARGV, CHANGE_ARGV].concat());
}

#[test]
fn an_append_gitlab_dropped_is_unchanged_with_gitlabs_lists() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    fake.answered_posts(4);

    let reply = changed(&fake, &repository, &people_change(Assignees, Add, "anna"));

    assert_eq!(reply["kind"], "unchanged");
    assert_eq!(usernames(&reply["people"]["assignees"]), ["erik"]);
    let reviewers = &reply["people"]["reviewers"];
    assert_eq!(usernames(reviewers), ["ben", "dmitri", "erik"]);
}

#[test]
fn a_mutation_error_is_refused_in_gitlabs_words() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    fake.answered_posts(5);

    let reply = changed(&fake, &repository, &people_change(Reviewers, Add, "ghost"));

    let message = "Reviewers not able to be set: ghost";
    assert_eq!(reply, json!({ "kind": "refused", "message": message }));
}

#[test]
fn a_top_level_error_fails() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    fake.answered_posts(6);

    let reply = changed(
        &fake,
        &repository,
        &people_change(Assignees, Remove, "erik"),
    );

    assert_eq!(reply, json!({ "kind": "failed", "message": DENIED }));
}

#[test]
fn a_remove_gitlab_did_not_make_is_unchanged() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    fake.answered_posts(7);

    let reply = changed(&fake, &repository, &people_change(Reviewers, Remove, "ben"));

    assert_eq!(reply["kind"], "unchanged");
    let reviewers = &reply["people"]["reviewers"];
    assert_eq!(usernames(reviewers), ["ben", "dmitri", "erik"]);
}

#[test]
fn each_change_writes_one_append_or_remove_of_one_username() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let changes = [
        people_change(Assignees, Add, "erik"),
        people_change(Reviewers, Add, "erik"),
        people_change(Assignees, Remove, "sam"),
        people_change(Reviewers, Remove, "chiara"),
        people_change(Assignees, Add, "anna"),
        people_change(Reviewers, Add, "ghost"),
        people_change(Assignees, Add, "erik"),
        people_change(Reviewers, Remove, "ben"),
    ];

    for change in &changes {
        changed(&fake, &repository, change);
    }

    let bodies = bodies(&fake);
    assert_eq!(bodies.len(), changes.len());
    for body in &bodies {
        let query = body["query"].as_str().unwrap();
        assert!([SET_ASSIGNEES, SET_REVIEWERS].contains(&query), "{query}");
        let mode = body["variables"]["mode"].as_str().unwrap();
        assert!(["APPEND", "REMOVE"].contains(&mode), "{mode}");
        assert_eq!(body["variables"]["usernames"].as_array().unwrap().len(), 1);
    }
    let argv = fake.logged("argv: ");
    let writes = argv.iter().filter(|line| line.contains("--input")).count();
    assert_eq!(writes, changes.len(), "{argv:?}");
    let stdin = fake.logged("stdin: ");
    for line in argv.iter().chain(&stdin) {
        let names_another_write = ["REPLACE", "-X", "reviewer_ids", "assignee_ids"]
            .iter()
            .any(|word| line.contains(word));
        assert!(!names_another_write, "{line}");
    }
}

#[test]
fn glab_missing_or_logged_out_answers_before_any_query() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("logged-out");
    let change = people_change(Assignees, Add, "erik");
    let iid = MergeRequestIid(52);

    let missing_search = search_people(&repository, None, "er").reply;
    let missing_change = change_people(&repository, None, iid, &change).reply;
    let logged_out_search = search_people(&repository, Some(&fake.glab), "er").reply;
    let logged_out_change = change_people(&repository, Some(&fake.glab), iid, &change).reply;

    assert_eq!(missing_search, PeopleSearchReply::GlabMissing);
    assert_eq!(missing_change, PeopleChangeReply::GlabMissing);
    let detail = "gitlab.com".to_owned();
    let not_logged_in = PeopleSearchReply::NotLoggedIn {
        detail: detail.clone(),
    };
    assert_eq!(logged_out_search, not_logged_in);
    assert_eq!(logged_out_change, PeopleChangeReply::NotLoggedIn { detail });
    assert_eq!(fake.logged("argv: "), ["argv: auth status"; 2]);
}
