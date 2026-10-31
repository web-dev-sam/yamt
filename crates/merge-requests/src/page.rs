use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde::de::IgnoredAny;

use crate::project::Project;
use crate::{
    BlockedReason, ChangeSize, CiStatus, FailedJob, MergeRequestIid, MergeRequestRow, Person,
    Pipeline, Readiness, WebPage,
};

const NO_DATA: &str = "GitLab's answer holds no data";
pub(crate) const NO_PROJECT: &str = "GitLab finds no such project, or you may not see it";
const NO_CURSOR: &str = "GitLab says more merge requests follow, but sent no cursor for them";

/// One GraphQL answer of the list query.
pub(crate) struct ParsedPage {
    pub me: Option<String>,
    pub rows: Vec<MergeRequestRow>,
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
struct Connection<T> {
    page_info: PageInfo,
    nodes: Vec<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageInfo {
    has_next_page: bool,
    end_cursor: Option<String>,
}

#[derive(Deserialize)]
struct Nodes<T> {
    nodes: Vec<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Node {
    iid: String,
    title: String,
    created_at: String,
    draft: bool,
    labels: Option<Nodes<Label>>,
    assignees: Option<Nodes<Person>>,
    reviewers: Option<Nodes<Person>>,
    approved_by: Option<Nodes<IgnoredAny>>,
    resolvable_discussions_count: Option<i64>,
    resolved_discussions_count: Option<i64>,
    head_pipeline: Option<PipelineNode>,
    detailed_merge_status: Option<String>,
    conflicts: bool,
    diff_stats: Option<Vec<FileStats>>,
    source_project_id: Option<i64>,
    target_project_id: i64,
}

#[derive(Deserialize)]
struct FileStats {
    additions: i64,
    deletions: i64,
}

#[derive(Deserialize)]
struct Label {
    title: String,
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
    let mut rows = Vec::new();
    for node in merge_requests.nodes {
        rows.push(row(node, project)?);
    }
    Ok(ParsedPage {
        me: data.current_user.map(|user| user.username),
        rows,
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

fn row(node: Node, project: &Project) -> Result<MergeRequestRow, String> {
    let iid = node
        .iid
        .parse()
        .map_err(|_| format!("GitLab sent {:?} as a merge request number", node.iid))?;
    let iid = MergeRequestIid(iid);
    let origin = project.web_origin.as_deref();
    let page = origin.and_then(|origin| WebPage::merge_request(origin, &project.web_path, iid));
    let labels = listed(node.labels).into_iter().map(|label| label.title);
    Ok(MergeRequestRow {
        iid,
        title: node.title,
        created_at: node.created_at,
        draft: node.draft,
        assignees: listed(node.assignees),
        reviewers: listed(node.reviewers),
        labels: labels.collect(),
        open_discussions: open_discussions(
            node.resolvable_discussions_count,
            node.resolved_discussions_count,
        ),
        approvals: count(listed(node.approved_by).len()),
        pipeline: node.head_pipeline.map(|found| pipeline(found, origin)),
        page,
        size: change_size(node.diff_stats.as_deref().unwrap_or_default()),
        readiness: readiness(
            node.detailed_merge_status.as_deref(),
            node.conflicts,
            node.draft,
        ),
        from_fork: is_from_fork(node.source_project_id, node.target_project_id),
    })
}

fn listed<T>(connection: Option<Nodes<T>>) -> Vec<T> {
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

fn count(length: usize) -> u32 {
    u32::try_from(length).unwrap_or(u32::MAX)
}

/// The sums over the changed files, `None` when GitLab sent none (it has not computed the diff yet).
fn change_size(files: &[FileStats]) -> Option<ChangeSize> {
    if files.is_empty() {
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

/// The row's one readiness: GitLab's merge status alone, unless the merge request conflicts (its `conflicts` flag
/// or a `CONFLICT` status). A conflict comes first, with what else blocks the merge (request rule 2, #1998): the
/// status's blocked reason, then `Draft` for a draft — GitLab never merges one, whatever its status says.
fn readiness(status: Option<&str>, conflicts: bool, draft: bool) -> Readiness {
    let folded = status.map_or(Readiness::Checking, merge_status);
    if !conflicts && !matches!(folded, Readiness::Conflicts { .. }) {
        return folded;
    }
    let mut also = match folded {
        Readiness::Blocked { reason } => vec![reason],
        Readiness::Ready
        | Readiness::Conflicts { .. }
        | Readiness::NeedsRebase
        | Readiness::Checking => Vec::new(),
    };
    if draft && !also.contains(&BlockedReason::Draft) {
        also.push(BlockedReason::Draft);
    }
    Readiness::Conflicts { also }
}

/// GitLab's `DetailedMergeStatus` (GraphQL reference) as a readiness; an unknown one blocks, in GitLab's word.
fn merge_status(status: &str) -> Readiness {
    match status {
        "MERGEABLE" => Readiness::Ready,
        "CONFLICT" => Readiness::Conflicts { also: Vec::new() },
        "NEED_REBASE" => Readiness::NeedsRebase,
        "CHECKING" | "UNCHECKED" | "PREPARING" | "APPROVALS_SYNCING" => Readiness::Checking,
        blocking => Readiness::Blocked {
            reason: blocked_reason(blocking),
        },
    }
}

fn blocked_reason(status: &str) -> BlockedReason {
    match status {
        "DRAFT_STATUS" => BlockedReason::Draft,
        "DISCUSSIONS_NOT_RESOLVED" => BlockedReason::Discussions,
        "NOT_APPROVED" => BlockedReason::Approvals,
        "CI_MUST_PASS" => BlockedReason::PipelineMustPass,
        "CI_STILL_RUNNING" => BlockedReason::PipelineRunning,
        "REQUESTED_CHANGES" => BlockedReason::ChangesRequested,
        "BLOCKED_STATUS" => BlockedReason::Dependencies,
        "EXTERNAL_STATUS_CHECKS" => BlockedReason::StatusChecks,
        "JIRA_ASSOCIATION" => BlockedReason::JiraIssue,
        "LOCKED_LFS_FILES" => BlockedReason::LockedFiles,
        "LOCKED_PATHS" => BlockedReason::LockedPaths,
        "MERGE_TIME" => BlockedReason::MergeTime,
        "NOT_OPEN" => BlockedReason::NotOpen,
        "COMMITS_STATUS" => BlockedReason::SourceBranch,
        "SECURITY_POLICIES_VIOLATIONS" => BlockedReason::SecurityPolicies,
        "SECURITY_POLICY_PIPELINE_CHECK" => BlockedReason::SecurityPipelines,
        "TITLE_NOT_MATCHING" => BlockedReason::TitleRule,
        unknown => {
            tracing::warn!(status = unknown, "unknown merge status, shown as blocked");
            BlockedReason::Other {
                status: unknown.to_owned(),
            }
        }
    }
}

#[cfg(test)]
mod tests;
