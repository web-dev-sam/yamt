use super::*;

#[test]
fn the_query_is_one_line_with_balanced_braces_the_failed_job_limit_and_the_merge_fields() {
    let query = list_query();
    assert!(!query.contains('\n'), "{query}");
    assert_eq!(query.matches('{').count(), query.matches('}').count());
    assert!(query.contains("first: 50)"), "{query}");
    let merge_fields = "resolvedDiscussionsCount detailedMergeStatus conflicts \
         diffStats { additions deletions } diffRefs { baseSha } sourceProjectId targetProjectId targetBranch \
         diffHeadSha headPipeline";
    assert!(query.contains(merge_fields), "{query}");
}

#[test]
fn the_list_query_asks_per_file_diff_stats_never_the_summary() {
    // gitlab.com, 2026-10-31 (`docs/slices/briefs/mr-diff-stats.md`): beside `diffStatsSummary` in a
    // `mergeRequests` list, GitLab answers `detailedMergeStatus: CONFLICT` for merge requests that merge clean.
    let query = list_query();
    assert!(query.contains("diffStats {"), "{query}");
    assert!(!query.contains("diffStatsSummary"), "{query}");
}

#[test]
fn the_list_query_asks_people_with_pictures_review_states_the_permission_and_label_colours() {
    let query = list_query();
    let people = "iid title description createdAt draft author { username name avatarUrl } \
         labels { nodes { title color textColor } } assignees { nodes { username name avatarUrl } } \
         reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } \
         approvedBy { nodes { username name avatarUrl } } userPermissions { updateMergeRequest } \
         resolvableDiscussionsCount";
    assert!(query.contains(people), "{query}");
}

#[test]
fn the_list_query_asks_the_description_and_stays_one_line() {
    let query = list_query();
    assert!(!query.contains('\n'), "{query}");
    assert_eq!(query.matches('{').count(), query.matches('}').count());
    assert!(
        query.contains(" iid title description createdAt "),
        "{query}"
    );
    assert!(!query.contains("descriptionHtml"), "{query}");
}

#[test]
fn the_description_query_is_one_line_and_asks_only_description_html() {
    let query = "query=query MergeRequestDescription($fullPath: ID!, $iid: String!) { \
         project(fullPath: $fullPath) { mergeRequest(iid: $iid) { descriptionHtml } } }";
    assert!(!query.contains('\n'));
    assert_eq!(query.matches('{').count(), query.matches('}').count());

    let args = description_args("taskboard/taskboard", MergeRequestIid(52));

    let expected = [
        "api",
        "graphql",
        "-f",
        query,
        "-f",
        "fullPath=taskboard/taskboard",
        "-f",
        "iid=52",
    ];
    assert_eq!(args, expected);
}

#[test]
fn the_reviewers_query_is_one_line_with_balanced_braces_and_its_argv_is_exact() {
    let query = "query=query MergeRequestReviewers($fullPath: ID!, $iid: String!) { \
         project(fullPath: $fullPath) { mergeRequest(iid: $iid) { state reviewers { nodes { id username name \
         avatarUrl mergeRequestInteraction { approved reviewState } } } } } }";
    assert_eq!(query.matches('{').count(), query.matches('}').count());

    let args = reviewers_args("taskboard/taskboard", MergeRequestIid(52));

    let expected = [
        "api",
        "graphql",
        "-f",
        query,
        "-f",
        "fullPath=taskboard/taskboard",
        "-f",
        "iid=52",
    ];
    assert_eq!(args, expected);
}

#[test]
fn the_rerequest_body_names_the_rereview_mutation_and_carries_the_id_as_a_variable() {
    let mutation = "mutation RerequestReview($projectPath: ID!, $iid: String!, $userId: UserID!) { \
         mergeRequestReviewerRereview(input: { projectPath: $projectPath, iid: $iid, userId: $userId }) { \
         errors mergeRequest { reviewers { nodes { username name avatarUrl \
         mergeRequestInteraction { approved reviewState } } } } } }";
    assert_eq!(mutation.matches('{').count(), mutation.matches('}').count());

    let body = rerequest_body(
        "taskboard/taskboard",
        MergeRequestIid(52),
        "gid://gitlab/User/3",
    );

    let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let expected = json!({ "query": mutation, "variables": {
        "projectPath": "taskboard/taskboard", "iid": "52", "userId": "gid://gitlab/User/3" } });
    assert_eq!(body, expected);
    assert_eq!(GRAPHQL_BODY_ARGS, ["api", "graphql", "--input", "-"]);
}

#[test]
fn the_details_query_is_one_line_with_balanced_braces() {
    assert!(!DETAILS_QUERY.contains('\n'), "{DETAILS_QUERY}");
    let braces = DETAILS_QUERY.matches('{').count();
    assert_eq!(braces, DETAILS_QUERY.matches('}').count());
    let args = details_args("taskboard/taskboard", MergeRequestIid(13));
    assert_eq!(
        args[4..],
        ["-f", "fullPath=taskboard/taskboard", "-f", "iid=13"]
    );
    assert!(args[3].starts_with("query=query MergeRequestDetails("));
}

