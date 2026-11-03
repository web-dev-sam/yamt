use std::sync::PoisonError;

use tauri::ipc::Channel;
use yamt_merge_requests::{
    CheckedRow, Glab, ListEnd, ListedPage, MergeRequestPage, MergeRequestRow, WebPage,
    check_conflicts,
};

use super::{MergeRequestState, NO_PROJECT, offer};

/// One message of a load, in order: every page, then its end, then each row the local conflict check changed. The
/// end travels on the channel too: tauri 2.12.1 delivers a channel message of 8 KiB of JSON or more by a later fetch
/// (ipc/channel.rs `MAX_JSON_DIRECT_EXECUTE_THRESHOLD`), so a page could reach the window after the command's own
/// answer.
#[derive(Clone, Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum ListMessage {
    Page { page: MergeRequestPage },
    End { end: ListEnd },
    Checked { row: CheckedRow },
}

/// The page of `row` and of each of its failed jobs.
fn row_pages(row: &MergeRequestRow) -> impl Iterator<Item = WebPage> + '_ {
    let jobs = row
        .pipeline
        .iter()
        .flat_map(|pipeline| &pipeline.failed_jobs);
    row.page
        .clone()
        .into_iter()
        .chain(jobs.filter_map(|job| job.page.clone()))
}

/// Offers the page's merge request and failed job pages and its uploaded pictures, then sends the page to the window.
fn forward_page(state: &MergeRequestState, channel: &Channel<ListMessage>, listed: ListedPage) {
    let pages = listed.page.rows.iter().flat_map(row_pages);
    offer(state, pages, listed.pictures);
    send(channel, ListMessage::Page { page: listed.page });
}

fn send(channel: &Channel<ListMessage>, message: ListMessage) {
    if let Err(error) = channel.send(message) {
        tracing::warn!(%error, "a message of the merge-request list did not reach the window");
    }
}

/// Sends every page, then the end, then — when the list reached the project — each row the local conflict check
/// changed; a `Checked` that does not reach the window is not logged (request rule 8: the check's one line per load).
pub(super) fn list(state: &MergeRequestState, glab: Option<&Glab>, channel: &Channel<ListMessage>) {
    let Some(repository) = &state.gitlab else {
        let end = ListEnd::Failed {
            message: NO_PROJECT.to_owned(),
        };
        send(channel, ListMessage::End { end });
        return;
    };
    let on_page = |page| forward_page(state, channel, page);
    let listed = yamt_merge_requests::list_merge_requests(repository, glab, &on_page);
    send(channel, ListMessage::End { end: listed.end });
    let Some(check) = listed.to_check else {
        return;
    };
    let mut merged = state.merged.lock().unwrap_or_else(PoisonError::into_inner);
    let on_checked = |row| {
        let _unlogged = channel.send(ListMessage::Checked { row });
    };
    check_conflicts(repository, &check, &mut merged, &on_checked);
}
