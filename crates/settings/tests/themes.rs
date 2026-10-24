#![cfg(test)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod config;

use yamt_settings::{Error, StoredSettings, Theme, read};

use crate::config::{Config, write};

#[test]
fn the_two_first_names_still_read_as_dark_and_light() {
    for (text, theme) in [
        (r#"{"theme": "dark"}"#, Theme::Dark),
        (r#"{"theme": "light"}"#, Theme::Light),
    ] {
        let config = Config::new();
        write(&config.default_file(), text);
        let settings = read(&config.places, &StoredSettings::default()).unwrap();
        assert_eq!(settings.stored.theme, theme);
    }
}

#[test]
fn an_editor_theme_reads_by_its_kebab_name() {
    let config = Config::new();
    write(&config.default_file(), r#"{"theme": "webstorm-dark"}"#);
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(settings.stored.theme, Theme::WebstormDark);
}

#[test]
fn a_theme_name_without_its_variant_is_broken_and_names_the_entry() {
    for name in ["vscode", "WebstormDark", "webstorm_dark"] {
        let config = Config::new();
        write(&config.default_file(), &format!(r#"{{"theme": "{name}"}}"#));
        let error = read(&config.places, &StoredSettings::default()).unwrap_err();
        let Error::Broken { message, .. } = error else {
            panic!("not broken: {error:?}");
        };
        assert!(message.starts_with("`theme`: "), "{message}");
    }
}
