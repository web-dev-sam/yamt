#![cfg(test)]

use std::fs::{self, File};
use std::path::Path;
use std::time::{Duration, SystemTime};

use yamt_compare::{Error, TabId, TabLanguage, TabList, TabStore};

fn names(list: &TabList) -> Vec<&str> {
    list.tabs.iter().map(|tab| tab.name.as_str()).collect()
}

fn id_of(list: &TabList, name: &str) -> TabId {
    list.tabs
        .iter()
        .find(|tab| tab.name == name)
        .map(|tab| tab.id)
        .unwrap()
}

fn with_three_tabs(dir: &Path) -> (TabStore, TabList) {
    let mut store = TabStore::open(dir).unwrap();
    store.add_tab().unwrap();
    let list = store.add_tab().unwrap();
    assert_eq!(names(&list), ["Compare 1", "Compare 2", "Compare 3"]);
    (store, list)
}

const LONG_AGO: Duration = Duration::from_secs(1_000_000);

fn age(path: &Path) -> SystemTime {
    let then = SystemTime::UNIX_EPOCH + LONG_AGO;
    File::options()
        .write(true)
        .open(path)
        .unwrap()
        .set_modified(then)
        .unwrap();
    then
}

fn modified(path: &Path) -> SystemTime {
    fs::metadata(path).unwrap().modified().unwrap()
}

#[test]
fn a_new_tab_is_appended_last_and_shown() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let list = store.add_tab().unwrap();
    assert_eq!(names(&list), ["Compare 1", "Compare 2"]);
    assert_eq!(list.shown, list.tabs[1].id);
    assert_eq!(list.tabs[1].language, TabLanguage::Auto);
    assert!(!list.tabs[1].holds_text);
    assert_ne!(list.tabs[0].id, list.tabs[1].id);
}

#[test]
fn closing_compare_2_of_three_numbers_the_next_tab_4_not_a_reused_2() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, list) = with_three_tabs(dir.path());
    store.close_tab(id_of(&list, "Compare 2")).unwrap();
    let list = store.add_tab().unwrap();
    assert_eq!(names(&list), ["Compare 1", "Compare 3", "Compare 4"]);
}

#[test]
fn closing_all_but_compare_1_numbers_the_next_tab_2() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, list) = with_three_tabs(dir.path());
    store.close_tab(id_of(&list, "Compare 2")).unwrap();
    store.close_tab(id_of(&list, "Compare 3")).unwrap();
    let list = store.add_tab().unwrap();
    assert_eq!(names(&list), ["Compare 1", "Compare 2"]);
}

#[test]
fn ids_never_repeat_even_when_numbers_do() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, list) = with_three_tabs(dir.path());
    let closed = id_of(&list, "Compare 3");
    store.close_tab(closed).unwrap();
    let list = store.add_tab().unwrap();
    assert_eq!(names(&list), ["Compare 1", "Compare 2", "Compare 3"]);
    assert_ne!(id_of(&list, "Compare 3"), closed);
}

#[test]
fn closing_the_last_tab_leaves_a_fresh_compare_1_with_a_new_id() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let first = store.start().list.tabs[0].id;
    store.rename_tab(first, "kept").unwrap();
    let json = TabLanguage::Picked {
        name: "JSON".to_owned(),
    };
    store.set_language(first, json).unwrap();
    let list = store.close_tab(first).unwrap();
    assert_eq!(names(&list), ["Compare 1"]);
    assert_ne!(list.tabs[0].id, first);
    assert_eq!(list.shown, list.tabs[0].id);
    assert_eq!(list.tabs[0].language, TabLanguage::Auto);
}

#[test]
fn closing_the_shown_tab_shows_the_next_one() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, list) = with_three_tabs(dir.path());
    store.show_tab(id_of(&list, "Compare 2")).unwrap();
    let after = store.close_tab(id_of(&list, "Compare 2")).unwrap();
    assert_eq!(after.shown, id_of(&list, "Compare 3"));
}

#[test]
fn closing_the_shown_last_tab_shows_the_previous_one() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, list) = with_three_tabs(dir.path());
    let after = store.close_tab(id_of(&list, "Compare 3")).unwrap();
    assert_eq!(after.shown, id_of(&list, "Compare 2"));
}

#[test]
fn closing_a_hidden_tab_keeps_the_shown_one() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, list) = with_three_tabs(dir.path());
    let after = store.close_tab(id_of(&list, "Compare 1")).unwrap();
    assert_eq!(after.shown, id_of(&list, "Compare 3"));
    assert_eq!(names(&after), ["Compare 2", "Compare 3"]);
}

