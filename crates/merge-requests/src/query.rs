use serde_json::json;

use crate::discussions::{DISCUSSIONS_PER_PAGE, NOTES_READ};
use crate::{MAX_FAILED_JOBS, MergeRequestIid, PAGE_SIZE};

/// A merge request's state, target branch and the two commits of its diff, asked afresh on each open so a push
/// since the list loaded counts.
const DETAILS_QUERY: &str = "query MergeRequestDetails($fullPath: ID!, $iid: String!) { \
     project(fullPath: $fullPath) { mergeRequest(iid: $iid) { \
     state targetBranch diffRefs { baseSha headSha } } } }";

/// What resolving a merge request's conflicts needs, asked afresh on each click: its state, its two branches and
/// whether the source branch lives in the target's project.
const BRANCHES_QUERY: &str = "query MergeRequestBranches($fullPath: ID!, $iid: String!) { \
     project(fullPath: $fullPath) { mergeRequest(iid: $iid) { \
     state sourceBranch targetBranch sourceProjectId targetProjectId } } }";

/// A merge request's state and reviewers, asked afresh before a review is asked for again: who is still a reviewer,
/// their global id and how far their review is.
const REVIEWERS_QUERY: &str = "query MergeRequestReviewers($fullPath: ID!, $iid: String!) { \
     project(fullPath: $fullPath) { mergeRequest(iid: $iid) { \
     state reviewers { nodes { id username name avatarUrl \
     mergeRequestInteraction { approved reviewState } } } } } }";

/// Asks a reviewer for their review again (GitLab's "Re-request review"), answering the merge request's reviewers: the
/// only write of the crate.
const REREQUEST_MUTATION: &str = "mutation RerequestReview($projectPath: ID!, $iid: String!, $userId: UserID!) { \
     mergeRequestReviewerRereview(input: { projectPath: $projectPath, iid: $iid, userId: $userId }) { \
     errors mergeRequest { reviewers { nodes { username name avatarUrl \
     mergeRequestInteraction { approved reviewState } } } } } }";

/// `glab api graphql` reading the request's JSON body from stdin.
pub(crate) const GRAPHQL_BODY_ARGS: [&str; 4] = ["api", "graphql", "--input", "-"];

/// One page of the project's open merge requests, newest created first, each with its latest pipeline's failed
/// jobs (the latest run of each), its merge status and size, its people, labels and your permission to update it, and
/// its target branch and head commit for the local conflict check; 170 of GitLab's complexity limit of 250, measured
/// on gitlab.com on 2026-11-02 (`docs/slices/briefs/mr-row-details-rust.md`; `.omp/run/notes/MrOverviewDesign.md`
/// §2.2, `docs/slices/briefs/mr-conflicts-design.md` §1, `docs/slices/briefs/local-conflicts-design.md` §1,
/// `docs/slices/briefs/mr-row-details-design.md` §1.1). One line, so the fake glab logs each call on one line.
fn list_query() -> String {
    format!(
        "query MergeRequestPage($fullPath: ID!, $first: Int!, $after: String) {{ \
         queryComplexity {{ score limit }} \
         currentUser {{ username }} \
         project(fullPath: $fullPath) {{ \
         mergeRequests(state: opened, sort: CREATED_DESC, first: $first, after: $after) {{ \
         pageInfo {{ hasNextPage endCursor }} \
         nodes {{ \
         iid title createdAt draft \
         author {{ username name avatarUrl }} \
         labels {{ nodes {{ title color textColor }} }} \
         assignees {{ nodes {{ username name avatarUrl }} }} \
         reviewers {{ nodes {{ username name avatarUrl mergeRequestInteraction {{ approved reviewState }} }} }} \
         approvedBy {{ nodes {{ username name avatarUrl }} }} \
         userPermissions {{ updateMergeRequest }} \
         resolvableDiscussionsCount resolvedDiscussionsCount \
         detailedMergeStatus conflicts diffStats {{ additions deletions }} diffRefs {{ baseSha }} \
         sourceProjectId targetProjectId targetBranch diffHeadSha \
         headPipeline {{ status \
         jobs(statuses: [FAILED], retried: false, first: {MAX_FAILED_JOBS}) {{ \
         pageInfo {{ hasNextPage }} nodes {{ name allowFailure webPath stage {{ name }} }} }} }} \
         }} }} }} }}"
    )
}

