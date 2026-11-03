#![cfg(test)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod config;

use std::fs;

use serde_json::json;
use yamt_settings::{
    DiscussionDetails, Error, StoredSettings, Theme, read, set_discussion_details, set_theme,
};

use crate::config::{Config, json_at, write};

#[test]
fn the_three_values_read_and_write_as_named() {
    for (details, name) in [
        (DiscussionDetails::Lazy, "lazy"),
        (DiscussionDetails::Off, "off"),
    ] {
        let config = Config::new();
        let current = StoredSettings::default();

        let settings = set_discussion_details(&config.places, &current, details).unwrap();

        assert_eq!(settings.stored.discussion_details, details);
        assert_eq!(
            json_at(&config.default_file()),
            json!({ "theme": "dark", "antialiasing": "subpixel", "discussionDetails": name })
        );
        let reread = read(&config.places, &current).unwrap();
        assert_eq!(reread.stored.discussion_details, details);
    }
    let config = Config::new();
    write(&config.default_file(), r#"{"discussionDetails": "full"}"#);
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(settings.stored.discussion_details, DiscussionDetails::Full);
}

#[test]
fn a_file_without_the_key_reads_as_full_and_full_is_not_written() {
    let config = Config::new();
    let text = r#"{"theme": "light"}"#;
    write(&config.default_file(), text);
    let current = StoredSettings::default();

    let settings = read(&config.places, &current).unwrap();

    assert_eq!(settings.stored.discussion_details, DiscussionDetails::Full);
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
    set_discussion_details(&config.places, &current, DiscussionDetails::Off).unwrap();
    let back = set_discussion_details(&config.places, &current, DiscussionDetails::Full).unwrap();
    assert_eq!(back.stored.discussion_details, DiscussionDetails::Full);
    assert_eq!(
        json_at(&config.default_file()),
        json!({ "theme": "light", "antialiasing": "subpixel" })
    );
}

#[test]
fn an_unknown_value_is_broken_and_nothing_is_written() {
    let config = Config::new();
    let text = r#"{"discussionDetails": "eager", "theme": "light"}"#;
    write(&config.default_file(), text);
    let current = StoredSettings::default();

    let read_error = read(&config.places, &current).unwrap_err();

    let Error::Broken { message, .. } = read_error else {
        panic!("not broken: {read_error:?}");
    };
    assert!(message.starts_with("`discussionDetails`: "), "{message}");
    assert!(message.contains("eager"), "{message}");
    let set_error =
        set_discussion_details(&config.places, &current, DiscussionDetails::Off).unwrap_err();
    assert!(matches!(set_error, Error::Broken { .. }), "{set_error:?}");
    let theme_error = set_theme(&config.places, &current, Theme::Dark).unwrap_err();
    assert!(
        matches!(theme_error, Error::Broken { .. }),
        "{theme_error:?}"
    );
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
}

#[test]
fn unknown_entries_are_kept() {
    let config = Config::new();
    write(
        &config.default_file(),
        r#"{"window": {"x": 1}, "theme": "light", "discussionDetails": "off"}"#,
    );

    let settings = set_discussion_details(
        &config.places,
        &StoredSettings::default(),
        DiscussionDetails::Lazy,
    )
    .unwrap();

    assert_eq!(settings.stored.theme, Theme::Light);
    assert_eq!(
        json_at(&config.default_file()),
        json!({
            "window": { "x": 1 },
            "theme": "light",
            "antialiasing": "subpixel",
            "discussionDetails": "lazy",
        })
    );
}
