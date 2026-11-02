#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use std::fs;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo, git_ok};
use yamt_gitio::{Glab, TIMED_OUT};
use yamt_merge_requests::{
    GitLabRepository, ListEnd, ListedPage, MergeRequestPage, fetch_picture, gitlab_repository,
    list_merge_requests,
};

use fake_glab::Fake;

const SHORT_TIMEOUT: Duration = Duration::from_secs(2);
const TIMEOUT_SCENARIO_SLEEP: Duration = Duration::from_secs(25);
const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const FIRST_PAGE_FIELDS: &str = " -f fullPath=taskboard/taskboard -F first=100";
const QUERY_START: &str = "argv: api graphql -f query=query MergeRequestPage(";
const FILES: [ConflictFile<'static>; 1] = [ConflictFile {
    path: "a.txt",
    kind: FileKind::Regular,
    base: Some(b"base\n"),
    local: Some(b"local\n"),
    remote: Some(b"remote\n"),
}];

/// A repository whose `origin` is on gitlab.example, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let dir = diverged_repo(&FILES).unwrap();
    git_ok(dir.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(dir.path()).unwrap();
    (dir, repository)
}

/// The end of a load and the pages sent before it.
fn listed(repository: &GitLabRepository, glab: Option<&Glab>) -> (ListEnd, Vec<MergeRequestPage>) {
    let (end, pages) = listed_with_pictures(repository, glab);
    (end, pages.into_iter().map(|listed| listed.page).collect())
}

/// The end of a load and the pages sent before it, each with the pictures it offered.
fn listed_with_pictures(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
) -> (ListEnd, Vec<ListedPage>) {
    let (sender, sent) = mpsc::channel();
    let on_page = |listed: ListedPage| sender.send(listed).unwrap();
    let end = list_merge_requests(repository, glab, &on_page).end;
    (end, sent.try_iter().collect())
}

/// Whether a load on `scenario`'s fake glab (none for `None`) hands rows to the local check.
fn has_rows_to_check(repository: &GitLabRepository, scenario: Option<&str>) -> bool {
    let fake = scenario.map(Fake::new);
    let glab = fake.as_ref().map(|fake| &fake.glab);
    let listed = list_merge_requests(repository, glab, &|_| {});
    listed.to_check.is_some()
}

#[test]
fn only_a_load_that_reached_the_project_hands_rows_to_the_check() {
    let (_repo, repository) = gitlab_repo();

    assert!(has_rows_to_check(&repository, Some("merge-requests")));
    assert!(!has_rows_to_check(&repository, None));
    assert!(!has_rows_to_check(&repository, Some("logged-out")));
    assert!(!has_rows_to_check(&repository, Some("lined-up")));
}

fn iids(page: &MergeRequestPage) -> Vec<u32> {
    page.rows.iter().map(|row| row.iid.0).collect()
}

#[test]
fn the_list_comes_page_by_page_from_glab_graphql_after_each_cursor() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("merge-requests");

    let (end, pages) = listed(&repository, Some(&fake.glab));

    assert_eq!(end, ListEnd::Loaded);
    let sent: Vec<Vec<u32>> = pages.iter().map(iids).collect();
    assert_eq!(sent, [vec![13, 12, 11], vec![9, 8]]);
    assert_eq!(pages[0].me.as_deref(), Some("sam"));
    let failed = pages[0].rows[0].pipeline.as_ref().unwrap();
    let job_page = failed.failed_jobs[0].page.as_ref().unwrap();
    assert_eq!(
        job_page.as_str(),
        "https://gitlab.example/taskboard/taskboard/-/jobs/302"
    );
    let row_page = pages[0].rows[0].page.as_ref().unwrap();
    assert_eq!(
        row_page.as_str(),
        "https://gitlab.example/taskboard/taskboard/-/merge_requests/13"
    );
    let argv = fake.logged("argv: ");
    assert_eq!(
        argv[..2],
        ["argv: auth status", "argv: api projects/:fullpath"]
    );
    let [first, second] = &argv[2..] else {
        panic!("{argv:?}");
    };
    assert!(first.starts_with(QUERY_START), "{first}");
    assert!(first.ends_with(FIRST_PAGE_FIELDS), "{first}");
    assert!(second.starts_with(QUERY_START), "{second}");
    let after = format!("{FIRST_PAGE_FIELDS} -f after=page-2");
    assert!(second.ends_with(&after), "{second}");
}

