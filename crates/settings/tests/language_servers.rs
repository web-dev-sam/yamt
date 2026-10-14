#![cfg(test)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod config;

use std::fs;

use serde_json::json;
use yamt_settings::{
    AddedServer, Error, LanguageServerSettings, RepositoryAnswer, StoredSettings, Theme, read,
    set_added_servers, set_repository_answer, set_theme,
};

use crate::config::{Config, json_at, write};

const ROOT: &str = "/home/me/project";

fn texts(words: &[&str]) -> Vec<String> {
    words.iter().map(|word| (*word).to_owned()).collect()
}

fn pylsp() -> AddedServer {
    AddedServer {
        command: texts(&["pylsp", "--verbose"]),
        file_types: texts(&["py", "pyi"]),
    }
}

#[test]
fn an_old_file_without_the_entry_reads_as_empty_and_stays_as_written() {
    let config = Config::new();
    let text = r#"{"theme": "light", "antialiasing": "subpixel"}"#;
    write(&config.default_file(), text);
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(
        settings.stored.language_servers,
        LanguageServerSettings::default()
    );
    set_theme(&config.places, &settings.stored, Theme::Light).unwrap();
    assert_eq!(
        json_at(&config.default_file()),
        json!({ "theme": "light", "antialiasing": "subpixel" })
    );
}

#[test]
fn an_answer_is_set_replaced_and_forgotten_by_the_repository_root() {
    let config = Config::new();
    let current = StoredSettings::default();
    let other = "/home/me/other";
    set_repository_answer(
        &config.places,
        &current,
        other,
        Some(RepositoryAnswer::Start),
    )
    .unwrap();
    let start = Some(RepositoryAnswer::Start);
    set_repository_answer(&config.places, &current, ROOT, start).unwrap();
    let dont_start = Some(RepositoryAnswer::DontStart);
    let replaced = set_repository_answer(&config.places, &current, ROOT, dont_start).unwrap();
    let repositories = &replaced.stored.language_servers.repositories;
    assert_eq!(repositories.get(ROOT), Some(&RepositoryAnswer::DontStart));
    assert_eq!(
        json_at(&config.default_file())["languageServers"],
        json!({ "repositories": { ROOT: "dontStart", other: "start" }, "added": [] })
    );
    let forgotten = set_repository_answer(&config.places, &current, ROOT, None).unwrap();
    assert_eq!(
        forgotten.stored.language_servers.repositories.get(ROOT),
        None
    );
    set_repository_answer(&config.places, &current, other, None).unwrap();
    assert_eq!(
        json_at(&config.default_file()),
        json!({ "theme": "dark", "antialiasing": "subpixel" })
    );
}

#[test]
fn added_servers_are_written_with_their_file_types_and_read_back() {
    let config = Config::new();
    let current = StoredSettings::default();
    let start = Some(RepositoryAnswer::Start);
    set_repository_answer(&config.places, &current, ROOT, start).unwrap();
    let written = set_added_servers(&config.places, &current, vec![pylsp()]).unwrap();
    assert_eq!(written.stored.language_servers.added, vec![pylsp()]);
    let added = json!([{ "command": ["pylsp", "--verbose"], "fileTypes": ["py", "pyi"] }]);
    assert_eq!(
        json_at(&config.default_file())["languageServers"],
        json!({ "repositories": { ROOT: "start" }, "added": added })
    );
    let read_back = read(&config.places, &current).unwrap();
    assert_eq!(read_back.stored, written.stored);
    let emptied = set_added_servers(&config.places, &current, Vec::new()).unwrap();
    assert_eq!(emptied.stored.language_servers.added, Vec::new());
}

#[test]
fn a_malformed_language_servers_entry_is_broken_and_no_change_rewrites_the_file() {
    let malformed = [
        r#"{"languageServers": {"repositories": {"/r": "maybe"}, "added": []}}"#,
        r#"{"languageServers": {"repositories": {}, "added": [{"command": ["x"]}]}}"#,
        r#"{"languageServers": []}"#,
    ];
    for text in malformed {
        let config = Config::new();
        write(&config.default_file(), text);
        let current = StoredSettings::default();
        let error = read(&config.places, &current).unwrap_err();
        let Error::Broken { message, .. } = error else {
            panic!("not broken: {error:?}");
        };
        assert!(message.starts_with("`languageServers`: "), "{message}");
        let answer = Some(RepositoryAnswer::Start);
        let set_error = set_repository_answer(&config.places, &current, ROOT, answer).unwrap_err();
        assert!(matches!(set_error, Error::Broken { .. }), "{set_error:?}");
        let added_error = set_added_servers(&config.places, &current, vec![pylsp()]).unwrap_err();
        assert!(
            matches!(added_error, Error::Broken { .. }),
            "{added_error:?}"
        );
        assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
    }
}
