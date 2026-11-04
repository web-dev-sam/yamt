#![cfg(test)]
#![cfg(unix)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod fake_glab;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    DescriptionLinks, GitLabRepository, LinkedCommit, LinkedEpic, LinkedIssue, LinkedParent,
    LinksReply, MergeRequestIid, ReadLinks, ShownEpic, ShownIssue, WebPage, gitlab_repository,
    read_links,
};

use fake_glab::Fake;

const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const SCENARIO: &str = "mr-links";
const ORIGIN: &str = "https://gitlab.example";
const LOOKUP_START: &str = "argv: api graphql -f query=query MergeRequestLinks(";
const MR_SHA: &str = "6ea97d8c1111222233334444555566667777aaaa";
const RANGE: &str =
    "a1b2c3d40123456789abcdef0123456789abcdef...e5f6a7b8fedcba9876543210fedcba9876543210";
const UNSEEN_SHA: &str = "0badc0de0badc0de0badc0de0badc0de0badc0de";

/// A repository whose `origin` is on gitlab.example, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    (repo, repository)
}

fn read(fake: &Fake, iid: u32) -> ReadLinks {
    let (_repo, repository) = gitlab_repo();
    read_links(&repository, Some(&fake.glab), MergeRequestIid(iid))
}

fn links_of(read: &ReadLinks) -> &DescriptionLinks {
    let LinksReply::Read { links } = &read.reply else {
        panic!("not read: {:?}", read.reply);
    };
    links
}

fn lookups(fake: &Fake) -> Vec<String> {
    let argv = fake.logged("argv: ");
    argv.into_iter()
        .filter(|line| line.starts_with(LOOKUP_START))
        .collect()
}

fn at(path: &str) -> WebPage {
    serde_json::from_value(serde_json::json!(format!("{ORIGIN}{path}"))).unwrap()
}

fn epic(reference: &str, path: &str, shown: Option<(&str, bool)>) -> LinkedEpic {
    LinkedEpic {
        reference: reference.to_owned(),
        page: at(path),
        shown: shown.map(|(title, closed)| ShownEpic {
            title: title.to_owned(),
            closed,
        }),
    }
}

fn issue(reference: &str, path: &str, shown: Option<ShownIssue>) -> LinkedIssue {
    LinkedIssue {
        reference: reference.to_owned(),
        page: at(path),
        shown,
    }
}

fn shown(title: &str, closed: bool, parent: Option<LinkedParent>) -> ShownIssue {
    ShownIssue {
        title: title.to_owned(),
        closed,
        parent,
    }
}

fn parent(reference: &str, title: &str, path: &str) -> LinkedParent {
    LinkedParent {
        reference: reference.to_owned(),
        title: title.to_owned(),
        page: at(path),
    }
}

fn commit(reference: &str, path: &str, title: Option<&str>) -> LinkedCommit {
    LinkedCommit {
        reference: reference.to_owned(),
        page: at(path),
        title: title.map(str::to_owned),
    }
}

/// !62's epics, issues and commits as the acceptance names them.
fn expected_62() -> DescriptionLinks {
    let epics = vec![
        epic(
            "&3",
            "/groups/taskboard/-/epics/3",
            Some(("Board redesign", false)),
        ),
        epic(
            "&4",
            "/groups/taskboard/-/work_items/4",
            Some(("Old board", true)),
        ),
        epic(
            "design&2",
            "/groups/design/-/epics/2",
            Some(("Design system", false)),
        ),
    ];
    DescriptionLinks {
        epics,
        issues: issues_of_62(),
        commits: commits_of_62(),
    }
}

