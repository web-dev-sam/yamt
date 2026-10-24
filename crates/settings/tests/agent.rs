#![cfg(test)]

#[expect(dead_code, reason = "these tests use part of the shared helpers")]
mod config;

use std::fs;

use serde_json::json;
use yamt_settings::{AgentSettings, Error, StoredSettings, Theme, read, set_agent, set_theme};

use crate::config::{Config, json_at, write};

fn words(list: &[&str]) -> Vec<String> {
    list.iter().map(|word| (*word).to_owned()).collect()
}

fn agent(command: Option<&[&str]>, first_message: Option<&str>) -> AgentSettings {
    AgentSettings {
        command: command.map(words),
        first_message: first_message.map(str::to_owned),
    }
}

#[test]
fn set_agent_writes_only_the_fields_given_and_keeps_unknown_entries() {
    let config = Config::new();
    write(
        &config.default_file(),
        r#"{"window": {"x": 1}, "theme": "light"}"#,
    );
    let current = StoredSettings::default();

    let command = agent(Some(&["omp", "acp", "--fast"]), None);
    let written = set_agent(&config.places, &current, command.clone()).unwrap();
    assert_eq!(written.stored.agent, command);
    assert_eq!(written.stored.theme, Theme::Light);
    assert_eq!(
        json_at(&config.default_file()),
        json!({
            "window": { "x": 1 },
            "theme": "light",
            "antialiasing": "subpixel",
            "agent": { "command": ["omp", "acp", "--fast"] },
        })
    );

    let message = agent(None, Some("Look at {{ RANGE }}"));
    let written = set_agent(&config.places, &current, message.clone()).unwrap();
    assert_eq!(written.stored.agent, message);
    assert_eq!(
        json_at(&config.default_file())["agent"],
        json!({ "firstMessage": "Look at {{ RANGE }}" })
    );
    assert_eq!(
        read(&config.places, &current).unwrap().stored.agent,
        message
    );

    let defaults = set_agent(&config.places, &current, AgentSettings::default()).unwrap();
    assert_eq!(defaults.stored.agent, AgentSettings::default());
    assert_eq!(
        json_at(&config.default_file()),
        json!({ "window": { "x": 1 }, "theme": "light", "antialiasing": "subpixel" })
    );
}

#[test]
fn a_file_without_agent_reads_as_defaults() {
    let defaults = [
        r#"{"theme": "light"}"#,
        r#"{"agent": {}}"#,
        r#"{"agent": {"command": null, "firstMessage": null}}"#,
    ];
    for text in defaults {
        let config = Config::new();
        write(&config.default_file(), text);
        let settings = read(&config.places, &StoredSettings::default()).unwrap();
        assert_eq!(settings.stored.agent, AgentSettings::default(), "{text}");
        assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
    }
}

#[test]
fn a_set_field_reads_back_and_the_other_stays_the_default() {
    let config = Config::new();
    write(
        &config.default_file(),
        r#"{"agent": {"command": ["/opt/my agent/omp", "acp"]}}"#,
    );
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(
        settings.stored.agent,
        agent(Some(&["/opt/my agent/omp", "acp"]), None)
    );
}

#[test]
fn an_agent_entry_of_the_wrong_shape_is_reported_broken() {
    let malformed = [
        r#"{"agent": {"command": "omp acp"}}"#,
        r#"{"agent": {"firstMessage": ["hi"]}}"#,
        r#"{"agent": ["omp", "acp"]}"#,
    ];
    for text in malformed {
        let config = Config::new();
        write(&config.default_file(), text);
        let current = StoredSettings::default();
        let error = read(&config.places, &current).unwrap_err();
        let Error::Broken { message, .. } = error else {
            panic!("not broken: {error:?}");
        };
        assert!(message.starts_with("`agent`: "), "{message}");
        let theme_error = set_theme(&config.places, &current, Theme::Light).unwrap_err();
        assert!(
            matches!(theme_error, Error::Broken { .. }),
            "{theme_error:?}"
        );
        let agent_error = set_agent(&config.places, &current, agent(None, Some("hi"))).unwrap_err();
        assert!(
            matches!(agent_error, Error::Broken { .. }),
            "{agent_error:?}"
        );
        assert_eq!(fs::read_to_string(config.default_file()).unwrap(), text);
    }
}

#[test]
fn an_empty_command_list_is_written_as_the_default() {
    let config = Config::new();
    let current = StoredSettings::default();

    let written = set_agent(&config.places, &current, agent(Some(&[]), Some("hi"))).unwrap();

    assert_eq!(written.stored.agent, agent(None, Some("hi")));
    assert_eq!(
        json_at(&config.default_file())["agent"],
        json!({ "firstMessage": "hi" })
    );
    let emptied = set_agent(&config.places, &current, agent(Some(&[]), None)).unwrap();
    assert_eq!(emptied.stored.agent, AgentSettings::default());
    assert_eq!(json_at(&config.default_file()).get("agent"), None);
}

#[test]
fn a_hand_written_empty_command_list_reads_as_the_default() {
    let config = Config::new();
    write(&config.default_file(), r#"{"agent": {"command": []}}"#);
    let settings = read(&config.places, &StoredSettings::default()).unwrap();
    assert_eq!(settings.stored.agent, AgentSettings::default());
}
