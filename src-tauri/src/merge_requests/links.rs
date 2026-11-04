use tauri::{Manager, Runtime, WebviewWindow};
use yamt_merge_requests::{Glab, LinksReply, MergeRequestIid};

use super::{MergeRequestState, NO_PROJECT, offer};
use crate::ipc_error::{IpcError, blocking_reply};

/// No GitLab project → `Failed`; else glab reads the links, and every line's and parent's page is offered before the
/// reply is returned; `pages` is never held while glab runs.
pub(super) fn links_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> LinksReply {
    let Some(repository) = &state.gitlab else {
        return LinksReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    let read = yamt_merge_requests::read_links(repository, glab, iid);
    offer(state, read.pages, Vec::new());
    read.reply
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_links<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
) -> Result<LinksReply, IpcError> {
    blocking_reply(move || Ok(links_reply(&window.state(), Glab::find().as_ref(), iid))).await
}
