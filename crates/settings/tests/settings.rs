#![cfg(test)]

mod config;

use std::fs;
use std::time::{Duration, SystemTime};

use serde_json::json;
use yamt_settings::{
    Antialiasing, Error, KeysChange, StoredSettings, Theme, read, relocate, set_keys, set_theme,
    stored_at_start,
};

use crate::config::{Config, json_at, keys, light_with_apply, names_in, write};

fn change(action: &str, action_keys: Option<&[&str]>) -> KeysChange {
    KeysChange {
        action: action.to_owned(),
        keys: action_keys.map(|list| list.iter().map(|key| (*key).to_owned()).collect()),
    }
}

#[test]
fn a_missing_folder_and_file_are_created_from_the_current_settings() {
    let config = Config::new();
    let settings = read(&config.places, &light_with_apply()).unwrap();
    assert_eq!(settings.stored, light_with_apply());
    assert_eq!(settings.path, config.default_file().display().to_string());
    assert_eq!(settings.default_path, settings.path);
    assert_eq!(
        fs::read_to_string(config.default_file()).unwrap(),
        "{\n  \"antialiasing\": \"subpixel\",\n  \"keys\": {\n    \"apply\": [\n      \"Mod-Enter\"\n    ],\n    \"ignore\": []\n  },\n  \"theme\": \"light\"\n}\n"
    );
}

#[test]
fn reading_an_existing_file_never_rewrites_it() {
    let config = Config::new();
    let text = "{\"theme\":\"light\",   \"extra\": 1}";
    write(&config.default_file(), text);
    let long_ago = SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000);
    let file = fs::File::options()
        .write(true)
        .open(config.default_file())
        .unwrap();
    file.set_modified(long_ago).unwrap();
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(settings.stored.theme, Theme::Light);
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
    let modified = fs::metadata(config.default_file())
        .unwrap()
        .modified()
        .unwrap();
    assert_eq!(modified, long_ago);
}

#[test]
fn broken_json_reports_line_and_column_and_a_change_leaves_the_bytes_untouched() {
    let config = Config::new();
    let text = "{\n  \"theme\": \"light\",\n}\n";
    write(&config.default_file(), text);
    let error = read(&config.places, &StoredSettings::default()).unwrap_err();
    let Error::Broken { path, message } = error else {
        panic!("not broken: {error:?}");
    };
    assert_eq!(path, config.default_file());
    assert!(message.contains("line 3 column 1"), "{message}");
    let current = StoredSettings::default();
    let theme_error = set_theme(&config.places, &current, Theme::Dark).unwrap_err();
    assert!(
        matches!(theme_error, Error::Broken { .. }),
        "{theme_error:?}"
    );
    let keys_error = set_keys(&config.places, &current, &[change("apply", None)]).unwrap_err();
    assert!(matches!(keys_error, Error::Broken { .. }), "{keys_error:?}");
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
}

#[test]
fn broken_json_at_the_end_of_the_file_reports_the_line_without_a_column() {
    let config = Config::new();
    write(&config.default_file(), "{\n  \"theme\": \"light\",\n");
    let error = read(&config.places, &StoredSettings::default()).unwrap_err();
    let Error::Broken { message, .. } = error else {
        panic!("not broken: {error:?}");
    };
    assert!(message.ends_with(" at line 3"), "{message}");
}

#[cfg(unix)]
#[test]
fn an_unreadable_settings_file_is_a_read_error_and_stays_untouched() {
    use std::os::unix::fs::PermissionsExt;

    let config = Config::new();
    let text = r#"{"theme": "light"}"#;
    write(&config.default_file(), text);
    fs::set_permissions(config.default_file(), fs::Permissions::from_mode(0o000)).unwrap();
    let current = StoredSettings::default();
    let read_error = read(&config.places, &current).unwrap_err();
    let theme_error = set_theme(&config.places, &current, Theme::Dark).unwrap_err();
    let mode = fs::metadata(config.default_file())
        .unwrap()
        .permissions()
        .mode();
    fs::set_permissions(config.default_file(), fs::Permissions::from_mode(0o644)).unwrap();
    for error in [read_error, theme_error] {
        assert!(
            matches!(&error, Error::ReadFailed { path, .. } if *path == config.default_file()),
            "{error:?}"
        );
    }
    assert_eq!(mode & 0o777, 0o000);
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
}

