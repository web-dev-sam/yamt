#![cfg(test)]
#![cfg(unix)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod fake_glab;

use std::fs;
use std::sync::mpsc;

use serde_json::{Value, json};
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_merge_requests::{
    DescriptionReply, GitLabRepository, ImageKind, ListedPage, MergeRequestIid, ReadDescription,
    WebPage, fetch_picture, gitlab_repository, list_merge_requests, read_description,
};

use fake_glab::{Fake, in_this_repository};

const GITLAB_REMOTE: &str = "https://gitlab.com/taskboard/taskboard.git";
const SCENARIO: &str = "mr-description";
const SELF_MANAGED_SCENARIO: &str = "mr-description/self-managed";
const PROJECT: &str = "https://gitlab.com/taskboard/taskboard";
const HEX_A: &str = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const HEX_B: &str = "f9e8d7c6b5a4938271605f4e3d2c1b0a";
const HEX_C: &str = "1111aaaa2222bbbb3333cccc4444dddd";
const HEX_REDIRECTED_BY_API: &str = "2222cccc3333dddd4444eeee5555ffff";
const HEX_REDIRECTED_ON_WEB: &str = "6666aaaa7777bbbb8888cccc9999dddd";
const DESCRIPTION_QUERY: &str = "query=query MergeRequestDescription($fullPath: ID!, $iid: String!) { \
     project(fullPath: $fullPath) { mergeRequest(iid: $iid) { descriptionHtml } } }";

/// A repository whose `origin` is on gitlab.com, and its `GitLabRepository`.
fn gitlab_repo() -> (TempDir, GitLabRepository) {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    let repository = gitlab_repository(repo.path()).unwrap();
    (repo, repository)
}

fn read(fake: &Fake, repository: &GitLabRepository, iid: u32) -> ReadDescription {
    read_description(repository, Some(&fake.glab), MergeRequestIid(iid))
}

/// The reply as the window gets it.
fn sent(reply: &DescriptionReply) -> Value {
    serde_json::to_value(reply).unwrap()
}

fn failed(message: &str) -> DescriptionReply {
    DescriptionReply::Failed {
        message: message.to_owned(),
    }
}

fn scenario_file(path: &str) -> Vec<u8> {
    fs::read(in_this_repository(&format!("tests/glab/{SCENARIO}/{path}"))).unwrap()
}

/// The pages !52's links lead to, in document order.
fn pages_of_52() -> [String; 7] {
    [
        "https://docs.example/x".to_owned(),
        "http://plain.example/".to_owned(),
        format!("{PROJECT}/-/issues/12"),
        "https://gitlab.com/anna".to_owned(),
        format!("{PROJECT}/-/commit/9c1ba3f2e4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9"),
        format!("{PROJECT}/-/merge_requests?label_name=frontend"),
        format!("{PROJECT}/-/merge_requests/52#section"),
    ]
}

#[test]
fn a_description_comes_back_with_its_pages_and_uploads() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &repository, 52);

    let reply = sent(&read.reply);
    assert_eq!(reply["kind"], "read");
    let blocks = reply["description"]["blocks"].as_array().unwrap();
    let kinds: Vec<&str> = blocks
        .iter()
        .map(|block| block["kind"].as_str().unwrap())
        .collect();
    let expected_kinds = "heading heading heading paragraph code code code paragraph list list list table quote \
         rule details paragraph paragraph";
    assert_eq!(kinds.join(" "), expected_kinds);
    let ruby = json!({ "kind": "code", "language": "ruby", "text": "Label.colour(:red)\nend" });
    assert_eq!(blocks[4], ruby);
    let pages: Vec<&str> = read.pages.iter().map(WebPage::as_str).collect();
    assert_eq!(pages, pages_of_52());
    let uploads: Vec<String> = read
        .uploads
        .iter()
        .map(|offered| format!("{} {}", offered.key.as_str(), offered.address.as_str()))
        .collect();
    let upload = |secret: &str, file: &str| {
        format!("upload~{secret} https://gitlab.com/-/project/7/uploads/{secret}/{file}")
    };
    let expected_uploads = [
        upload(HEX_A, "shot.png"),
        upload(HEX_B, "old.png"),
        upload(HEX_C, "gone.png"),
    ];
    assert_eq!(uploads, expected_uploads);
    let asked = format!(
        "argv: api graphql -f {DESCRIPTION_QUERY} -f fullPath=taskboard/taskboard -f iid=52"
    );
    assert_eq!(fake.logged("argv: api graphql"), [asked]);
}

