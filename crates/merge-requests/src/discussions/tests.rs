use serde_json::{Value, json};

use super::*;
use crate::page::NO_PROJECT;
use crate::picture::{AvatarSource, avatar_source};

const ORIGIN: &str = "https://gitlab.example";
const ANNA_S_AVATAR: &str = "/uploads/-/system/user/avatar/2/avatar.png";

fn project() -> Project {
    Project {
        full_path: "taskboard/taskboard".to_owned(),
        web_path: "/taskboard/taskboard".to_owned(),
        web_origin: Some(ORIGIN.to_owned()),
    }
}

fn iids(numbers: &[u32]) -> Vec<MergeRequestIid> {
    numbers
        .iter()
        .map(|&number| MergeRequestIid(number))
        .collect()
}

/// A person's note on the merge request itself, its body naming its author and `n`.
fn comment(username: &str, n: u32) -> Value {
    json!({
        "system": false,
        "author": { "username": username, "name": format!("{username} name"), "avatarUrl": null },
        "body": format!("{username} {n}"),
        "createdAt": format!("2026-11-03T10:00:0{n}Z"),
        "url": format!("https://gitlab.example/taskboard/taskboard/-/merge_requests/1#note_{n}"),
        "position": null,
    })
}

fn system_note(n: u32) -> Value {
    let mut note = comment("pusher", n);
    note["system"] = json!(true);
    note
}

fn on_file(mut note: Value, new_line: Option<u32>, old_line: Option<u32>) -> Value {
    note["position"] =
        json!({ "filePath": "src/card.ts", "newLine": new_line, "oldLine": old_line });
    note
}

fn discussion(resolvable: bool, resolved: bool, notes: &[Value], earlier: bool) -> Value {
    json!({
        "resolvable": resolvable,
        "resolved": resolved,
        "notes": { "pageInfo": { "hasPreviousPage": earlier }, "nodes": notes },
    })
}

fn open(notes: &[Value]) -> Value {
    discussion(true, false, notes, false)
}

fn merge_request(iid: u32, discussions: &[Value], next: Option<&str>) -> Value {
    json!({
        "iid": iid.to_string(),
        "discussions": {
            "pageInfo": { "hasNextPage": next.is_some(), "endCursor": next },
            "nodes": discussions,
        },
    })
}

fn answer(merge_requests: &[Value]) -> Vec<u8> {
    let data = json!({
        "queryComplexity": { "score": 58, "limit": 250 },
        "project": { "mergeRequests": { "nodes": merge_requests } },
    });
    json!({ "data": data }).to_string().into_bytes()
}

/// The rows `answered` gives for `asked` when the batch's call answers `batch` and no later page is asked.
fn rows_for(asked: &[u32], batch: &[Value]) -> Vec<RowDiscussions> {
    let mut fetch = |_: &[MergeRequestIid], after: Option<&str>| {
        assert_eq!(after, None);
        Ok(answer(batch))
    };
    answered(&iids(asked), &project(), &mut fetch).0.rows
}

/// The open discussions of the one row asked.
fn open_of(batch: &[Value]) -> Vec<OpenDiscussion> {
    let rows = rows_for(&[1], batch);
    let [row] = rows.as_slice() else {
        panic!("not one row: {rows:?}");
    };
    let DiscussionsAnswer::Open { discussions } = &row.answer else {
        panic!("not open: {row:?}");
    };
    discussions.clone()
}

fn texts(discussions: &[OpenDiscussion]) -> Vec<&str> {
    discussions
        .iter()
        .map(|open| open.last.text.as_str())
        .collect()
}

fn failed(message: &str) -> DiscussionsAnswer {
    DiscussionsAnswer::Failed {
        message: message.to_owned(),
    }
}

#[test]
fn a_system_note_after_the_last_reply_is_skipped() {
    let notes = [comment("anna", 1), comment("ben", 2), system_note(3)];

    let discussions = open_of(&[merge_request(1, &[open(&notes)], None)]);

    assert_eq!(texts(&discussions), ["ben 2"]);
}

