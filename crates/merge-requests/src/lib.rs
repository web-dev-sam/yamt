//! The GitLab project's open merge requests for the compare and range windows: found offline, listed through glab,
//! each row's conflicts checked by yamt's own merge of GitLab's two commits, each one's changes prepared for a window
//! of their own, its page or a failed job's opened in the browser, a failed job's log read, each row's open
//! discussions read with every person's note, a discussion's whole thread read and answered, a text previewed as
//! GitLab renders it, its assignees and reviewers added and removed, its description read as GitLab renders it, and
//! the epics, issues and commits it links to looked up.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod check;
mod description;
mod detect;
mod discussion_thread;
mod discussions;
mod job_log;
mod labels;
mod links;
mod list;
mod markdown_preview;
mod open;
mod page;
mod people;
mod people_change;
mod people_search;
mod picture;
mod project;
mod query;
mod readiness;
mod remote;
mod rerequest;
mod resolve;
mod row;
mod web_page;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use specta::Type;

pub use check::{CheckSummary, ConflictCheck, MergedPairs, check_conflicts};
pub use description::{
    CellAlign, Description, DescriptionBlock, DescriptionCell, DescriptionImage, DescriptionInline,
    DescriptionItem, DescriptionLink, DescriptionReply, DescriptionRow, HeadingLevel, ImageLength,
    ImageSize, ListNumbering, OfferedUpload, ReadDescription, TaskBox, UploadKey, read_description,
};
pub use detect::{GitLabRepository, gitlab_repository};
pub use discussion_thread::{
    Commenting, DiscussionComment, DiscussionThread, DiscussionThreadReply, DiscussionWriteReply,
    NoteEdit, PendingDraft, ReadThread, ReplyKind, read_discussion_thread, reply_to_discussion,
    resolve_discussion, submit_review,
};
pub use discussions::{
    DISCUSSION_BATCH, DiscussionId, DiscussionNote, DiscussionPlace, DiscussionsAnswer,
    FirstComment, Mention, OpenDiscussion, ReadDiscussions, RowDiscussions, TurnComment,
    read_discussions, unread_discussions,
};
pub use job_log::{JobLog, JobLogReply, MAX_LOG_BYTES, read_job_log};
pub use labels::{Label, LabelColors};
pub use links::{
    DescriptionLinks, LinkedCommit, LinkedEpic, LinkedIssue, LinkedParent, LinksReply, ReadLinks,
    ShownEpic, ShownIssue, read_links,
};
pub use list::{Listed, ListedPage, OfferedPicture, list_merge_requests};
pub use markdown_preview::{MarkdownPreviewReply, ReadPreview, preview_markdown};
pub use open::prepare_open;
pub use people::{Person, PersonPicture, ReviewState, Reviewer};
pub use people_change::{
    ChangedPeople, MergeRequestPeople, PeopleAction, PeopleChange, PeopleChangeReply, PeopleGroup,
    change_people,
};
pub use people_search::{FoundPeople, PeopleSearchReply, search_people};
pub use picture::{
    GravatarAddress, ImageKind, MAX_PICTURE_BYTES, MAX_UPLOAD_BYTES, Picture, PictureAddress,
    fetch_picture,
};
pub use rerequest::{RerequestReply, rerequest_review};
pub use resolve::prepare_resolve;
pub use row::{
    BlockedReason, ChangeSize, CheckedRow, CiStatus, FailedJob, MergeRequestPage, MergeRequestRow,
    Pipeline, Readiness,
};
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

/// The address of a page this window may open in the browser: a failed job's log, a merge request or a note on one,
/// on the project's GitLab, or a link in a description; only `WebPage::job`, `::merge_request`, `::note` and
/// `::linked` make one.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Type)]
pub struct WebPage(String);

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
