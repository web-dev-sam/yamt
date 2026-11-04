use std::ops::Range;

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::{Glab, HttpCall};

use crate::query::{
    draft_reply_args, draft_reply_body, reply_args, reply_body, resolve_args, resolve_body,
    submit_review_args, submit_review_body,
};
use crate::{DiscussionId, GitLabRepository, MergeRequestIid};

const NOTHING_TO_SEND: &str = "There is nothing to send.";
/// HTTP's client errors: GitLab refused the write as asked (RFC 9110 §15.5).
const REFUSED: Range<u16> = 400..500;

/// How a reply is posted: at once, or as a draft of the viewer's review.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ReplyKind {
    /// A comment everyone sees now.
    Comment,
    /// A draft, published with the review.
    Draft,
}

/// How a write to a discussion ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiscussionWriteReply {
    /// GitLab took it.
    Sent,
    /// GitLab answered 4xx: `HttpAnswer::reason()` (its `message`/`error`, glab's line, `HTTP <code>`); also a
    /// blank text, before any glab run: "There is nothing to send."
    Refused {
        /// Why.
        reason: String,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// No HTTP answer (glab failed, timed out), a 5xx or another status (its reason), or `NO_PROJECT`.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// One of the four writes, with what it names.
pub(super) enum Write<'a> {
    Reply {
        discussion: &'a DiscussionId,
        kind: ReplyKind,
        text: &'a str,
    },
    Resolve {
        discussion: &'a DiscussionId,
        resolve: bool,
    },
    Submit,
}

/// Posts `text`, as written, to `discussion` as a comment or as a draft: one `Glab::send` (RK54); a blank text is
/// refused before any glab run.
#[must_use]
pub fn reply_to_discussion(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    discussion: &DiscussionId,
    kind: ReplyKind,
    text: &str,
) -> DiscussionWriteReply {
    let write = Write::Reply {
        discussion,
        kind,
        text,
    };
    if text.trim().is_empty() {
        let refused = DiscussionWriteReply::Refused {
            reason: NOTHING_TO_SEND.to_owned(),
        };
        return logged(iid, &write, (refused, None));
    }
    written(repository, glab, iid, &write)
}

/// Resolves `discussion`, or unresolves it when `resolve` is false: one `Glab::send` (RK54).
#[must_use]
pub fn resolve_discussion(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    discussion: &DiscussionId,
    resolve: bool,
) -> DiscussionWriteReply {
    let write = Write::Resolve {
        discussion,
        resolve,
    };
    written(repository, glab, iid, &write)
}

/// Publishes all the viewer's drafts on merge request `iid`, with no `reviewer_state`: one `Glab::send` (RK54).
#[must_use]
pub fn submit_review(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> DiscussionWriteReply {
    written(repository, glab, iid, &Write::Submit)
}

fn written(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    write: &Write,
) -> DiscussionWriteReply {
    logged(iid, write, sent(repository, glab, iid, write))
}

/// glab missing → `GlabMissing`; the remembered project; then exactly one `Glab::send` of the write's argv and body;
/// a failure's words (`failure_words`) through `logged_out_after`. The reply, and GitLab's status when it answered.
fn sent(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    write: &Write,
) -> (DiscussionWriteReply, Option<u16>) {
    let Some(glab) = glab else {
        return (DiscussionWriteReply::GlabMissing, None);
    };
    let project = match repository.logged_in_project(glab) {
        Ok(project) => project,
        Err(refused) => return (refused.into(), None),
    };
    let (args, body) = request(write, &project.full_path, iid);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let call = glab.send(repository.root(), &args, Some(body));
    let logged_out =
        failure_words(&call).and_then(|words| repository.logged_out_after(glab, words));
    let (reply, status) = replied(call);
    match logged_out {
        Some(detail) => (DiscussionWriteReply::NotLoggedIn { detail }, status),
        None => (reply, status),
    }
}

/// glab's line of a non-2xx answer, or its words when GitLab never answered; None for a 2xx.
pub(super) fn failure_words(call: &HttpCall) -> Option<&str> {
    match call {
        HttpCall::Answered(answer) if answer.is_success() => None,
        HttpCall::Answered(answer) => answer.glab_line.as_deref(),
        HttpCall::NotAnswered(message) => Some(message),
    }
}

/// The write's argv and stdin body (`query.rs`).
pub(super) fn request(
    write: &Write,
    full_path: &str,
    iid: MergeRequestIid,
) -> (Vec<String>, Vec<u8>) {
    match *write {
        Write::Reply {
            discussion,
            kind: ReplyKind::Comment,
            text,
        } => (reply_args(full_path, iid, discussion), reply_body(text)),
        Write::Reply {
            discussion,
            kind: ReplyKind::Draft,
            text,
        } => (
            draft_reply_args(full_path, iid),
            draft_reply_body(text, discussion),
        ),
        Write::Resolve {
            discussion,
            resolve,
        } => (
            resolve_args(full_path, iid, discussion),
            resolve_body(resolve),
        ),
        Write::Submit => (submit_review_args(full_path, iid), submit_review_body()),
    }
}

/// 2xx → Sent (the body is not read); 4xx → Refused; any other status → Failed, both with `HttpAnswer::reason`; no
/// answer → Failed in glab's words. Beside it, GitLab's status when it answered.
pub(super) fn replied(call: HttpCall) -> (DiscussionWriteReply, Option<u16>) {
    let answer = match call {
        HttpCall::Answered(answer) => answer,
        HttpCall::NotAnswered(message) => return (DiscussionWriteReply::Failed { message }, None),
    };
    let reply = if answer.is_success() {
        DiscussionWriteReply::Sent
    } else if REFUSED.contains(&answer.status) {
        DiscussionWriteReply::Refused {
            reason: answer.reason(),
        }
    } else {
        DiscussionWriteReply::Failed {
            message: answer.reason(),
        }
    };
    (reply, Some(answer.status))
}

/// One line per write: never the text, a name or the discussion id.
fn logged(
    iid: MergeRequestIid,
    write: &Write,
    (reply, status): (DiscussionWriteReply, Option<u16>),
) -> DiscussionWriteReply {
    tracing::info!(
        iid = iid.0,
        kind = kind(write),
        outcome = outcome(&reply),
        status,
        "wrote to a merge request's discussion"
    );
    reply
}

pub(super) fn kind(write: &Write) -> &'static str {
    match write {
        Write::Reply {
            kind: ReplyKind::Comment,
            ..
        } => "comment",
        Write::Reply {
            kind: ReplyKind::Draft,
            ..
        } => "draft",
        Write::Resolve { resolve: true, .. } => "resolve",
        Write::Resolve { resolve: false, .. } => "unresolve",
        Write::Submit => "submit",
    }
}

pub(super) fn outcome(reply: &DiscussionWriteReply) -> &'static str {
    match reply {
        DiscussionWriteReply::Sent => "sent",
        DiscussionWriteReply::Refused { .. } => "refused",
        DiscussionWriteReply::GlabMissing => "glabMissing",
        DiscussionWriteReply::NotLoggedIn { .. } => "notLoggedIn",
        DiscussionWriteReply::Failed { .. } => "failed",
    }
}
