use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{App, AppHandle, Manager, Runtime, State, WebviewWindow};
use yamt_range::{
    PairLock, Range, RangeFile, RangeFileId, RangeHeading, RangeSpec, RangeStart, Resolved,
    SearchTexts,
};
use yamt_review::ThreadStore;
use yamt_reviewed::{ReviewOf, ReviewedStore};

use crate::ai;
use crate::args::{Ai, RangeOf, StartScreen};
use crate::ipc_error::{IpcError, blocking_reply};
use crate::merge_requests;
use crate::outcome::Ending;
use crate::window::{WindowKind, open_with_data_folder, window_title};

const RANGE_FOLDER: &str = "range";
const REVIEWED_FOLDER: &str = "reviewed";
const TITLE_GAP: &str = "  ";

/// The range the window shows, what it names, its review threads, its Reviewed marks and the lock on its commit pair,
/// held for the run (plan §2 #104, #107, #117, #195, #199): a send holds `sending` throughout and locks `threads` only
/// between glab calls.
pub(crate) struct RangeState {
    pub(crate) range: Range,
    pub(crate) heading: RangeHeading,
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
    range_of: RangeOf,
) -> Ending {
    let resolved = match Resolved::resolve(repo, spec) {
        Ok(resolved) => resolved,
        Err(error) => return Ending::failure(error.to_string()),
    };
    let manage =
        |app: &App, app_folder: &Path| manage_range_in(app, app_folder, resolved, ai, range_of);
    let at_exit = |app: &AppHandle| ai::end_at_exit(&app.state());
    match open_with_data_folder(WindowKind::Range { ai, start }, manage, at_exit) {
        Ok(ending) => ending,
        Err(error) => Ending::failure(error.to_string()),
    }
}

/// Takes the pair's lock in `<app_folder>/range/` before listing and reading the pair's threads and the review's
/// marks in `<app_folder>/reviewed/`, then hands the range and the AI's state to the app. Ok: the window's title
/// (`range_title` of the listed range's start).
fn manage_range_in<R: Runtime>(
    app: &App<R>,
    app_folder: &Path,
    resolved: Resolved,
    ai: Ai,
    range_of: RangeOf,
) -> Result<String, String> {
    let heading = heading_of(&range_of);
    let lock =
        PairLock::take(&range_folder(app_folder), &resolved).map_err(|error| error.to_string())?;
    let range = resolved.list().map_err(|error| error.to_string())?;
    let threads = ThreadStore::open(lock.folder()).map_err(|error| error.to_string())?;
    let reviewed = review_of(&range, range_of)
        .and_then(|review| ReviewedStore::open(&app_folder.join(REVIEWED_FOLDER), review, &range))
        .map_err(|error| error.to_string())?;
    let unlisted = threads.unlisted_paths(&range);
    if !unlisted.is_empty() {
        tracing::warn!(paths = ?unlisted, "review threads kept on paths this range does not list");
    }
    ai::manage(app, ai, range_folder(app_folder), lock.folder(), &range);
    merge_requests::manage(app, range.root(), app_folder, ai);
    let title = range_title(&range.start(heading.clone()), range.root());
    app.manage(RangeState {
        range,
        heading,
        threads: Mutex::new(threads),
        reviewed: Mutex::new(reviewed),
        sending: Mutex::new(()),
        _lock: lock,
    });
    Ok(title)
}

fn heading_of(range_of: &RangeOf) -> RangeHeading {
    match range_of {
        RangeOf::SideNames => RangeHeading::Typed,
        RangeOf::MergeRequest {
            iid,
            names: Some(names),
            ..
        } => RangeHeading::MergeRequest {
            iid: *iid,
            names: names.clone(),
        },
        RangeOf::MergeRequest {
            iid, names: None, ..
        } => RangeHeading::UnnamedMergeRequest { iid: *iid },
    }
}

fn review_of(range: &Range, range_of: RangeOf) -> yamt_reviewed::Result<ReviewOf> {
    match range_of {
        RangeOf::SideNames => Ok(ReviewOf::Range(range.side_names()?)),
        RangeOf::MergeRequest { project, iid, .. } => Ok(ReviewOf::MergeRequest { project, iid }),
    }
}

pub(crate) fn range_folder(app_folder: &Path) -> PathBuf {
    app_folder.join(RANGE_FOLDER)
}

/// The title bar's text: what the window shows, then its totals (plan §2 #199; parts two spaces apart, rule VU18).
fn range_title(start: &RangeStart, root: &Path) -> String {
    let shown = match &start.heading {
        RangeHeading::Typed => start.range.clone(),
        RangeHeading::MergeRequest { iid, names } => format!(
            "!{iid} {}{TITLE_GAP}{} → {}",
            without_controls(&names.title),
            names.source,
            names.target
        ),
        RangeHeading::UnnamedMergeRequest { iid } => format!(
            "!{iid}{TITLE_GAP}{}..{}",
            start.left.short_id, start.right.short_id
        ),
    };
    let totals = start.totals;
    format!(
        "{shown}{TITLE_GAP}+{} −{} — {}",
        totals.added,
        totals.removed,
        window_title(root)
    )
}

/// `text` with each control character, a newline among them, written as a space: a title bar holds one line.
fn without_controls(text: &str) -> String {
    text.chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect()
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn open_range(state: State<'_, RangeState>) -> RangeStart {
    state.range.start(state.heading.clone())
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
