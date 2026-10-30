//! The GitLab project's open merge requests for the compare and range windows: found offline, listed through glab.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod detect;
mod job_page;
mod list;
mod page;
mod project;
mod query;

use serde::{Deserialize, Serialize};
use specta::Type;

pub use detect::{GitLabRepository, gitlab_repository};
pub use list::list_merge_requests;

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

/// The address of a failed job's log page on the project's GitLab; only `JobPage::built` makes one.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Type)]
pub struct JobPage(String);

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
    pub page: Option<JobPage>,
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
