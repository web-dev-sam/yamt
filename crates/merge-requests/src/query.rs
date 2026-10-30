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

/// One page of the project's open merge requests, newest created first, each with its latest pipeline's failed
/// jobs (the latest run of each), its merge status and size; about 119 of GitLab's complexity limit of 250
/// (`.omp/run/notes/MrOverviewDesign.md` §2.2, `docs/slices/briefs/mr-conflicts-design.md` §1). One line, so the
/// fake glab logs each call on one line.
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
         labels {{ nodes {{ title }} }} \
         assignees {{ nodes {{ username name }} }} \
         reviewers {{ nodes {{ username name }} }} \
         approvedBy {{ nodes {{ username }} }} \
         resolvableDiscussionsCount resolvedDiscussionsCount \
         detailedMergeStatus conflicts diffStatsSummary {{ additions deletions fileCount }} \
         sourceProjectId targetProjectId \
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
             diffStatsSummary { additions deletions fileCount } sourceProjectId targetProjectId headPipeline";
        assert!(query.contains(merge_fields), "{query}");
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
}
