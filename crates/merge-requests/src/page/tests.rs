use serde_json::{Value, json};

use super::*;

const ORIGIN: &str = "https://gitlab.example";
const FULL_PATH: &str = "taskboard/taskboard";
const PAGE_1: &[u8] = include_bytes!("../../../../tests/glab/merge-requests/graphql-page-1.json");
const PAGE_2: &[u8] = include_bytes!("../../../../tests/glab/merge-requests/graphql-page-2.json");

fn person(username: &str, name: &str) -> Person {
    Person {
        username: username.to_owned(),
        name: name.to_owned(),
    }
}

fn taskboard(web_origin: Option<&str>) -> Project {
    Project {
        full_path: FULL_PATH.to_owned(),
        web_origin: web_origin.map(str::to_owned),
    }
}

fn job(name: &str, allow_failure: bool, id: u32) -> FailedJob {
    let page = format!("https://gitlab.example/taskboard/taskboard/-/jobs/{id}");
    FailedJob {
        name: name.to_owned(),
        stage: "test".to_owned(),
        allow_failure,
        page: Some(WebPage(page)),
    }
}

/// !13 of the recorded first page.
fn snooze_a_reminder() -> MergeRequestRow {
    let failed = Pipeline {
        status: CiStatus::Failed,
        failed_jobs: vec![job("lint", true, 302), job("unit tests", false, 301)],
        more_failed_jobs: false,
    };
    MergeRequestRow {
        iid: MergeRequestIid(13),
        title: "Snooze a reminder".to_owned(),
        created_at: "2026-10-28T09:15:00Z".to_owned(),
        draft: false,
        assignees: vec![person("sam", "Sam Doe")],
        reviewers: vec![person("anna", "Anna Berg")],
        labels: vec!["reminders".to_owned(), "ui".to_owned()],
        open_discussions: 0,
        approvals: 0,
        pipeline: Some(failed),
        page: Some(WebPage(
            "https://gitlab.example/taskboard/taskboard/-/merge_requests/13".to_owned(),
        )),
    }
}

fn answer(nodes: &Value, page_info: &Value) -> Vec<u8> {
    let page = json!({ "data": { "currentUser": null, "project": { "mergeRequests": {
        "pageInfo": page_info, "nodes": nodes } } } });
    page.to_string().into_bytes()
}

fn last_page_of(nodes: &Value) -> Result<ParsedPage, String> {
    let page_info = json!({ "hasNextPage": false, "endCursor": null });
    parsed(&answer(nodes, &page_info), &taskboard(Some(ORIGIN)))
}

fn status_of(row: &MergeRequestRow) -> Option<CiStatus> {
    row.pipeline.as_ref().map(|pipeline| pipeline.status)
}

#[test]
fn a_recorded_page_gives_its_rows_the_user_the_cursor_and_the_complexity() {
    let page = parsed(PAGE_1, &taskboard(Some(ORIGIN))).unwrap();

    assert_eq!(page.me.as_deref(), Some("sam"));
    assert_eq!(page.next.as_deref(), Some("page-2"));
    let complexity = Complexity {
        score: 112,
        limit: 250,
    };
    assert_eq!(page.complexity, Some(complexity));
    let iids: Vec<u32> = page.rows.iter().map(|row| row.iid.0).collect();
    assert_eq!(iids, [13, 12, 11]);
    assert_eq!(page.rows[0], snooze_a_reminder());
    let passed = &page.rows[1];
    assert_eq!((passed.open_discussions, passed.approvals), (1, 2));
    assert_eq!(status_of(passed), Some(CiStatus::Passed));
    let draft = &page.rows[2];
    assert!(draft.draft);
    assert_eq!(draft.title, "Draft: Move reminders to the settings page");
}

#[test]
fn the_last_page_has_no_cursor_and_a_row_without_a_pipeline_has_none() {
    let page = parsed(PAGE_2, &taskboard(Some(ORIGIN))).unwrap();

    assert_eq!(page.next, None);
    assert_eq!(page.rows[0].pipeline, None);
    assert_eq!(status_of(&page.rows[1]), Some(CiStatus::Manual));
    assert_eq!(page.rows[1].approvals, 1);
}

#[test]
fn without_an_https_origin_no_row_and_no_job_has_a_page() {
    let page = parsed(PAGE_1, &taskboard(None)).unwrap();

    let pipeline = page.rows[0].pipeline.as_ref().unwrap();
    let pages: Vec<_> = pipeline.failed_jobs.iter().map(|job| &job.page).collect();
    assert_eq!(pages, [&None, &None]);
    assert!(page.rows.iter().all(|row| row.page.is_none()));
}