#[test]
fn glab_runs_in_the_repository_with_no_color_and_no_terminal_prompt() {
    let (repo, repository) = gitlab_repo();
    let fake = Fake::new("merge-requests");

    listed(&repository, Some(&fake.glab));

    let root = fs::canonicalize(repo.path()).unwrap();
    let cwd = format!("cwd: {}", root.display());
    assert_eq!(fake.logged("cwd: "), vec![cwd; 4]);
    let env = "env: NO_COLOR=1 GIT_TERMINAL_PROMPT=0".to_owned();
    assert_eq!(fake.logged("env: "), vec![env; 4]);
    assert_eq!(fs::canonicalize(repository.root()).unwrap(), root);
}

#[test]
fn glab_missing_or_logged_out_ends_the_list_before_any_page() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("logged-out");

    let missing = listed(&repository, None);
    let logged_out = listed(&repository, Some(&fake.glab));

    assert_eq!(missing, (ListEnd::GlabMissing, Vec::new()));
    let detail = "gitlab.com".to_owned();
    assert_eq!(logged_out, (ListEnd::NotLoggedIn { detail }, Vec::new()));
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}

#[test]
fn a_page_past_glab_s_deadline_fails_the_list_in_glab_s_timeout_words() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("merge-requests-timeout");
    let glab = Glab::at(fake.dir.path().join("glab")).with_timeout(SHORT_TIMEOUT);
    let started = Instant::now();

    let timed_out = listed(&repository, Some(&glab));

    let message = TIMED_OUT.to_owned();
    assert_eq!(timed_out, (ListEnd::Failed { message }, Vec::new()));
    assert!(
        started.elapsed() < TIMEOUT_SCENARIO_SLEEP,
        "{:?}",
        started.elapsed()
    );
}

#[test]
fn a_project_glab_cannot_find_fails_the_list_in_glab_s_words() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("lined-up");

    let not_found = listed(&repository, Some(&fake.glab));

    let message = "glab: 404 Not Found (HTTP 404)".to_owned();
    assert_eq!(not_found, (ListEnd::Failed { message }, Vec::new()));
}

const BEN_GRAVATAR: &str = "https://secure.gravatar.com/avatar/0f3a9c2e5b7d14f6a8c0e2b4d6f8a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d2f4?s=80&d=identicon";

fn person(username: &str, name: &str, picture: &Value) -> Value {
    json!({ "username": username, "name": name, "picture": picture })
}

fn reviewer(person: &Value, state: &str) -> Value {
    json!({ "person": person, "state": state })
}

/// The scenario `mr-row-details`' people as the window gets them (`tests/glab/README.md`).
fn people() -> [Value; 6] {
    let uploaded = json!({ "kind": "uploaded" });
    let none = json!({ "kind": "none" });
    [
        person("anna", "Anna Berg", &uploaded),
        person("sam", "Sam Doe", &uploaded),
        person(
            "ben",
            "Ben Okafor",
            &json!({ "kind": "gravatar", "address": BEN_GRAVATAR }),
        ),
        person("chiara", "Chiara Rossi", &none),
        person("dmitri", "Dmitri Volkov", &none),
        person("erik", "Erik Lund", &none),
    ]
}

fn page_of(number: u32) -> String {
    format!("https://gitlab.example/taskboard/taskboard/-/merge_requests/{number}")
}

fn colored(title: &str, background: &str) -> Value {
    json!({ "title": title, "colors": { "background": background, "text": "#FFFFFF" } })
}

