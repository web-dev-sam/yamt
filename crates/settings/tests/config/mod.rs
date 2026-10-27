//! A per-test config folder and home under a temp dir, and the settings the tests send.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tempfile::TempDir;
use yamt_settings::{
    AgentSettings, Antialiasing, LanguageServerSettings, Places, StoredSettings, Theme,
};

pub struct Config {
    pub dir: TempDir,
    pub places: Places,
}

impl Config {
    pub fn new() -> Config {
        let dir = tempfile::tempdir().unwrap();
        let places = Places::new(&dir.path().join("config"), &dir.path().join("home"));
        Config { dir, places }
    }

    pub fn folder(&self) -> PathBuf {
        self.dir.path().join("config").join("yamt")
    }

    pub fn default_file(&self) -> PathBuf {
        self.folder().join("settings.json")
    }

    pub fn location_file(&self) -> PathBuf {
        self.folder().join("settings-location")
    }

    pub fn elsewhere(&self, name: &str) -> PathBuf {
        self.dir.path().join("elsewhere").join(name)
    }
}

pub fn write(path: &Path, text: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

pub fn json_at(path: &Path) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

pub fn names_in(folder: &Path) -> Vec<String> {
    let mut names = Vec::new();
    for entry in fs::read_dir(folder).unwrap() {
        names.push(entry.unwrap().file_name().into_string().unwrap());
    }
    names.sort();
    names
}

pub fn keys(entries: &[(&str, &[&str])]) -> BTreeMap<String, Vec<String>> {
    let mut keys = BTreeMap::new();
    for (action, action_keys) in entries {
        let action_keys = action_keys.iter().map(|key| (*key).to_owned()).collect();
        keys.insert((*action).to_owned(), action_keys);
    }
    keys
}

pub fn light_with_apply() -> StoredSettings {
    StoredSettings {
        theme: Theme::Light,
        antialiasing: Antialiasing::Subpixel,
        keys: keys(&[("apply", &["Mod-Enter"]), ("ignore", &[])]),
        language_servers: LanguageServerSettings::default(),
        agent: AgentSettings::default(),
    }
}
