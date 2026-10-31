use serde_json::{Value, json};

use super::*;

const ORIGIN: &str = "https://gitlab.example";
const FULL_PATH: &str = "taskboard/taskboard";
const WEB_PATH: &str = "/taskboard/taskboard";
const PAGE_1: &[u8] = include_bytes!("../../../../tests/glab/merge-requests/graphql-page-1.json");
const PAGE_2: &[u8] = include_bytes!("../../../../tests/glab/merge-requests/graphql-page-2.json");
const CONFLICTS_PAGE: &[u8] =
    include_bytes!("../../../../tests/glab/mr-conflicts/graphql-page-1.json");

fn person(username: &str, name: &str) -> Person {
    Person {
        username: username.to_owned(),
        name: name.to_owned(),
    }
}

fn taskboard(web_origin: Option<&str>) -> Project {
    Project {
        full_path: FULL_PATH.to_owned(),
        web_path: WEB_PATH.to_owned(),
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
        size: Some(size(64, 9, 4)),
        readiness: blocked(BlockedReason::PipelineMustPass),
        from_fork: false,
    }
}

/// A node with GitLab's non-null fields, then `fields` over them.
fn node_with(fields: &Value) -> Value {
    let mut node = json!({ "iid": "4", "title": "t", "createdAt": "2026-01-01T00:00:00Z", "draft": false,
        "conflicts": false, "sourceProjectId": 1, "targetProjectId": 1 });
    for (name, value) in fields.as_object().unwrap() {
        node[name] = value.clone();
    }
    node
}

fn row_with(fields: &Value) -> MergeRequestRow {
    let page = last_page_of(&json!([node_with(fields)])).unwrap();
    page.rows.into_iter().next().unwrap()
}

fn conflicts(also: &[BlockedReason]) -> Readiness {
    Readiness::Conflicts {
        also: also.to_vec(),
    }
}

fn blocked(reason: BlockedReason) -> Readiness {
    Readiness::Blocked { reason }
}

