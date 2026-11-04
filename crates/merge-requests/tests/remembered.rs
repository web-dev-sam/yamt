#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use serde_json::{Value, json};
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    DiscussionId, GitLabRepository, Glab, MergeRequestIid, PeopleAction, PeopleChange, PeopleGroup,
    ReplyKind, WebPage, change_people, gitlab_repository, list_merge_requests, prepare_open,
    prepare_resolve, preview_markdown, read_description, read_discussion_thread, read_discussions,
    read_job_log, read_links, reply_to_discussion, rerequest_review, resolve_discussion,
    search_people, submit_review,
};

use fake_glab::Fake;

const GITLAB_REMOTE: &str = "https://gitlab.com/taskboard/taskboard.git";
const THREADS: &str = "mr-threads";
const REMEMBERED: &str = "mr-remembered";
const MR_90: MergeRequestIid = MergeRequestIid(90);
const AUTH_STATUS: &str = "argv: auth status";
const PROJECT: &str = "argv: api projects/:fullpath";
const PREVIEW: &str = "argv: api --method POST markdown --input -";
const WRITE: &str = "argv: api --include ";
/// `mr-remembered`'s posts after which each `glab api` answers so, and `glab auth status` says (README).
const UNAUTHORIZED_LOGGED_OUT: u32 = 1;
const ANSWERING_LOGGED_IN: u32 = 2;
const UNAUTHORIZED_LOGGED_IN: u32 = 3;
const PROJECT_NOT_FOUND: u32 = 4;
const FORBIDDEN: u32 = 5;
const PROJECT_NULL: u32 = 6;
const ANONYMOUS_LOGGED_OUT: u32 = 7;
const MUTATION: &str = "argv: api graphql --input -";
/// `page.rs` `NO_PROJECT`.
const NO_PROJECT: &str = "GitLab finds no such project, or you may not see it";

/// The fake glab on a scenario, a repository whose `origin` is on gitlab.com, and a folder for range locks.
struct Setup {
    fake: Fake,
    _repo: TempDir,
    repository: GitLabRepository,
    range_dir: TempDir,
}

impl Setup {
    fn new(scenario: &str) -> Setup {
        let repo = TempDir::new().unwrap();
        git_ok(repo.path(), &["init", "-q"]).unwrap();
        git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
        Setup {
            fake: Fake::new(scenario),
            repository: gitlab_repository(repo.path()).unwrap(),
            _repo: repo,
            range_dir: TempDir::new().unwrap(),
        }
    }

    fn glab(&self) -> &Glab {
        &self.fake.glab
    }

    fn count(&self, argv: &str) -> usize {
        self.fake.logged(argv).len()
    }
}

fn d01() -> DiscussionId {
    DiscussionId::try_from(format!("{:0>40}", "01")).unwrap()
}

fn json_of(reply: impl serde::Serialize) -> Value {
    serde_json::to_value(reply).unwrap()
}

fn preview(setup: &Setup) -> Value {
    json_of(preview_markdown(&setup.repository, Some(setup.glab()), MR_90, "Hi").reply)
}

fn comment(setup: &Setup) -> Value {
    let kind = ReplyKind::Comment;
    json_of(reply_to_discussion(
        &setup.repository,
        Some(setup.glab()),
        MR_90,
        &d01(),
        kind,
        "Hi",
    ))
}

fn description(setup: &Setup) -> Value {
    json_of(read_description(&setup.repository, Some(setup.glab()), MR_90).reply)
}

fn failed(message: &str) -> Value {
    json!({ "kind": "failed", "message": message })
}

fn refused(reason: &str) -> Value {
    json!({ "kind": "refused", "reason": reason })
}

/// One action as the window asks it: its reply's JSON.
type Action = fn(&Setup) -> Value;

fn list(setup: &Setup) -> Value {
    json_of(list_merge_requests(&setup.repository, Some(setup.glab()), &|_| {}).end)
}

fn links(setup: &Setup) -> Value {
    json_of(read_links(&setup.repository, Some(setup.glab()), MR_90).reply)
}

fn discussions(setup: &Setup) -> Value {
    let read = read_discussions(&setup.repository, Some(setup.glab()), &[MR_90]);
    json_of(&read.rows[0].answer)
}

fn job_log(setup: &Setup) -> Value {
    let job = "https://gitlab.com/taskboard/taskboard/-/jobs/302";
    let page: WebPage = serde_json::from_value(json!(job)).unwrap();
    json_of(read_job_log(&setup.repository, Some(setup.glab()), &page))
}

