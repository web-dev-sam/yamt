#![cfg(test)]

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use serde_json::{Value, json};
use yamt_compare::{Error, TabId, TabLanguage, TabStore};

const ONE_TAB: &str = r#"{"format":1,"shown":3,"nextId":4,"tabs":[{"id":3,"number":1,"name":"Compare 1","language":{"kind":"auto"}}]}"#;

fn files_in(dir: &Path) -> BTreeMap<String, Vec<u8>> {
    fs::read_dir(dir)
        .unwrap()
        .map(|entry| {
            let entry = entry.unwrap();
            let name = entry.file_name().into_string().unwrap();
            (name, fs::read(entry.path()).unwrap())
        })
        .collect()
}

fn names_in(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .collect();
    names.sort();
    names
}

#[test]
fn the_first_open_creates_the_folder_compare_1_and_its_tabs_json() {
    let home = tempfile::tempdir().unwrap();
    let dir = home.path().join("yamt").join("compare");
    let store = TabStore::open(&dir).unwrap();
    let start = store.start();
    assert_eq!(start.column_limit, 8 * 1024 * 1024);
    assert_eq!(start.list.tabs.len(), 1);
    let tab = &start.list.tabs[0];
    assert_eq!((tab.id, tab.name.as_str()), (TabId(1), "Compare 1"));
    assert_eq!(tab.language, TabLanguage::Auto);
    assert!(!tab.holds_text);
    assert_eq!(start.list.shown, TabId(1));
    let index: Value = serde_json::from_slice(&fs::read(dir.join("tabs.json")).unwrap()).unwrap();
    let expected = json!({
        "format": 1, "shown": 1, "nextId": 2,
        "tabs": [{ "id": 1, "number": 1, "name": "Compare 1", "language": { "kind": "auto" } }],
    });
    assert_eq!(index, expected);
    assert_eq!(names_in(&dir), ["lock", "tabs.json"]);
}

#[test]
fn an_existing_tabs_json_is_read_not_replaced() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("tabs.json"), ONE_TAB).unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    assert_eq!(store.start().list.shown, TabId(3));
    assert_eq!(
        fs::read_to_string(dir.path().join("tabs.json")).unwrap(),
        ONE_TAB
    );
    assert_eq!(store.add_tab().unwrap().shown, TabId(4));
}

#[test]
fn broken_json_is_broken_with_its_line_and_nothing_in_the_folder_changes() {
    let dir = tempfile::tempdir().unwrap();
    let broken = "{\n  \"format\": 1,\n  \"shown\": 1,,\n}\n";
    fs::write(dir.path().join("tabs.json"), broken).unwrap();
    fs::write(
        dir.path().join("7-left.txt"),
        "an orphan stays while broken",
    )
    .unwrap();
    let before = files_in(dir.path());
    let result = TabStore::open(dir.path());
    match result {
        Err(Error::Broken { path, message }) => {
            assert_eq!(path, dir.path().join("tabs.json"));
            assert!(message.contains("line 3"), "{message}");
        }
        other => panic!("expected Broken, got {other:?}"),
    }
    assert_eq!(files_in(dir.path()), before);
}

#[test]
fn a_shape_that_is_not_format_1_is_broken() {
    let dir = tempfile::tempdir().unwrap();
    let wrong = r#"{"format":1,"shown":1,"nextId":2,"tabs":[{"id":1,"name":"no number"}]}"#;
    fs::write(dir.path().join("tabs.json"), wrong).unwrap();
    assert!(matches!(
        TabStore::open(dir.path()),
        Err(Error::Broken { .. })
    ));
    assert_eq!(names_in(dir.path()), ["tabs.json"]);
}

#[test]
fn format_2_is_newer_format_and_nothing_in_the_folder_changes() {
    let dir = tempfile::tempdir().unwrap();
    let newer = r#"{"format":2,"somethingNew":true}"#;
    fs::write(dir.path().join("tabs.json"), newer).unwrap();
    fs::write(dir.path().join("9-right.txt"), "kept").unwrap();
    let before = files_in(dir.path());
    let result = TabStore::open(dir.path());
    assert!(
        matches!(result, Err(Error::NewerFormat { format: 2, path }) if path == dir.path().join("tabs.json"))
    );
    assert_eq!(files_in(dir.path()), before);
}

#[test]
fn a_tabs_json_that_cannot_be_read_is_read_failed_and_nothing_in_the_folder_changes() {
    let dir = tempfile::tempdir().unwrap();
    let index = dir.path().join("tabs.json");
    fs::create_dir(&index).unwrap();
    let column = dir.path().join("7-left.txt");
    fs::write(&column, "kept").unwrap();
    let result = TabStore::open(dir.path());
    assert!(
        matches!(&result, Err(Error::ReadFailed { path, .. }) if *path == index),
        "{result:?}"
    );
    assert_eq!(names_in(dir.path()), ["7-left.txt", "tabs.json"]);
    assert_eq!(fs::read_to_string(&column).unwrap(), "kept");
}

#[test]
fn a_second_open_while_the_first_lives_is_locked_and_opens_after_it_is_dropped() {
    let dir = tempfile::tempdir().unwrap();
    let first = TabStore::open(dir.path()).unwrap();
    let second = TabStore::open(dir.path());
    assert!(matches!(second, Err(Error::Locked { path }) if path == dir.path()));
    drop(first);
    let reopened = TabStore::open(dir.path()).unwrap();
    assert_eq!(reopened.start().list.tabs.len(), 1);
}

#[test]
fn a_locked_open_writes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let mut first = TabStore::open(dir.path()).unwrap();
    let closed = first.add_tab().unwrap().shown;
    first.close_tab(closed).unwrap();
    fs::write(dir.path().join(format!("{}-left.txt", closed.0)), "orphan").unwrap();
    let before = files_in(dir.path());
    assert!(matches!(
        TabStore::open(dir.path()),
        Err(Error::Locked { .. })
    ));
    assert_eq!(files_in(dir.path()), before);
}

#[test]
fn orphan_column_and_temp_files_are_removed_and_foreign_files_kept() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("tabs.json"), ONE_TAB).unwrap();
    for name in [
        "3-left.txt",
        "3-right.txt",
        "3-left.txt.tmp",
        "tabs.json.tmp",
        "notes.txt",
        "x-left.txt",
    ] {
        fs::write(dir.path().join(name), name).unwrap();
    }
    for orphan in ["1-left.txt", "2-right.txt", "12-right.txt.tmp"] {
        fs::write(dir.path().join(orphan), "closed").unwrap();
    }
    fs::create_dir(dir.path().join("5-left.txt.d")).unwrap();
    TabStore::open(dir.path()).unwrap();
    let names = names_in(dir.path());
    let expected = [
        "3-left.txt",
        "3-left.txt.tmp",
        "3-right.txt",
        "5-left.txt.d",
        "lock",
        "notes.txt",
        "tabs.json",
        "tabs.json.tmp",
        "x-left.txt",
    ];
    assert_eq!(names, expected);
}

#[test]
fn no_temp_file_is_left_after_a_write() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let tab = store.start().list.shown;
    store.rename_tab(tab, "renamed").unwrap();
    store
        .set_column(
            tab,
            yamt_compare::Column::Left,
            "x".to_owned(),
            yamt_compare::ColumnVersion(1),
        )
        .unwrap();
    assert_eq!(names_in(dir.path()), ["1-left.txt", "lock", "tabs.json"]);
}
