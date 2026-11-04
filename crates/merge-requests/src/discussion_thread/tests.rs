use serde_json::{Value, json};
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_gitio::{Glab, HttpAnswer, HttpCall};

use super::read::{self, offered, thread_from};
use super::write::{self, Write, replied, request};
use super::*;
use crate::discussions::sample::{
    answer, comment, discussion, hex, merge_request, open, project, system_note, with_id,
};
use crate::project::Project;
use crate::query::{draft_notes_args, markdown_args, markdown_body};
use crate::{
    DescriptionBlock, DescriptionInline, DiscussionId, ImageLength, ImageSize, MergeRequestIid,
    gitlab_repository,
};

const IID: MergeRequestIid = MergeRequestIid(1);
const NOTHING_TO_SEND: &str = "There is nothing to send.";

fn id(n: u32) -> DiscussionId {
    DiscussionId::try_from(hex(n)).unwrap()
}

fn user(username: &str) -> Value {
    json!({ "username": username, "name": format!("{username} name"), "avatarUrl": null })
}

/// A draft of the viewer's in discussion `n`; `None`: one starting a discussion.
fn draft(discussion: Option<u32>, note: &str) -> Value {
    json!({ "id": 500, "discussion_id": discussion.map(hex), "note": note, "position": null })
}

/// What `glab api --paginate` prints for these pages: each page's array, one after the other.
fn drafts(pages: &[&[Value]]) -> Vec<u8> {
    let printed: String = pages.iter().map(|page| json!(page).to_string()).collect();
    printed.into_bytes()
}

/// The thread read of discussion `asked` when the discussions query answers `batch` and the draft list `listed`;
/// beside it, how many times the drafts were asked for.
fn read_on(
    project: &Project,
    batch: &[Value],
    asked: u32,
    listed: &Result<Vec<u8>, String>,
) -> (ReadThread, u32) {
    let mut fetch = |iids: &[MergeRequestIid], after: Option<&str>| {
        assert_eq!((iids, after), ([IID].as_slice(), None));
        Ok(answer(batch))
    };
    let mut drafts_asked = 0;
    let mut fetch_drafts = || {
        drafts_asked += 1;
        listed.clone()
    };
    let read = thread_from(IID, &id(asked), project, &mut fetch, &mut fetch_drafts);
    (offered(read), drafts_asked)
}

fn thread_of(read: &ReadThread) -> DiscussionThread {
    let DiscussionThreadReply::Read { thread } = &read.reply else {
        panic!("not read: {:?}", read.reply);
    };
    thread.clone()
}

/// The thread of discussion 1 of merge request 1 holding `discussions`, with no drafts.
fn thread(discussions: &[Value]) -> DiscussionThread {
    let batch = [merge_request(1, discussions, None)];
    thread_of(&read_on(&project(), &batch, 1, &Ok(drafts(&[&[]]))).0)
}

fn failed(message: &str) -> DiscussionThreadReply {
    DiscussionThreadReply::Failed {
        message: message.to_owned(),
    }
}

fn username(person: Option<&Person>) -> Option<&str> {
    person.map(|person| person.username.as_str())
}

#[test]
fn a_resolved_discussions_thread_reads_resolved() {
    let notes = [comment("anna", 1), system_note(2), comment("ben", 3)];

    let thread = thread(&[discussion(true, true, &notes)]);

    assert!(thread.resolved);
    let authors: Vec<Option<&str>> = thread
        .comments
        .iter()
        .map(|comment| username(comment.author.as_ref()))
        .collect();
    assert_eq!(authors, [Some("anna"), Some("ben")]);
    assert_eq!(thread.discussion.id, id(1));
    assert_eq!(thread.discussion.last.text, "ben 3");
    assert_eq!(
        username(thread.discussion.earlier[0].author.as_ref()),
        Some("anna")
    );
    assert_eq!(thread.comments[1].created_at, "2026-11-03T10:00:03Z");
    let page = thread.comments[1].page.as_ref().map(WebPage::as_str);
    let note_3 = "https://gitlab.example/taskboard/taskboard/-/merge_requests/1#note_3";
    assert_eq!(page, Some(note_3));
    assert_eq!((thread.drafts, thread.pending), (Vec::new(), 0));
    assert!(thread.may_resolve);
    assert_eq!(thread.commenting, Commenting::Allowed);
}