#[test]
fn an_unknown_theme_or_a_wrong_keys_type_is_broken_and_names_the_entry() {
    let config = Config::new();
    write(&config.default_file(), r#"{"theme": "blue"}"#);
    let error = read(&config.places, &StoredSettings::default()).unwrap_err();
    let Error::Broken { message, .. } = error else {
        panic!("not broken: {error:?}");
    };
    assert!(message.starts_with("`theme`: "), "{message}");
    assert!(message.contains("blue"), "{message}");
    write(
        &config.default_file(),
        r#"{"keys": {"apply": "Mod-Enter"}}"#,
    );
    let error = read(&config.places, &StoredSettings::default()).unwrap_err();
    let Error::Broken { message, .. } = error else {
        panic!("not broken: {error:?}");
    };
    assert!(message.starts_with("`keys`: "), "{message}");
}

#[test]
fn unknown_entries_and_unknown_action_ids_survive_a_change() {
    let config = Config::new();
    write(
        &config.default_file(),
        r#"{"window": {"x": 1}, "keys": {"future-action": ["F1"]}}"#,
    );
    let current = StoredSettings::default();
    set_theme(&config.places, &current, Theme::Light).unwrap();
    set_keys(
        &config.places,
        &current,
        &[change("apply", Some(&["Mod-Enter"]))],
    )
    .unwrap();
    assert_eq!(
        json_at(&config.default_file()),
        json!({
            "window": { "x": 1 },
            "theme": "light",
            "antialiasing": "subpixel",
            "keys": { "future-action": ["F1"], "apply": ["Mod-Enter"] },
        })
    );
}

#[test]
fn some_sets_and_none_removes_an_action_and_keys_disappears_when_empty() {
    let config = Config::new();
    read(&config.places, &light_with_apply()).unwrap();
    let changes = [change("apply", None), change("undo", Some(&["Mod-u"]))];
    let settings = set_keys(&config.places, &light_with_apply(), &changes).unwrap();
    let expected = keys(&[("ignore", &[]), ("undo", &["Mod-u"])]);
    assert_eq!(settings.stored.keys, expected);
    assert_eq!(
        json_at(&config.default_file()),
        json!({
            "theme": "light",
            "antialiasing": "subpixel",
            "keys": { "ignore": [], "undo": ["Mod-u"] },
        })
    );
    let back = [change("ignore", None), change("undo", None)];
    let settings = set_keys(&config.places, &light_with_apply(), &back).unwrap();
    assert!(settings.stored.keys.is_empty());
    assert_eq!(
        json_at(&config.default_file()),
        json!({ "theme": "light", "antialiasing": "subpixel" })
    );
}

#[test]
fn a_change_rereads_the_file_so_an_outside_edit_to_another_entry_survives() {
    let config = Config::new();
    let current = StoredSettings::default();
    read(&config.places, &current).unwrap();
    write(&config.default_file(), r#"{"theme": "light"}"#);
    let settings = set_keys(&config.places, &current, &[change("apply", Some(&["F2"]))]).unwrap();
    assert_eq!(settings.stored.theme, Theme::Light);
    assert_eq!(
        json_at(&config.default_file()),
        json!({ "theme": "light", "antialiasing": "subpixel", "keys": { "apply": ["F2"] } })
    );
}

#[test]
fn a_change_to_a_missing_file_starts_from_the_current_settings() {
    let config = Config::new();
    let settings = set_theme(&config.places, &light_with_apply(), Theme::Dark).unwrap();
    assert_eq!(settings.stored.keys, light_with_apply().keys);
    assert_eq!(
        json_at(&config.default_file()),
        json!({
            "theme": "dark",
            "antialiasing": "subpixel",
            "keys": { "apply": ["Mod-Enter"], "ignore": [] },
        })
    );
}

#[test]
fn a_write_leaves_no_temporary_file() {
    let config = Config::new();
    read(&config.places, &StoredSettings::default()).unwrap();
    set_theme(&config.places, &StoredSettings::default(), Theme::Light).unwrap();
    relocate(&config.places, &StoredSettings::default(), "~/s.json").unwrap();
    assert_eq!(
        names_in(&config.folder()),
        ["settings-location", "settings.json"]
    );
}

#[test]
fn a_failed_rename_leaves_no_temporary_file() {
    let config = Config::new();
    fs::create_dir_all(config.location_file().join("occupied")).unwrap();
    let target = config.elsewhere("s.json").display().to_string();
    let error = relocate(&config.places, &StoredSettings::default(), &target);
    assert!(matches!(error, Err(Error::WriteFailed { .. })), "{error:?}");
    assert_eq!(names_in(&config.folder()), ["settings-location"]);
}

#[cfg(unix)]
#[test]
fn a_settings_file_reached_through_a_symlink_stays_a_symlink() {
    let config = Config::new();
    let dotfile = config.elsewhere("dotfiles/settings.json");
    write(&dotfile, r#"{"theme": "dark"}"#);
    fs::create_dir_all(config.folder()).unwrap();
    std::os::unix::fs::symlink(&dotfile, config.default_file()).unwrap();
    set_theme(&config.places, &StoredSettings::default(), Theme::Light).unwrap();
    let link = fs::symlink_metadata(config.default_file()).unwrap();
    assert!(link.file_type().is_symlink());
    assert_eq!(json_at(&dotfile), light_subpixel());
}

#[cfg(unix)]
#[test]
fn a_chain_of_settings_symlinks_stays_links_and_writes_the_last_target() {
    let config = Config::new();
    let dotfile = config.elsewhere("dotfiles/settings.json");
    write(&dotfile, r#"{"theme": "dark"}"#);
    let second_link = config.elsewhere("links/settings.json");
    fs::create_dir_all(config.elsewhere("links")).unwrap();
    std::os::unix::fs::symlink("../dotfiles/settings.json", &second_link).unwrap();
    fs::create_dir_all(config.folder()).unwrap();
    std::os::unix::fs::symlink(&second_link, config.default_file()).unwrap();
    set_theme(&config.places, &StoredSettings::default(), Theme::Light).unwrap();
    for link in [config.default_file(), second_link] {
        assert!(fs::symlink_metadata(link).unwrap().file_type().is_symlink());
    }
    assert_eq!(json_at(&dotfile), light_subpixel());
}

#[cfg(unix)]
#[test]
fn a_chain_of_forty_settings_symlinks_is_written_through_as_linux_reads_it() {
    const LINUX_LINK_LIMIT: usize = 40;
    let config = Config::new();
    let dotfile = config.elsewhere("dotfiles/settings.json");
    write(&dotfile, r#"{"theme": "dark"}"#);
    let links = config.elsewhere("links");
    fs::create_dir_all(&links).unwrap();
    let mut target = dotfile.clone();
    for number in 1..LINUX_LINK_LIMIT {
        let link = links.join(format!("link-{number}"));
        std::os::unix::fs::symlink(&target, &link).unwrap();
        target = link;
    }
    fs::create_dir_all(config.folder()).unwrap();
    std::os::unix::fs::symlink(&target, config.default_file()).unwrap();
    let current = StoredSettings::default();
    assert_eq!(
        read(&config.places, &current).unwrap().stored.theme,
        Theme::Dark
    );
    set_theme(&config.places, &current, Theme::Light).unwrap();
    assert_eq!(json_at(&dotfile), light_subpixel());
    let mut link_count = 0;
    for entry in fs::read_dir(&links).unwrap() {
        assert!(entry.unwrap().file_type().unwrap().is_symlink());
        link_count += 1;
    }
    assert_eq!(link_count + 1, LINUX_LINK_LIMIT);
    assert!(
        fs::symlink_metadata(config.default_file())
            .unwrap()
            .is_symlink()
    );
}

#[cfg(unix)]
#[test]
fn a_dangling_settings_symlink_creates_its_target_and_stays_a_link() {
    let config = Config::new();
    fs::create_dir_all(config.folder()).unwrap();
    let relative_target = std::path::Path::new("../../elsewhere/dotfiles/settings.json");
    std::os::unix::fs::symlink(relative_target, config.default_file()).unwrap();
    let dotfile = config.elsewhere("dotfiles/settings.json");
    read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(
        json_at(&dotfile),
        json!({ "theme": "dark", "antialiasing": "subpixel" })
    );
    set_theme(&config.places, &StoredSettings::default(), Theme::Light).unwrap();
    let link = fs::symlink_metadata(config.default_file()).unwrap();
    assert!(link.file_type().is_symlink());
    assert_eq!(
        fs::read_link(config.default_file()).unwrap(),
        relative_target
    );
    assert_eq!(json_at(&dotfile), light_subpixel());
}

fn light_subpixel() -> serde_json::Value {
    json!({ "theme": "light", "antialiasing": "subpixel" })
}

#[test]
fn stored_at_start_gives_the_defaults_whenever_anything_is_missing_or_broken() {
    let config = Config::new();
    let defaults = StoredSettings::default();
    assert_eq!(stored_at_start(&config.places), defaults);
    assert!(!config.folder().exists());
    write(
        &config.default_file(),
        r#"{"theme": "light", "antialiasing": "greyscale", "keys": {"apply": ["F2"]}}"#,
    );
    let stored = StoredSettings {
        theme: Theme::Light,
        antialiasing: Antialiasing::Greyscale,
        keys: keys(&[("apply", &["F2"])]),
    };
    assert_eq!(stored_at_start(&config.places), stored);
    write(&config.default_file(), r#"{"keys": {}}"#);
    assert_eq!(stored_at_start(&config.places), defaults);
    write(&config.default_file(), r#"{"theme": "light""#);
    assert_eq!(stored_at_start(&config.places), defaults);
    write(
        &config.default_file(),
        r#"{"theme": "light", "antialiasing": "sharp"}"#,
    );
    assert_eq!(stored_at_start(&config.places), defaults);
    let target = config.elsewhere("missing.json");
    write(&config.location_file(), &format!("{}\n", target.display()));
    assert_eq!(stored_at_start(&config.places), defaults);
    assert!(!target.exists());
    write(&config.location_file(), "relative.json\n");
    assert_eq!(stored_at_start(&config.places), defaults);
    fs::remove_file(config.location_file()).unwrap();
    fs::create_dir(config.location_file()).unwrap();
    assert_eq!(stored_at_start(&config.places), defaults);
}

#[cfg(unix)]
#[test]
fn stored_at_start_gives_the_defaults_for_an_unreadable_file_and_leaves_it_alone() {
    use std::os::unix::fs::PermissionsExt;

    let config = Config::new();
    let text = r#"{"theme": "light", "antialiasing": "greyscale"}"#;
    write(&config.default_file(), text);
    fs::set_permissions(config.default_file(), fs::Permissions::from_mode(0o000)).unwrap();
    let stored = stored_at_start(&config.places);
    fs::set_permissions(config.default_file(), fs::Permissions::from_mode(0o644)).unwrap();
    assert_eq!(stored, StoredSettings::default());
    assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
}