#[test]
fn a_system_note_between_replies_is_skipped() {
    let notes = [
        on_file(comment("anna", 1), Some(4), None),
        on_file(system_note(2), Some(4), None),
        on_file(comment("sam", 3), Some(4), None),
    ];

    let discussions = open_of(&[merge_request(1, &[open(&notes)], None)]);

    assert_eq!(texts(&discussions), ["sam 3"]);
    let last = &discussions[0].last;
    let author = last.author.as_ref().map(|person| person.username.as_str());
    assert_eq!(author, Some("sam"));
    assert_eq!(last.created_at, "2026-11-03T10:00:03Z");
    let page = last.page.as_ref().map(WebPage::as_str);
    let address = "https://gitlab.example/taskboard/taskboard/-/merge_requests/1#note_3";
    assert_eq!(page, Some(address));
}

#[test]
fn resolved_and_unresolvable_discussions_are_left_out() {
    let discussions = [
        discussion(true, true, &[comment("anna", 1)], false),
        discussion(false, false, &[comment("ben", 2)], false),
        discussion(false, false, &[system_note(3)], false),
        open(&[comment("chiara", 4)]),
        discussion(false, true, &[comment("dmitri", 5)], false),
    ];

    let open = open_of(&[merge_request(1, &discussions, None)]);

    assert_eq!(texts(&open), ["chiara 4"]);
}

#[test]
fn a_note_without_position_is_the_overview() {
    let open = open_of(&[merge_request(1, &[open(&[comment("anna", 1)])], None)]);

    assert_eq!(open[0].place, DiscussionPlace::Overview);
}

#[test]
fn a_diff_place_takes_the_new_line_else_the_old() {
    let discussions = [
        open(&[on_file(comment("anna", 1), Some(4), Some(3))]),
        open(&[on_file(comment("anna", 2), None, Some(3))]),
        open(&[on_file(comment("anna", 3), None, None)]),
    ];

    let open = open_of(&[merge_request(1, &discussions, None)]);

    let file = |line| DiscussionPlace::File {
        path: "src/card.ts".to_owned(),
        line,
    };
    let places: Vec<&DiscussionPlace> = open.iter().map(|open| &open.place).collect();
    assert_eq!(places, [&file(Some(4)), &file(Some(3)), &file(None)]);
}

#[test]
fn twenty_system_notes_with_earlier_ones_fail_the_row() {
    let system_notes: Vec<Value> = (1..=20).map(system_note).collect();
    let cut = discussion(true, false, &system_notes, true);
    let whole = discussion(true, false, &system_notes, false);
    let batch = [
        merge_request(1, &[open(&[comment("anna", 1)]), cut], None),
        merge_request(2, &[whole, open(&[comment("ben", 2)])], None),
    ];

    let rows = rows_for(&[1, 2], &batch);

    let message = "a discussion's last 20 notes are all GitLab's own; yamt reads no further";
    assert_eq!(rows[0].answer, failed(message));
    let DiscussionsAnswer::Open { discussions } = &rows[1].answer else {
        panic!("not open: {:?}", rows[1]);
    };
    assert_eq!(texts(discussions), ["ben 2"]);
}

#[test]
fn an_iid_gitlab_does_not_name_fails_alone() {
    let batch = [merge_request(82, &[open(&[comment("anna", 1)])], None)];

    let rows = rows_for(&[82, 78], &batch);

    assert!(matches!(rows[0].answer, DiscussionsAnswer::Open { .. }));
    assert_eq!(rows[1].iid, MergeRequestIid(78));
    assert_eq!(rows[1].answer, failed("GitLab sent no merge request !78"));
}

#[test]
fn graphql_errors_fail_each_row_of_the_batch() {
    let refused = json!({ "data": null, "errors": [{ "message": "Field 'x' doesn't exist" }] });
    let mut fetch = |_: &[MergeRequestIid], _: Option<&str>| Ok(refused.to_string().into_bytes());

    let (read, complexity) = answered(&iids(&[2, 1]), &project(), &mut fetch);

    let answer = failed("Field 'x' doesn't exist");
    let expected = [
        RowDiscussions {
            iid: MergeRequestIid(2),
            answer: answer.clone(),
        },
        RowDiscussions {
            iid: MergeRequestIid(1),
            answer,
        },
    ];
    assert_eq!(read.rows, expected);
    assert_eq!(complexity, None);
}