#[test]
fn closing_a_tab_deletes_both_its_column_files() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let list = store.add_tab().unwrap();
    let closed = list.tabs[1].id;
    for column in ["left", "right"] {
        fs::write(
            dir.path().join(format!("{}-{column}.txt", closed.0)),
            "text",
        )
        .unwrap();
    }
    store.close_tab(closed).unwrap();
    assert!(!dir.path().join(format!("{}-left.txt", closed.0)).exists());
    assert!(!dir.path().join(format!("{}-right.txt", closed.0)).exists());
    let index = fs::read_to_string(dir.path().join("tabs.json")).unwrap();
    assert!(!index.contains("Compare 2"));
}

#[test]
fn a_failed_index_write_at_close_keeps_the_tab_and_both_its_column_files() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let closed = store.add_tab().unwrap().shown;
    let columns =
        ["left", "right"].map(|column| dir.path().join(format!("{}-{column}.txt", closed.0)));
    for column in &columns {
        fs::write(column, "text").unwrap();
    }
    let temp = dir.path().join("tabs.json.tmp");
    fs::create_dir(&temp).unwrap();
    fs::write(temp.join("in the way"), "").unwrap();
    let result = store.close_tab(closed);
    assert!(
        matches!(&result, Err(Error::WriteFailed { path, .. }) if *path == dir.path().join("tabs.json")),
        "{result:?}"
    );
    for column in &columns {
        assert_eq!(fs::read_to_string(column).unwrap(), "text");
    }
    assert!(store.start().list.tabs.iter().any(|tab| tab.id == closed));
}

#[test]
fn rename_trims_the_name() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let tab = store.start().list.shown;
    let list = store.rename_tab(tab, "  payloads \t").unwrap();
    assert_eq!(names(&list), ["payloads"]);
}

#[test]
fn rename_with_spaces_only_keeps_the_name_and_writes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let tab = store.start().list.shown;
    let index = dir.path().join("tabs.json");
    let then = age(&index);
    let list = store.rename_tab(tab, "   ").unwrap();
    assert_eq!(names(&list), ["Compare 1"]);
    assert_eq!(modified(&index), then);
}

#[test]
fn showing_the_shown_tab_again_does_not_rewrite_the_index() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let tab = store.start().list.shown;
    let index = dir.path().join("tabs.json");
    let then = age(&index);
    store.show_tab(tab).unwrap();
    store.set_language(tab, TabLanguage::Auto).unwrap();
    assert_eq!(modified(&index), then);
}

#[test]
fn show_tab_changes_the_shown_tab() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, list) = with_three_tabs(dir.path());
    let after = store.show_tab(id_of(&list, "Compare 1")).unwrap();
    assert_eq!(after.shown, id_of(&list, "Compare 1"));
    assert_eq!(store.start().list.shown, id_of(&list, "Compare 1"));
}

#[test]
fn set_language_picks_and_returns_to_auto() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let tab = store.start().list.shown;
    let json = TabLanguage::Picked {
        name: "JSON".to_owned(),
    };
    let list = store.set_language(tab, json.clone()).unwrap();
    assert_eq!(list.tabs[0].language, json);
    let list = store.set_language(tab, TabLanguage::Auto).unwrap();
    assert_eq!(list.tabs[0].language, TabLanguage::Auto);
}

#[test]
fn every_operation_on_an_unknown_id_is_unknown_tab() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = TabStore::open(dir.path()).unwrap();
    let unknown = TabId(42);
    let is_unknown = |result: Result<TabList, Error>| matches!(result, Err(Error::UnknownTab { tab }) if tab == unknown);
    assert!(is_unknown(store.close_tab(unknown)));
    assert!(is_unknown(store.rename_tab(unknown, "x")));
    assert!(is_unknown(store.rename_tab(unknown, " ")));
    assert!(is_unknown(store.set_language(unknown, TabLanguage::Auto)));
    assert!(is_unknown(store.show_tab(unknown)));
    assert!(matches!(
        store.load_tab(unknown),
        Err(Error::UnknownTab { tab }) if tab == unknown
    ));
    assert_eq!(names(&store.start().list), ["Compare 1"]);
}

#[test]
fn a_restart_reads_back_order_names_languages_and_the_shown_tab() {
    let dir = tempfile::tempdir().unwrap();
    let before = {
        let (mut store, list) = with_three_tabs(dir.path());
        store
            .rename_tab(id_of(&list, "Compare 2"), "payloads")
            .unwrap();
        let json = TabLanguage::Picked {
            name: "JSON".to_owned(),
        };
        store.set_language(id_of(&list, "Compare 3"), json).unwrap();
        store.show_tab(id_of(&list, "Compare 1")).unwrap()
    };
    let mut store = TabStore::open(dir.path()).unwrap();
    assert_eq!(store.start().list, before);
    let list = store.add_tab().unwrap();
    assert_eq!(
        names(&list),
        ["Compare 1", "payloads", "Compare 3", "Compare 4"]
    );
    assert!(before.tabs.iter().all(|tab| tab.id != list.shown));
}