fn search(setup: &Setup) -> Value {
    json_of(search_people(&setup.repository, Some(setup.glab()), "er").reply)
}

fn change(setup: &Setup) -> Value {
    let change = PeopleChange {
        group: PeopleGroup::Reviewers,
        action: PeopleAction::Add,
        username: "erik".to_owned(),
    };
    json_of(change_people(&setup.repository, Some(setup.glab()), MR_90, &change).reply)
}

fn rerequest(setup: &Setup) -> Value {
    json_of(rerequest_review(
        &setup.repository,
        Some(setup.glab()),
        MR_90,
        "ben",
    ))
}

fn open(setup: &Setup) -> Value {
    let range_dir = setup.range_dir.path();
    json_of(prepare_open(&setup.repository, Some(setup.glab()), MR_90, range_dir).err())
}

fn resolve_conflicts(setup: &Setup) -> Value {
    json_of(prepare_resolve(&setup.repository, Some(setup.glab()), MR_90).err())
}

fn thread(setup: &Setup) -> Value {
    let glab = Some(setup.glab());
    json_of(read_discussion_thread(&setup.repository, glab, MR_90, &d01()).reply)
}

fn resolve(setup: &Setup) -> Value {
    json_of(resolve_discussion(
        &setup.repository,
        Some(setup.glab()),
        MR_90,
        &d01(),
        true,
    ))
}

fn submit(setup: &Setup) -> Value {
    json_of(submit_review(&setup.repository, Some(setup.glab()), MR_90))
}

/// Each of the 13 actions (the three writes each), by name.
const ACTIONS: [(&str, Action); 15] = [
    ("list_merge_requests", list),
    ("read_description", description),
    ("read_links", links),
    ("read_discussions", discussions),
    ("read_job_log", job_log),
    ("search_people", search),
    ("change_people", change),
    ("rerequest_review", rerequest),
    ("prepare_open", open),
    ("prepare_resolve", resolve_conflicts),
    ("read_discussion_thread", thread),
    ("reply_to_discussion", comment),
    ("resolve_discussion", resolve),
    ("submit_review", submit),
    ("preview_markdown", preview),
];

#[test]
fn a_second_preview_thread_read_and_write_ask_glab_nothing() {
    let setup = Setup::new(THREADS);

    let previews = [preview(&setup), preview(&setup)];
    let read = thread(&setup);
    let sent = comment(&setup);

    assert_eq!(
        previews.map(|reply| reply["kind"].clone()),
        ["read", "read"]
    );
    assert_eq!(read["kind"], "read");
    assert_eq!(sent, json!({ "kind": "sent" }));
    assert_eq!(setup.fake.logged(AUTH_STATUS), [AUTH_STATUS]);
    assert_eq!(setup.fake.logged(PROJECT), [PROJECT]);
    assert_eq!(setup.count(PREVIEW), 2);
    assert_eq!(setup.count(WRITE), 1);
}

#[test]
fn two_actions_started_together_ask_once() {
    let setup = Setup::new(THREADS);

    let replies = std::thread::scope(|scope| {
        let first = scope.spawn(|| preview(&setup));
        let second = scope.spawn(|| preview(&setup));
        [first.join().unwrap(), second.join().unwrap()]
    });

    assert_eq!(replies.map(|reply| reply["kind"].clone()), ["read", "read"]);
    assert_eq!(setup.fake.logged(AUTH_STATUS), [AUTH_STATUS]);
    assert_eq!(setup.fake.logged(PROJECT), [PROJECT]);
}

#[test]
fn a_401_forgets_and_answers_not_logged_in() {
    let logged_out = json!({ "kind": "notLoggedIn", "detail": "gitlab.com" });
    for (name, action) in ACTIONS {
        let setup = Setup::new(REMEMBERED);
        assert_eq!(preview(&setup)["kind"], "read", "{name}");
        setup.fake.answered_posts(UNAUTHORIZED_LOGGED_OUT);

        let reply = action(&setup);

        assert_eq!(reply, logged_out, "{name}");
        let argv = setup.fake.logged("argv: ");
        assert_eq!(argv[..3], [AUTH_STATUS, PROJECT, PREVIEW], "{name}");
        let [failed_call, asked_again] = &argv[3..] else {
            panic!("{name}: not one call and one auth status after the preview: {argv:#?}");
        };
        assert_ne!(failed_call, AUTH_STATUS, "{name}");
        assert_eq!(asked_again, AUTH_STATUS, "{name}");
        setup.fake.answered_posts(ANSWERING_LOGGED_IN);
        assert_eq!(preview(&setup)["kind"], "read", "{name}");
        assert_eq!(
            (setup.count(AUTH_STATUS), setup.count(PROJECT)),
            (3, 2),
            "{name}"
        );
    }
}