fn issues_of_62() -> Vec<LinkedIssue> {
    let board = parent("&3", "Board redesign", "/groups/taskboard/-/work_items/3");
    let snooze = parent(
        "#12",
        "Snooze a reminder",
        "/taskboard/taskboard/-/work_items/12",
    );
    let twelve = shown("Snooze a reminder", false, Some(board));
    let thirteen = shown("Write the snooze test", false, Some(snooze));
    vec![
        issue("#12", "/taskboard/taskboard/-/work_items/12", Some(twelve)),
        issue(
            "#13",
            "/taskboard/taskboard/-/work_items/13",
            Some(thirteen),
        ),
        issue(
            "other/lib#5",
            "/other/lib/-/issues/5",
            Some(shown("Fix date parsing", true, None)),
        ),
        issue(
            "web#6",
            "/taskboard/web/-/issues/6",
            Some(shown("Web card", false, None)),
        ),
        issue("secret/vault#9", "/secret/vault/-/issues/9", None),
        issue("#99", "/taskboard/taskboard/-/work_items/99", None),
    ]
}

fn commits_of_62() -> Vec<LinkedCommit> {
    let full = "/taskboard/taskboard/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f";
    let own = format!("/taskboard/taskboard/-/merge_requests/62/diffs?commit_id={MR_SHA}");
    let range = format!("/taskboard/taskboard/-/compare/{RANGE}");
    let unseen = format!("/secret/vault/-/commit/{UNSEEN_SHA}");
    vec![
        commit("fa3335f3", full, Some("Backfill due dates")),
        commit("6ea97d8c", &own, Some("Snooze a reminder")),
        commit(
            "a1b2c3d4…e5f6a7b8",
            &range,
            Some("Commits a1b2c3d4 through e5f6a7b8"),
        ),
        commit("secret/vault@0badc0de", &unseen, None),
    ]
}

#[test]
fn one_hovers_lookup_answers_epics_issues_and_commits_in_order_with_titles_states_and_parents() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 62);

    assert_eq!(links_of(&read), &expected_62());
    assert_eq!(lookups(&fake).len(), 1);
}

#[test]
fn a_cross_project_an_unseen_and_a_missing_reference_answer_without_error() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 62);

    let issues = &links_of(&read).issues;
    let shown: Vec<(&str, bool)> = issues
        .iter()
        .map(|issue| (issue.reference.as_str(), issue.shown.is_some()))
        .collect();
    let expected = [
        ("#12", true),
        ("#13", true),
        ("other/lib#5", true),
        ("web#6", true),
        ("secret/vault#9", false),
        ("#99", false),
    ];
    assert_eq!(shown, expected);
}

#[test]
fn on_gitlab_free_issues_have_no_parent_and_an_epic_is_not_shown_without_error() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 59);

    let free_issue = parent("#20", "Free issue", "/taskboard/taskboard/-/work_items/20");
    let expected = DescriptionLinks {
        epics: vec![epic("&8", "/groups/taskboard/-/epics/8", None)],
        issues: vec![
            issue(
                "#20",
                "/taskboard/taskboard/-/work_items/20",
                Some(shown("Free issue", false, None)),
            ),
            issue(
                "#21",
                "/taskboard/taskboard/-/work_items/21",
                Some(shown("Free task", false, Some(free_issue))),
            ),
        ],
        commits: Vec::new(),
    };
    assert_eq!(links_of(&read), &expected);
}

#[test]
fn a_description_linking_nothing_asks_no_lookup() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 61);

    assert_eq!(links_of(&read), &DescriptionLinks::default());
    assert_eq!(read.pages, Vec::<WebPage>::new());
    let log = std::fs::read_to_string(fake.dir.path().join("log")).unwrap();
    assert!(!log.contains("MergeRequestLinks"), "{log}");
}

#[test]
fn commits_alone_ask_no_lookup() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 58);

    let expected = DescriptionLinks {
        commits: vec![
            commit("fa3335f3", "/taskboard/taskboard/-/commit/fa3335f3", None),
            commit(
                "secret/vault@0badc0de",
                &format!("/secret/vault/-/commit/{UNSEEN_SHA}"),
                None,
            ),
        ],
        ..DescriptionLinks::default()
    };
    assert_eq!(links_of(&read), &expected);
    assert_eq!(lookups(&fake), Vec::<String>::new());
}

#[test]
fn a_failed_lookup_fails_the_reply_in_glabs_words() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 60);

    let failed = LinksReply::Failed {
        message: "glab: a deadline line".to_owned(),
    };
    assert_eq!(read.reply, failed);
    assert_eq!(read.pages, Vec::<WebPage>::new());
}