#[test]
fn the_branches_query_is_one_line_with_balanced_braces_and_its_argv_is_exact() {
    assert!(!BRANCHES_QUERY.contains('\n'), "{BRANCHES_QUERY}");
    let braces = BRANCHES_QUERY.matches('{').count();
    assert_eq!(braces, BRANCHES_QUERY.matches('}').count());
    let query = "query=query MergeRequestBranches($fullPath: ID!, $iid: String!) { \
         project(fullPath: $fullPath) { mergeRequest(iid: $iid) { \
         state sourceBranch targetBranch sourceProjectId targetProjectId } } }";

    let args = branches_args("taskboard/taskboard", MergeRequestIid(21));

    let expected = [
        "api",
        "graphql",
        "-f",
        query,
        "-f",
        "fullPath=taskboard/taskboard",
        "-f",
        "iid=21",
    ];
    assert_eq!(args, expected);
}

#[test]
fn the_discussions_query_is_one_line_as_designed_and_its_argv_is_exact() {
    let query = "query=query MergeRequestDiscussions($fullPath: ID!, $iids: [String!], $first: Int!, \
         $discussionsAfter: String) { queryComplexity { score limit } project(fullPath: $fullPath) { \
         mergeRequests(iids: $iids, first: $first) { nodes { iid discussions(first: 100, after: \
         $discussionsAfter) { pageInfo { hasNextPage endCursor } nodes { resolvable resolved notes(last: 20) { \
         pageInfo { hasPreviousPage } nodes { system author { username name avatarUrl } body createdAt url \
         position { filePath newLine oldLine } } } } } } } } }";
    assert_eq!(query.matches('{').count(), query.matches('}').count());
    let iids = [MergeRequestIid(82), MergeRequestIid(7)];

    let batch = discussions_args("taskboard/taskboard", &iids, None);
    let later = discussions_args("taskboard/taskboard", &iids[..1], Some("d-2"));

    let common = [
        "api",
        "graphql",
        "-f",
        query,
        "-f",
        "fullPath=taskboard/taskboard",
    ];
    let batch_fields = ["-F", r#"iids=["82","7"]"#, "-F", "first=2"];
    assert_eq!(batch, [common.as_slice(), &batch_fields].concat());
    let later_fields = ["-F", r#"iids=["82"]"#, "-F", "first=1"];
    let after = ["-f", "discussionsAfter=d-2"];
    assert_eq!(later, [common.as_slice(), &later_fields, &after].concat());
}

#[test]
fn the_search_query_is_one_line_and_its_argv_is_exact() {
    let query = "query=query PeopleSearch($fullPath: ID!, $search: String!) { \
         project(fullPath: $fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } } }";
    assert!(!query.contains('\n'), "{query}");
    assert_eq!(query.matches('{').count(), query.matches('}').count());

    let args = people_search_args("taskboard/taskboard", "@er ik");

    let expected = [
        "api",
        "graphql",
        "-f",
        query,
        "-f",
        "fullPath=taskboard/taskboard",
        "-f",
        "search=@er ik",
    ];
    assert_eq!(args, expected);
}

/// The mutation text the tests expect for `name` (`Assignees`, `Reviewers`), as contracted.
fn people_mutation(name: &str, field: &str) -> String {
    format!(
        "mutation Set{name}($projectPath: ID!, $iid: String!, $usernames: [String!]!, \
         $mode: MutationOperationMode!) {{ changed: mergeRequestSet{name}(input: {{ projectPath: $projectPath, \
         iid: $iid, {field}: $usernames, operationMode: $mode }}) {{ errors mergeRequest {{ \
         assignees {{ nodes {{ username name avatarUrl }} }} \
         reviewers {{ nodes {{ username name avatarUrl mergeRequestInteraction {{ approved reviewState }} }} }} }} }} }}"
    )
}

#[test]
fn the_change_body_names_the_groups_mutation_with_one_username_and_the_actions_mode() {
    use PeopleAction::{Add, Remove};
    use PeopleGroup::{Assignees, Reviewers};
    let assignees = people_mutation("Assignees", "assigneeUsernames");
    let reviewers = people_mutation("Reviewers", "reviewerUsernames");
    for mutation in [&assignees, &reviewers] {
        assert!(!mutation.contains('\n'), "{mutation}");
        assert_eq!(mutation.matches('{').count(), mutation.matches('}').count());
    }
    let cases = [
        (Assignees, Add, &assignees, "APPEND"),
        (Assignees, Remove, &assignees, "REMOVE"),
        (Reviewers, Add, &reviewers, "APPEND"),
        (Reviewers, Remove, &reviewers, "REMOVE"),
    ];
    for (group, action, mutation, mode) in cases {
        let username = "erik".to_owned();
        let change = PeopleChange {
            group,
            action,
            username,
        };

        let body = people_change_body("taskboard/taskboard", MergeRequestIid(52), &change);

        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let expected = json!({ "query": mutation, "variables": {
            "projectPath": "taskboard/taskboard", "iid": "52", "usernames": ["erik"], "mode": mode } });
        assert_eq!(body, expected, "{group:?} {action:?}");
    }
}