/// `glab api graphql` for the page after `after`, the first page when `None`.
pub(crate) fn list_args(full_path: &str, after: Option<&str>) -> Vec<String> {
    let mut args = vec![
        "api".to_owned(),
        "graphql".to_owned(),
        "-f".to_owned(),
        format!("query={}", list_query()),
        "-f".to_owned(),
        format!("fullPath={full_path}"),
        "-F".to_owned(),
        format!("first={PAGE_SIZE}"),
    ];
    if let Some(cursor) = after {
        args.push("-f".to_owned());
        args.push(format!("after={cursor}"));
    }
    args
}

/// `glab api graphql` for merge request `iid`'s details.
pub(crate) fn details_args(full_path: &str, iid: MergeRequestIid) -> Vec<String> {
    merge_request_args(DETAILS_QUERY, full_path, iid)
}

/// `glab api graphql` for merge request `iid`'s branches.
pub(crate) fn branches_args(full_path: &str, iid: MergeRequestIid) -> Vec<String> {
    merge_request_args(BRANCHES_QUERY, full_path, iid)
}

/// `glab api graphql` for merge request `iid`'s state and reviewers.
pub(crate) fn reviewers_args(full_path: &str, iid: MergeRequestIid) -> Vec<String> {
    merge_request_args(REVIEWERS_QUERY, full_path, iid)
}

/// The open discussions of the merge requests `$iids`, each with its last notes, read by `read_discussions`
/// (`docs/slices/briefs/mr-discussions-design.md` §1.1, §1.2): 58 of GitLab's limit of 250 for 20 merge requests,
/// measured on gitlab.com on 2026-11-03. One line, so the fake glab logs each call on one line.
fn discussions_query() -> String {
    format!(
        "query MergeRequestDiscussions($fullPath: ID!, $iids: [String!], $first: Int!, $discussionsAfter: String) {{ \
         queryComplexity {{ score limit }} \
         project(fullPath: $fullPath) {{ mergeRequests(iids: $iids, first: $first) {{ nodes {{ iid \
         discussions(first: {DISCUSSIONS_PER_PAGE}, after: $discussionsAfter) {{ \
         pageInfo {{ hasNextPage endCursor }} nodes {{ \
         resolvable resolved \
         notes(last: {NOTES_READ}) {{ pageInfo {{ hasPreviousPage }} nodes {{ \
         system author {{ username name avatarUrl }} body createdAt url position {{ filePath newLine oldLine }} \
         }} }} }} }} }} }} }} }}"
    )
}

/// `glab api graphql` for the open discussions of `iids`, from the discussions after `after` when given:
/// `-F iids=<a JSON array of strings> -F first=<their count>`.
pub(crate) fn discussions_args(
    full_path: &str,
    iids: &[MergeRequestIid],
    after: Option<&str>,
) -> Vec<String> {
    let numbers: Vec<String> = iids.iter().map(|iid| iid.0.to_string()).collect();
    let mut args = vec![
        "api".to_owned(),
        "graphql".to_owned(),
        "-f".to_owned(),
        format!("query={}", discussions_query()),
        "-f".to_owned(),
        format!("fullPath={full_path}"),
        "-F".to_owned(),
        format!("iids={}", json!(numbers)),
        "-F".to_owned(),
        format!("first={}", iids.len()),
    ];
    if let Some(cursor) = after {
        args.push("-f".to_owned());
        args.push(format!("discussionsAfter={cursor}"));
    }
    args
}

/// The JSON body asking the reviewer with global id `user_id` (`gid://gitlab/User/<n>`) for their review of merge
/// request `iid` again; the id travels as a variable, never inside the query text.
pub(crate) fn rerequest_body(full_path: &str, iid: MergeRequestIid, user_id: &str) -> Vec<u8> {
    let body = json!({
        "query": REREQUEST_MUTATION,
        "variables": { "projectPath": full_path, "iid": iid.0.to_string(), "userId": user_id },
    });
    body.to_string().into_bytes()
}

fn merge_request_args(query: &str, full_path: &str, iid: MergeRequestIid) -> Vec<String> {
    vec![
        "api".to_owned(),
        "graphql".to_owned(),
        "-f".to_owned(),
        format!("query={query}"),
        "-f".to_owned(),
        format!("fullPath={full_path}"),
        "-f".to_owned(),
        format!("iid={}", iid.0),
    ]
}

#[cfg(test)]
mod tests {
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
        let people = "iid title createdAt draft author { username name avatarUrl } \
             labels { nodes { title color textColor } } assignees { nodes { username name avatarUrl } } \
             reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } \
             approvedBy { nodes { username name avatarUrl } } userPermissions { updateMergeRequest } \
             resolvableDiscussionsCount";
        assert!(query.contains(people), "{query}");
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
}
