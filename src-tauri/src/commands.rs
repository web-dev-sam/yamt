use std::sync::Mutex;

use tauri::{Manager, Runtime, State, WebviewWindow};
use yamt_local_merge::PushReply;
use yamt_session::{DiskVersion, FileMergeData, FileSides, MergeSession, Side, WriteReply};

use crate::frontend_log::LogEntry;
use crate::ipc_error::IpcError;
use crate::merge::{self, AbortReply, ContinueReply, Listing, Merge, MergeState, lock};
use crate::{ai, clipboard, compare, merge_requests, range, review, servers, settings};

#[expect(
    clippy::too_many_lines,
    reason = "one line per command of every window"
)]
pub(crate) fn specta_builder<R: Runtime>() -> tauri_specta::Builder<R> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
        load_file,
        finish_file,
        save_file,
        reset_file,
        describe_file,
        take_side,
        list_stop,
        continue_operation::<tauri::Wry>,
        abort_operation::<tauri::Wry>,
        push_merged_branch::<tauri::Wry>,
        close_ended_merge::<tauri::Wry>,
        log,
        settings::load_settings::<tauri::Wry>,
        settings::set_theme::<tauri::Wry>,
        settings::set_antialiasing::<tauri::Wry>,
        settings::set_keys::<tauri::Wry>,
        settings::move_settings::<tauri::Wry>,
        settings::set_server_answer::<tauri::Wry>,
        settings::set_server_switch::<tauri::Wry>,
        settings::set_added_servers::<tauri::Wry>,
        settings::set_agent::<tauri::Wry>,
        servers::servers_context,
        servers::start_server,
        servers::send_to_server,
        servers::stop_server,
        servers::find_program,
        servers::project_files,
        compare::open_compare,
        compare::load_tab::<tauri::Wry>,
        compare::set_column::<tauri::Wry>,
        compare::add_tab,
        compare::close_tab,
        compare::rename_tab,
        compare::set_tab_language,
        compare::show_tab,
        range::open_range,
        range::load_range_file::<tauri::Wry>,
        range::search_range_texts::<tauri::Wry>,
        review::list_threads,
        review::add_thread,
        review::add_note,
        review::queue_message,
        review::unqueue_message,
        review::edit_note,
        review::delete_message,
        review::set_thread_session,
        review::add_ai_answer,
        review::check_gitlab::<tauri::Wry>,
        review::send_queue::<tauri::Wry>,
        ai::prepare_checkout::<tauri::Wry>,
        ai::start_agent::<tauri::Wry>,
        ai::send_to_agent,
        ai::stop_agent,
        ai::checkout_changes::<tauri::Wry>,
        ai::discard_checkout::<tauri::Wry>,
        ai::diff_texts,
        clipboard::read_clipboard::<tauri::Wry>,
        merge_requests::find_gitlab_project,
        merge_requests::list_merge_requests::<tauri::Wry>,
        merge_requests::open_merge_request::<tauri::Wry>,
        merge_requests::open_page,
        merge_requests::resolve_merge_request::<tauri::Wry>,
        merge_requests::continue_merge_request::<tauri::Wry>,
        merge_requests::find_local_merge::<tauri::Wry>,
    ])
}

pub(crate) fn with_session<R: Runtime>(
    builder: tauri::Builder<R>,
    session: Box<MergeSession>,
) -> tauri::Builder<R> {
    servers::manage(builder, session.root())
        .manage(Mutex::new(Merge::Held(session)))
        .invoke_handler(specta_builder().invoke_handler())
        // A reloaded page's channels still take events (tauri 2.12 ipc/channel.rs:409-449 fails a
        // send only when `eval` fails), so its runs would never stop themselves.
        .on_page_load(|webview, page| {
            servers::stop_runs_on_page_start(&webview.state(), page.event());
        })
}

/// A window whose state is managed once the data folder is known: the compare and range windows. A
/// range window's page that starts loading stops the agent of the page before.
pub(crate) fn with_commands<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .invoke_handler(specta_builder().invoke_handler())
        .on_page_load(|webview, page| {
            ai::stop_agent_on_page_start(webview.app_handle(), page.event());
        })
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn load_file(state: State<'_, MergeState>, path: &str) -> Result<FileMergeData, IpcError> {
    Ok(lock(&state).session()?.load(path)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn finish_file(
    state: State<'_, MergeState>,
    path: &str,
    text: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.finish(path, text, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn save_file(
    state: State<'_, MergeState>,
    path: &str,
    text: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.save(path, text, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn reset_file(
    state: State<'_, MergeState>,
    path: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.reset(path, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn describe_file(state: State<'_, MergeState>, path: &str) -> Result<FileSides, IpcError> {
    Ok(lock(&state).session()?.describe(path)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn take_side(
    state: State<'_, MergeState>,
    path: &str,
    side: Side,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.take(path, side, disk_version)?)
}

// tauri 2.12 `WebviewWindow::destroy` "does not emit any events": no `CloseRequested`, so the page's
// unsaved-work question does not run; the last window gone ends `run_return`.
fn close_window<R: Runtime>(window: &WebviewWindow<R>, ended: &str) {
    if let Err(error) = window.destroy() {
        tracing::warn!(%error, ended, "git is done but the window stays: closing it ends yamt");
    }
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn list_stop(state: State<'_, MergeState>) -> Result<Listing, IpcError> {
    lock(&state).list_stop()
}

// The merge state comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
async fn continue_operation<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<ContinueReply, IpcError> {
    let reply = merge::continue_operation(&window.state()).await?;
    close_window_if_ended(&window, "finished");
    Ok(reply)
}

#[tauri::command]
#[specta::specta]
async fn abort_operation<R: Runtime>(window: WebviewWindow<R>) -> Result<AbortReply, IpcError> {
    let reply = merge::abort_operation(&window.state()).await?;
    if reply.leftovers.is_empty() {
        close_window_if_ended(&window, "aborted");
    }
    Ok(reply)
}

#[tauri::command]
#[specta::specta]
async fn push_merged_branch<R: Runtime>(window: WebviewWindow<R>) -> Result<PushReply, IpcError> {
    let reply = merge::push_merged_branch(&window.state()).await?;
    close_window_if_ended(&window, "pushed");
    Ok(reply)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes the window by value"
)]
fn close_ended_merge<R: Runtime>(window: WebviewWindow<R>) {
    lock(&window.state()).end_committed();
    close_window_if_ended(&window, "finished");
}

fn close_window_if_ended<R: Runtime>(window: &WebviewWindow<R>, ended: &str) {
    if lock(&window.state()).has_ended() {
        close_window(window, ended);
    }
}

#[tauri::command]
#[specta::specta]
fn log(entry: LogEntry) {
    entry.emit();
}

#[cfg(test)]
mod tests;
