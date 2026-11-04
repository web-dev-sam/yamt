#![cfg(test)]
#![cfg(unix)]

mod fake_glab;

use std::fs;

use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    Commenting, DescriptionBlock, DescriptionInline, DiscussionId, DiscussionThread,
    DiscussionThreadReply, DiscussionWriteReply, GitLabRepository, ImageLength, ImageSize,
    MarkdownPreviewReply, MergeRequestIid, NoteEdit, PendingDraft, ReadThread, ReplyKind, WebPage,
    gitlab_repository, preview_markdown, read_discussion_thread, reply_to_discussion,
    resolve_discussion, submit_review,
};

use fake_glab::Fake;

const GITLAB_REMOTE: &str = "https://gitlab.com/taskboard/taskboard.git";
const SCENARIO: &str = "mr-threads";
const REFUSED_SCENARIO: &str = "mr-threads-refused";
const MR_90: MergeRequestIid = MergeRequestIid(90);
const UPLOAD_KEY: &str = "upload~903a1b2c3d4e5f60718293a4b5c6d7e8";

/// A repository whose `origin` is on gitlab.com, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    (repo, repository)
}

/// Discussion `dNN`: `NN` behind zeros.
fn d(nn: &str) -> DiscussionId {
    DiscussionId::try_from(format!("{nn:0>40}")).unwrap()
}

fn read_thread(fake: &Fake, iid: u32, nn: &str) -> ReadThread {
    let (_repo, repository) = gitlab_repo();
    read_discussion_thread(&repository, Some(&fake.glab), MergeRequestIid(iid), &d(nn))
}

fn thread_of(read: &ReadThread) -> &DiscussionThread {
    let DiscussionThreadReply::Read { thread } = &read.reply else {
        panic!("not read: {:?}", read.reply);
    };
    thread
}

/// The posts the fake counted: its state file, absent before the first.
fn posts(fake: &Fake) -> u32 {
    let state = fs::read_to_string(fake.dir.path().join("state")).unwrap_or_default();
    state.trim().parse().unwrap_or(0)
}

/// The argv the fake logged for each write: `glab api --include`.
fn writes(fake: &Fake) -> Vec<String> {
    fake.logged("argv: api --include ")
}

fn edit(by: &str, at: &str) -> (String, String) {
    (by.to_owned(), at.to_owned())
}

fn edit_of(edit: Option<&NoteEdit>) -> Option<(String, String)> {
    edit.map(|edit| (edit.by.username.clone(), edit.at.clone()))
}

#[test]
fn a_thread_comes_back_whole_with_edits_and_the_viewers_drafts() {
    let fake = Fake::new(SCENARIO);

    let read = read_thread(&fake, 90, "01");

    let thread = thread_of(&read);
    let authors: Vec<&str> = thread
        .comments
        .iter()
        .map(|comment| {
            comment
                .author
                .as_ref()
                .map_or("", |person| person.username.as_str())
        })
        .collect();
    assert_eq!(authors, ["anna", "sam", "dmitri", "anna"]);
    let edits: Vec<Option<(String, String)>> = thread
        .comments
        .iter()
        .map(|comment| edit_of(comment.edited.as_ref()))
        .collect();
    let expected = [
        Some(edit("anna", "2026-11-03T09:00:00Z")),
        Some(edit("dmitri", "2026-11-01T12:30:00Z")),
        None,
        None,
    ];
    assert_eq!(edits, expected);
    let drafts = [PendingDraft {
        text: "I'll take the second option.".to_owned(),
    }];
    assert_eq!(thread.drafts, drafts);
    assert_eq!(thread.pending, 2);
    assert!(thread.may_resolve);
    assert!(!thread.resolved);
    assert_eq!(thread.commenting, Commenting::Allowed);
    assert_eq!(thread.discussion.id, d("01"));
    assert_eq!(thread.discussion.earlier.len(), 3);
    let drafts_asked =
        "argv: api --paginate projects/taskboard%2Ftaskboard/merge_requests/90/draft_notes";
    assert_eq!(fake.logged(drafts_asked), [drafts_asked]);
}