#[test]
fn null_fields_are_empty_or_zero_and_more_failed_jobs_than_asked_are_flagged() {
    let node = json!({ "iid": "4", "title": "t", "createdAt": "2026-01-01T00:00:00Z", "draft": false,
        "labels": null, "assignees": null, "reviewers": null, "approvedBy": null,
        "resolvableDiscussionsCount": null, "resolvedDiscussionsCount": null,
        "headPipeline": { "status": "CANCELING", "jobs": { "pageInfo": { "hasNextPage": true },
            "nodes": [{ "name": "e2e", "allowFailure": false, "webPath": "/a/-/jobs/x", "stage": null }] } } });

    let page = last_page_of(&json!([node])).unwrap();

    let row = &page.rows[0];
    assert_eq!((row.open_discussions, row.approvals), (0, 0));
    assert!(row.labels.is_empty() && row.assignees.is_empty() && row.reviewers.is_empty());
    let expected = Pipeline {
        status: CiStatus::Canceled,
        failed_jobs: vec![FailedJob {
            name: "e2e".to_owned(),
            stage: String::new(),
            allow_failure: false,
            page: None,
        }],
        more_failed_jobs: true,
    };
    assert_eq!(row.pipeline, Some(expected));
    assert_eq!(page.me, None);
    assert_eq!(page.complexity, None);
}

#[test]
fn open_discussions_are_resolvable_minus_resolved_never_negative() {
    assert_eq!(open_discussions(Some(3), Some(1)), 2);
    assert_eq!(open_discussions(Some(1), None), 1);
    assert_eq!(open_discussions(None, Some(2)), 0);
    assert_eq!(open_discussions(Some(2), Some(5)), 0);
    assert_eq!(open_discussions(Some(i64::MAX), Some(-1)), u32::MAX);
}

#[test]
fn every_gitlab_pipeline_status_folds_into_one_of_seven_and_an_unknown_one_is_pending() {
    let statuses = [
        ("SUCCESS", CiStatus::Passed),
        ("FAILED", CiStatus::Failed),
        ("RUNNING", CiStatus::Running),
        ("CREATED", CiStatus::Pending),
        ("WAITING_FOR_RESOURCE", CiStatus::Pending),
        ("PREPARING", CiStatus::Pending),
        ("WAITING_FOR_CALLBACK", CiStatus::Pending),
        ("PENDING", CiStatus::Pending),
        ("SCHEDULED", CiStatus::Pending),
        ("CANCELED", CiStatus::Canceled),
        ("CANCELING", CiStatus::Canceled),
        ("SKIPPED", CiStatus::Skipped),
        ("MANUAL", CiStatus::Manual),
        ("BLOCKED", CiStatus::Pending),
    ];
    for (gitlab, shown) in statuses {
        assert_eq!(ci_status(gitlab), shown, "{gitlab}");
    }
}

#[test]
fn graphql_errors_are_gitlab_s_first_message_even_beside_data() {
    let too_complex = "Query has complexity of 260, which exceeds max complexity of 250";
    let refused = json!({ "errors": [{ "message": too_complex }, { "message": "second" }],
        "data": { "project": null } });

    let page = parsed(refused.to_string().as_bytes(), &taskboard(Some(ORIGIN)));

    assert_eq!(page.err().as_deref(), Some(too_complex));
}

#[test]
fn an_answer_without_data_project_cursor_or_number_is_an_error_not_a_page() {
    let no_cursor = json!({ "hasNextPage": true, "endCursor": null });
    let no_project = json!({ "data": { "project": null } }).to_string();
    let no_merge_requests = json!({ "data": { "project": { "mergeRequests": null } } }).to_string();
    let bad_iid = json!([{ "iid": "!4", "title": "t", "createdAt": "x", "draft": false }]);
    let error = |answer: &[u8]| parsed(answer, &taskboard(Some(ORIGIN))).err();

    assert_eq!(error(b"{}").as_deref(), Some(NO_DATA));
    assert_eq!(error(no_project.as_bytes()).as_deref(), Some(NO_PROJECT));
    let no_list = error(no_merge_requests.as_bytes());
    assert_eq!(no_list.as_deref(), Some(NO_PROJECT));
    let no_next = error(&answer(&json!([]), &no_cursor));
    assert_eq!(no_next.as_deref(), Some(NO_CURSOR));
    let bad = last_page_of(&bad_iid).err();
    let expected = r#"GitLab sent "!4" as a merge request number"#;
    assert_eq!(bad.as_deref(), Some(expected));
    assert!(error(b"<html>").is_some());
}