#[test]
fn a_system_note_is_no_comment_of_the_thread() {
    let notes = [system_note(1), comment("anna", 2), system_note(3)];

    let thread = thread(&[open(&notes)]);

    assert_eq!(thread.comments.len(), 1);
    assert_eq!(username(thread.comments[0].author.as_ref()), Some("anna"));
}

#[test]
fn a_thread_answered_without_its_discussion_is_not_found() {
    let only_gitlab = with_id(open(&[system_note(3)]), 2);
    let batch = [merge_request(
        1,
        &[open(&[comment("anna", 1)]), only_gitlab],
        None,
    )];

    for asked in [2, 3] {
        let (read, drafts_asked) = read_on(&project(), &batch, asked, &Ok(drafts(&[&[]])));

        assert_eq!(read.reply, DiscussionThreadReply::NotFound);
        assert_eq!(drafts_asked, 0);
    }
}

#[test]
fn a_thread_that_cannot_be_read_fails_with_gitlabs_or_glabs_words() {
    let none = Ok(drafts(&[&[]]));
    let mut cut = open(&[comment("anna", 1)]);
    cut["notes"]["pageInfo"]["hasNextPage"] = json!(true);
    let other = [merge_request(2, &[open(&[comment("anna", 1)])], None)];
    let whole = [merge_request(1, &[open(&[comment("anna", 1)])], None)];
    let cases = [
        (
            &[merge_request(1, &[cut], None)][..],
            &none,
            "a discussion has more than 200 notes; yamt reads no further",
        ),
        (&other[..], &none, "GitLab sent no merge request !1"),
        (
            &whole[..],
            &Err("glab: timed out".to_owned()),
            "glab: timed out",
        ),
    ];

    for (batch, listed, message) in cases {
        let (read, _) = read_on(&project(), batch, 1, listed);

        assert_eq!(read.reply, failed(message));
        assert_eq!(read.pages, []);
    }
    let (read, _) = read_on(&project(), &whole, 1, &Ok(b"{}".to_vec()));
    let DiscussionThreadReply::Failed { message } = read.reply else {
        panic!("not failed: {:?}", read.reply);
    };
    assert!(
        message.starts_with("GitLab's draft notes are not what yamt expects"),
        "{message}"
    );
}

#[test]
fn commenting_is_allowed_locked_or_not_allowed_as_gitlab_says() {
    let cases = [
        (true, false, Commenting::Allowed),
        (true, true, Commenting::Allowed),
        (false, true, Commenting::Locked),
        (false, false, Commenting::NotAllowed),
    ];
    for (create_note, locked, commenting) in cases {
        let mut node = merge_request(1, &[open(&[comment("anna", 1)])], None);
        node["userPermissions"]["createNote"] = json!(create_note);
        node["discussionLocked"] = json!(locked);

        let (read, _) = read_on(&project(), &[node], 1, &Ok(drafts(&[&[]])));

        assert_eq!(thread_of(&read).commenting, commenting);
    }
    for (resolvable, resolve_note, may_resolve) in [
        (true, true, true),
        (true, false, false),
        (false, true, false),
    ] {
        let mut asked = discussion(resolvable, false, &[comment("anna", 1)]);
        asked["userPermissions"]["resolveNote"] = json!(resolve_note);

        assert_eq!(thread(&[asked]).may_resolve, may_resolve);
    }
}