#[test]
fn a_threads_comments_keep_image_sizes_and_name_their_pages_uploads_and_pictures() {
    let fake = Fake::new(SCENARIO);

    let read = read_thread(&fake, 90, "01");

    let sams = &thread_of(&read).comments[1].body.blocks;
    let DescriptionBlock::Paragraph { inlines } = &sams[sams.len() - 1] else {
        panic!("no paragraph last: {sams:?}");
    };
    let Some(DescriptionInline::Image { size, .. }) = inlines.first() else {
        panic!("no image first: {inlines:?}");
    };
    let sixty = ImageSize::Width {
        width: ImageLength::Percent { value: 60 },
    };
    assert_eq!(*size, Some(sixty));
    let keys: Vec<&str> = read
        .uploads
        .iter()
        .map(|upload| upload.key.as_str())
        .collect();
    assert_eq!(keys, [UPLOAD_KEY]);
    let pages: Vec<&str> = read.pages.iter().map(WebPage::as_str).collect();
    let note_901 = "https://gitlab.com/taskboard/taskboard/-/merge_requests/90#note_901";
    assert_eq!(pages[..2], [note_901, "https://docs.example/board"]);
    let pictures: Vec<&str> = read
        .pictures
        .iter()
        .map(|picture| picture.username.as_str())
        .collect();
    assert_eq!(pictures, ["anna", "dmitri", "sam"]);
}

#[test]
fn a_locked_merge_request_may_not_be_commented() {
    let fake = Fake::new(SCENARIO);

    let read = read_thread(&fake, 91, "14");

    let thread = thread_of(&read);
    assert_eq!(thread.commenting, Commenting::Locked);
    assert!(!thread.may_resolve);
    assert_eq!(thread.pending, 0);
}

#[test]
fn reading_a_thread_writes_nothing() {
    let fake = Fake::new(SCENARIO);

    let read = read_thread(&fake, 90, "01");

    assert!(matches!(read.reply, DiscussionThreadReply::Read { .. }));
    assert_eq!(posts(&fake), 0);
    assert_eq!(writes(&fake), Vec::<String>::new());
    let gone = read_thread(&fake, 90, "99");
    assert_eq!(gone.reply, DiscussionThreadReply::NotFound);
}

#[test]
fn a_preview_writes_nothing() {
    let fake = Fake::new(SCENARIO);
    let (_repo, repository) = gitlab_repo();

    let read = preview_markdown(&repository, Some(&fake.glab), MR_90, "**Preview** of @anna");

    let MarkdownPreviewReply::Read { preview } = &read.reply else {
        panic!("not read: {:?}", read.reply);
    };
    assert_eq!(preview.blocks.len(), 1);
    let pages: Vec<&str> = read.pages.iter().map(WebPage::as_str).collect();
    assert_eq!(pages, ["https://gitlab.com/anna"]);
    assert_eq!(posts(&fake), 0);
    assert_eq!(writes(&fake), Vec::<String>::new());
    let asked = "argv: api --method POST markdown --input -";
    assert_eq!(fake.logged(asked), [asked]);
}

#[test]
fn a_failed_preview_keeps_glabs_words() {
    let fake = Fake::new(REFUSED_SCENARIO);
    let (_repo, repository) = gitlab_repo();

    let read = preview_markdown(&repository, Some(&fake.glab), MR_90, "x");

    let failed = MarkdownPreviewReply::Failed {
        message: "glab: 401 Unauthorized (HTTP 401)".to_owned(),
    };
    assert_eq!(read.reply, failed);
    assert_eq!(read.pages, []);
}

