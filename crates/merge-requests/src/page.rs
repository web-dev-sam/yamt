use std::collections::BTreeSet;

use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde::de::IgnoredAny;
use yamt_gitio::Oid;

use crate::check::RowToCheck;
use crate::labels::{LabelNode, label};
use crate::people::{People, ReviewerNode, UserNode};
use crate::project::Project;
use crate::readiness::GitLabMerge;
use crate::{
    ChangeSize, CiStatus, FailedJob, MergeRequestIid, MergeRequestRow, OfferedPicture, Pipeline,
    WebPage,
};

const NO_DATA: &str = "GitLab's answer holds no data";
pub(crate) const NO_PROJECT: &str = "GitLab finds no such project, or you may not see it";
const NO_CURSOR: &str = "GitLab says more merge requests follow, but sent no cursor for them";

/// One GraphQL answer of the list query.
pub(crate) struct ParsedPage {
    pub me: Option<String>,
    pub rows: Vec<MergeRequestRow>,
    /// Each row as the local conflict check needs it, in the same order.
    pub to_check: Vec<RowToCheck>,
    /// The uploaded pictures of the rows' people, in the order they were named.
    pub pictures: Vec<OfferedPicture>,
    pub unknown_review_states: BTreeSet<String>,
    /// The cursor of the next page; `None` on the last.
    pub next: Option<String>,
    pub complexity: Option<Complexity>,
}

/// GitLab's cost of the query, and its limit (GitLab GraphQL docs, "Query complexity").
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
pub(crate) struct Complexity {
    pub score: u32,
    pub limit: u32,
}

#[derive(Deserialize)]
struct Answer<D> {
    data: Option<D>,
    #[serde(default)]
    errors: Vec<GraphQlError>,
}

