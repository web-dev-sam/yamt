use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::ipc::Channel;
use tauri::{App, Manager, Runtime, State, WebviewWindow};
use yamt_merge_requests::{
    GitLabProject, GitLabRepository, Glab, JobOpened, JobPage, ListEnd, MergeRequestIid,
    MergeRequestPage, OpenReply, gitlab_repository, prepare_open,
};

use crate::ipc_error::{IpcError, blocking_reply};
use crate::range::range_folder;
use crate::range_window;

const NO_PROJECT: &str = "this window's folder has no remote on a GitLab server";

/// One message of a load, in order: every page, then its end. The end travels on the channel too: tauri 2.12.1
/// delivers a channel message of 8 KiB of JSON or more by a later fetch (ipc/channel.rs
/// `MAX_JSON_DIRECT_EXECUTE_THRESHOLD`), so a page could reach the window after the command's own answer.
#[derive(Clone, Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum ListMessage {
    Page { page: MergeRequestPage },
    End { end: ListEnd },
}

/// The window's GitLab project, found once at start, the folder pair locks live in, and every job page a list
/// sent in this run: only those may be opened (plan §2 #128–#135); never locked together with another `Mutex`.
pub(crate) struct MergeRequestState {
    gitlab: Option<GitLabRepository>,
    range_dir: PathBuf,
    job_pages: Mutex<BTreeSet<JobPage>>,
}

/// Looks for a GitLab project in `folder`'s repository, offline, and hands it to the app.
pub(crate) fn manage<R: Runtime>(app: &App<R>, folder: &Path, app_folder: &Path) {
    app.manage(MergeRequestState {
        gitlab: gitlab_repository(folder),
        range_dir: range_folder(app_folder),
        job_pages: Mutex::new(BTreeSet::new()),
    });
}

fn offered(job_pages: &Mutex<BTreeSet<JobPage>>) -> MutexGuard<'_, BTreeSet<JobPage>> {
    job_pages.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Remembers the page's job pages as offered, then sends the page to the window.
fn forward_page(state: &MergeRequestState, channel: &Channel<ListMessage>, page: MergeRequestPage) {
    let mut job_pages = offered(&state.job_pages);
    for row in &page.rows {
        let jobs = row
            .pipeline
            .iter()
            .flat_map(|pipeline| &pipeline.failed_jobs);
        job_pages.extend(jobs.filter_map(|job| job.page.clone()));
    }
    drop(job_pages);
    send(channel, ListMessage::Page { page });
}

fn send(channel: &Channel<ListMessage>, message: ListMessage) {
    if let Err(error) = channel.send(message) {
        tracing::warn!(%error, "a message of the merge-request list did not reach the window");
    }
}

/// Sends every page, then the end.
fn list(state: &MergeRequestState, glab: Option<&Glab>, channel: &Channel<ListMessage>) {
    let end = match &state.gitlab {
        Some(repository) => {
            let on_page = |page| forward_page(state, channel, page);
            yamt_merge_requests::list_merge_requests(repository, glab, &on_page)
        }
        None => ListEnd::Failed {
            message: NO_PROJECT.to_owned(),
        },
    };
    send(channel, ListMessage::End { end });
}

fn opened(state: &MergeRequestState, glab: Option<&Glab>, iid: MergeRequestIid) -> OpenReply {
    let Some(repository) = &state.gitlab else {
        return OpenReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    match prepare_open(repository, glab, iid, &state.range_dir) {
        Ok(range) => range_window::start(&range),
        Err(reply) => reply,
    }
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn find_gitlab_project(state: State<'_, MergeRequestState>) -> GitLabProject {
    state
        .gitlab
        .as_ref()
        .map_or(GitLabProject::None, GitLabRepository::project)
}

// The state comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
pub(crate) async fn list_merge_requests<R: Runtime>(
    window: WebviewWindow<R>,
    messages: Channel<ListMessage>,
) -> Result<(), IpcError> {
    blocking_reply(move || {
        list(&window.state(), Glab::find().as_ref(), &messages);
        Ok(())
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn open_merge_request<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
) -> Result<OpenReply, IpcError> {
    blocking_reply(move || Ok(opened(&window.state(), Glab::find().as_ref(), iid))).await
}

/// Opens `page` in the browser only when a list of this window sent it: the window cannot hand any other
/// address to the system.
#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn open_job_page(state: State<'_, MergeRequestState>, page: JobPage) -> JobOpened {
    if !offered(&state.job_pages).contains(&page) {
        tracing::warn!(page = page.as_str(), "a job page no list sent");
        return JobOpened::NotOffered;
    }
    yamt_merge_requests::open_job_page(&page)
}

#[cfg(test)]
mod tests;