#[test]
fn each_write_is_one_post() {
    let fake = Fake::new(SCENARIO);
    let (_repo, repository) = gitlab_repo();
    let glab = Some(&fake.glab);
    let d01 = d("01");

    let replies = [
        reply_to_discussion(&repository, glab, MR_90, &d01, ReplyKind::Comment, "Thanks"),
        reply_to_discussion(&repository, glab, MR_90, &d01, ReplyKind::Draft, "Later"),
        resolve_discussion(&repository, glab, MR_90, &d01, true),
        resolve_discussion(&repository, glab, MR_90, &d01, false),
        submit_review(&repository, glab, MR_90),
    ];

    assert_eq!(replies, [const { DiscussionWriteReply::Sent }; 5]);
    assert_eq!(posts(&fake), 5);
    let route = "projects/taskboard%2Ftaskboard/merge_requests/90";
    let thread = format!("{route}/discussions/{}", d01.as_str());
    let expected = [
        format!("argv: api --include --method POST {thread}/notes --input -"),
        format!("argv: api --include --method POST {route}/draft_notes --input -"),
        format!("argv: api --include --method PUT {thread} --input -"),
        format!("argv: api --include --method PUT {thread} --input -"),
        format!("argv: api --include --method POST {route}/draft_notes/bulk_publish --input -"),
    ];
    assert_eq!(writes(&fake), expected);
    let after = read_thread(&fake, 90, "01");
    assert_eq!(thread_of(&after).discussion.last.text, "Later");
    assert_eq!(thread_of(&after).pending, 0);
}

#[test]
fn a_refused_write_carries_gitlabs_reason() {
    let fake = Fake::new(REFUSED_SCENARIO);
    let (_repo, repository) = gitlab_repo();
    let glab = Some(&fake.glab);
    let d01 = d("01");

    let forbidden = reply_to_discussion(&repository, glab, MR_90, &d01, ReplyKind::Comment, "Hi");
    let missing = reply_to_discussion(&repository, glab, MR_90, &d01, ReplyKind::Draft, "Hi");

    let refused = |reason: &str| DiscussionWriteReply::Refused {
        reason: reason.to_owned(),
    };
    assert_eq!(forbidden, refused("403 Forbidden"));
    assert_eq!(missing, refused("note is missing"));
}

#[test]
fn a_write_without_an_answer_fails() {
    let fake = Fake::new(REFUSED_SCENARIO);
    fake.answered_posts(2);
    let (_repo, repository) = gitlab_repo();

    let reply = resolve_discussion(&repository, Some(&fake.glab), MR_90, &d("01"), true);

    let deadline = "glab: Post \"https://gitlab.com/api/v4/projects/taskboard%2Ftaskboard/merge_requests/90/\
                    discussions/0000000000000000000000000000000000000001/notes\": context deadline exceeded";
    let failed = DiscussionWriteReply::Failed {
        message: deadline.to_owned(),
    };
    assert_eq!(reply, failed);
}

#[test]
fn a_5xx_fails() {
    let fake = Fake::new(REFUSED_SCENARIO);
    fake.answered_posts(3);
    let (_repo, repository) = gitlab_repo();

    let reply = submit_review(&repository, Some(&fake.glab), MR_90);

    let failed = DiscussionWriteReply::Failed {
        message: "500 Internal Server Error".to_owned(),
    };
    assert_eq!(reply, failed);
}

#[test]
fn glab_missing_or_logged_out_writes_and_reads_nothing() {
    let (_repo, repository) = gitlab_repo();
    let d01 = d("01");

    let missing = read_discussion_thread(&repository, None, MR_90, &d01);
    let write = submit_review(&repository, None, MR_90);

    assert_eq!(missing.reply, DiscussionThreadReply::GlabMissing);
    assert_eq!(write, DiscussionWriteReply::GlabMissing);
    let fake = Fake::new("logged-out");
    let logged_out = resolve_discussion(&repository, Some(&fake.glab), MR_90, &d01, true);
    let detail = "gitlab.com".to_owned();
    assert_eq!(logged_out, DiscussionWriteReply::NotLoggedIn { detail });
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}
