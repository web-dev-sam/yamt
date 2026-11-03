use serde_json::json;

use crate::discussions::{DISCUSSIONS_PER_PAGE, NOTES_READ};
use crate::{MAX_FAILED_JOBS, MergeRequestIid, PAGE_SIZE, PeopleAction, PeopleChange, PeopleGroup};

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

/// Asks a reviewer for their review again (GitLab's "Re-request review"), answering the merge request's reviewers.
const REREQUEST_MUTATION: &str = "mutation RerequestReview($projectPath: ID!, $iid: String!, $userId: UserID!) { \
     mergeRequestReviewerRereview(input: { projectPath: $projectPath, iid: $iid, userId: $userId }) { \
     errors mergeRequest { reviewers { nodes { username name avatarUrl \
     mergeRequestInteraction { approved reviewState } } } } } }";

/// `glab api graphql` reading the request's JSON body from stdin.
pub(crate) const GRAPHQL_BODY_ARGS: [&str; 4] = ["api", "graphql", "--input", "-"];

/// The project's people whose name, username or public email matches `$search`, as GitLab's own merge-request
/// dropdown asks (`project_autocomplete_users_with_mr_permissions.query.graphql`): at most 20, sorted by name; 13 of
/// GitLab's limit of 250 on gitlab-org/gitlab, measured on gitlab.com on 2026-11-03.
const PEOPLE_SEARCH_QUERY: &str = "query PeopleSearch($fullPath: ID!, $search: String!) { \
     project(fullPath: $fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } } }";

/// Adds or removes assignees by username against GitLab's list at that moment, answering both of the merge
/// request's lists with the list query's fields.
const SET_ASSIGNEES_MUTATION: &str = "mutation SetAssignees($projectPath: ID!, $iid: String!, \
     $usernames: [String!]!, $mode: MutationOperationMode!) { changed: mergeRequestSetAssignees(input: { \
     projectPath: $projectPath, iid: $iid, assigneeUsernames: $usernames, operationMode: $mode }) { errors \
     mergeRequest { assignees { nodes { username name avatarUrl } } \
     reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } } } }";

/// The same for reviewers.
const SET_REVIEWERS_MUTATION: &str = "mutation SetReviewers($projectPath: ID!, $iid: String!, \
     $usernames: [String!]!, $mode: MutationOperationMode!) { changed: mergeRequestSetReviewers(input: { \
     projectPath: $projectPath, iid: $iid, reviewerUsernames: $usernames, operationMode: $mode }) { errors \
     mergeRequest { assignees { nodes { username name avatarUrl } } \
     reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } } } }";

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

/// `glab api graphql` for the project's people matching `text`: `-f search=<text>`, a raw string glab never reads as
/// `@file` (measured with glab 1.126.0 on gitlab.com on 2026-11-03: `search=@sam` searched the text).
pub(crate) fn people_search_args(full_path: &str, text: &str) -> Vec<String> {
    vec![
        "api".to_owned(),
        "graphql".to_owned(),
        "-f".to_owned(),
        format!("query={PEOPLE_SEARCH_QUERY}"),
        "-f".to_owned(),
        format!("fullPath={full_path}"),
        "-f".to_owned(),
        format!("search={text}"),
    ]
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

/// The JSON body asking for `change` on merge request `iid`: the group's mutation, one username, `APPEND` or
/// `REMOVE`; the username travels as a variable, never inside the query text.
pub(crate) fn people_change_body(
    full_path: &str,
    iid: MergeRequestIid,
    change: &PeopleChange,
) -> Vec<u8> {
    let mutation = match change.group {
        PeopleGroup::Assignees => SET_ASSIGNEES_MUTATION,
        PeopleGroup::Reviewers => SET_REVIEWERS_MUTATION,
    };
    let mode = match change.action {
        PeopleAction::Add => "APPEND",
        PeopleAction::Remove => "REMOVE",
    };
    let body = json!({
        "query": mutation,
        "variables": {
            "projectPath": full_path,
            "iid": iid.0.to_string(),
            "usernames": [change.username],
            "mode": mode,
        },
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
mod tests;
