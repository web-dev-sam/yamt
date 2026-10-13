use tauri::path::PathResolver;
use tauri::{Manager, Runtime, WebviewWindow};
use yamt_settings::{KeysChange, Places, SettingsRead, StoredSettings, Theme};

use crate::ipc_error::IpcError;
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