#[test]
fn an_upload_is_fetched_with_the_login_through_the_uploads_api() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let read = read(&fake, &repository, 52);

    let picture = fetch_picture(&fake.glab, repository.root(), &read.uploads[0].address).unwrap();

    let shot = scenario_file(&format!("uploads/7/uploads/{HEX_A}/shot.png"));
    assert_eq!((picture.kind, picture.bytes), (ImageKind::Png, shot));
    let argv = fake.logged("argv: ");
    let rest = format!("argv: api projects/7/uploads/{HEX_A}/shot.png");
    assert_eq!(argv.last(), Some(&rest));
    let is_a_write = |line: &&String| {
        ["-X", "--method", "--input"]
            .iter()
            .any(|flag| line.contains(flag))
    };
    assert_eq!(argv.iter().find(is_a_write), None);
}

#[test]
fn an_upload_the_api_does_not_know_is_fetched_on_its_web_path() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let read = read(&fake, &repository, 52);

    let picture = fetch_picture(&fake.glab, repository.root(), &read.uploads[1].address).unwrap();

    let old = scenario_file(&format!("pictures/-/project/7/uploads/{HEX_B}/old.png"));
    assert_eq!(picture.bytes, old);
    let argv = fake.logged("argv: ");
    let asked = [
        format!("argv: api projects/7/uploads/{HEX_B}/old.png"),
        format!("argv: api https://gitlab.com/-/project/7/uploads/{HEX_B}/old.png"),
    ];
    assert_eq!(argv[argv.len() - 2..], asked);
}

#[test]
fn an_upload_missing_on_both_routes_is_an_error() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let read = read(&fake, &repository, 52);

    let fetched = fetch_picture(&fake.glab, repository.root(), &read.uploads[2].address);

    assert!(fetched.is_err(), "{fetched:?}");
    let answered = fake.logged("answered: ");
    let both = [
        format!("answered: projects/7/uploads/{HEX_C}/gone.png"),
        format!("answered: https://gitlab.com/-/project/7/uploads/{HEX_C}/gone.png"),
    ];
    assert_eq!(answered, both);
}

#[test]
fn a_redirect_on_either_route_is_refused_and_never_retried() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let read = read(&fake, &repository, 53);

    let fetched: Vec<_> = read
        .uploads
        .iter()
        .map(|offered| fetch_picture(&fake.glab, repository.root(), &offered.address))
        .collect();

    let redirected = Err("glab: HTTP 302".to_owned());
    assert_eq!(fetched, [redirected.clone(), redirected]);
    let answered = fake.logged("answered: ");
    let asked = [
        format!("answered: projects/7/uploads/{HEX_REDIRECTED_BY_API}/moved.png"),
        format!("answered: projects/7/uploads/{HEX_REDIRECTED_ON_WEB}/moved.png"),
        format!(
            "answered: https://gitlab.com/-/project/7/uploads/{HEX_REDIRECTED_ON_WEB}/moved.png"
        ),
    ];
    assert_eq!(answered, asked);
}

#[test]
fn another_sites_image_never_reaches_glab() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let read = read(&fake, &repository, 52);

    for offered in &read.uploads {
        let _ = fetch_picture(&fake.glab, repository.root(), &offered.address);
    }

    let reply = sent(&read.reply).to_string();
    for site in ["images.example", "evil.example"] {
        assert!(reply.contains(site), "the tree names {site}");
    }
    let argv = fake.logged("argv: ");
    for site in ["images.example", "evil.example", "plain.example"] {
        let named = argv.iter().find(|line| line.contains(site));
        assert_eq!(named, None, "{site}");
    }
}

#[test]
fn an_upload_on_a_self_managed_server_is_a_web_image_never_fetched_with_the_login() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SELF_MANAGED_SCENARIO);

    let read = read(&fake, &repository, 52);
    for offered in &read.uploads {
        let _ = fetch_picture(&fake.glab, repository.root(), &offered.address);
    }

    assert!(read.uploads.is_empty(), "{:?}", read.uploads);
    let web = |address: String| json!({ "kind": "web", "address": address });
    let images = [
        web(format!(
            "https://gitlab.example/-/project/7/uploads/{HEX_A}/shot.png"
        )),
        web(format!(
            "https://gitlab.example/taskboard/taskboard/uploads/{HEX_B}/old.png"
        )),
    ];
    let inlines = &sent(&read.reply)["description"]["blocks"][0]["inlines"];
    assert_eq!(
        [&inlines[0]["image"], &inlines[1]["image"]],
        images.each_ref()
    );
    let argv = fake.logged("argv: ");
    let fetched = argv.iter().find(|line| line.contains("/uploads/"));
    assert_eq!(fetched, None, "{argv:#?}");
}

#[test]
fn an_empty_description_has_no_blocks() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &repository, 51);

    assert_eq!(
        sent(&read.reply),
        json!({ "kind": "read", "description": { "blocks": [] } })
    );
    assert!(read.pages.is_empty() && read.uploads.is_empty());
}