#[test]
fn drafts_of_this_discussion_show_and_every_draft_counts() {
    let batch = [merge_request(1, &[open(&[comment("anna", 1)])], None)];
    let listed = drafts(&[&[
        draft(Some(1), "first"),
        draft(Some(2), "elsewhere"),
        draft(None, "a new thread"),
        draft(Some(1), "second"),
    ]]);

    let (read, drafts_asked) = read_on(&project(), &batch, 1, &Ok(listed));

    let thread = thread_of(&read);
    let texts: Vec<&str> = thread
        .drafts
        .iter()
        .map(|draft| draft.text.as_str())
        .collect();
    assert_eq!(texts, ["first", "second"]);
    assert_eq!(thread.pending, 4);
    assert_eq!(drafts_asked, 1);
}

#[test]
fn paginated_drafts_are_read_page_by_page() {
    let batch = [merge_request(1, &[open(&[comment("anna", 1)])], None)];
    let listed = drafts(&[
        &[draft(Some(1), "page one"), draft(Some(2), "other")],
        &[draft(Some(1), "page two")],
        &[],
    ]);

    let thread = thread_of(&read_on(&project(), &batch, 1, &Ok(listed)).0);

    let texts: Vec<&str> = thread
        .drafts
        .iter()
        .map(|draft| draft.text.as_str())
        .collect();
    assert_eq!(texts, ["page one", "page two"]);
    assert_eq!(thread.pending, 3);
    let nothing = thread_of(&read_on(&project(), &batch, 1, &Ok(Vec::new())).0);
    assert_eq!((nothing.drafts, nothing.pending), (Vec::new(), 0));
}

#[test]
fn a_comment_is_edited_only_when_gitlab_names_an_editor_after_creation() {
    let later = "2026-11-04T09:00:00Z";
    let mut at_creation = comment("anna", 1);
    at_creation["lastEditedBy"] = user("anna");
    let mut resolved = comment("ben", 2);
    resolved["lastEditedAt"] = json!(later);
    let mut edited = comment("chiara", 3);
    edited["lastEditedAt"] = json!(later);
    edited["lastEditedBy"] = user("dmitri");
    let mut no_time = comment("dmitri", 4);
    no_time["lastEditedAt"] = json!(null);
    no_time["lastEditedBy"] = user("dmitri");
    let notes = [comment("sam", 5), at_creation, resolved, edited, no_time];

    let thread = thread(&[open(&notes)]);

    let edits: Vec<Option<(&str, Option<&str>)>> = thread
        .comments
        .iter()
        .map(|comment| comment.edited.as_ref())
        .map(|edit| edit.map(|edit| (edit.at.as_str(), username(Some(&edit.by)))))
        .collect();
    assert_eq!(
        edits,
        [None, None, None, Some((later, Some("dmitri"))), None]
    );
}

#[test]
fn a_comments_html_reaches_the_window_only_as_blocks() {
    let mut note = comment("anna", 1);
    note["body"] = json!("Please **check** <script>alert(1)</script>");
    note["bodyHtml"] = json!(
        r#"<p>Please <strong>check</strong> <b>THIS</b> &amp; <script>alert(1)</script><span style="color:red">that</span></p>"#
    );

    let thread = thread(&[open(&[note])]);

    let body = &thread.comments[0].body;
    let DescriptionBlock::Paragraph { inlines } = &body.blocks[0] else {
        panic!("not a paragraph: {body:?}");
    };
    assert!(
        inlines
            .iter()
            .any(|inline| matches!(inline, DescriptionInline::Strong { .. })),
        "{inlines:?}"
    );
    let sent = serde_json::to_string(&thread.comments).unwrap();
    for markup in ["<", "alert", "color:red", "bodyHtml"] {
        assert!(!sent.contains(markup), "{markup} in {sent}");
    }
    assert_eq!(
        thread.discussion.last.text,
        "Please **check** <script>alert(1)</script>"
    );
}

