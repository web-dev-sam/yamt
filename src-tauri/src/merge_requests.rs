use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use tauri::ipc::Channel;
use tauri::{App, Manager, Runtime, State, WebviewWindow};
use yamt_local_merge::{LocalMerge, MergeRequestBranches, Refusal, Started};
use yamt_merge_requests::{
    GitLabProject, GitLabRepository, Glab, ListEnd, MergeRequestIid, MergeRequestPage, OpenReply,
    PageOpened, ResolveRefusal, WebPage, gitlab_repository, prepare_open, prepare_resolve,
};

use crate::ipc_error::{IpcError, blocking_reply};
use crate::range::range_folder;
use crate::second_window;

const NO_PROJECT: &str = "this window's folder has no remote on a GitLab server";
const CLAIM_PROBE_INTERVAL: Duration = Duration::from_millis(50);
/// Long enough for a cold start of the merge window up to its claim.
const CLAIM_WAIT: Duration = Duration::from_secs(5);

/// One message of a load, in order: every page, then its end. The end travels on the channel too: tauri 2.12.1
/// delivers a channel message of 8 KiB of JSON or more by a later fetch (ipc/channel.rs
/// `MAX_JSON_DIRECT_EXECUTE_THRESHOLD`), so a page could reach the window after the command's own answer.
#[derive(Clone, Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum ListMessage {
    Page { page: MergeRequestPage },
    End { end: ListEnd },
}

/// What resolving a merge request's conflicts did (plan §2 #139): a merge started in this checkout and its
/// window started or not, or why nothing changed.
#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum ResolveReply {
    Started { started: Started },
    WindowFailed { started: Started, message: String },
    Refused { refusal: Refusal },
    GitLabRefused { refusal: ResolveRefusal },
}

/// What continuing an unfinished merge yamt started did (plan §2 #143); nothing in git changes.
#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum ContinueMergeReply {
    Opened { branch: String, target: String },
    AlreadyOpen,
    Ended,
    WindowFailed { message: String },
}

/// The window's GitLab project, found once at start, the folder pair locks live in, and every merge request's and
/// failed job's page a list sent in this run: only those may be opened (plan §2 #128–#137); never locked together
/// with another `Mutex`.
pub(crate) struct MergeRequestState {
    gitlab: Option<GitLabRepository>,
    range_dir: PathBuf,
    pages: Mutex<BTreeSet<WebPage>>,
}

/// Looks for a GitLab project in `folder`'s repository, offline, and hands it to the app.
pub(crate) fn manage<R: Runtime>(app: &App<R>, folder: &Path, app_folder: &Path) {
    app.manage(MergeRequestState {
        gitlab: gitlab_repository(folder),
        range_dir: range_folder(app_folder),
        pages: Mutex::new(BTreeSet::new()),
    });
}

fn offered(pages: &Mutex<BTreeSet<WebPage>>) -> MutexGuard<'_, BTreeSet<WebPage>> {
    pages.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Remembers the page's merge request and failed job pages as offered, then sends the page to the window.
fn forward_page(state: &MergeRequestState, channel: &Channel<ListMessage>, page: MergeRequestPage) {
    let mut pages = offered(&state.pages);
    for row in &page.rows {
        pages.extend(row.page.clone());
        let jobs = row
            .pipeline
            .iter()
            .flat_map(|pipeline| &pipeline.failed_jobs);
        pages.extend(jobs.filter_map(|job| job.page.clone()));
    }
    drop(pages);
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
        Ok(range) => second_window::start_range(&range),
        Err(reply) => reply,
    }
}

