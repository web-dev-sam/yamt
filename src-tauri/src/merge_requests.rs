use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use tauri::ipc::Channel;
use tauri::{App, Manager, Runtime, State, WebviewWindow};
use yamt_local_merge::{LocalMerge, MergeRequestBranches, Refusal, Started};
use yamt_merge_requests::{
    GitLabProject, GitLabRepository, Glab, JobLogReply, MergeRequestIid, MergedPairs,
    OfferedPicture, OfferedUpload, OpenReply, PageOpened, PeopleChange, PeopleChangeReply,
    PeopleSearchReply, RerequestReply, ResolveRefusal, RowDiscussions, WebPage, gitlab_repository,
    prepare_open, prepare_resolve,
};

use crate::args::Ai;
use crate::ipc_error::{IpcError, blocking_reply};
use crate::range::range_folder;
use crate::second_window;

pub(crate) mod description;
mod discussions;
mod job_logs;
pub(crate) mod links;
mod list;
mod people;
mod pictures;

use list::ListMessage;

pub(crate) use pictures::{PICTURE_SCHEME, answer_picture};

const NO_PROJECT: &str = "this window's folder has no remote on a GitLab server";
const CLAIM_PROBE_INTERVAL: Duration = Duration::from_millis(50);
/// Long enough for a cold start of the merge window up to its claim.
const CLAIM_WAIT: Duration = Duration::from_secs(5);

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

/// The window's GitLab project, found once at start, the folder pair locks live in, the window's `--ai` that "Show
/// Diff" passes on, and every merge request's and failed job's page a list sent, every note's page
/// `read_discussions` sent, every page `read_description` sent and every line's and parent's page `read_links` sent
/// in this run: only those may be opened or have their log read (plan §2 #128–#137); `pages` is never locked
/// together with another `Mutex`.
pub(crate) struct MergeRequestState {
    gitlab: Option<GitLabRepository>,
    range_dir: PathBuf,
    ai: Ai,
    pages: Mutex<BTreeSet<WebPage>>,
    /// The run's merged pairs; locked for a whole check, so a second load's check waits and then merges nothing
    /// twice (rule 7); never locked together with `pages`.
    merged: Mutex<MergedPairs>,
    pictures: pictures::Pictures,
    job_logs: job_logs::JobLogs,
}

/// Looks for a GitLab project in `folder`'s repository, offline, and hands it to the app with the window's `ai`.
pub(crate) fn manage<R: Runtime>(app: &App<R>, folder: &Path, app_folder: &Path, ai: Ai) {
    app.manage(MergeRequestState {
        gitlab: gitlab_repository(folder),
        range_dir: range_folder(app_folder),
        ai,
        pages: Mutex::new(BTreeSet::new()),
        merged: Mutex::new(MergedPairs::default()),
        pictures: pictures::Pictures::default(),
        job_logs: job_logs::JobLogs::default(),
    });
}

fn offered(pages: &Mutex<BTreeSet<WebPage>>) -> MutexGuard<'_, BTreeSet<WebPage>> {
    pages.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Remembers `pages` and `pictures` as offered, so the window may open or ask for them once it gets the reply that
/// names them; holds `pages` and the pictures' lock one after the other, never together.
fn offer(
    state: &MergeRequestState,
    pages: impl IntoIterator<Item = WebPage>,
    pictures: Vec<OfferedPicture>,
) {
    offered(&state.pages).extend(pages);
    state.pictures.offer(pictures);
}

/// Remembers a description's `pages`, then its `uploads`, as offered; the same two locks as `offer`, one after the other.
fn offer_described(state: &MergeRequestState, pages: Vec<WebPage>, uploads: Vec<OfferedUpload>) {
    offered(&state.pages).extend(pages);
    state.pictures.offer_uploads(uploads);
}

fn opened(state: &MergeRequestState, glab: Option<&Glab>, iid: MergeRequestIid) -> OpenReply {
    let Some(repository) = &state.gitlab else {
        return OpenReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    match prepare_open(repository, glab, iid, &state.range_dir) {
        Ok(range) => second_window::start_range(&range, state.ai),
        Err(reply) => reply,
    }
}

fn rerequested(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    username: &str,
) -> RerequestReply {
    let Some(repository) = &state.gitlab else {
        return RerequestReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    yamt_merge_requests::rerequest_review(repository, glab, iid, username)
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
        list::list(&window.state(), Glab::find().as_ref(), &messages);
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
pub(crate) async fn rerequest_review<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
    username: String,
) -> Result<RerequestReply, IpcError> {
    blocking_reply(move || {
        Ok(rerequested(
            &window.state(),
            Glab::find().as_ref(),
            iid,
            &username,
        ))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_job_log<R: Runtime>(
    window: WebviewWindow<R>,
    page: WebPage,
) -> Result<JobLogReply, IpcError> {
    blocking_reply(move || {
        Ok(job_logs::job_log_reply(
            &window.state(),
            Glab::find().as_ref(),
            &page,
        ))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_discussions<R: Runtime>(
    window: WebviewWindow<R>,
    iids: Vec<MergeRequestIid>,
) -> Result<Vec<RowDiscussions>, IpcError> {
    blocking_reply(move || {
        Ok(discussions::discussions_reply(
            &window.state(),
            Glab::find().as_ref(),
            &iids,
        ))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn search_people<R: Runtime>(
    window: WebviewWindow<R>,
    text: String,
) -> Result<PeopleSearchReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(people::search_reply(&window.state(), glab.as_ref(), &text))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn change_people<R: Runtime>(
    window: WebviewWindow<R>,
    iid: MergeRequestIid,
    change: PeopleChange,
) -> Result<PeopleChangeReply, IpcError> {
    blocking_reply(move || {
        let glab = Glab::find();
        Ok(people::change_reply(
            &window.state(),
            glab.as_ref(),
            iid,
            &change,
        ))
    })
    .await
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

/// Opens `page` in the browser only when a reply of this window sent it (lists, discussions, descriptions, links): the
/// window cannot hand any other address to the system.
#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn open_page(state: State<'_, MergeRequestState>, page: WebPage) -> PageOpened {
    if !offered(&state.pages).contains(&page) {
        tracing::warn!(
            page = page.as_str(),
            "a GitLab page this window was never sent"
        );
        return PageOpened::NotOffered;
    }
    yamt_merge_requests::open_page(&page)
}

#[cfg(test)]
mod tests;
