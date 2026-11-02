#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use serde_json::{Value, json};
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    GitLabRepository, MergeRequestIid, RerequestReply, gitlab_repository, rerequest_review,
};

use fake_glab::Fake;

const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const SCENARIO: &str = "mr-row-details";
const BEN_GRAVATAR: &str = "https://secure.gravatar.com/avatar/0f3a9c2e5b7d14f6a8c0e2b4d6f8a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d2f4?s=80&d=identicon";
const REREVIEW: &str = "mutation RerequestReview($projectPath: ID!, $iid: String!, $userId: UserID!) { \
     mergeRequestReviewerRereview(input: { projectPath: $projectPath, iid: $iid, userId: $userId }) { \
     errors mergeRequest { reviewers { nodes { username name avatarUrl \
     mergeRequestInteraction { approved reviewState } } } } } }";

/// A repository whose `origin` is on gitlab.example, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    (repo, repository)
}

/// The reply as the window gets it.
fn asked(fake: &Fake, repository: &GitLabRepository, iid: u32, username: &str) -> Value {
    let reply = rerequest_review(repository, Some(&fake.glab), MergeRequestIid(iid), username);
    serde_json::to_value(reply).unwrap()
}

fn reviewer(username: &str, name: &str, picture: &Value, state: &str) -> Value {
    json!({ "person": { "username": username, "name": name, "picture": picture }, "state": state })
}

/// !52's reviewers with ben's state `ben`.
fn reviewers_of_52(ben: &str) -> Value {
    let none = json!({ "kind": "none" });
    let gravatar = json!({ "kind": "gravatar", "address": BEN_GRAVATAR });
    json!({ "kind": "requested", "reviewers": [
        reviewer("ben", "Ben Okafor", &gravatar, ben),
        reviewer("chiara", "Chiara Rossi", &none, "approved"),
        reviewer("dmitri", "Dmitri Volkov", &none, "requested"),
    ] })
}

fn bodies(fake: &Fake) -> Vec<Value> {
    let stdin = fake.logged("stdin: ");
    let body = |line: &String| serde_json::from_str(&line["stdin: ".len()..]).unwrap();
    stdin.iter().map(body).collect()
}

#[test]
fn a_done_reviewer_is_asked_again_by_global_id_with_the_exact_body() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let reply = asked(&fake, &repository, 52, "ben");

    assert_eq!(reply, reviewers_of_52("requested"));
    let expected = json!({ "query": REREVIEW, "variables": {
        "projectPath": "taskboard/taskboard", "iid": "52", "userId": "gid://gitlab/User/4" } });
    assert_eq!(bodies(&fake), [expected]);
    let argv = fake.logged("argv: ");
    assert_eq!(argv.last().unwrap(), "argv: api graphql --input -");
}

#[test]
fn someone_no_longer_a_reviewer_is_refused_before_any_write() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let reply = asked(&fake, &repository, 52, "anna");

    assert_eq!(reply, json!({ "kind": "notReviewer" }));
    assert_eq!(fake.logged("stdin: "), Vec::<String>::new());
    let fresh = fake.logged("argv: ").pop().unwrap();
    assert!(
        fresh.starts_with("argv: api graphql -f query=query MergeRequestReviewers("),
        "{fresh}"
    );
    assert!(
        fresh.ends_with(" -f fullPath=taskboard/taskboard -f iid=52"),
        "{fresh}"
    );
}

#[test]
fn a_reviewer_still_awaiting_review_is_not_asked_again() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let reply = asked(&fake, &repository, 52, "dmitri");

    assert_eq!(reply, reviewers_of_52("reviewed"));
    assert_eq!(fake.logged("stdin: "), Vec::<String>::new());
}

#[test]
fn the_only_write_is_the_rereview_mutation() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    for (iid, username) in [
        (52, "anna"),
        (52, "dmitri"),
        (52, "ben"),
        (52, "chiara"),
        (50, "anna"),
    ] {
        asked(&fake, &repository, iid, username);
    }

    let bodies = bodies(&fake);
    let ids: Vec<&Value> = bodies
        .iter()
        .map(|body| &body["variables"]["userId"])
        .collect();
    assert_eq!(ids, ["gid://gitlab/User/4", "gid://gitlab/User/5"]);
    for body in &bodies {
        let query = body["query"].as_str().unwrap();
        assert_eq!(query, REREVIEW);
        assert_eq!(query.matches("mutation").count(), 1, "{query}");
    }
    let argv = fake.logged("argv: ");
    let writes: Vec<&String> = argv
        .iter()
        .filter(|line| line.contains("--input"))
        .collect();
    assert_eq!(writes.len(), bodies.len(), "{argv:?}");
    for line in &argv {
        let names_another_write = ["mutation", "-X", "reviewer_ids", "SetReviewers"]
            .iter()
            .any(|word| line.contains(word));
        assert!(!names_another_write, "{line}");
    }
}

#[test]
fn a_mutation_error_comes_back_as_one_sentence() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    asked(&fake, &repository, 52, "ben");

    let refused = asked(&fake, &repository, 52, "ben");

    assert_eq!(
        refused,
        json!({ "kind": "refused", "message": "Reviewer not found" })
    );
}

#[test]
fn a_merge_request_no_longer_open_is_not_open() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let reply = asked(&fake, &repository, 50, "anna");

    assert_eq!(reply, json!({ "kind": "notOpen" }));
    assert_eq!(fake.logged("stdin: "), Vec::<String>::new());
}

#[test]
fn glab_missing_or_logged_out_answers_before_any_query() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("logged-out");

    let missing = rerequest_review(&repository, None, MergeRequestIid(52), "ben");
    let logged_out = rerequest_review(&repository, Some(&fake.glab), MergeRequestIid(52), "ben");

    assert_eq!(missing, RerequestReply::GlabMissing);
    let detail = "gitlab.com".to_owned();
    assert_eq!(logged_out, RerequestReply::NotLoggedIn { detail });
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}