#[derive(Deserialize)]
struct GraphQlError {
    message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Data {
    query_complexity: Option<Complexity>,
    current_user: Option<User>,
    project: Option<ProjectNode>,
}

#[derive(Deserialize)]
struct User {
    username: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectNode {
    merge_requests: Option<Connection<Node>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Connection<T> {
    pub page_info: PageInfo,
    pub nodes: Vec<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PageInfo {
    pub has_next_page: bool,
    pub end_cursor: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct Nodes<T> {
    pub nodes: Vec<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Node {
    iid: String,
    title: String,
    created_at: String,
    draft: bool,
    author: Option<UserNode>,
    labels: Option<Nodes<LabelNode>>,
    assignees: Option<Nodes<UserNode>>,
    reviewers: Option<Nodes<ReviewerNode>>,
    approved_by: Option<Nodes<UserNode>>,
    user_permissions: Option<Permissions>,
    resolvable_discussions_count: Option<i64>,
    resolved_discussions_count: Option<i64>,
    head_pipeline: Option<PipelineNode>,
    detailed_merge_status: Option<String>,
    conflicts: bool,
    diff_stats: Option<Vec<FileStats>>,
    diff_refs: Option<IgnoredAny>,
    target_branch: String,
    diff_head_sha: Option<String>,
    source_project_id: Option<i64>,
    target_project_id: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Permissions {
    update_merge_request: bool,
}

#[derive(Deserialize)]
struct FileStats {
    additions: i64,
    deletions: i64,
}

#[derive(Deserialize)]
struct PipelineNode {
    status: String,
    jobs: Option<Connection<Job>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Job {
    name: String,
    allow_failure: bool,
    web_path: Option<String>,
    stage: Option<Stage>,
}

#[derive(Deserialize)]
struct Stage {
    name: String,
}

/// The page in a GraphQL answer of `project`'s list; `Err` holds GitLab's first error, or what yamt could not read.
pub(crate) fn parsed(json: &[u8], project: &Project) -> Result<ParsedPage, String> {
    let data: Data = graphql_data(json)?;
    let merge_requests = data
        .project
        .and_then(|found| found.merge_requests)
        .ok_or(NO_PROJECT)?;
    let mut people = People::new(project.web_origin.as_deref());
    let mut rows = Vec::new();
    let mut to_check = Vec::new();
    for node in merge_requests.nodes {
        let (row, row_to_check) = row(node, project, &mut people)?;
        rows.push(row);
        to_check.push(row_to_check);
    }
    Ok(ParsedPage {
        me: data.current_user.map(|user| user.username),
        rows,
        to_check,
        pictures: people.pictures,
        unknown_review_states: people.unknown_states,
        next: next_cursor(merge_requests.page_info)?,
        complexity: data.query_complexity,
    })
}

/// The `data` of a GraphQL answer; `Err` holds GitLab's first error, or what yamt could not read.
pub(crate) fn graphql_data<D: DeserializeOwned>(json: &[u8]) -> Result<D, String> {
    let answer: Answer<D> = serde_json::from_slice(json)
        .map_err(|error| format!("GitLab's answer is not what yamt expects: {error}"))?;
    if let Some(error) = answer.errors.into_iter().next() {
        return Err(error.message);
    }
    answer.data.ok_or_else(|| NO_DATA.to_owned())
}

fn next_cursor(page_info: PageInfo) -> Result<Option<String>, String> {
    match (page_info.has_next_page, page_info.end_cursor) {
        (false, _) => Ok(None),
        (true, Some(cursor)) => Ok(Some(cursor)),
        (true, None) => Err(NO_CURSOR.to_owned()),
    }
}

/// The row the window shows and, beside it, what the local check needs; a `diffHeadSha` that is no commit id is no
/// head.
fn row(
    node: Node,
    project: &Project,
    people: &mut People,
) -> Result<(MergeRequestRow, RowToCheck), String> {
    let iid = merge_request_iid(&node.iid)?;
    let origin = project.web_origin.as_deref();
    let page = origin.and_then(|origin| WebPage::merge_request(origin, &project.web_path, iid));
    let status = node.detailed_merge_status.as_deref();
    let gitlab = GitLabMerge::read(status, node.conflicts, node.draft);
    let files = node.diff_stats.as_deref().unwrap_or_default();
    let row = MergeRequestRow {
        iid,
        title: node.title,
        created_at: node.created_at,
        draft: node.draft,
        author: node.author.map(|author| people.person(author)),
        assignees: people.persons(listed(node.assignees)),
        reviewers: people.reviewers(listed(node.reviewers)),
        labels: listed(node.labels).into_iter().map(label).collect(),
        open_discussions: open_discussions(
            node.resolvable_discussions_count,
            node.resolved_discussions_count,
        ),
        approved_by: people.persons(listed(node.approved_by)),
        may_rerequest: node
            .user_permissions
            .is_some_and(|allowed| allowed.update_merge_request),
        pipeline: node.head_pipeline.map(|found| pipeline(found, origin)),
        page,
        size: change_size(files, node.diff_refs.is_some()),
        readiness: gitlab.readiness(),
        from_fork: is_from_fork(node.source_project_id, node.target_project_id),
    };
    let to_check = RowToCheck {
        iid,
        target_branch: node.target_branch,
        head: node.diff_head_sha.and_then(|sha| Oid::parse(&sha).ok()),
        gitlab,
    };
    Ok((row, to_check))
}

pub(crate) fn merge_request_iid(sent: &str) -> Result<MergeRequestIid, String> {
    let iid = sent
        .parse()
        .map_err(|_| format!("GitLab sent {sent:?} as a merge request number"))?;
    Ok(MergeRequestIid(iid))
}

pub(crate) fn listed<T>(connection: Option<Nodes<T>>) -> Vec<T> {
    connection.map_or_else(Vec::new, |connection| connection.nodes)
}

/// Resolvable discussions not resolved; a missing count is 0, and the result never below 0.
fn open_discussions(resolvable: Option<i64>, resolved: Option<i64>) -> u32 {
    let open = resolvable
        .unwrap_or(0)
        .saturating_sub(resolved.unwrap_or(0));
    saturated(open)
}

/// GitLab's `Int` as a count: below 0 is 0, above `u32::MAX` is `u32::MAX`.
fn saturated(sent: i64) -> u32 {
    u32::try_from(sent.max(0)).unwrap_or(u32::MAX)
}

pub(crate) fn count(length: usize) -> u32 {
    u32::try_from(length).unwrap_or(u32::MAX)
}

/// The sums over the changed files. GitLab sends no files both for an empty diff and for one it has not computed
/// (design `mr-row-details-design.md` §1.4): with `diffRefs` the diff is computed and empty, without it there is no
/// size yet.
fn change_size(files: &[FileStats], has_diff_refs: bool) -> Option<ChangeSize> {
    if files.is_empty() && !has_diff_refs {
        return None;
    }
    let mut size = ChangeSize {
        additions: 0,
        deletions: 0,
        files: count(files.len()),
    };
    for file in files {
        size.additions = size.additions.saturating_add(saturated(file.additions));
        size.deletions = size.deletions.saturating_add(saturated(file.deletions));
    }
    Some(size)
}

/// Whether a merge request's source branch lives outside its target's project; a deleted source project
/// (`sourceProjectId` null) counts, as its branch is not in the target's project either.
pub(crate) fn is_from_fork(source_project_id: Option<i64>, target_project_id: i64) -> bool {
    source_project_id != Some(target_project_id)
}

fn pipeline(found: PipelineNode, origin: Option<&str>) -> Pipeline {
    let (jobs, more_failed_jobs) = match found.jobs {
        Some(jobs) => (jobs.nodes, jobs.page_info.has_next_page),
        None => (Vec::new(), false),
    };
    let failed_jobs = jobs.into_iter().map(|job| failed_job(job, origin));
    Pipeline {
        status: ci_status(&found.status),
        failed_jobs: failed_jobs.collect(),
        more_failed_jobs,
    }
}

fn failed_job(job: Job, origin: Option<&str>) -> FailedJob {
    let page = origin.zip(job.web_path.as_deref());
    FailedJob {
        page: page.and_then(|(origin, web_path)| WebPage::job(origin, web_path)),
        name: job.name,
        stage: job.stage.map(|stage| stage.name).unwrap_or_default(),
        allow_failure: job.allow_failure,
    }
}

/// GitLab's `PipelineStatusEnum` (GraphQL reference) in the window's seven.
fn ci_status(status: &str) -> CiStatus {
    match status {
        "SUCCESS" => CiStatus::Passed,
        "FAILED" => CiStatus::Failed,
        "RUNNING" => CiStatus::Running,
        "CREATED"
        | "WAITING_FOR_RESOURCE"
        | "PREPARING"
        | "WAITING_FOR_CALLBACK"
        | "PENDING"
        | "SCHEDULED" => CiStatus::Pending,
        "CANCELED" | "CANCELING" => CiStatus::Canceled,
        "SKIPPED" => CiStatus::Skipped,
        "MANUAL" => CiStatus::Manual,
        unknown => {
            tracing::warn!(
                status = unknown,
                "unknown pipeline status, shown as pending"
            );
            CiStatus::Pending
        }
    }
}

#[cfg(test)]
mod tests;
