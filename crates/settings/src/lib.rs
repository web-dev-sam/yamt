//! The per-user settings file: where it is, what it holds, and how a change is written to it.
#![forbid(unsafe_code)]

mod file;
mod places;

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::file::Loaded;
pub use crate::places::Places;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum Theme {
    #[default]
    Dark,
    Light,
    WebstormDark,
    WebstormLight,
    VscodeDark,
    VscodeLight,
    ZedDark,
    ZedLight,
    AtomDark,
    AtomLight,
}

impl Theme {
    /// The spelling in the settings file and in the page's `data-theme`.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Theme::Dark => "dark",
            Theme::Light => "light",
            Theme::WebstormDark => "webstorm-dark",
            Theme::WebstormLight => "webstorm-light",
            Theme::VscodeDark => "vscode-dark",
            Theme::VscodeLight => "vscode-light",
            Theme::ZedDark => "zed-dark",
            Theme::ZedLight => "zed-light",
            Theme::AtomDark => "atom-dark",
            Theme::AtomLight => "atom-light",
        }
    }
}

/// How code text is smoothed: with coloured subpixels or grey only (applied on Linux, at start).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum Antialiasing {
    #[default]
    Subpixel,
    Greyscale,
}

impl Antialiasing {
    /// The spelling in the settings file.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Antialiasing::Subpixel => "subpixel",
            Antialiasing::Greyscale => "greyscale",
        }
    }
}

/// What the window holds and sends: `keys` = action id → key strings, only for actions whose
/// keys differ from the defaults (the window knows the defaults; Rust never does).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct StoredSettings {
    pub theme: Theme,
    pub antialiasing: Antialiasing,
    pub keys: BTreeMap<String, Vec<String>>,
    #[serde(rename = "languageServers")]
    pub language_servers: LanguageServerSettings,
    pub agent: AgentSettings,
}

/// The AI agent the window starts and its first message; `None` = the window's default.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
// No `serde(default)`: serde already reads a missing `Option` field as `None`, and specta-serde
// 0.0.12 exports every field of a `default` container as optional (`command?:`, lib.rs:850).
#[serde(rename_all = "camelCase")]
pub struct AgentSettings {
    pub command: Option<Vec<String>>,
    pub first_message: Option<String>,
}

impl AgentSettings {
    pub(crate) fn without_empty_command(self) -> AgentSettings {
        AgentSettings {
            command: self.command.filter(|words| !words.is_empty()),
            first_message: self.first_message,
        }
    }
}

/// `repositories`: the answer to "Start this project's language servers?" per repository root
/// (the exact path text the window gets); `added`: the servers the user added by hand.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct LanguageServerSettings {
    pub repositories: BTreeMap<String, RepositoryAnswer>,
    /// Repository root → the keys of the found servers switched off there (the window's text, opaque here).
    #[serde(default)]
    pub off: BTreeMap<String, BTreeSet<String>>,
    pub added: Vec<AddedServer>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum RepositoryAnswer {
    Start,
    DontStart,
}

/// A server the user added: the program and its arguments, and the file extensions it serves
/// (without dots).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AddedServer {
    pub command: Vec<String>,
    pub file_types: Vec<String>,
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