#[test]
fn a_planted_handler_in_a_comment_is_left_out() {
    let mut note = comment("anna", 1);
    note["bodyHtml"] = json!(concat!(
        r#"<p onclick="yamtPlanted()">x<img src="https://images.example/a.png" onerror="yamtPlanted()"></p>"#,
        r#"<script>yamtPlanted()</script><iframe src="https://evil.example/"></iframe>"#,
        r#"<button onclick="yamtPlanted()">Go planted</button><svg onload="yamtPlanted()"></svg>"#,
    ));

    let (read, _) = read_on(
        &project(),
        &[merge_request(1, &[open(&[note])], None)],
        1,
        &Ok(drafts(&[&[]])),
    );

    let sent = serde_json::to_string(&read.reply).unwrap();
    for planted in [
        "yamtPlanted",
        "onclick",
        "onerror",
        "onload",
        "evil.example",
        "Go planted",
    ] {
        assert!(!sent.contains(planted), "{planted} in {sent}");
    }
    let offered: Vec<&str> = read.pages.iter().map(WebPage::as_str).collect();
    assert!(
        !offered.iter().any(|page| page.contains("evil")),
        "{offered:?}"
    );
}

#[test]
fn a_notes_image_keeps_its_size() {
    let mut note = comment("dmitri", 1);
    note["bodyHtml"] =
        json!(r#"<p><img src="https://images.example/arch.png" alt="arch" height="80"></p>"#);

    let thread = thread(&[open(&[note])]);

    let DescriptionBlock::Paragraph { inlines } = &thread.comments[0].body.blocks[0] else {
        panic!("not a paragraph: {:?}", thread.comments[0].body);
    };
    let height = ImageSize::Height {
        height: ImageLength::Pixels { value: 80 },
    };
    let image_size = |inline: &DescriptionInline| {
        if let DescriptionInline::Image { size, .. } = inline {
            Some(*size)
        } else {
            None
        }
    };
    let sizes: Vec<Option<ImageSize>> = inlines.iter().filter_map(image_size).collect();
    assert_eq!(sizes, [Some(height)]);
}

fn on_gitlab_com() -> Project {
    Project {
        full_path: "taskboard/taskboard".to_owned(),
        web_path: "/taskboard/taskboard".to_owned(),
        web_origin: Some("https://gitlab.com".to_owned()),
    }
}

fn note_page(n: u32) -> String {
    format!("https://gitlab.com/taskboard/taskboard/-/merge_requests/1#note_{n}")
}

/// Anna's note `n` on gitlab.com holding `html`, with her uploaded avatar.
fn annas_note(n: u32, html: &str) -> Value {
    let mut note = comment("anna", n);
    note["url"] = json!(note_page(n));
    note["bodyHtml"] = json!(html);
    note["author"]["avatarUrl"] = json!("/uploads/-/system/user/avatar/2/avatar.png");
    note
}

#[test]
fn a_threads_pages_and_uploads_are_named_once_each_in_order() {
    let secret = "903a1b2c3d4e5f60718293a4b5c6d7e8";
    let upload = format!(r#"<img src="/-/project/7/uploads/{secret}/shot.png">"#);
    let a = r#"<a href="https://docs.example/a">a</a>"#;
    let b = r#"<a href="https://docs.example/b">b</a>"#;
    let notes = [
        annas_note(1, &format!("<p>{a}{upload}</p>")),
        annas_note(2, &format!("<p>{a}{b}{upload}</p>")),
    ];
    let batch = [merge_request(1, &[open(&notes)], None)];

    let (read, _) = read_on(&on_gitlab_com(), &batch, 1, &Ok(drafts(&[&[]])));

    let pages: Vec<&str> = read.pages.iter().map(WebPage::as_str).collect();
    let expected = [
        note_page(1),
        "https://docs.example/a".to_owned(),
        note_page(2),
        "https://docs.example/b".to_owned(),
    ];
    assert_eq!(pages, expected);
    let keys: Vec<&str> = read
        .uploads
        .iter()
        .map(|upload| upload.key.as_str())
        .collect();
    assert_eq!(keys, [format!("upload~{secret}")]);
    let pictures: Vec<&str> = read
        .pictures
        .iter()
        .map(|picture| picture.username.as_str())
        .collect();
    assert_eq!(pictures, ["anna"]);
}

const ROUTE: &str = "projects/group%2Fsub%2Fproject/merge_requests/1";

/// The argv and the body `write` sends for merge request 1 of `group/sub/project`.
fn sent(write: &Write) -> (Vec<String>, Value) {
    let (args, body) = request(write, "group/sub/project", IID);
    (args, serde_json::from_slice(&body).unwrap())
}

fn writing(method: &str, endpoint: &str) -> Vec<String> {
    Vec::from(
        [
            "api",
            "--include",
            "--method",
            method,
            endpoint,
            "--input",
            "-",
        ]
        .map(str::to_owned),
    )
}

#[test]
fn each_write_sends_one_call_with_its_body() {
    let discussion = id(1);
    let text = " Thanks,\n\"done\" ";
    let thread = format!("{ROUTE}/discussions/{}", hex(1));
    let resolve = |resolve| Write::Resolve {
        discussion: &discussion,
        resolve,
    };
    let reply = Write::Reply {
        discussion: &discussion,
        text,
    };
    let draft = Write::DraftReply {
        discussion: &discussion,
        text,
    };

    let notes = writing("POST", &format!("{thread}/notes"));
    assert_eq!(sent(&reply), (notes, json!({ "body": text })));
    let drafted = json!({ "note": text, "in_reply_to_discussion_id": hex(1) });
    let draft_notes = writing("POST", &format!("{ROUTE}/draft_notes"));
    assert_eq!(sent(&draft), (draft_notes, drafted));
    assert_eq!(
        sent(&resolve(true)),
        (writing("PUT", &thread), json!({ "resolved": true }))
    );
    assert_eq!(
        sent(&resolve(false)),
        (writing("PUT", &thread), json!({ "resolved": false }))
    );
    let publish = writing("POST", &format!("{ROUTE}/draft_notes/bulk_publish"));
    assert_eq!(sent(&Write::Submit), (publish, json!({})));
}

#[test]
fn the_drafts_and_the_preview_are_asked_as_gitlab_documents() {
    let drafts = ["api", "--paginate", &format!("{ROUTE}/draft_notes")].map(str::to_owned);
    assert_eq!(draft_notes_args("group/sub/project", IID), drafts);
    let markdown = ["api", "--method", "POST", "markdown", "--input", "-"];
    assert_eq!(markdown_args(), markdown);
    let body = markdown_body("**x** @sam", "group/sub/project");
    let preview: Value = serde_json::from_slice(&body).unwrap();
    let expected = json!({ "text": "**x** @sam", "gfm": true, "project": "group/sub/project" });
    assert_eq!(preview, expected);
}

#[test]
fn an_empty_reply_runs_no_glab() {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    let remote = "https://gitlab.example/taskboard/taskboard.git";
    git_ok(repo.path(), &["remote", "add", "origin", remote]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    let glab = Glab::at(repo.path().join("no-such-glab"));
    let refused = DiscussionWriteReply::Refused {
        reason: NOTHING_TO_SEND.to_owned(),
    };

    for kind in [ReplyKind::Comment, ReplyKind::Draft] {
        for blank in ["", " \n\t "] {
            let reply = reply_to_discussion(&repository, Some(&glab), IID, &id(1), kind, blank);
            assert_eq!(reply, refused);
        }
        let tried = reply_to_discussion(&repository, Some(&glab), IID, &id(1), kind, "x");
        assert!(
            matches!(tried, DiscussionWriteReply::Failed { .. }),
            "{tried:?}"
        );
    }
}

fn http(status: u16, body: &str, glab_line: Option<&str>) -> HttpCall {
    HttpCall::Answered(HttpAnswer {
        status,
        body: body.as_bytes().to_vec(),
        glab_line: glab_line.map(str::to_owned),
    })
}

fn refused(reason: &str) -> DiscussionWriteReply {
    DiscussionWriteReply::Refused {
        reason: reason.to_owned(),
    }
}

fn write_failed(message: &str) -> DiscussionWriteReply {
    DiscussionWriteReply::Failed {
        message: message.to_owned(),
    }
}

#[test]
fn a_4xx_is_refused_with_gitlabs_reason() {
    let forbidden = http(
        403,
        r#"{"message":"403 Forbidden"}"#,
        Some("glab: 403 Forbidden (HTTP 403)"),
    );
    let missing = http(
        400,
        r#"{"error":"note is missing"}"#,
        Some("glab: note is missing (HTTP 400)"),
    );
    let silent = http(404, "", Some("glab: 404 Not Found (HTTP 404)"));

    assert_eq!(replied(forbidden), (refused("403 Forbidden"), Some(403)));
    assert_eq!(replied(missing), (refused("note is missing"), Some(400)));
    assert_eq!(
        replied(silent),
        (refused("glab: 404 Not Found (HTTP 404)"), Some(404))
    );
    assert_eq!(
        replied(http(499, "", None)),
        (refused("HTTP 499"), Some(499))
    );
    for status in [200, 201, 204, 299] {
        assert_eq!(
            replied(http(status, "not read", None)),
            (DiscussionWriteReply::Sent, Some(status))
        );
    }
}

#[test]
fn no_http_answer_or_a_5xx_fails() {
    let timed_out = HttpCall::NotAnswered("glab: timed out".to_owned());
    let broken = http(500, r#"{"message":"500 Internal Server Error"}"#, None);

    assert_eq!(replied(timed_out), (write_failed("glab: timed out"), None));
    assert_eq!(
        replied(broken),
        (write_failed("500 Internal Server Error"), Some(500))
    );
    assert_eq!(
        replied(http(399, "", None)),
        (write_failed("HTTP 399"), Some(399))
    );
    assert_eq!(
        replied(http(302, "", Some("glab: HTTP 302"))),
        (write_failed("glab: HTTP 302"), Some(302))
    );
}

#[test]
fn the_logs_name_each_outcome_by_its_kind() {
    let threads = [
        DiscussionThreadReply::Read {
            thread: thread(&[open(&[comment("anna", 1)])]),
        },
        DiscussionThreadReply::NotFound,
        DiscussionThreadReply::GlabMissing,
        DiscussionThreadReply::NotLoggedIn {
            detail: String::new(),
        },
        failed(""),
    ];
    for reply in threads {
        let serialized = serde_json::to_value(&reply).unwrap();
        assert_eq!(serialized["kind"], read::outcome(&reply));
    }
    let writes = [
        DiscussionWriteReply::Sent,
        refused(""),
        DiscussionWriteReply::GlabMissing,
        DiscussionWriteReply::NotLoggedIn {
            detail: String::new(),
        },
        write_failed(""),
    ];
    for reply in writes {
        let serialized = serde_json::to_value(&reply).unwrap();
        assert_eq!(serialized["kind"], write::outcome(&reply));
    }
}

#[test]
fn the_log_names_each_write_by_its_kind() {
    let discussion = id(1);
    let resolve = |resolve| Write::Resolve {
        discussion: &discussion,
        resolve,
    };
    let reply = Write::Reply {
        discussion: &discussion,
        text: "",
    };
    let draft = Write::DraftReply {
        discussion: &discussion,
        text: "",
    };
    let kinds = [
        &reply,
        &draft,
        &resolve(true),
        &resolve(false),
        &Write::Submit,
    ]
    .map(write::kind);
    assert_eq!(
        kinds,
        ["comment", "draft", "resolve", "unresolve", "submit"]
    );
}
