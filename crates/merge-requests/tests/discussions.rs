#![cfg(test)]
#![cfg(unix)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod fake_glab;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    DiscussionNote, DiscussionPlace, DiscussionsAnswer, GitLabRepository, MergeRequestIid,
    OfferedPicture, OpenDiscussion, ReadDiscussions, RowDiscussions, WebPage, gitlab_repository,
    read_discussions,
};

use fake_glab::Fake;

const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";
const SCENARIO: &str = "mr-discussions";
const QUERY_START: &str = "argv: api graphql -f query=query MergeRequestDiscussions(";

/// A repository whose `origin` is on gitlab.example, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    (repo, repository)
}

fn iids(numbers: &[u32]) -> Vec<MergeRequestIid> {
    numbers
        .iter()
        .map(|&number| MergeRequestIid(number))
        .collect()
}

fn read(fake: &Fake, numbers: &[u32]) -> ReadDiscussions {
    let (_repo, repository) = gitlab_repo();
    read_discussions(&repository, Some(&fake.glab), &iids(numbers))
}

/// The discussions query's argv lines the fake logged.
fn queries(fake: &Fake) -> Vec<String> {
    let argv = fake.logged("argv: ");
    argv.into_iter()
        .filter(|line| line.starts_with(QUERY_START))
        .collect()
}

fn open_of(row: &RowDiscussions) -> &[OpenDiscussion] {
    let DiscussionsAnswer::Open { discussions } = &row.answer else {
        panic!("not open: {row:?}");
    };
    discussions
}

fn author(note: &DiscussionNote) -> Option<&str> {
    note.author.as_ref().map(|person| person.username.as_str())
}

fn page(note: &DiscussionNote) -> Option<&str> {
    note.page.as_ref().map(WebPage::as_str)
}

#[test]
fn a_rows_open_discussions_arrive_with_their_last_persons_note_place_and_link() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &[82, 81, 79, 78]);

    let asked: Vec<MergeRequestIid> = read.rows.iter().map(|row| row.iid).collect();
    assert_eq!(asked, iids(&[82, 81, 79, 78]));
    let open = open_of(&read.rows[0]);
    assert_eq!(open.len(), 3, "{open:?}");
    let (a, b, c) = (&open[0], &open[1], &open[2]);
    let card = DiscussionPlace::File {
        path: "src/board/card.ts".to_owned(),
        line: Some(12),
    };
    assert_eq!(a.place, card);
    assert_eq!(author(&a.last), Some("sam"));
    assert_eq!(a.last.text, "Yes, done in the second commit.");
    assert_eq!(a.last.created_at, "2026-11-03T11:05:00Z");
    let note_103 = "https://gitlab.example/taskboard/taskboard/-/merge_requests/82#note_103";
    assert_eq!(page(&a.last), Some(note_103));
    let due_dates = DiscussionPlace::File {
        path: "src/board/dueDates.ts".to_owned(),
        line: Some(6),
    };
    assert_eq!(b.place, due_dates);
    assert_eq!(author(&b.last), Some("ben"));
    assert_eq!(c.place, DiscussionPlace::Overview);
    assert_eq!(author(&c.last), Some("anna"));
    assert_eq!(page(&c.last), None);
    let missing = DiscussionsAnswer::Failed {
        message: "GitLab sent no merge request !78".to_owned(),
    };
    assert_eq!(read.rows[3].answer, missing);
    let offered: Vec<&str> = read
        .pictures
        .iter()
        .map(|picture| picture.username.as_str())
        .collect();
    assert_eq!(offered, ["anna"]);
}

#[test]
fn one_rows_details_alone_are_one_call() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &[81]);

    assert_eq!(read.rows.len(), 1);
    assert_eq!(open_of(&read.rows[0]).len(), 1);
    let asked = queries(&fake);
    assert_eq!(asked.len(), 1, "{asked:?}");
    assert!(
        asked[0].ends_with(r#" -f fullPath=taskboard/taskboard -F iids=["81"] -F first=1"#),
        "{asked:?}"
    );
}

#[test]
fn a_later_discussions_page_is_asked_for_that_row_alone() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &[82, 81, 79, 78]);

    let open = open_of(&read.rows[2]);
    assert_eq!(open.len(), 1, "{open:?}");
    assert_eq!(open[0].last.text, "Search titles only, for now?");
    let asked = queries(&fake);
    assert_eq!(asked.len(), 2, "{asked:?}");
    assert!(
        asked[0].ends_with(r#" -F iids=["82","81","79","78"] -F first=4"#),
        "{asked:?}"
    );
    let later = r#" -F iids=["79"] -F first=1 -f discussionsAfter=d-2"#;
    assert!(asked[1].ends_with(later), "{asked:?}");
}

#[test]
fn markup_in_a_body_stays_as_sent() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &[81]);

    let text = &open_of(&read.rows[0])[0].last.text;
    let sent = "Please **check** <b>THIS</b> & that\non a dark theme\n<script>alert(1)</script>";
    assert_eq!(text, sent);
}

#[test]
fn a_failed_glab_call_fails_its_rows_and_keeps_its_words() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &[77]);

    let message = r#"glab: Post "https://gitlab.example/api/graphql": context deadline exceeded"#;
    let failed = DiscussionsAnswer::Failed {
        message: message.to_owned(),
    };
    let row = RowDiscussions {
        iid: MergeRequestIid(77),
        answer: failed,
    };
    assert_eq!(read.rows, [row]);
    assert_eq!(read.pictures, Vec::<OfferedPicture>::new());
}

#[test]
fn glab_missing_answers_each_row() {
    let (_repo, repository) = gitlab_repo();

    let read = read_discussions(&repository, None, &iids(&[82, 81]));

    let answers: Vec<&DiscussionsAnswer> = read.rows.iter().map(|row| &row.answer).collect();
    assert_eq!(answers, [&DiscussionsAnswer::GlabMissing; 2]);
}

#[test]
fn logged_out_answers_each_row() {
    let fake = Fake::new("logged-out");

    let read = read(&fake, &[82, 81]);

    let logged_out = DiscussionsAnswer::NotLoggedIn {
        detail: "gitlab.com".to_owned(),
    };
    let answers: Vec<&DiscussionsAnswer> = read.rows.iter().map(|row| &row.answer).collect();
    assert_eq!(answers, [&logged_out; 2]);
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}

#[test]
fn an_empty_ask_answers_nothing_and_runs_no_glab() {
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &[]);

    assert_eq!(read.rows, Vec::<RowDiscussions>::new());
    assert_eq!(read.pictures, Vec::<OfferedPicture>::new());
    assert_eq!(fake.logged("argv: "), Vec::<String>::new());
}