fn size(additions: u32, deletions: u32, files: u32) -> ChangeSize {
    ChangeSize {
        additions,
        deletions,
        files,
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
        score: 119,
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
    let readiness: Vec<&Readiness> = page.rows.iter().map(|row| &row.readiness).collect();
    let conflicting_draft = conflicts(&[BlockedReason::Draft]);
    assert_eq!(readiness[1..], [&Readiness::Ready, &conflicting_draft]);
}

#[test]
fn the_last_page_has_no_cursor_and_a_row_without_a_pipeline_has_none() {
    let page = parsed(PAGE_2, &taskboard(Some(ORIGIN))).unwrap();

    assert_eq!(page.next, None);
    assert_eq!(page.rows[0].pipeline, None);
    assert_eq!(status_of(&page.rows[1]), Some(CiStatus::Manual));
    assert_eq!(page.rows[1].approvals, 1);
    assert_eq!(page.rows[0].readiness, Readiness::NeedsRebase);
    assert_eq!(page.rows[0].size, None);
    assert_eq!(page.rows[1].readiness, Readiness::Checking);
    assert_eq!(
        (page.rows[0].from_fork, page.rows[1].from_fork),
        (false, true)
    );
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
fn on_a_gitlab_under_a_sub_path_a_row_s_page_keeps_the_sub_path() {
    let project = Project {
        web_path: format!("/gitlab{WEB_PATH}"),
        ..taskboard(Some(ORIGIN))
    };

    let page = parsed(PAGE_1, &project).unwrap();

    let expected = "https://gitlab.example/gitlab/taskboard/taskboard/-/merge_requests/13";
    assert_eq!(
        page.rows[0].page.as_ref().map(WebPage::as_str),
        Some(expected)
    );
}

#[test]
fn null_fields_are_empty_or_zero_and_more_failed_jobs_than_asked_are_flagged() {
    let node = node_with(
        &json!({ "labels": null, "assignees": null, "reviewers": null, "approvedBy": null,
        "resolvableDiscussionsCount": null, "resolvedDiscussionsCount": null,
        "headPipeline": { "status": "CANCELING", "jobs": { "pageInfo": { "hasNextPage": true },
            "nodes": [{ "name": "e2e", "allowFailure": false, "webPath": "/a/-/jobs/x", "stage": null }] } } }),
    );
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
    let bad_iid = json!([node_with(&json!({ "iid": "!4" }))]);
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

/// GitLab's 24 `DetailedMergeStatus` values and what each folds to.
fn merge_status_table() -> [(&'static str, Readiness); 24] {
    use BlockedReason::{
        Approvals, ChangesRequested, Dependencies, Discussions, Draft, JiraIssue, LockedFiles,
        LockedPaths, MergeTime, NotOpen, PipelineMustPass, PipelineRunning, SecurityPipelines,
        SecurityPolicies, SourceBranch, StatusChecks, TitleRule,
    };
    [
        ("MERGEABLE", Readiness::Ready),
        ("CONFLICT", conflicts(&[])),
        ("NEED_REBASE", Readiness::NeedsRebase),
        ("CHECKING", Readiness::Checking),
        ("UNCHECKED", Readiness::Checking),
        ("PREPARING", Readiness::Checking),
        ("APPROVALS_SYNCING", Readiness::Checking),
        ("DRAFT_STATUS", blocked(Draft)),
        ("DISCUSSIONS_NOT_RESOLVED", blocked(Discussions)),
        ("NOT_APPROVED", blocked(Approvals)),
        ("CI_MUST_PASS", blocked(PipelineMustPass)),
        ("CI_STILL_RUNNING", blocked(PipelineRunning)),
        ("REQUESTED_CHANGES", blocked(ChangesRequested)),
        ("BLOCKED_STATUS", blocked(Dependencies)),
        ("EXTERNAL_STATUS_CHECKS", blocked(StatusChecks)),
        ("JIRA_ASSOCIATION", blocked(JiraIssue)),
        ("LOCKED_LFS_FILES", blocked(LockedFiles)),
        ("LOCKED_PATHS", blocked(LockedPaths)),
        ("MERGE_TIME", blocked(MergeTime)),
        ("NOT_OPEN", blocked(NotOpen)),
        ("COMMITS_STATUS", blocked(SourceBranch)),
        ("SECURITY_POLICIES_VIOLATIONS", blocked(SecurityPolicies)),
        ("SECURITY_POLICY_PIPELINE_CHECK", blocked(SecurityPipelines)),
        ("TITLE_NOT_MATCHING", blocked(TitleRule)),
    ]
}

fn unknown_status() -> BlockedReason {
    BlockedReason::Other {
        status: "MERGE_TRAIN_STUCK".to_owned(),
    }
}

#[test]
fn every_gitlab_merge_status_folds_as_the_table_null_is_checking_and_an_unknown_one_blocks() {
    for (gitlab, folded) in merge_status_table() {
        assert_eq!(readiness(Some(gitlab), false, false), folded, "{gitlab}");
    }
    let unknown = readiness(Some("MERGE_TRAIN_STUCK"), false, false);
    assert_eq!(unknown, blocked(unknown_status()));
    let missing = row_with(&json!({ "detailedMergeStatus": null }));
    assert_eq!(missing.readiness, Readiness::Checking);
}

#[test]
fn a_conflict_flag_or_status_comes_first_with_the_status_s_blocker_then_a_draft() {
    use BlockedReason::{Discussions, Draft, PipelineMustPass};
    let cases: [(Option<&str>, bool, &[BlockedReason]); 9] = [
        (Some("DRAFT_STATUS"), true, &[Draft]),
        (Some("CI_MUST_PASS"), true, &[PipelineMustPass, Draft]),
        (Some("DISCUSSIONS_NOT_RESOLVED"), false, &[Discussions]),
        (Some("MERGEABLE"), false, &[]),
        (Some("MERGEABLE"), true, &[Draft]),
        (Some("CHECKING"), false, &[]),
        (Some("NEED_REBASE"), false, &[]),
        (None, false, &[]),
        (Some("MERGE_TRAIN_STUCK"), false, &[unknown_status()]),
    ];
    for (status, draft, also) in cases {
        let folded = readiness(status, true, draft);
        assert_eq!(folded, conflicts(also), "{status:?}");
    }
    assert_eq!(readiness(Some("CONFLICT"), false, false), conflicts(&[]));
    assert_eq!(
        readiness(Some("CONFLICT"), false, true),
        conflicts(&[Draft])
    );
    assert_eq!(readiness(Some("DRAFT_STATUS"), false, true), blocked(Draft));
}

#[test]
fn a_size_sums_each_file_s_counts_and_counts_the_files() {
    let files = json!([
        { "additions": 10, "deletions": 2 },
        { "additions": 0, "deletions": 5 },
        { "additions": 7, "deletions": 0 }
    ]);
    let counted = row_with(&json!({ "diffStats": files }));
    assert_eq!(counted.size, Some(size(17, 7, 3)));
}

#[test]
fn no_files_or_null_stats_is_no_size() {
    assert_eq!(row_with(&json!({ "diffStats": [] })).size, None);
    assert_eq!(row_with(&json!({ "diffStats": null })).size, None);
    assert_eq!(row_with(&json!({})).size, None);
}

#[test]
fn a_negative_count_is_0_a_huge_sum_saturates_and_another_or_no_source_project_is_a_fork() {
    let files = json!([
        { "additions": -3, "deletions": 7 },
        { "additions": 4, "deletions": 5_000_000_000_i64 },
        { "additions": 2, "deletions": 1 }
    ]);
    let counted = row_with(&json!({ "diffStats": files }));
    assert_eq!(counted.size, Some(size(6, u32::MAX, 3)));
    assert!(!counted.from_fork);
    assert!(row_with(&json!({ "sourceProjectId": 2, "targetProjectId": 1 })).from_fork);
    assert!(row_with(&json!({ "sourceProjectId": null })).from_fork);
}

#[test]
fn the_mr_conflicts_scenario_s_page_folds_as_its_readme_says() {
    use BlockedReason::{Draft, PipelineMustPass};
    let page = parsed(CONFLICTS_PAGE, &taskboard(Some(ORIGIN))).unwrap();

    let rows: Vec<(u32, Readiness, bool)> = page
        .rows
        .iter()
        .map(|row| (row.iid.0, row.readiness.clone(), row.from_fork))
        .collect();

    let expected = [
        (32, conflicts(&[PipelineMustPass, Draft]), false),
        (31, conflicts(&[Draft]), false),
        (29, conflicts(&[]), false),
        (28, blocked(unknown_status()), false),
        (27, Readiness::Ready, false),
        (26, Readiness::Checking, false),
        (25, blocked(Draft), false),
        (24, Readiness::NeedsRebase, false),
        (23, conflicts(&[]), false),
        (22, conflicts(&[]), true),
        (21, conflicts(&[]), false),
    ];
    assert_eq!(rows, expected);
    assert_eq!((page.me.as_deref(), page.next), (Some("sam"), None));
    assert_eq!(page.rows[4].size, None);
    assert_eq!(page.rows[10].size, Some(size(120, 40, 6)));
}

#[test]
fn the_recorded_pages_give_the_sizes_their_summaries_gave() {
    let sizes_of = |json: &[u8]| -> Vec<Option<ChangeSize>> {
        let page = parsed(json, &taskboard(Some(ORIGIN))).unwrap();
        page.rows.into_iter().map(|row| row.size).collect()
    };
    let first = [size(64, 9, 4), size(30, 2, 2), size(120, 40, 6)];
    assert_eq!(sizes_of(PAGE_1), first.map(Some));
    assert_eq!(sizes_of(PAGE_2), [None, Some(size(5, 5, 1))]);
    let conflicts_page = [
        Some(size(75, 12, 5)),
        Some(size(210, 3, 7)),
        Some(size(8, 1, 1)),
        Some(size(44, 6, 3)),
        None,
        Some(size(31, 0, 2)),
        Some(size(18, 2, 1)),
        Some(size(96, 22, 4)),
        Some(size(52, 14, 3)),
        Some(size(27, 9, 2)),
        Some(size(120, 40, 6)),
    ];
    assert_eq!(sizes_of(CONFLICTS_PAGE), conflicts_page);
}