/// The file in use's settings; defaults when anything on the way to it is missing, unreadable or
/// broken. Never writes.
#[must_use]
pub fn stored_at_start(places: &Places) -> StoredSettings {
    let Ok(path) = places.file_in_use() else {
        return StoredSettings::default();
    };
    match file::load(&path) {
        Ok(Some(loaded)) => loaded.stored,
        Ok(None) | Err(_) => StoredSettings::default(),
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
    change(places, current, |stored| stored.theme = theme)
}

pub fn set_antialiasing(
    places: &Places,
    current: &StoredSettings,
    antialiasing: Antialiasing,
) -> Result<SettingsRead, Error> {
    change(places, current, |stored| stored.antialiasing = antialiasing)
}

pub fn set_keys(
    places: &Places,
    current: &StoredSettings,
    changes: &[KeysChange],
) -> Result<SettingsRead, Error> {
    change(places, current, |stored| {
        for keys_change in changes {
            match &keys_change.keys {
                Some(keys) => {
                    stored.keys.insert(keys_change.action.clone(), keys.clone());
                }
                None => {
                    stored.keys.remove(&keys_change.action);
                }
            }
        }
    })
}

/// `None` forgets the answer for `root`, so the window asks again.
pub fn set_repository_answer(
    places: &Places,
    current: &StoredSettings,
    root: &str,
    answer: Option<RepositoryAnswer>,
) -> Result<SettingsRead, Error> {
    change(places, current, |stored| {
        let repositories = &mut stored.language_servers.repositories;
        match answer {
            Some(answer) => {
                repositories.insert(root.to_owned(), answer);
            }
            None => {
                repositories.remove(root);
            }
        }
    })
}

/// `on: false` adds `server` to `root`'s set, `on: true` removes it; a root left with none is removed.
pub fn set_server_switch(
    places: &Places,
    current: &StoredSettings,
    root: &str,
    server: &str,
    on: bool,
) -> Result<SettingsRead, Error> {
    change(places, current, |stored| {
        let off = &mut stored.language_servers.off;
        if on {
            if let Some(servers) = off.get_mut(root) {
                servers.remove(server);
                if servers.is_empty() {
                    off.remove(root);
                }
            }
        } else {
            off.entry(root.to_owned())
                .or_default()
                .insert(server.to_owned());
        }
    })
}

pub fn set_added_servers(
    places: &Places,
    current: &StoredSettings,
    added: Vec<AddedServer>,
) -> Result<SettingsRead, Error> {
    change(places, current, |stored| {
        stored.language_servers.added = added;
    })
}

/// An empty `command` is stored as `None`: the window's default.
pub fn set_agent(
    places: &Places,
    current: &StoredSettings,
    agent: AgentSettings,
) -> Result<SettingsRead, Error> {
    change(places, current, |stored| {
        stored.agent = agent.without_empty_command();
    })
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
    edit: impl FnOnce(&mut StoredSettings),
) -> Result<SettingsRead, Error> {
    let path = places.file_in_use()?;
    let mut loaded = file::load(&path)?.unwrap_or_else(|| Loaded::from_settings(current));
    edit(&mut loaded.stored);
    let stored = loaded.stored.clone();
    file::write_entries(&path, loaded)?;
    Ok(settings_read(places, &path, stored))
}

fn settings_read(places: &Places, path: &Path, stored: StoredSettings) -> SettingsRead {
    SettingsRead {
        path: path.display().to_string(),
        default_path: places.default_file().display().to_string(),
        stored,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_theme_name_is_its_serde_spelling() {
        let themes = [
            (Theme::Dark, "dark"),
            (Theme::Light, "light"),
            (Theme::WebstormDark, "webstorm-dark"),
            (Theme::WebstormLight, "webstorm-light"),
            (Theme::VscodeDark, "vscode-dark"),
            (Theme::VscodeLight, "vscode-light"),
            (Theme::ZedDark, "zed-dark"),
            (Theme::ZedLight, "zed-light"),
            (Theme::AtomDark, "atom-dark"),
            (Theme::AtomLight, "atom-light"),
        ];
        for (theme, spelling) in themes {
            assert_eq!(theme.name(), spelling);
            assert_eq!(
                serde_json::to_value(theme).unwrap(),
                serde_json::Value::from(spelling)
            );
            let read: Theme = serde_json::from_value(serde_json::Value::from(spelling)).unwrap();
            assert_eq!(read, theme);
        }
    }

    #[test]
    fn an_antialiasing_name_is_its_serde_spelling() {
        for antialiasing in [Antialiasing::Subpixel, Antialiasing::Greyscale] {
            assert_eq!(
                serde_json::to_value(antialiasing).unwrap(),
                serde_json::Value::from(antialiasing.name())
            );
        }
    }

    #[test]
    fn the_language_server_entry_crosses_the_ipc_spelled_as_in_the_file() {
        let mut stored = StoredSettings::default();
        let servers = &mut stored.language_servers;
        servers
            .repositories
            .insert("/r".to_owned(), RepositoryAnswer::DontStart);
        servers.added.push(AddedServer {
            command: vec!["pylsp".to_owned()],
            file_types: vec!["py".to_owned()],
        });
        servers
            .off
            .insert("/r".to_owned(), BTreeSet::from(["oxlint".to_owned()]));
        let expected = serde_json::json!({
            "repositories": { "/r": "dontStart" },
            "off": { "/r": ["oxlint"] },
            "added": [{ "command": ["pylsp"], "fileTypes": ["py"] }],
        });
        assert_eq!(
            serde_json::to_value(&stored).unwrap()["languageServers"],
            expected
        );
    }

    #[test]
    fn the_agent_entry_crosses_the_ipc_with_both_fields_and_reads_with_none() {
        let agent = AgentSettings {
            command: Some(vec!["omp".to_owned(), "acp".to_owned()]),
            first_message: None,
        };
        let sent = serde_json::json!({ "command": ["omp", "acp"], "firstMessage": null });
        assert_eq!(serde_json::to_value(&agent).unwrap(), sent);
        let read: AgentSettings = serde_json::from_value(sent).unwrap();
        assert_eq!(read, agent);
        let missing: AgentSettings = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(missing, AgentSettings::default());
    }
}
