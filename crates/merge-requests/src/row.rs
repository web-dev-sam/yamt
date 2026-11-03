use serde::Serialize;
use specta::Type;

use crate::{Label, MergeRequestIid, Person, Reviewer, WebPage};

/// A pipeline's status, GitLab's fifteen folded into the seven the window shows.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CiStatus {
    /// It succeeded.
    Passed,
    /// It failed.
    Failed,
    /// It runs.
    Running,
    /// It waits to run.
    Pending,
    /// It was canceled.
    Canceled,
    /// It was skipped.
    Skipped,
    /// It waits for a manual job.
    Manual,
}

/// A failed job of a merge request's latest pipeline, the latest run of it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FailedJob {
    /// The job's name.
    pub name: String,
    /// Its stage's name.
    pub stage: String,
    /// Whether the pipeline may pass while it fails.
    pub allow_failure: bool,
    /// Its log page; `None` when GitLab is not on https or sent an odd path.
    pub page: Option<WebPage>,
}

/// A merge request's latest pipeline.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Pipeline {
    /// Its status.
    pub status: CiStatus,
    /// Its failed jobs, in GitLab's order.
    pub failed_jobs: Vec<FailedJob>,
    /// Whether it has more failed jobs than were asked for.
    pub more_failed_jobs: bool,
}

/// How much a merge request changes, GitLab's counts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSize {
    /// Lines added.
    pub additions: u32,
    /// Lines removed.
    pub deletions: u32,
    /// Files changed.
    pub files: u32,
}

/// Whether a merge request can be merged, GitLab's `detailedMergeStatus` folded with its `conflicts` flag, or with
/// yamt's own merge of its two commits: one state per row, a conflict first.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Readiness {
    /// It can be merged.
    Ready,
    /// Its branch conflicts with its target.
    Conflicts {
        /// What else blocks it, GitLab's status first, then `Draft`; empty when nothing else is known.
        also: Vec<BlockedReason>,
    },
    /// Its branch must be rebased first.
    NeedsRebase,
    /// GitLab still checks whether it can be merged.
    Checking,
    /// Something other than a conflict blocks it.
    Blocked {
        /// What blocks it.
        reason: BlockedReason,
    },
    /// yamt's own merge of GitLab's two commits is clean, and GitLab's status says nothing of the other blockers:
    /// it still checks, or keeps a conflict that hides them (request rule 3).
    MergesCleanly,
}

/// A row's readiness once yamt merged GitLab's two commits itself; sent only when it differs from GitLab's answer.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CheckedRow {
    /// The row's merge request.
    pub iid: MergeRequestIid,
    /// Its readiness after the local merge.
    pub readiness: Readiness,
}

/// What blocks a merge, GitLab's `DetailedMergeStatus` in the window's words.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum BlockedReason {
    /// It is a draft.
    Draft,
    /// Discussions are unresolved.
    Discussions,
    /// Approvals are missing.
    Approvals,
    /// The pipeline must pass.
    PipelineMustPass,
    /// The pipeline still runs.
    PipelineRunning,
    /// A reviewer requested changes.
    ChangesRequested,
    /// Merge requests it depends on must be merged first.
    Dependencies,
    /// External status checks must pass.
    StatusChecks,
    /// Its title or description must name a Jira issue.
    JiraIssue,
    /// It changes LFS files someone locked.
    LockedFiles,
    /// It changes paths someone locked.
    LockedPaths,
    /// It may not be merged at this time.
    MergeTime,
    /// It is not open.
    NotOpen,
    /// Its source branch is missing or has no commits.
    SourceBranch,
    /// Security policies are not satisfied.
    SecurityPolicies,
    /// Security policy pipelines must pass.
    SecurityPipelines,
    /// Its title does not match the project's rule.
    TitleRule,
    /// A status yamt does not know.
    Other {
        /// GitLab's word for it.
        status: String,
    },
}

/// One open merge request as a row of the list.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequestRow {
    /// Its number.
    pub iid: MergeRequestIid,
    /// Its title, GitLab's "Draft: " prefix included.
    pub title: String,
    /// GitLab's ISO 8601 time, as sent.
    pub created_at: String,
    /// Whether it is a draft.
    pub draft: bool,
    /// Who opened it; `None` when GitLab names no one.
    pub author: Option<Person>,
    /// Its assignees.
    pub assignees: Vec<Person>,
    /// Its reviewers and how far each review is.
    pub reviewers: Vec<Reviewer>,
    /// Its labels, in GitLab's order.
    pub labels: Vec<Label>,
    /// Resolvable discussions not yet resolved.
    pub open_discussions: u32,
    /// Who approved it.
    pub approved_by: Vec<Person>,
    /// GitLab's `updateMergeRequest` permission for you: whether you may re-request a review and add or remove
    /// assignees and reviewers.
    pub may_rerequest: bool,
    /// Its latest pipeline; `None` when it has none.
    pub pipeline: Option<Pipeline>,
    /// Its page on GitLab; `None` when GitLab is not on https.
    pub page: Option<WebPage>,
    /// How much it changes; `None` when GitLab has not computed its diff.
    pub size: Option<ChangeSize>,
    /// Whether it can be merged.
    pub readiness: Readiness,
    /// Whether its branch lives in another project than its target, or in a deleted one.
    pub from_fork: bool,
}

/// One page of the list, sent as soon as it arrives.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequestPage {
    /// The logged-in user's username.
    pub me: Option<String>,
    /// The page's merge requests, newest first.
    pub rows: Vec<MergeRequestRow>,
}
