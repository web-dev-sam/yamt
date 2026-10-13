//! The per-user settings file: where it is, what it holds, and how a change is written to it.
#![forbid(unsafe_code)]

mod file;
mod places;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::file::Loaded;
pub use crate::places::Places;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Dark,
    Light,
}

/// What the window holds and sends: `keys` = action id → key strings, only for actions whose
/// keys differ from the defaults (the window knows the defaults; Rust never does).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct StoredSettings {
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub keys: BTreeMap<String, Vec<String>>,
}

/// `Some(keys)` replaces the action's entry (an empty list = the action has no key);
/// `None` removes the entry (the action is back on its defaults).
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, specta::Type)]
pub struct KeysChange {
    pub action: String,
    pub keys: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, specta::Type)]
pub struct SettingsRead {
    pub path: String,
    pub default_path: String,
    pub stored: StoredSettings,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("cannot read {}: {message}", path.display())]
    ReadFailed { path: PathBuf, message: String },
    #[error("{} is broken: {message}", path.display())]
    Broken { path: PathBuf, message: String },
    #[error("cannot write {}: {message}", path.display())]
    WriteFailed { path: PathBuf, message: String },
    #[error("`{path}` is not an absolute path")]
    NotAbsolute { path: String },
}

/// The file in use's theme; `Dark` when anything on the way to it is missing, unreadable or broken.
#[must_use]
pub fn theme_at_start(places: &Places) -> Theme {
    let Ok(path) = places.file_in_use() else {
        return Theme::Dark;
    };
    match file::load(&path) {
        Ok(Some(loaded)) => loaded.stored.theme,
        Ok(None) | Err(_) => Theme::Dark,
    }
}

/// The file in use, created from `current` when it is missing; an existing file is never rewritten.
pub fn read(places: &Places, current: &StoredSettings) -> Result<SettingsRead, Error> {
    let path = places.file_in_use()?;
    let stored = file::read_or_create(&path, current)?;
    Ok(settings_read(places, &path, stored))
}

pub fn set_theme(
    places: &Places,
    current: &StoredSettings,
    theme: Theme,
) -> Result<SettingsRead, Error> {
    change(places, current, |loaded| loaded.set_theme(theme))
}

pub fn set_keys(
    places: &Places,
    current: &StoredSettings,
    changes: &[KeysChange],
) -> Result<SettingsRead, Error> {
    change(places, current, |loaded| loaded.set_keys(changes))
}

/// Makes `to` the file in use: an existing file there is used, a missing one is created from
/// `current`; the location is recorded only once that file is readable.
pub fn relocate(
    places: &Places,
    current: &StoredSettings,
    to: &str,
) -> Result<SettingsRead, Error> {
    let path = places.expanded(to)?;
    let stored = file::read_or_create(&path, current)?;
    places.record_location(&path)?;
    Ok(settings_read(places, &path, stored))
}

fn change(
    places: &Places,
    current: &StoredSettings,
    edit: impl FnOnce(&mut Loaded),
) -> Result<SettingsRead, Error> {
    let path = places.file_in_use()?;
    let mut loaded = file::load(&path)?.unwrap_or_else(|| Loaded::from_settings(current));
    edit(&mut loaded);
    file::write_entries(&path, loaded.entries)?;
    Ok(settings_read(places, &path, loaded.stored))
}

fn settings_read(places: &Places, path: &Path, stored: StoredSettings) -> SettingsRead {
    SettingsRead {
        path: path.display().to_string(),
        default_path: places.default_file().display().to_string(),
        stored,
    }
}
