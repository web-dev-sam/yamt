use std::sync::{Mutex, MutexGuard, PoisonError, TryLockError};

use tauri::ipc::Channel;
use tauri::{Manager, Runtime, State, WebviewWindow};
use yamt_range::RangeFileId;
use yamt_review::{
    GitLabCheck, Glab, MessageId, SendProgress, SendReply, ThreadAdded, ThreadId, ThreadLine,
    ThreadList, ThreadStore,
};

use crate::ipc_error::{IpcError, blocking_reply};
use crate::range::RangeState;

fn locked(threads: &Mutex<ThreadStore>) -> MutexGuard<'_, ThreadStore> {
    threads.lock().unwrap_or_else(PoisonError::into_inner)
}

/// The send guard, or `SendRunning` while another send holds it.
fn send_guard(sending: &Mutex<()>) -> Result<MutexGuard<'_, ()>, IpcError> {
    match sending.try_lock() {
        Ok(guard) => Ok(guard),
        Err(TryLockError::Poisoned(poisoned)) => Ok(poisoned.into_inner()),
        Err(TryLockError::WouldBlock) => Err(IpcError::SendRunning),
    }
}

fn forward_progress(channel: &Channel<SendProgress>, progress: SendProgress) {
    if let Err(error) = channel.send(progress) {
        tracing::warn!(%error, "a send's progress did not reach the window");
    }
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
#[expect(
    clippy::unnecessary_wraps,
    reason = "every command answers a Result the window checks"
)]
pub(crate) fn list_threads(state: State<'_, RangeState>) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).list(&state.range))
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn add_thread(
    state: State<'_, RangeState>,
    file: RangeFileId,
    line: ThreadLine,
    text: String,
) -> Result<ThreadAdded, IpcError> {
    Ok(locked(&state.threads).add_thread(&state.range, file, line, &text)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn add_note(
    state: State<'_, RangeState>,
    thread: ThreadId,
    text: String,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).add_note(&state.range, thread, &text)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn queue_message(
    state: State<'_, RangeState>,
    message: MessageId,
    text: String,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).queue(&state.range, message, &text)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn unqueue_message(
    state: State<'_, RangeState>,
    message: MessageId,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).unqueue(&state.range, message)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn edit_note(
    state: State<'_, RangeState>,
    message: MessageId,
    text: String,
) -> Result<ThreadList, IpcError> {
    let _sending = send_guard(&state.sending)?;
    Ok(locked(&state.threads).edit_note(&state.range, message, &text)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn delete_message(
    state: State<'_, RangeState>,
    message: MessageId,
) -> Result<ThreadList, IpcError> {
    let _sending = send_guard(&state.sending)?;
    Ok(locked(&state.threads).delete_message(&state.range, message)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn set_thread_session(
    state: State<'_, RangeState>,
    thread: ThreadId,
    session: String,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).set_session(&state.range, thread, &session)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn add_ai_answer(
    state: State<'_, RangeState>,
    thread: ThreadId,
    session: String,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).add_ai_answer(&state.range, thread, &session)?)
}

// The range comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
pub(crate) async fn check_gitlab<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<GitLabCheck, IpcError> {
    blocking_reply(move || {
        let state = window.state::<RangeState>();
        Ok(yamt_review::check_gitlab(
            &state.range,
            Glab::find().as_ref(),
        ))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn send_queue<R: Runtime>(
    window: WebviewWindow<R>,
    progress: Channel<SendProgress>,
) -> Result<SendReply, IpcError> {
    blocking_reply(move || {
        let state = window.state::<RangeState>();
        let _sending = send_guard(&state.sending)?;
        let forward = |done| forward_progress(&progress, done);
        let glab = Glab::find();
        Ok(yamt_review::send_queue(
            &state.range,
            glab.as_ref(),
            &state.threads,
            &forward,
        )?)
    })
    .await
}

#[cfg(test)]
mod tests;
