mod drafts;
mod read;
mod write;

use serde::Serialize;
use specta::Type;

use crate::{Description, OfferedPicture, OfferedUpload, OpenDiscussion, Person, WebPage};

pub use read::read_discussion_thread;
pub use write::{
    DiscussionWriteReply, ReplyKind, reply_to_discussion, resolve_discussion, submit_review,
};

/// How reading a discussion's whole thread ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[expect(
    clippy::large_enum_variant,
    reason = "one value per read, returned and serialized at once; never stored"
)]
pub enum DiscussionThreadReply {
    /// The thread.
    Read {
        /// The thread.
        thread: DiscussionThread,
    },
    /// The merge request answered, without this discussion (deleted, or never there).
    NotFound,
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// glab's or GitLab's words, `page.rs` `NO_PROJECT`, or the 200-note rule's sentence.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// A discussion's whole thread, and what the viewer may do in it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiscussionThread {
    /// The same turn data the box gets, built by the same function (resolved or not).
    pub discussion: OpenDiscussion,
    /// Whether it is resolved.
    pub resolved: bool,
    /// Every person note, oldest first; never empty (the discussion has one). System notes left out (RK61).
    pub comments: Vec<DiscussionComment>,
    /// The viewer's pending drafts in this discussion, in GitLab's order.
    pub drafts: Vec<PendingDraft>,
    /// All the viewer's pending drafts on this merge request (C9).
    pub pending: u32,
    /// Whether the viewer may comment.
    pub commenting: Commenting,
    /// `Discussion.userPermissions.resolveNote`, and the discussion resolvable.
    pub may_resolve: bool,
}

/// A comment of a thread.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiscussionComment {
    /// Who wrote it; `None` for a deleted user.
    pub author: Option<Person>,
    /// When it was written: GitLab's ISO 8601 time, as sent.
    pub created_at: String,
    /// Edited as GitLab's `Note#edited?` means it: `lastEditedBy` a person and `lastEditedAt` after `createdAt`
    /// (`app/models/note.rb:533-545`; resolving moves `lastEditedAt` alone, measured, design §1.3).
    pub edited: Option<NoteEdit>,
    /// GitLab's `bodyHtml` reduced by `described_on` on the merge request's page (RK60, RK66: no other path).
    pub body: Description,
    /// Its page on GitLab; `None` when GitLab's `url` is not the one it builds for this note.
    pub page: Option<WebPage>,
}

/// When and by whom a comment was last edited.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NoteEdit {
    /// GitLab's ISO 8601 time, as sent.
    pub at: String,
    /// Who edited it.
    pub by: Person,
}

/// A draft's raw text as written (GitLab's draft list sends no rendering; design §4 item 3).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PendingDraft {
    /// The text.
    pub text: String,
}

/// Whether the viewer may comment on the merge request: `createNote` true → allowed; false with `discussionLocked`
/// → locked; false → not allowed.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Commenting {
    /// They may.
    Allowed,
    /// Comments are locked to project members, and the viewer is not one.
    Locked,
    /// They may not.
    NotAllowed,
}

/// Not IPC: what the shell offers before it replies (RK41, RK53).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadThread {
    /// The reply the window gets.
    pub reply: DiscussionThreadReply,
    /// Every comment's page and every link's page of every comment, once each, in order.
    pub pages: Vec<WebPage>,
    /// Every upload the comments name, once each.
    pub uploads: Vec<OfferedUpload>,
    /// The uploaded pictures of the comments' and editors' authors, one per username.
    pub pictures: Vec<OfferedPicture>,
}

#[cfg(test)]
mod tests;