#[test]
fn a_401_while_logged_in_keeps_todays_words() {
    let unauthorized = "glab: 401 Unauthorized (HTTP 401)";
    let previewed = Setup::new(REMEMBERED);
    let replied = Setup::new(REMEMBERED);
    for setup in [&previewed, &replied] {
        assert_eq!(preview(setup)["kind"], "read");
        setup.fake.answered_posts(UNAUTHORIZED_LOGGED_IN);
    }

    assert_eq!(preview(&previewed), failed(unauthorized));
    assert_eq!(comment(&replied), refused("401 Unauthorized"));

    for setup in [&previewed, &replied] {
        assert_eq!(setup.count(AUTH_STATUS), 2);
        assert_eq!(preview(setup), failed(unauthorized));
        assert_eq!((setup.count(AUTH_STATUS), setup.count(PROJECT)), (3, 2));
    }
    assert_eq!(replied.count(WRITE), 1);
}

#[test]
fn a_missing_project_forgets() {
    let not_found = Setup::new(REMEMBERED);
    let null = Setup::new(REMEMBERED);
    for setup in [&not_found, &null] {
        assert_eq!(preview(setup)["kind"], "read");
    }
    not_found.fake.answered_posts(PROJECT_NOT_FOUND);
    null.fake.answered_posts(PROJECT_NULL);

    let missing = preview(&not_found);
    let no_project = description(&null);

    assert_eq!(missing, failed("glab: 404 Project Not Found (HTTP 404)"));
    assert_eq!(no_project, failed(NO_PROJECT));
    for setup in [&not_found, &null] {
        assert_eq!(setup.count(AUTH_STATUS), 2);
        setup.fake.answered_posts(PROJECT_NULL);
        assert_eq!(preview(setup)["kind"], "read");
        assert_eq!((setup.count(AUTH_STATUS), setup.count(PROJECT)), (3, 2));
    }
}

#[test]
fn a_mutation_denied_after_a_logout_answers_not_logged_in() {
    let logged_out = json!({ "kind": "notLoggedIn", "detail": "gitlab.com" });
    for (name, action) in [
        ("change_people", change as Action),
        ("rerequest_review", rerequest),
    ] {
        let setup = Setup::new(REMEMBERED);
        assert_eq!(preview(&setup)["kind"], "read", "{name}");
        setup.fake.answered_posts(ANONYMOUS_LOGGED_OUT);

        let reply = action(&setup);

        assert_eq!(reply, logged_out, "{name}");
        let argv = setup.fake.logged("argv: ");
        assert_eq!(argv.last().map(String::as_str), Some(AUTH_STATUS), "{name}");
        assert_eq!(setup.fake.logged(MUTATION), [MUTATION], "{name}");
        assert_eq!(
            (setup.count(AUTH_STATUS), setup.count(PROJECT)),
            (2, 1),
            "{name}"
        );
    }
}

#[test]
fn a_403_keeps_the_project() {
    let setup = Setup::new(REMEMBERED);
    assert_eq!(preview(&setup)["kind"], "read");
    setup.fake.answered_posts(FORBIDDEN);

    let forbidden = comment(&setup);

    assert_eq!(forbidden, refused("403 Forbidden"));
    setup.fake.answered_posts(PROJECT_NULL);
    assert_eq!(preview(&setup)["kind"], "read");
    assert_eq!(setup.fake.logged(AUTH_STATUS), [AUTH_STATUS]);
    assert_eq!(setup.fake.logged(PROJECT), [PROJECT]);
}

#[test]
fn a_forgotten_project_is_asked_again() {
    let setup = Setup::new(THREADS);
    assert_eq!(preview(&setup)["kind"], "read");

    setup.repository.forget_project();

    assert_eq!(preview(&setup)["kind"], "read");
    assert_eq!((setup.count(AUTH_STATUS), setup.count(PROJECT)), (2, 2));
}