#[test]
fn a_failed_batch_call_fails_each_row_with_glab_s_words() {
    let mut fetch = |_: &[MergeRequestIid], _: Option<&str>| Err("glab: timed out".to_owned());

    let (read, _) = answered(&iids(&[2, 1]), &project(), &mut fetch);

    let answers: Vec<&DiscussionsAnswer> = read.rows.iter().map(|row| &row.answer).collect();
    assert_eq!(answers, [&failed("glab: timed out"); 2]);
}

#[test]
fn the_batch_answers_gitlab_s_complexity() {
    let mut fetch =
        |_: &[MergeRequestIid], _: Option<&str>| Ok(answer(&[merge_request(1, &[], None)]));

    let (_, complexity) = answered(&iids(&[1]), &project(), &mut fetch);

    let measured = Complexity {
        score: 58,
        limit: 250,
    };
    assert_eq!(complexity, Some(measured));
}

#[test]
fn the_batch_is_the_first_twenty_distinct_iids_in_order() {
    let mut asked = vec![5, 3, 5];
    asked.extend(100..130);

    let cut = batch(&iids(&asked));

    let mut expected = vec![5, 3];
    expected.extend(100..118);
    assert_eq!(cut, iids(&expected));
    assert_eq!(batch(&iids(&[2, 2, 2])), iids(&[2]));
    let unread = unread_discussions(&iids(&asked), "no project");
    let unread_iids: Vec<MergeRequestIid> = unread.iter().map(|row| row.iid).collect();
    assert_eq!(unread_iids, iids(&expected));
    assert!(unread.iter().all(|row| row.answer == failed("no project")));
}

#[test]
fn an_uploaded_avatar_is_offered_once_per_username() {
    let mut anna = comment("anna", 1);
    anna["author"]["avatarUrl"] = json!(ANNA_S_AVATAR);
    let mut ben = comment("ben", 2);
    ben["author"]["avatarUrl"] = json!("https://secure.gravatar.com/avatar/00?s=80&d=identicon");
    let batch = [
        merge_request(1, &[open(&[anna.clone()]), open(&[ben])], None),
        merge_request(2, &[open(&[anna])], None),
    ];
    let mut fetch = |_: &[MergeRequestIid], _: Option<&str>| Ok(answer(&batch));

    let (read, _) = answered(&iids(&[1, 2]), &project(), &mut fetch);

    let AvatarSource::Uploaded(address) = avatar_source(Some(ORIGIN), Some(ANNA_S_AVATAR)) else {
        panic!("{ANNA_S_AVATAR} is no uploaded avatar");
    };
    let username = "anna".to_owned();
    assert_eq!(read.pictures, [OfferedPicture { username, address }]);
}

/// Merge request 1's discussions over `pages` pages, each holding one open discussion `n` and naming `d-<n+1>` as
/// the next but the last; the rows and every cursor asked after.
fn paged(pages: u32) -> (Vec<RowDiscussions>, Vec<Option<String>>) {
    let page = |n: u32| {
        let next = (n < pages).then(|| format!("d-{}", n + 1));
        answer(&[merge_request(
            1,
            &[open(&[comment("anna", n)])],
            next.as_deref(),
        )])
    };
    let mut asked = Vec::new();
    let mut fetch = |iids: &[MergeRequestIid], after: Option<&str>| {
        asked.push(after.map(str::to_owned));
        let n = after.map_or(1, |cursor| cursor["d-".len()..].parse().unwrap());
        if n > 1 {
            assert_eq!(iids, [MergeRequestIid(1)]);
        }
        Ok(page(n))
    };
    let rows = answered(&iids(&[1]), &project(), &mut fetch).0.rows;
    (rows, asked)
}

