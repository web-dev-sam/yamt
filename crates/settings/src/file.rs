use std::fs;
use std::io::{self, ErrorKind};
use std::path::Path;
use std::process;

use serde::de::DeserializeOwned;
use serde_json::{Map, Value};

use crate::{Error, KeysChange, StoredSettings, Theme};

const THEME: &str = "theme";
const KEYS: &str = "keys";

/// A settings file's entries as written, unknown ones included, and what yamt reads from them.
pub(crate) struct Loaded {
    pub(crate) entries: Map<String, Value>,
    pub(crate) stored: StoredSettings,
}

impl Loaded {
    pub(crate) fn from_settings(settings: &StoredSettings) -> Loaded {
        let mut loaded = Loaded {
            entries: Map::new(),
            stored: settings.clone(),
        };
        loaded.set_theme(settings.theme);
        loaded.put_keys();
        loaded
    }

    pub(crate) fn set_theme(&mut self, theme: Theme) {
        self.stored.theme = theme;
        self.entries
            .insert(THEME.to_owned(), Value::from(theme_name(theme)));
    }

    pub(crate) fn set_keys(&mut self, changes: &[KeysChange]) {
        for change in changes {
            match &change.keys {
                Some(keys) => {
                    self.stored.keys.insert(change.action.clone(), keys.clone());
                }
                None => {
                    self.stored.keys.remove(&change.action);
                }
            }
        }
        self.put_keys();
    }

    fn put_keys(&mut self) {
        if self.stored.keys.is_empty() {
            self.entries.remove(KEYS);
            return;
        }
        let mut keys = Map::new();
        for (action, action_keys) in &self.stored.keys {
            keys.insert(action.clone(), Value::from(action_keys.clone()));
        }
        self.entries.insert(KEYS.to_owned(), Value::Object(keys));
    }
}

fn theme_name(theme: Theme) -> &'static str {
    match theme {
        Theme::Dark => "dark",
        Theme::Light => "light",
    }
}

/// `None` when there is no file at `path`.
pub(crate) fn load(path: &Path) -> Result<Option<Loaded>, Error> {
    match fs::read_to_string(path) {
        Ok(text) => parsed(path, &text).map(Some),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(Error::ReadFailed {
            path: path.to_owned(),
            message: error.to_string(),
        }),
    }
}

pub(crate) fn read_or_create(
    path: &Path,
    current: &StoredSettings,
) -> Result<StoredSettings, Error> {
    if let Some(loaded) = load(path)? {
        return Ok(loaded.stored);
    }
    let created = Loaded::from_settings(current);
    write_entries(path, created.entries)?;
    Ok(created.stored)
}

fn parsed(path: &Path, text: &str) -> Result<Loaded, Error> {
    let entries: Map<String, Value> =
        serde_json::from_str(text).map_err(|error| broken(path, error.to_string()))?;
    let stored = StoredSettings {
        theme: entry(path, &entries, THEME)?,
        keys: entry(path, &entries, KEYS)?,
    };
    Ok(Loaded { entries, stored })
}

fn entry<T: DeserializeOwned + Default>(
    path: &Path,
    entries: &Map<String, Value>,
    name: &str,
) -> Result<T, Error> {
    match entries.get(name) {
        Some(value) => {
            T::deserialize(value).map_err(|error| broken(path, format!("`{name}`: {error}")))
        }
        None => Ok(T::default()),
    }
}

fn broken(path: &Path, message: String) -> Error {
    Error::Broken {
        path: path.to_owned(),
        message,
    }
}

pub(crate) fn write_entries(path: &Path, entries: Map<String, Value>) -> Result<(), Error> {
    write_text(path, &format!("{:#}\n", Value::Object(entries)))
}

/// Writes through a temporary file and a rename; a symlink at `path` is followed, so it stays a link.
pub(crate) fn write_text(path: &Path, text: &str) -> Result<(), Error> {
    let target = fs::canonicalize(path).unwrap_or_else(|_| path.to_owned());
    let failed = |error: io::Error| Error::WriteFailed {
        path: target.clone(),
        message: error.to_string(),
    };
    let Some(name) = target.file_name() else {
        return Err(failed(io::Error::from(ErrorKind::IsADirectory)));
    };
    let mut temp_name = name.to_owned();
    temp_name.push(format!(".{}.tmp", process::id()));
    let temp = target.with_file_name(temp_name);
    if let Some(folder) = target.parent() {
        fs::create_dir_all(folder).map_err(failed)?;
    }
    let written = fs::write(&temp, text).and_then(|()| fs::rename(&temp, &target));
    if let Err(error) = written {
        fs::remove_file(&temp).ok();
        return Err(failed(error));
    }
    Ok(())
}