/// Starts merge request `iid`'s merge in this checkout, then its window by `start_window`, and waits for its claim.
fn resolved(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    start_window: impl FnOnce(&Path) -> Result<(), String>,
) -> ResolveReply {
    let Some(repository) = &state.gitlab else {
        let message = NO_PROJECT.to_owned();
        return ResolveReply::GitLabRefused {
            refusal: ResolveRefusal::Failed { message },
        };
    };
    let target = match prepare_resolve(repository, glab, iid) {
        Ok(target) => target,
        Err(refusal) => return ResolveReply::GitLabRefused { refusal },
    };
    let branches = MergeRequestBranches {
        iid: target.iid.0,
        remote: target.remote,
        branch: target.branch,
        target: target.target,
    };
    match yamt_local_merge::start(&target.root, &branches) {
        Err(refusal) => ResolveReply::Refused { refusal },
        Ok(started) => match start_window(&target.root) {
            Ok(()) => {
                wait_for_window_claim(&target.root);
                ResolveReply::Started { started }
            }
            Err(message) => ResolveReply::WindowFailed { started, message },
        },
    }
}

/// Starts the window of merge request `iid`'s unfinished merge again by `start_window` and waits for its claim,
/// unless the merge ended or its window is open.
fn continued(
    state: &MergeRequestState,
    iid: MergeRequestIid,
    start_window: impl FnOnce(&Path) -> Result<(), String>,
) -> ContinueMergeReply {
    let Some(repository) = &state.gitlab else {
        return ContinueMergeReply::Ended;
    };
    let root = repository.root();
    let live = match yamt_local_merge::find_live(root) {
        Ok(Some(live)) if live.iid() == iid.0 => live,
        Ok(_) => return ContinueMergeReply::Ended,
        Err(error) => {
            tracing::warn!(%error, "cannot tell whether a merge yamt started is in progress");
            return ContinueMergeReply::Ended;
        }
    };
    if yamt_local_merge::window_is_open(root) {
        return ContinueMergeReply::AlreadyOpen;
    }
    let view = live.view();
    match start_window(root) {
        Ok(()) => {
            wait_for_window_claim(root);
            ContinueMergeReply::Opened {
                branch: view.branch,
                target: view.target,
            }
        }
        Err(message) => ContinueMergeReply::WindowFailed { message },
    }
}

/// Returns once the merge window just started in `root` holds its claim, so that the reply is never read as a
/// closed window; after `CLAIM_WAIT` it gives up with a warning.
fn wait_for_window_claim(root: &Path) {
    let deadline = Instant::now() + CLAIM_WAIT;
    while !yamt_local_merge::window_is_open(root) {
        if Instant::now() >= deadline {
            tracing::warn!(root = %root.display(), "the merge window did not claim its merge in time");
            return;
        }
        thread::sleep(CLAIM_PROBE_INTERVAL);
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

#[tauri::command]
#[specta::specta]
pub(crate) async fn resolve_merge_request<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
) -> Result<ResolveReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(resolved(
            &window.state(),
            glab.as_ref(),
            iid,
            second_window::start_merge,
        ))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn continue_merge_request<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
) -> Result<ContinueMergeReply, IpcError> {
    blocking_reply(move || Ok(continued(&window.state(), iid, second_window::start_merge))).await
}

/// Whether a merge yamt started is unfinished in this window's repository; no GitLab project is `Free`.
#[tauri::command]
#[specta::specta]
pub(crate) async fn find_local_merge<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<LocalMerge, IpcError> {
    blocking_reply(move || Ok(local_merge(&window.state()))).await
}

fn local_merge(state: &MergeRequestState) -> LocalMerge {
    state
        .gitlab
        .as_ref()
        .map_or(LocalMerge::Free, |repository| {
            yamt_local_merge::local_merge(repository.root())
        })
}

/// Opens `page` in the browser only when a list of this window sent it: the window cannot hand any other
/// address to the system.
#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn open_page(state: State<'_, MergeRequestState>, page: WebPage) -> PageOpened {
    if !offered(&state.pages).contains(&page) {
        tracing::warn!(page = page.as_str(), "a GitLab page no list sent");
        return PageOpened::NotOffered;
    }
    yamt_merge_requests::open_page(&page)
}

#[cfg(test)]
mod tests;
