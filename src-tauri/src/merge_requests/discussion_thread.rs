use tauri::{Manager, Runtime, WebviewWindow};
use yamt_merge_requests::{
    DiscussionId, DiscussionThreadReply, DiscussionWriteReply, GitLabRepository, Glab,
    MarkdownPreviewReply, MergeRequestIid, ReplyKind,
};

use super::{MergeRequestState, NO_PROJECT, offer_described};
use crate::ipc_error::{IpcError, blocking_reply};

/// The thread's pages are offered, then its uploads, then its pictures — each lock held alone — before the reply
/// is returned (RK41, RK53; `offer`, `offer_described`).
pub(super) fn thread_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    discussion: &DiscussionId,
) -> DiscussionThreadReply {
    let Some(repository) = &state.gitlab else {
        return DiscussionThreadReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    let read = yamt_merge_requests::read_discussion_thread(repository, glab, iid, discussion);
    offer_described(state, read.pages, read.uploads);
    state.pictures.offer(read.pictures);
    read.reply
}

/// The preview's pages and uploads offered before the reply, as a description's.
pub(super) fn preview_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    text: &str,
) -> MarkdownPreviewReply {
    let Some(repository) = &state.gitlab else {
        return MarkdownPreviewReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    let read = yamt_merge_requests::preview_markdown(repository, glab, iid, text);
    offer_described(state, read.pages, read.uploads);
    read.reply
}

/// No GitLab project → `Failed`; else the one write `send` makes. A write answers no page, so nothing is offered.
fn written(
    state: &MergeRequestState,
    send: impl FnOnce(&GitLabRepository) -> DiscussionWriteReply,
) -> DiscussionWriteReply {
    match &state.gitlab {
        Some(repository) => send(repository),
        None => DiscussionWriteReply::Failed {
            message: NO_PROJECT.to_owned(),
        },
    }
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_discussion_thread<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
    discussion: DiscussionId,
) -> Result<DiscussionThreadReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(thread_reply(
            &window.state(),
            glab.as_ref(),
            iid,
            &discussion,
        ))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn reply_to_discussion<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
    discussion: DiscussionId,
    kind: ReplyKind,
    text: String,
) -> Result<DiscussionWriteReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(written(&window.state(), |repository| {
            yamt_merge_requests::reply_to_discussion(
                repository,
                glab.as_ref(),
                iid,
                &discussion,
                kind,
                &text,
            )
        }))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn resolve_discussion<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
    discussion: DiscussionId,
    resolve: bool,
) -> Result<DiscussionWriteReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(written(&window.state(), |repository| {
            yamt_merge_requests::resolve_discussion(
                repository,
                glab.as_ref(),
                iid,
                &discussion,
                resolve,
            )
        }))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn submit_review<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
) -> Result<DiscussionWriteReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(written(&window.state(), |repository| {
            yamt_merge_requests::submit_review(repository, glab.as_ref(), iid)
        }))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn preview_markdown<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
    text: String,
) -> Result<MarkdownPreviewReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(preview_reply(&window.state(), glab.as_ref(), iid, &text))
    })
    .await
}
