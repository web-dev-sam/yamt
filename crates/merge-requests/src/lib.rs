//! The GitLab project's open merge requests for the compare and range windows: found offline, listed through glab,
//! each one's changes prepared for a window of their own, its page or a failed job's opened in the browser.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod detect;
mod list;
mod open;
mod page;
mod project;
mod query;
mod remote;
mod resolve;
mod web_page;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use specta::Type;

pub use detect::{GitLabRepository, gitlab_repository};
pub use list::list_merge_requests;
pub use open::prepare_open;
pub use resolve::prepare_resolve;
pub use web_page::open_page;
pub use yamt_gitio::Glab;

/// Merge requests asked for in one glab call: GitLab's largest page.
pub const PAGE_SIZE: u32 = 100;
/// The most merge requests one load lists; beyond, the list ends `Cut`.
pub const MAX_MERGE_REQUESTS: u32 = 500;
const MAX_FAILED_JOBS: u32 = 50;

/// Whether the window shows the button: decided once at start, offline.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GitLabProject {
    /// No repository, or no remote on a GitLab server.
    None,
    /// A repository with a remote on a GitLab server.
    Found {
        /// The absolute common git dir (lossy UTF-8): the key filters are remembered by.
        repository: String,
    },
}

/// A merge request's number within its project, "!12" without the "!".
#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Type,
)]
pub struct MergeRequestIid(pub u32);

/// A GitLab user.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    /// The login name, without "@".
    pub username: String,
    /// The display name.
    pub name: String,
}

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

/// The address of a page on the project's GitLab that this window may open in the browser: a failed job's log or
/// a merge request; only `WebPage::job` and `WebPage::merge_request` make one.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Type)]
pub struct WebPage(String);

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

/// Whether a merge request can be merged, GitLab's `detailedMergeStatus` folded with its `conflicts` flag: one
/// state per row, a conflict first.
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
    /// Its assignees.
    pub assignees: Vec<Person>,
    /// Its reviewers.
    pub reviewers: Vec<Person>,
    /// Its labels' titles.
    pub labels: Vec<String>,
    /// Resolvable discussions not yet resolved.
    pub open_discussions: u32,
    /// Approvals given.
    pub approvals: u32,
    /// Its latest pipeline; `None` when it has none.
    pub pipeline: Option<Pipeline>,
    /// Its page on GitLab; `None` when GitLab is not on https.
    pub page: Option<WebPage>,
    /// How much it changes; `None` when GitLab has not counted it.
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

/// How a load ended; the pages already sent stay.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ListEnd {
    /// Every open merge request was sent.
    Loaded,
    /// The newest `limit` were sent; GitLab has more.
    Cut {
        /// How many were sent.
        limit: u32,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first output line, which names the instance.
        detail: String,
    },
    /// glab failed, timed out or answered something unexpected.
    Failed {
        /// What went wrong, in glab's, GitLab's or yamt's words.
        message: String,
    },
}

/// How asking to open a merge request's changes ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OpenReply {
    /// A new window shows them.
    Opened,
    /// Another yamt window shows the same two commits.
    AlreadyOpen,
    /// GitLab still prepares the merge request's diff.
    Preparing,
    /// The merge request is no longer open.
    NotOpen,
    /// No remote of the repository names the project, so its commits cannot be fetched.
    NoRemote {
        /// The project's full path, `group/project`.
        project: String,
    },
    /// Fetching the merge request's commits failed.
    FetchFailed {
        /// git's first line: the cause.
        message: String,
    },
    /// A commit of GitLab's diff is not in the repository, even after the fetch.
    MissingCommit {
        /// Its short id.
        short_id: String,
    },
    /// The new window's yamt did not start.
    StartFailed {
        /// Why, in the system's words.
        message: String,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first output line, which names the instance.
        detail: String,
    },
    /// glab or git failed, timed out or answered something unexpected.
    Failed {
        /// What went wrong, in glab's, GitLab's, git's or yamt's words.
        message: String,
    },
}

/// How asking to open a page on GitLab ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PageOpened {
    /// The browser was asked to show it.
    Opened,
    /// This window's list never offered that address, so it is not opened.
    NotOffered,
    /// The browser could not be asked.
    Failed {
        /// Why, in the system's words.
        message: String,
    },
}

/// A merge request's changes as a range the new window opens: `<base_sha>..<head_sha>` in `root`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RangeToOpen {
    /// The repository's work tree root, absolute.
    pub root: PathBuf,
    /// `<base_sha>..<head_sha>`, both GitLab's full commit ids.
    pub spec: String,
}

/// The branches of merge request `iid` and the remote holding them, asked afresh (plan §2 #139).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolveTarget {
    /// The repository's work tree root, absolute.
    pub root: PathBuf,
    /// The merge request.
    pub iid: MergeRequestIid,
    /// The name of the remote that names the project.
    pub remote: String,
    /// Its source branch.
    pub branch: String,
    /// Its target branch.
    pub target: String,
}

/// Why the branches of a merge request to resolve are not given.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolveRefusal {
    /// The merge request is no longer open.
    NotOpen,
    /// Its source branch lives in another project.
    FromFork,
    /// No remote of the repository names the project.
    NoRemote {
        /// The project's full path, `group/project`.
        project: String,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first output line, which names the instance.
        detail: String,
    },
    /// glab failed, timed out or answered something unexpected.
    Failed {
        /// What went wrong, in glab's, GitLab's or yamt's words.
        message: String,
    },
}
