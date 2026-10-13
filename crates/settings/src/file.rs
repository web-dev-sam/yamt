use std::fs;
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::process;

use serde::de::DeserializeOwned;
use serde_json::{Map, Value};

use crate::{Error, StoredSettings};

const THEME: &str = "theme";
const ANTIALIASING: &str = "antialiasing";
const KEYS: &str = "keys";

/// Linux's MAXSYMLINKS (`include/linux/namei.h`): more links in a row than this is a cycle.
const MAX_LINK_HOPS: usize = 40;

/// A settings file: the entries yamt does not know, kept as written, and what yamt reads.
pub(crate) struct Loaded {
    others: Map<String, Value>,
    pub(crate) stored: StoredSettings,
}

impl Loaded {
    pub(crate) fn from_settings(settings: &StoredSettings) -> Loaded {
        Loaded {
            others: Map::new(),
            stored: settings.clone(),
        }
    }

    fn entries(self) -> Map<String, Value> {
        let mut entries = self.others;
        entries.insert(THEME.to_owned(), Value::from(self.stored.theme.name()));
        entries.insert(
            ANTIALIASING.to_owned(),
            Value::from(self.stored.antialiasing.name()),
        );
        if !self.stored.keys.is_empty() {
            let mut keys = Map::new();
            for (action, action_keys) in self.stored.keys {
                keys.insert(action, Value::from(action_keys));
            }
            entries.insert(KEYS.to_owned(), Value::Object(keys));
        }
        entries
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
    write_entries(path, Loaded::from_settings(current))?;
    Ok(current.clone())
}

fn parsed(path: &Path, text: &str) -> Result<Loaded, Error> {
    let mut others: Map<String, Value> =
        serde_json::from_str(text).map_err(|error| broken(path, syntax_message(&error)))?;
    let stored = StoredSettings {
        theme: entry(path, THEME, others.remove(THEME))?,
        antialiasing: entry(path, ANTIALIASING, others.remove(ANTIALIASING))?,
        keys: entry(path, KEYS, others.remove(KEYS))?,
    };
    Ok(Loaded { others, stored })
}

/// `serde_json` counts columns from 1 and reports an error after the last newline as column 0
/// (`serde_json::Error::column`).
fn syntax_message(error: &serde_json::Error) -> String {
    let message = error.to_string();
    match message.strip_suffix(" column 0") {
        Some(line_only) => line_only.to_owned(),
        None => message,
    }
}

fn entry<T: DeserializeOwned + Default>(
    path: &Path,
    name: &str,
    value: Option<Value>,
) -> Result<T, Error> {
    match value {
        Some(value) => serde_json::from_value(value)
            .map_err(|error| broken(path, format!("`{name}`: {error}"))),
        None => Ok(T::default()),
    }
}

fn broken(path: &Path, message: String) -> Error {
    Error::Broken {
        path: path.to_owned(),
        message,
    }
}

pub(crate) fn write_entries(path: &Path, loaded: Loaded) -> Result<(), Error> {
    write_text(path, &format!("{:#}\n", Value::Object(loaded.entries())))
}

/// Writes through a temporary file and a rename into the file at the end of the symlinks at
/// `path`, so every link stays a link.
pub(crate) fn write_text(path: &Path, text: &str) -> Result<(), Error> {
    let failed = |target: &Path, error: io::Error| Error::WriteFailed {
        path: target.to_owned(),
        message: error.to_string(),
    };
    let target = file_to_write(path).map_err(|error| failed(path, error))?;
    let Some(name) = target.file_name() else {
        return Err(failed(&target, io::Error::from(ErrorKind::IsADirectory)));
    };
    let mut temp_name = name.to_owned();
    temp_name.push(format!(".{}.tmp", process::id()));
    let temp = target.with_file_name(temp_name);
    if let Some(folder) = target.parent() {
        fs::create_dir_all(folder).map_err(|error| failed(&target, error))?;
    }
    let written = fs::write(&temp, text).and_then(|()| fs::rename(&temp, &target));
    if let Err(error) = written {
        fs::remove_file(&temp).ok();
        return Err(failed(&target, error));
    }
    Ok(())
}

/// Also when the last link points to a file that does not exist yet.
fn file_to_write(path: &Path) -> io::Result<PathBuf> {
    let mut current = path.to_owned();
    for _ in 0..=MAX_LINK_HOPS {
        let is_link = fs::symlink_metadata(&current).is_ok_and(|metadata| metadata.is_symlink());
        if !is_link {
            return Ok(current);
        }
        let target = fs::read_link(&current)?;
        current = match current.parent() {
            Some(folder) => folder.join(target),
            None => target,
        };
    }
    Err(io::Error::other(format!(
        "more than {MAX_LINK_HOPS} symlinks in a row"
    )))
}
