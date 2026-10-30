use crate::{MAX_FAILED_JOBS, PAGE_SIZE};

/// One page of the project's open merge requests, newest created first, each with its latest pipeline's failed
/// jobs (the latest run of each); about 112 of GitLab's complexity limit of 250 (`.omp/run/notes/MrOverviewDesign.md`
/// §2.2). One line, so the fake glab logs each call on one line.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_query_is_one_line_with_balanced_braces_and_the_failed_job_limit() {
        let query = list_query();
        assert!(!query.contains('\n'), "{query}");
        assert_eq!(query.matches('{').count(), query.matches('}').count());
        assert!(query.contains("first: 50)"), "{query}");
    }
}