/// The scenario's three rows as the window gets them.
fn detailed_rows() -> Value {
    let [anna, sam, ben, chiara, dmitri, erik] = people();
    let no_jobs =
        |status: &str| json!({ "status": status, "failedJobs": [], "moreFailedJobs": false });
    let colourless = json!({ "title": "odd", "colors": null });
    json!([
        { "iid": 52, "title": "Colour the card labels", "createdAt": "2026-11-01T10:00:00Z", "draft": false,
          "author": anna, "assignees": [sam],
          "reviewers": [reviewer(&ben, "reviewed"), reviewer(&chiara, "approved"),
              reviewer(&dmitri, "requested")],
          "labels": [colored("frontend", "#428BCA"), colored("bug", "#D9534F"), colourless],
          "openDiscussions": 0, "approvedBy": [chiara], "mayRerequest": true, "pipeline": no_jobs("passed"),
          "page": page_of(52), "size": { "additions": 0, "deletions": 0, "files": 0 },
          "readiness": { "kind": "ready" }, "fromFork": false },
        { "iid": 51, "title": "Archive old boards", "createdAt": "2026-10-31T15:30:00Z", "draft": false,
          "author": null, "assignees": [], "reviewers": [], "labels": [], "openDiscussions": 0, "approvedBy": [],
          "mayRerequest": true, "pipeline": null, "page": page_of(51), "size": null,
          "readiness": { "kind": "checking" }, "fromFork": false },
        { "iid": 50, "title": "Keyboard shortcuts for cards", "createdAt": "2026-10-30T08:45:00Z", "draft": false,
          "author": ben, "assignees": [dmitri],
          "reviewers": [reviewer(&anna, "changesRequested"), reviewer(&sam, "requested"),
              reviewer(&ben, "reviewed"), reviewer(&erik, "requested")],
          "labels": [colored("frontend", "#428BCA")], "openDiscussions": 2, "approvedBy": [anna, sam],
          "mayRerequest": false, "pipeline": no_jobs("running"), "page": page_of(50),
          "size": { "additions": 52, "deletions": 6, "files": 2 },
          "readiness": { "kind": "blocked", "reason": { "kind": "discussions" } }, "fromFork": false },
    ])
}

#[test]
fn the_details_scenario_brings_author_pictures_approvers_states_and_label_colours() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("mr-row-details");

    let (end, pages) = listed_with_pictures(&repository, Some(&fake.glab));

    assert_eq!(end, ListEnd::Loaded);
    let [listed] = &pages[..] else {
        panic!("{pages:?}");
    };
    assert_eq!(
        serde_json::to_value(&listed.page.rows).unwrap(),
        detailed_rows()
    );
    let offered: Vec<(&str, &str)> = listed
        .pictures
        .iter()
        .map(|picture| (picture.username.as_str(), picture.address.as_str()))
        .collect();
    let expected = [
        (
            "anna",
            "https://gitlab.example/uploads/-/system/user/avatar/2/avatar.png",
        ),
        (
            "sam",
            "https://gitlab.example/uploads/-/system/user/avatar/1/avatar.png",
        ),
    ];
    assert_eq!(offered, expected);
}

#[test]
fn a_gravatar_person_is_never_fetched_through_glab() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new("mr-row-details");

    let (_, pages) = listed_with_pictures(&repository, Some(&fake.glab));
    let no_gravatar = |argv: &Vec<String>| argv.iter().all(|line| !line.contains("gravatar"));
    assert!(
        no_gravatar(&fake.logged("argv: ")),
        "{:?}",
        fake.logged("argv: ")
    );
    for picture in &pages[0].pictures {
        fetch_picture(&fake.glab, repository.root(), &picture.address).unwrap();
    }

    let argv = fake.logged("argv: ");
    assert!(no_gravatar(&argv), "{argv:?}");
    let fetched: Vec<&String> = argv.iter().filter(|line| line.contains("://")).collect();
    assert_eq!(fetched.len(), 2, "{argv:?}");
}
