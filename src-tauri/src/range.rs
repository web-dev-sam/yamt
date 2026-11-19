use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{App, AppHandle, Manager, Runtime, State, WebviewWindow};
use yamt_range::{
    PairLock, Range, RangeFile, RangeFileId, RangeSpec, RangeStart, Resolved, SearchTexts,
};
use yamt_review::ThreadStore;
use yamt_reviewed::{ReviewOf, ReviewedStore};

use crate::ai;
use crate::args::{Ai, MarksOf, StartScreen};
use crate::ipc_error::{IpcError, blocking_reply};
use crate::merge_requests;
use crate::outcome::Ending;
use crate::window::{WindowKind, open_with_data_folder, window_title};

const RANGE_FOLDER: &str = "range";
const REVIEWED_FOLDER: &str = "reviewed";

/// The range the window shows, its review threads, its Reviewed marks and the lock on its commit pair, held for the
/// run (plan §2 #104, #107, #117, #195): a send holds `sending` throughout and locks `threads` only between glab calls.
pub(crate) struct RangeState {
    pub(crate) range: Range,
    pub(crate) threads: Mutex<ThreadStore>,
    pub(crate) reviewed: Mutex<ReviewedStore>,
    pub(crate) sending: Mutex<()>,
    _lock: PairLock,
}

/// `yamt --diff=<range>`: every refusal before the window is one line and exit 2; a closed window is
/// exit 0, after the AI's workspace ended (plan §2 #111).
pub(crate) fn run_range(
    repo: &Path,
    spec: &RangeSpec,
    ai: Ai,
    start: StartScreen,
    marks: MarksOf,
) -> Ending {
    let resolved = match Resolved::resolve(repo, spec) {
        Ok(resolved) => resolved,
        Err(error) => return Ending::failure(error.to_string()),
    };
    let title = range_title(spec, resolved.root());
    let manage =
        |app: &App, app_folder: &Path| manage_range_in(app, app_folder, resolved, ai, marks);
    let at_exit = |app: &AppHandle| ai::end_at_exit(&app.state());
    match open_with_data_folder(&title, WindowKind::Range { ai, start }, manage, at_exit) {
        Ok(ending) => ending,
        Err(error) => Ending::failure(error.to_string()),
    }
}

/// Takes the pair's lock in `<app_folder>/range/` before listing and reading the pair's threads and the review's
/// marks in `<app_folder>/reviewed/`, then hands the range and the AI's state to the app.
fn manage_range_in<R: Runtime>(
    app: &App<R>,
    app_folder: &Path,
    resolved: Resolved,
    ai: Ai,
    marks: MarksOf,
) -> Result<(), String> {
    let lock =
        PairLock::take(&range_folder(app_folder), &resolved).map_err(|error| error.to_string())?;
    let range = resolved.list().map_err(|error| error.to_string())?;
    let threads = ThreadStore::open(lock.folder()).map_err(|error| error.to_string())?;
    let reviewed = review_of(&range, marks)
        .and_then(|review| ReviewedStore::open(&app_folder.join(REVIEWED_FOLDER), review, &range))
        .map_err(|error| error.to_string())?;
    let unlisted = threads.unlisted_paths(&range);
    if !unlisted.is_empty() {
        tracing::warn!(paths = ?unlisted, "review threads kept on paths this range does not list");
    }
    ai::manage(app, ai, range_folder(app_folder), lock.folder(), &range);
    merge_requests::manage(app, range.root(), app_folder, ai);
    app.manage(RangeState {
        range,
        threads: Mutex::new(threads),
        reviewed: Mutex::new(reviewed),
        sending: Mutex::new(()),
        _lock: lock,
    });
    Ok(())
}

fn review_of(range: &Range, marks: MarksOf) -> yamt_reviewed::Result<ReviewOf> {
    match marks {
        MarksOf::SideNames => Ok(ReviewOf::Range(range.side_names()?)),
        MarksOf::MergeRequest { project, iid } => Ok(ReviewOf::MergeRequest { project, iid }),
    }
}

pub(crate) fn range_folder(app_folder: &Path) -> PathBuf {
    app_folder.join(RANGE_FOLDER)
}

fn range_title(spec: &RangeSpec, root: &Path) -> String {
    format!("{} — {}", spec.text(), window_title(root))
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn open_range(state: State<'_, RangeState>) -> RangeStart {
    state.range.start()
}

// The range comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
pub(crate) async fn load_range_file<R: Runtime>(
    window: WebviewWindow<R>,
    file: RangeFileId,
) -> Result<RangeFile, IpcError> {
    blocking_reply(move || Ok(window.state::<RangeState>().range.load(file)?)).await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn search_range_texts<R: Runtime>(
    window: WebviewWindow<R>,
    from: RangeFileId,
) -> Result<SearchTexts, IpcError> {
    blocking_reply(move || Ok(window.state::<RangeState>().range.search_texts(from)?)).await
}

#[cfg(test)]
pub(crate) mod tests;