#[test]
fn a_descriptions_images_carry_the_size_gitlab_kept() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &repository, 54);

    let reply = sent(&read.reply);
    let images: Vec<Value> = reply["description"]["blocks"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|block| block["inlines"].as_array().unwrap())
        .filter(|inline| inline["kind"] == "image")
        .map(|image| json!({ "address": image["image"]["address"], "size": image["size"] }))
        .collect();
    let pixels = |value: u16| json!({ "kind": "pixels", "value": value });
    let percent = |value: u16| json!({ "kind": "percent", "value": value });
    let sized = |name: &str, size: Value| json!({ "address": format!("https://images.example/{name}.png"), "size": size });
    let expected = [
        sized("w300", json!({ "kind": "width", "width": pixels(300) })),
        sized("w40", json!({ "kind": "width", "width": percent(40) })),
        sized("h80", json!({ "kind": "height", "height": pixels(80) })),
        sized(
            "w200h100",
            json!({ "kind": "both", "width": pixels(200), "height": pixels(100) }),
        ),
        sized("w5000", json!({ "kind": "width", "width": pixels(5000) })),
        sized("wabc", Value::Null),
        sized("w12345", Value::Null),
        sized("h50", json!({ "kind": "height", "height": percent(50) })),
        sized("plain", Value::Null),
    ];
    assert_eq!(images, expected);
}

#[test]
fn the_planted_description_keeps_only_text_and_safe_pieces() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &repository, 50);

    let reply = sent(&read.reply).to_string();
    for planted in [
        "yamtPlanted",
        "evil.example",
        "display",
        "onerror",
        "onclick",
        "Go planted",
        "deepest",
    ] {
        assert!(!reply.contains(planted), "{planted} in {reply}");
    }
    for kept in ["before", "relative link", "\"text\"", "after"] {
        assert!(reply.contains(kept), "{kept} missing in {reply}");
    }
    let relative = format!("{PROJECT}/-/merge_requests/relative");
    let pages: Vec<&str> = read.pages.iter().map(WebPage::as_str).collect();
    assert_eq!(pages, [relative.as_str()]);
    assert_eq!(read.uploads.len(), 0);
}

#[test]
fn a_failed_read_keeps_glabs_words() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &repository, 49);

    assert_eq!(read.reply, failed("glab: a deadline line"));
    assert!(read.pages.is_empty() && read.uploads.is_empty());
}

#[test]
fn a_missing_merge_request_fails() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &repository, 48);

    assert_eq!(read.reply, failed("GitLab's answer names no merge request"));
}

#[test]
fn glab_missing_or_logged_out_answers_before_any_query() {
    let (_repo, repository) = gitlab_repo();

    let missing = read_description(&repository, None, MergeRequestIid(52));
    assert_eq!(missing.reply, DescriptionReply::GlabMissing);
    assert!(missing.pages.is_empty() && missing.uploads.is_empty());

    let fake = Fake::new("logged-out");
    let logged_out = read(&fake, &repository, 52);
    let detail = "gitlab.com".to_owned();
    assert_eq!(logged_out.reply, DescriptionReply::NotLoggedIn { detail });
    assert_eq!(fake.logged("argv: "), ["argv: auth status"]);
}

#[test]
fn the_list_says_which_rows_have_a_description() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);
    let (sender, sent_pages) = mpsc::channel();

    list_merge_requests(&repository, Some(&fake.glab), &|listed: ListedPage| {
        sender.send(listed.page).unwrap();
    });

    let page = sent_pages.recv().unwrap();
    let described: Vec<(u32, bool)> = page
        .rows
        .iter()
        .map(|row| (row.iid.0, row.has_description))
        .collect();
    let expected = [
        (52, true),
        (51, true),
        (50, true),
        (49, true),
        (48, true),
        (47, false),
        (46, false),
    ];
    assert_eq!(described, expected);
    let asked = fake.logged("argv: api graphql");
    assert!(
        asked[0].contains(" iid title description createdAt "),
        "{}",
        asked[0]
    );
}

#[test]
fn reading_a_description_writes_nothing() {
    let (_repo, repository) = gitlab_repo();
    let fake = Fake::new(SCENARIO);

    let read = read(&fake, &repository, 52);
    for offered in &read.uploads {
        let _ = fetch_picture(&fake.glab, repository.root(), &offered.address);
    }

    assert_eq!(fake.logged("stdin: "), Vec::<String>::new());
    let is_a_read = |line: &String| {
        let upload = line.contains("/uploads/") && line.matches(' ').count() == 2;
        line == "argv: auth status"
            || line == "argv: api projects/:fullpath"
            || line.starts_with("argv: api graphql -f ")
            || (line.starts_with("argv: api ") && upload)
    };
    let argv = fake.logged("argv: ");
    assert_eq!(argv.len(), 3 + 1 + 2 + 2, "{argv:#?}");
    for line in argv {
        assert!(is_a_read(&line), "{line}");
    }
}
