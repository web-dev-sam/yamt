use tauri::path::PathResolver;
use tauri::{Manager, Runtime, State, WebviewWindow};
use yamt_settings::{
    AddedServer, Antialiasing, KeysChange, Places, RepositoryAnswer, SettingsRead, StoredSettings,
    Theme,
};

use crate::ipc_error::IpcError;
use crate::servers::{self, HostState};
use crate::window::show_theme;

pub(crate) fn places<R: Runtime>(paths: &PathResolver<R>) -> Result<Places, IpcError> {
    match (paths.config_dir(), paths.home_dir()) {
        (Ok(config_dir), Ok(home)) => Ok(Places::new(&config_dir, &home)),
        (Err(_), _) | (_, Err(_)) => Err(IpcError::NoConfigFolder),
    }
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn load_settings<R: Runtime>(
    window: WebviewWindow<R>,
    current: StoredSettings,
) -> Result<SettingsRead, IpcError> {
    let read = yamt_settings::read(&places(window.path())?, &current)?;
    show_theme(&window, read.stored.theme);
    Ok(read)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn set_theme<R: Runtime>(
    window: WebviewWindow<R>,
    current: StoredSettings,
    theme: Theme,
) -> Result<SettingsRead, IpcError> {
    let read = yamt_settings::set_theme(&places(window.path())?, &current, theme)?;
    show_theme(&window, read.stored.theme);
    Ok(read)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn set_antialiasing<R: Runtime>(
    window: WebviewWindow<R>,
    current: StoredSettings,
    antialiasing: Antialiasing,
) -> Result<SettingsRead, IpcError> {
    let read = yamt_settings::set_antialiasing(&places(window.path())?, &current, antialiasing)?;
    show_theme(&window, read.stored.theme);
    Ok(read)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn set_keys<R: Runtime>(
    window: WebviewWindow<R>,
    current: StoredSettings,
    changes: Vec<KeysChange>,
) -> Result<SettingsRead, IpcError> {
    let read = yamt_settings::set_keys(&places(window.path())?, &current, &changes)?;
    show_theme(&window, read.stored.theme);
    Ok(read)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn move_settings<R: Runtime>(
    window: WebviewWindow<R>,
    current: StoredSettings,
    path: String,
) -> Result<SettingsRead, IpcError> {
    let read = yamt_settings::relocate(&places(window.path())?, &current, &path)?;
    show_theme(&window, read.stored.theme);
    Ok(read)
}

/// Keyed by the repository root as `servers_context` gives it; a root that is not UTF-8 has no
/// key the window could look up, so nothing is stored for it.
#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn set_server_answer<R: Runtime>(
    window: WebviewWindow<R>,
    host: State<'_, HostState>,
    current: StoredSettings,
    answer: Option<RepositoryAnswer>,
) -> Result<SettingsRead, IpcError> {
    let places = places(window.path())?;
    let root = servers::lock(&host).context().root;
    let read = match root {
        Some(root) => yamt_settings::set_repository_answer(&places, &current, &root, answer)?,
        None => yamt_settings::read(&places, &current)?,
    };
    show_theme(&window, read.stored.theme);
    Ok(read)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn set_server_switch<R: Runtime>(
    window: WebviewWindow<R>,
    host: State<'_, HostState>,
    current: StoredSettings,
    server: String,
    on: bool,
) -> Result<SettingsRead, IpcError> {
    let places = places(window.path())?;
    let root = servers::lock(&host).context().root;
    let read = match root {
        Some(root) => yamt_settings::set_server_switch(&places, &current, &root, &server, on)?,
        None => yamt_settings::read(&places, &current)?,
    };
    show_theme(&window, read.stored.theme);
    Ok(read)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn set_added_servers<R: Runtime>(
    window: WebviewWindow<R>,
    current: StoredSettings,
    added: Vec<AddedServer>,
) -> Result<SettingsRead, IpcError> {
    let read = yamt_settings::set_added_servers(&places(window.path())?, &current, added)?;
    show_theme(&window, read.stored.theme);
    Ok(read)
}