#[test]
fn glab_missing_or_logged_out_answers_before_any_query() {
    let (_repo, repository) = gitlab_repo();

    let missing = read_links(&repository, None, MergeRequestIid(62));
    assert_eq!(missing.reply, LinksReply::GlabMissing);
    assert_eq!(missing.pages, Vec::<WebPage>::new());

    let fake = Fake::new("logged-out");
    let logged_out = read_links(&repository, Some(&fake.glab), MergeRequestIid(62));
    let detail = "gitlab.com".to_owned();
    assert_eq!(logged_out.reply, LinksReply::NotLoggedIn { detail });
    assert_eq!(logged_out.pages, Vec::<WebPage>::new());
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}

#[test]
fn reading_links_writes_nothing() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 62);

    assert!(matches!(read.reply, LinksReply::Read { .. }));
    assert_eq!(fake.logged("stdin: "), Vec::<String>::new());
    let argv = fake.logged("argv: ");
    assert_eq!(argv.len(), 4, "{argv:#?}");
    assert_eq!(argv[0], "argv: auth status");
    assert_eq!(argv[1], "argv: api projects/:fullpath");
    assert!(argv[2].starts_with("argv: api graphql -f query=query MergeRequestDescription("));
    assert!(argv[3].starts_with(LOOKUP_START));
    for line in &argv {
        assert!(
            !line.contains(" -X ") && !line.contains("--input"),
            "{line}"
        );
    }
}

#[test]
fn the_lookup_is_one_get_with_fields_per_part() {
    let fake = Fake::new(SCENARIO);

    let _ = read(&fake, 62);

    let lookups = lookups(&fake);
    assert_eq!(lookups.len(), 1);
    let fields = [
        " -f path0=taskboard/taskboard -F iids0=[\"12\",\"13\",\"99\"] -F first0=3",
        " -f path1=taskboard -F iids1=[\"3\",\"4\"] -F first1=2",
        " -f path2=other/lib -F iids2=[\"5\"] -F first2=1",
        " -f path3=taskboard/web -F iids3=[\"6\"] -F first3=1",
        " -f path4=secret/vault -F iids4=[\"9\"] -F first4=1",
        " -f path5=design -F iids5=[\"2\"] -F first5=1",
    ];
    assert!(lookups[0].ends_with(&fields.concat()), "{}", lookups[0]);
    assert!(lookups[0].contains("part1: group(fullPath: $path1)"));
    assert!(lookups[0].contains("part4: project(fullPath: $path4)"));
    assert!(lookups[0].contains("part5: group(fullPath: $path5)"));
}

#[test]
fn every_line_and_parent_is_offered_once() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, 62);

    let pages: Vec<&str> = read.pages.iter().map(WebPage::as_str).collect();
    let expected = [
        "/groups/taskboard/-/epics/3".to_owned(),
        "/groups/taskboard/-/work_items/4".to_owned(),
        "/groups/design/-/epics/2".to_owned(),
        "/taskboard/taskboard/-/work_items/12".to_owned(),
        "/groups/taskboard/-/work_items/3".to_owned(),
        "/taskboard/taskboard/-/work_items/13".to_owned(),
        "/other/lib/-/issues/5".to_owned(),
        "/taskboard/web/-/issues/6".to_owned(),
        "/secret/vault/-/issues/9".to_owned(),
        "/taskboard/taskboard/-/work_items/99".to_owned(),
        "/taskboard/taskboard/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f".to_owned(),
        format!("/taskboard/taskboard/-/merge_requests/62/diffs?commit_id={MR_SHA}"),
        format!("/taskboard/taskboard/-/compare/{RANGE}"),
        format!("/secret/vault/-/commit/{UNSEEN_SHA}"),
    ];
    let expected: Vec<String> = expected
        .iter()
        .map(|path| format!("{ORIGIN}{path}"))
        .collect();
    assert_eq!(pages, expected);
}
