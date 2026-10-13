#![cfg(test)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod config;

use std::fs;

use serde_json::json;
use yamt_settings::{
    Antialiasing, Error, StoredSettings, Theme, read, set_antialiasing, set_theme,
};

use crate::config::{Config, json_at, keys, write};

#[test]
fn a_missing_antialiasing_entry_reads_subpixel_and_the_file_stays_as_written() {
    let config = Config::new();
    let text = r#"{"theme": "light"}"#;
    write(&config.default_file(), text);
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(settings.stored.antialiasing, Antialiasing::Subpixel);
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
}

#[test]
fn greyscale_reads_back() {
    let config = Config::new();
    write(&config.default_file(), r#"{"antialiasing": "greyscale"}"#);
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(settings.stored.antialiasing, Antialiasing::Greyscale);
}

#[test]
fn an_unknown_antialiasing_is_broken_names_the_entry_and_no_change_rewrites_the_file() {
    let config = Config::new();
    let text = r#"{"antialiasing": "sharp", "theme": "light"}"#;
    write(&config.default_file(), text);
    let current = StoredSettings::default();
    let read_error = read(&config.places, &current).unwrap_err();
    let Error::Broken { message, .. } = read_error else {
        panic!("not broken: {read_error:?}");
    };
    assert!(message.starts_with("`antialiasing`: "), "{message}");
    assert!(message.contains("sharp"), "{message}");
    let antialiasing_error =
        set_antialiasing(&config.places, &current, Antialiasing::Greyscale).unwrap_err();
    assert!(
        matches!(antialiasing_error, Error::Broken { .. }),
        "{antialiasing_error:?}"
    );
    let theme_error = set_theme(&config.places, &current, Theme::Dark).unwrap_err();
    assert!(
        matches!(theme_error, Error::Broken { .. }),
        "{theme_error:?}"
    );
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
}

#[test]
fn set_antialiasing_keeps_unknown_entries_and_the_other_settings() {
    let config = Config::new();
    write(
        &config.default_file(),
        r#"{"window": {"x": 1}, "theme": "light", "keys": {"apply": ["F2"]}}"#,
    );
    let settings = set_antialiasing(
        &config.places,
        &StoredSettings::default(),
        Antialiasing::Greyscale,
    )
    .unwrap();
    let expected = StoredSettings {
        theme: Theme::Light,
        antialiasing: Antialiasing::Greyscale,
        keys: keys(&[("apply", &["F2"])]),
    };
    assert_eq!(settings.stored, expected);
    assert_eq!(
        json_at(&config.default_file()),
        json!({
            "window": { "x": 1 },
            "theme": "light",
            "antialiasing": "greyscale",
            "keys": { "apply": ["F2"] },
        })
    );
    let text = fs::read_to_string(config.default_file()).unwrap();
    assert!(text.contains(r#""antialiasing": "greyscale""#), "{text}");
}

#[test]
fn set_antialiasing_back_to_subpixel_writes_subpixel() {
    let config = Config::new();
    let current = StoredSettings::default();
    set_antialiasing(&config.places, &current, Antialiasing::Greyscale).unwrap();
    let settings = set_antialiasing(&config.places, &current, Antialiasing::Subpixel).unwrap();
    assert_eq!(settings.stored.antialiasing, Antialiasing::Subpixel);
    assert_eq!(
        json_at(&config.default_file()),
        json!({ "theme": "dark", "antialiasing": "subpixel" })
    );
}
