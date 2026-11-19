use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{Manager, Runtime, State, WebviewWindow};
use yamt_range::RangeFileId;
use yamt_reviewed::{FileReview, ReviewedStore, SinceReview};

use crate::ipc_error::{IpcError, blocking_reply};
use crate::range::RangeState;

fn locked(reviewed: &Mutex<ReviewedStore>) -> MutexGuard<'_, ReviewedStore> {
    reviewed.lock().unwrap_or_else(PoisonError::into_inner)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
#[expect(
    clippy::unnecessary_wraps,
    reason = "every command answers a Result the window checks"
)]
pub(crate) fn list_reviewed(state: State<'_, RangeState>) -> Result<Vec<FileReview>, IpcError> {
    Ok(locked(&state.reviewed).marks())
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn mark_reviewed<R: Runtime>(
    window: WebviewWindow<R>,
    file: RangeFileId,
) -> Result<(), IpcError> {
    blocking_reply(move || {
        let state = window.state::<RangeState>();
        Ok(locked(&state.reviewed).mark(&state.range, file)?)
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn unmark_reviewed<R: Runtime>(
    window: WebviewWindow<R>,
    file: RangeFileId,
) -> Result<(), IpcError> {
    blocking_reply(move || {
        let state = window.state::<RangeState>();
        Ok(locked(&state.reviewed).unmark(&state.range, file)?)
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn load_since_review<R: Runtime>(
    window: WebviewWindow<R>,
    file: RangeFileId,
) -> Result<SinceReview, IpcError> {
    blocking_reply(move || {
        let state = window.state::<RangeState>();
        Ok(locked(&state.reviewed).since_review(&state.range, file)?)
    })
    .await
}

#[cfg(test)]
mod tests;