#[test]
fn later_discussion_pages_are_read_up_to_the_tenth() {
    let (rows, asked) = paged(10);

    let DiscussionsAnswer::Open { discussions } = &rows[0].answer else {
        panic!("not open: {rows:?}");
    };
    assert_eq!(discussions.len(), 10);
    assert_eq!(asked.len(), 10);
    assert_eq!(asked[1].as_deref(), Some("d-2"));
}

#[test]
fn more_than_ten_discussion_pages_fail_the_row_without_an_eleventh_call() {
    let (rows, asked) = paged(11);

    assert_eq!(rows[0].answer, failed("more than 1,000 discussions"));
    assert_eq!(asked.len(), 10);
    assert_eq!(MAX_DISCUSSION_PAGES * DISCUSSIONS_PER_PAGE, 1_000);
}

#[test]
fn a_failing_later_page_fails_its_row_alone() {
    let batch = [
        merge_request(1, &[], Some("d-2")),
        merge_request(2, &[open(&[comment("ben", 2)])], None),
        merge_request(3, &[], Some("d-2")),
    ];
    let mut fetch = |iids: &[MergeRequestIid], after: Option<&str>| match after {
        None => Ok(answer(&batch)),
        Some(_) if iids == [MergeRequestIid(1)] => Err("glab: page 2 failed".to_owned()),
        Some(_) => Ok(answer(&[])),
    };

    let rows = answered(&iids(&[1, 2, 3]), &project(), &mut fetch).0.rows;

    assert_eq!(rows[0].answer, failed("glab: page 2 failed"));
    assert!(matches!(rows[1].answer, DiscussionsAnswer::Open { .. }));
    assert_eq!(rows[2].answer, failed("GitLab sent no merge request !3"));
}

#[test]
fn more_discussions_without_a_cursor_fail_the_row() {
    let mut batch = merge_request(1, &[], None);
    batch["discussions"]["pageInfo"]["hasNextPage"] = json!(true);

    let rows = rows_for(&[1], &[batch]);

    let message = "GitLab says more discussions follow, but sent no cursor for them";
    assert_eq!(rows[0].answer, failed(message));
}

#[test]
fn a_note_url_gitlab_does_not_build_gives_no_page() {
    let mut elsewhere = comment("anna", 1);
    elsewhere["url"] = json!("https://evil.example/x#note_1");
    let mut none = comment("ben", 2);
    none["url"] = json!(null);

    let open = open_of(&[merge_request(1, &[open(&[elsewhere]), open(&[none])], None)]);

    let pages: Vec<Option<&WebPage>> = open.iter().map(|open| open.last.page.as_ref()).collect();
    assert_eq!(pages, [None, None]);
}

#[test]
fn no_project_in_the_answer_fails_each_row() {
    let refused = json!({ "data": { "queryComplexity": null, "project": null } });
    let mut fetch = |_: &[MergeRequestIid], _: Option<&str>| Ok(refused.to_string().into_bytes());

    let rows = answered(&iids(&[1]), &project(), &mut fetch).0.rows;

    assert_eq!(rows[0].answer, failed(NO_PROJECT));
}

/// The fake glab on `tests/glab/mr-discussions/` through a symlink beside its `glab.env` (`tests/glab/README.md`).
#[cfg(unix)]
#[test]
fn each_query_of_a_call_is_counted_and_the_batch_s_complexity_kept() {
    let folder = tempfile::tempdir().unwrap();
    let repository = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let scenario = repository.join("tests/glab/mr-discussions");
    let settings = format!("YAMT_FAKE_GLAB={}\n", scenario.display());
    std::fs::write(folder.path().join("glab.env"), settings).unwrap();
    let link = folder.path().join("glab");
    std::os::unix::fs::symlink(repository.join("scripts/fake-glab/glab"), &link).unwrap();
    let mut tally = Tally::default();

    let read = through_glab(
        folder.path(),
        Some(&Glab::at(link)),
        &iids(&[82, 81, 79, 78]),
        &mut tally,
    );

    assert_eq!(read.rows.len(), 4);
    assert_eq!(tally.queries, 2);
    let measured = Complexity {
        score: 58,
        limit: 250,
    };
    assert_eq!(tally.complexity, Some(measured));
}
