use tauri::{Manager, Runtime, WebviewWindow};
use yamt_merge_requests::{DescriptionReply, Glab, MergeRequestIid};

use super::{MergeRequestState, NO_PROJECT, offer_described};
use crate::ipc_error::{IpcError, blocking_reply};

/// No GitLab project → `Failed`; else glab reads the description, and its pages are offered, then its uploads, each
/// lock held alone, before the reply is returned.
pub(super) fn description_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> DescriptionReply {
    let Some(repository) = &state.gitlab else {
        return DescriptionReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    let read = yamt_merge_requests::read_description(repository, glab, iid);
    offer_described(state, read.pages, read.uploads);
    read.reply
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_description<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
) -> Result<DescriptionReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(description_reply(&window.state(), glab.as_ref(), iid))
    })
    .await
}
