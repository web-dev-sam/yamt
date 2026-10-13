#![cfg(test)]

mod config;

use std::fs;

use serde_json::json;
use yamt_settings::{Error, StoredSettings, Theme, read, relocate, set_theme, theme_at_start};

use crate::config::{Config, json_at, light_with_apply, names_in, write};

#[test]
fn relocating_to_an_existing_file_uses_it_and_records_the_location() {
    let config = Config::new();
    let target = config.elsewhere("s.json");
    write(&target, r#"{"theme": "light"}"#);
    let target_name = target.display().to_string();
    let settings = relocate(&config.places, &StoredSettings::default(), &target_name).unwrap();
    assert_eq!(settings.stored.theme, Theme::Light);
    assert_eq!(settings.path, target_name);
    assert_eq!(
        fs::read_to_string(config.location_file()).unwrap(),
        format!("{target_name}\n")
    );
    let again = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(again.path, target_name);
    assert_eq!(
        again.default_path,
        config.default_file().display().to_string()
    );
    assert_eq!(theme_at_start(&config.places), Theme::Light);
}

#[test]
fn relocating_to_a_missing_path_creates_it_from_the_current_settings() {
    let config = Config::new();
    let target = config.elsewhere("new/s.json");
    let settings = relocate(
        &config.places,
        &light_with_apply(),
        &target.display().to_string(),
    )
    .unwrap();
    assert_eq!(settings.stored, light_with_apply());
    assert_eq!(
        json_at(&target),
        json!({ "theme": "light", "keys": { "apply": ["Mod-Enter"], "ignore": [] } })
    );
    assert!(config.location_file().exists());
}

#[test]
fn relocating_to_the_default_removes_the_location_file() {
    let config = Config::new();
    let target = config.elsewhere("s.json").display().to_string();
    relocate(&config.places, &StoredSettings::default(), &target).unwrap();
    let default_name = config.default_file().display().to_string();
    let settings = relocate(&config.places, &light_with_apply(), &default_name).unwrap();
    assert!(!config.location_file().exists());
    assert_eq!(settings.path, default_name);
    assert_eq!(json_at(&config.default_file())["theme"], "light");
}

#[test]
fn relocating_to_the_default_without_a_location_file_is_ok() {
    let config = Config::new();
    let default_name = config.default_file().display().to_string();
    let settings = relocate(&config.places, &light_with_apply(), &default_name).unwrap();
    assert_eq!(settings.path, default_name);
    assert!(!config.location_file().exists());
}

#[cfg(unix)]
#[test]
fn a_location_file_that_cannot_be_removed_is_a_write_error_and_stays_in_force() {
    use std::os::unix::fs::PermissionsExt;

    let config = Config::new();
    let old = config.elsewhere("old.json").display().to_string();
    relocate(&config.places, &StoredSettings::default(), &old).unwrap();
    write(&config.default_file(), r#"{"theme": "light"}"#);
    fs::set_permissions(config.folder(), fs::Permissions::from_mode(0o555)).unwrap();
    let default_name = config.default_file().display().to_string();
    let error = relocate(&config.places, &StoredSettings::default(), &default_name);
    fs::set_permissions(config.folder(), fs::Permissions::from_mode(0o755)).unwrap();
    assert!(
        matches!(&error, Err(Error::WriteFailed { path, .. }) if *path == config.location_file()),
        "{error:?}"
    );
    let in_force = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(in_force.path, old);
}

#[test]
fn a_relative_path_is_refused_and_a_home_prefix_is_expanded() {
    let config = Config::new();
    let error = relocate(
        &config.places,
        &StoredSettings::default(),
        "elsewhere/s.json",
    );
    assert!(
        matches!(error, Err(Error::NotAbsolute { ref path }) if path == "elsewhere/s.json"),
        "{error:?}"
    );
    assert!(!config.location_file().exists());
    let settings = relocate(&config.places, &StoredSettings::default(), "~/s.json").unwrap();
    let in_home = config.dir.path().join("home/s.json");
    assert_eq!(settings.path, in_home.display().to_string());
    assert!(in_home.exists());
}

#[test]
fn relocating_to_a_broken_file_keeps_the_old_location() {
    let config = Config::new();
    let broken = config.elsewhere("broken.json");
    write(&broken, "{");
    let error = relocate(
        &config.places,
        &StoredSettings::default(),
        &broken.display().to_string(),
    );
    assert!(matches!(error, Err(Error::Broken { .. })), "{error:?}");
    assert!(!config.location_file().exists());
}

#[cfg(unix)]
#[test]
fn relocating_into_an_unwritable_folder_keeps_the_old_location() {
    use std::os::unix::fs::PermissionsExt;

    let config = Config::new();
    let old = config.elsewhere("old.json").display().to_string();
    relocate(&config.places, &StoredSettings::default(), &old).unwrap();
    let locked = config.dir.path().join("locked");
    fs::create_dir(&locked).unwrap();
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o555)).unwrap();
    let target = locked.join("s.json").display().to_string();
    let error = relocate(&config.places, &StoredSettings::default(), &target);
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(matches!(error, Err(Error::WriteFailed { .. })), "{error:?}");
    assert_eq!(
        fs::read_to_string(config.location_file()).unwrap(),
        format!("{old}\n")
    );
    assert_eq!(fs::read_dir(&locked).unwrap().count(), 0);
}

#[test]
fn an_unreadable_location_file_is_an_error() {
    let config = Config::new();
    fs::create_dir_all(config.location_file()).unwrap();
    let error = read(&config.places, &StoredSettings::default()).unwrap_err();
    assert!(
        matches!(error, Error::ReadFailed { ref path, .. } if *path == config.location_file()),
        "{error:?}"
    );
    fs::remove_dir(config.location_file()).unwrap();
    write(&config.location_file(), "relative.json\n");
    let error = set_theme(&config.places, &StoredSettings::default(), Theme::Light).unwrap_err();
    assert!(matches!(error, Error::Broken { .. }), "{error:?}");
    assert!(!config.default_file().exists());
}

#[cfg(unix)]
#[test]
fn a_settings_location_link_cycle_is_a_write_error_on_the_location_file_and_writes_nothing() {
    let config = Config::new();
    let partner = config.folder().join("partner");
    fs::create_dir_all(config.folder()).unwrap();
    std::os::unix::fs::symlink(&partner, config.location_file()).unwrap();
    std::os::unix::fs::symlink(config.location_file(), &partner).unwrap();
    let target = config.elsewhere("s.json").display().to_string();
    let error = relocate(&config.places, &StoredSettings::default(), &target).unwrap_err();
    assert!(
        matches!(&error, Error::WriteFailed { path, .. } if *path == config.location_file()),
        "{error:?}"
    );
    for link in [config.location_file(), partner] {
        assert!(fs::symlink_metadata(link).unwrap().is_symlink());
    }
    assert_eq!(names_in(&config.folder()), ["partner", "settings-location"]);
}
