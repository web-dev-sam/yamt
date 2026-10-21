#![cfg(test)]

use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use yamt_compare::{
    Column, ColumnVersion, ColumnVersions, Error, MAX_COLUMN_BYTES, TabId, TabStore, TabTexts,
    comparison, tab_texts,
};

const LONG_AGO: Duration = Duration::from_secs(1_000_000);

fn column_file(dir: &Path, tab: TabId, column: &str) -> PathBuf {
    dir.join(format!("{}-{column}.txt", tab.0))
}

fn first_tab(dir: &Path) -> (TabStore, TabId) {
    let store = TabStore::open(dir).unwrap();
    let tab = store.start().list.shown;
    (store, tab)
}

fn texts(store: &mut TabStore, tab: TabId) -> TabTexts {
    tab_texts(&store.load_tab(tab).unwrap())
}

fn versions(left: u32, right: u32) -> ColumnVersions {
    ColumnVersions {
        left: ColumnVersion(left),
        right: ColumnVersion(right),
    }
}

fn aged(path: &Path) -> SystemTime {
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

fn holds_text(store: &TabStore, tab: TabId) -> bool {
    let list = store.start().list;
    list.tabs
        .iter()
        .find(|entry| entry.id == tab)
        .unwrap()
        .holds_text
}

#[test]
fn set_column_writes_that_column_and_returns_both_texts_and_versions() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    store
        .set_column(tab, Column::Right, "right\n".to_owned(), ColumnVersion(1))
        .unwrap();
    let loaded = store
        .set_column(tab, Column::Left, "left\n".to_owned(), ColumnVersion(3))
        .unwrap();
    let texts = tab_texts(&loaded);
    assert_eq!(texts.left, "left\n");
    assert_eq!(texts.right, "right\n");
    assert_eq!(texts.comparison.versions, versions(3, 1));
    assert_eq!(
        fs::read_to_string(column_file(dir.path(), tab, "left")).unwrap(),
        "left\n"
    );
    assert_eq!(
        fs::read_to_string(column_file(dir.path(), tab, "right")).unwrap(),
        "right\n"
    );
}

#[test]
fn set_column_rewrites_only_that_columns_file_not_the_other_nor_the_index() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    store
        .set_column(tab, Column::Left, "a".to_owned(), ColumnVersion(1))
        .unwrap();
    store
        .set_column(tab, Column::Right, "b".to_owned(), ColumnVersion(1))
        .unwrap();
    let right = column_file(dir.path(), tab, "right");
    let index = dir.path().join("tabs.json");
    let index_bytes = fs::read(&index).unwrap();
    let (right_then, index_then) = (aged(&right), aged(&index));
    store
        .set_column(tab, Column::Left, "c".to_owned(), ColumnVersion(2))
        .unwrap();
    assert_eq!(modified(&right), right_then);
    assert_eq!(fs::read(&right).unwrap(), b"b");
    assert_eq!(modified(&index), index_then);
    assert_eq!(fs::read(&index).unwrap(), index_bytes);
    assert_eq!(
        fs::read(column_file(dir.path(), tab, "left")).unwrap(),
        b"c"
    );
}

#[test]
fn a_stale_or_equal_version_stores_nothing_and_replies_with_the_stored_versions() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    store
        .set_column(tab, Column::Left, "new".to_owned(), ColumnVersion(2))
        .unwrap();
    let left = column_file(dir.path(), tab, "left");
    let then = aged(&left);
    for stale in [ColumnVersion(1), ColumnVersion(2)] {
        let reply = store
            .set_column(tab, Column::Left, "old".to_owned(), stale)
            .unwrap();
        let texts = tab_texts(&reply);
        assert_eq!(texts.left, "new");
        assert_eq!(texts.comparison.versions, versions(2, 0));
    }
    assert_eq!(modified(&left), then);
    assert_eq!(texts(&mut store, tab).left, "new");
}

#[test]
fn versions_start_at_0_for_every_tab_at_open() {
    let dir = tempfile::tempdir().unwrap();
    {
        let (mut store, tab) = first_tab(dir.path());
        store
            .set_column(tab, Column::Right, "r".to_owned(), ColumnVersion(9))
            .unwrap();
    }
    let (mut store, tab) = first_tab(dir.path());
    assert_eq!(texts(&mut store, tab).comparison.versions, versions(0, 0));
    let reply = store
        .set_column(tab, Column::Right, "s".to_owned(), ColumnVersion(1))
        .unwrap();
    assert_eq!(tab_texts(&reply).right, "s");
}

fn send(store: &mut TabStore, tab: TabId, column: Column, text: &str) {
    store
        .set_column(tab, column, text.to_owned(), ColumnVersion(1))
        .unwrap();
}

#[test]
fn a_restart_reads_back_both_texts_of_every_tab() {
    let dir = tempfile::tempdir().unwrap();
    let second = {
        let (mut store, first) = first_tab(dir.path());
        send(&mut store, first, Column::Left, "{\"a\": 1}\n");
        send(&mut store, first, Column::Right, "{\"a\": 2}\n");
        let second = store.add_tab().unwrap().shown;
        send(&mut store, second, Column::Right, "ünïcode\n");
        second
    };
    let (mut store, _) = first_tab(dir.path());
    let first = store.start().list.tabs[0].id;
    let first_texts = texts(&mut store, first);
    assert_eq!(
        (first_texts.left.as_str(), first_texts.right.as_str()),
        ("{\"a\": 1}\n", "{\"a\": 2}\n")
    );
    let second_texts = texts(&mut store, second);
    assert_eq!(
        (second_texts.left.as_str(), second_texts.right.as_str()),
        ("", "ünïcode\n")
    );
}

#[test]
fn a_missing_column_file_reads_as_an_empty_column() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    fs::write(column_file(dir.path(), tab, "left"), "only left").unwrap();
    let texts = texts(&mut store, tab);
    assert_eq!(texts.left, "only left");
    assert_eq!(texts.right, "");
}

#[test]
fn load_tab_reads_the_files_once() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    let left = column_file(dir.path(), tab, "left");
    fs::write(&left, "first").unwrap();
    assert_eq!(texts(&mut store, tab).left, "first");
    fs::write(&left, "changed behind the store").unwrap();
    assert_eq!(texts(&mut store, tab).left, "first");
}

#[test]
fn a_column_over_the_limit_is_too_large_and_nothing_is_written_or_stored() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    store
        .set_column(tab, Column::Left, "kept".to_owned(), ColumnVersion(1))
        .unwrap();
    let over = MAX_COLUMN_BYTES as usize + 1;
    let result = store.set_column(tab, Column::Left, "x".repeat(over), ColumnVersion(2));
    assert!(matches!(result, Err(Error::TooLarge { bytes }) if bytes == over));
    assert_eq!(
        fs::read(column_file(dir.path(), tab, "left")).unwrap(),
        b"kept"
    );
    let texts = texts(&mut store, tab);
    assert_eq!(texts.left, "kept");
    assert_eq!(texts.comparison.versions, versions(1, 0));
    let result = store.set_column(tab, Column::Right, "x".repeat(over), ColumnVersion(1));
    assert!(matches!(result, Err(Error::TooLarge { .. })));
    assert!(!column_file(dir.path(), tab, "right").exists());
}

#[test]
fn a_column_exactly_at_the_limit_is_stored() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    let full = "x".repeat(MAX_COLUMN_BYTES as usize);
    store
        .set_column(tab, Column::Right, full, ColumnVersion(1))
        .unwrap();
    drop(store);
    let (mut store, tab) = first_tab(dir.path());
    assert_eq!(
        texts(&mut store, tab).right.len(),
        MAX_COLUMN_BYTES as usize
    );
}

#[test]
fn a_column_file_over_the_limit_is_too_large_at_load() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    let over = MAX_COLUMN_BYTES as usize + 1;
    fs::write(column_file(dir.path(), tab, "right"), "x".repeat(over)).unwrap();
    assert!(matches!(store.load_tab(tab), Err(Error::TooLarge { bytes }) if bytes == over));
}

#[test]
fn a_non_utf8_column_file_fails_at_load_and_no_other_call_rewrites_it() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    let left = column_file(dir.path(), tab, "left");
    let bytes = b"caf\xe9\n";
    fs::write(&left, bytes).unwrap();
    assert!(matches!(store.load_tab(tab), Err(Error::ReadFailed { path, .. }) if path == left));
    for column in [Column::Left, Column::Right] {
        let result = store.set_column(tab, column, "text".to_owned(), ColumnVersion(1));
        assert!(matches!(result, Err(Error::ReadFailed { .. })));
    }
    store.rename_tab(tab, "renamed").unwrap();
    store.add_tab().unwrap();
    store.show_tab(tab).unwrap();
    drop(store);
    TabStore::open(dir.path()).unwrap();
    assert_eq!(fs::read(&left).unwrap(), bytes);
    assert!(!column_file(dir.path(), tab, "right").exists());
}

#[test]
fn holds_text_comes_from_the_file_sizes_before_a_load_and_from_the_texts_after() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    assert!(!holds_text(&store, tab));
    fs::write(column_file(dir.path(), tab, "left"), "").unwrap();
    assert!(!holds_text(&store, tab));
    fs::write(column_file(dir.path(), tab, "right"), "r").unwrap();
    assert!(holds_text(&store, tab));
    store.load_tab(tab).unwrap();
    assert!(holds_text(&store, tab));
    store
        .set_column(tab, Column::Right, String::new(), ColumnVersion(1))
        .unwrap();
    assert!(!holds_text(&store, tab));
    store
        .set_column(tab, Column::Left, "l".to_owned(), ColumnVersion(1))
        .unwrap();
    assert!(holds_text(&store, tab));
}

#[test]
fn holds_text_of_an_unloaded_tab_reads_no_text() {
    let dir = tempfile::tempdir().unwrap();
    let (store, tab) = first_tab(dir.path());
    fs::write(column_file(dir.path(), tab, "left"), b"\xff not utf-8").unwrap();
    assert!(holds_text(&store, tab));
}

#[test]
fn set_column_on_a_tab_never_loaded_keeps_the_other_columns_file_text() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    fs::write(column_file(dir.path(), tab, "left"), "on disk").unwrap();
    let reply = store
        .set_column(tab, Column::Right, "typed".to_owned(), ColumnVersion(1))
        .unwrap();
    let texts = tab_texts(&reply);
    assert_eq!(
        (texts.left.as_str(), texts.right.as_str()),
        ("on disk", "typed")
    );
}

#[test]
fn comparison_is_merge_core_compare_on_the_two_texts() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    let left = "a\nb\nc\nd\n";
    let right = "a\nB\nc\nd\ne\n";
    store
        .set_column(tab, Column::Left, left.to_owned(), ColumnVersion(1))
        .unwrap();
    let loaded = store
        .set_column(tab, Column::Right, right.to_owned(), ColumnVersion(4))
        .unwrap();
    let expected = yamt_merge_core::compare(left, right);
    assert_eq!(expected.len(), 2);
    let comparison = comparison(&loaded);
    assert_eq!(comparison.differences, expected);
    assert_eq!(comparison.versions, versions(1, 4));
    assert_eq!(tab_texts(&loaded).comparison, comparison);
}

#[cfg(unix)]
#[test]
fn a_failed_write_changes_nothing_in_memory() {
    use std::os::unix::fs::PermissionsExt;

    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    store
        .set_column(tab, Column::Left, "kept".to_owned(), ColumnVersion(1))
        .unwrap();
    let read_only = fs::Permissions::from_mode(0o500);
    fs::set_permissions(dir.path(), read_only).unwrap();
    let column = store.set_column(tab, Column::Left, "lost".to_owned(), ColumnVersion(2));
    let renamed = store.rename_tab(tab, "lost");
    let added = store.add_tab();
    fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o700)).unwrap();
    assert!(matches!(column, Err(Error::WriteFailed { .. })));
    assert!(matches!(renamed, Err(Error::WriteFailed { .. })));
    assert!(matches!(added, Err(Error::WriteFailed { .. })));
    let texts = texts(&mut store, tab);
    assert_eq!(texts.left, "kept");
    assert_eq!(texts.comparison.versions, versions(1, 0));
    let list = store.start().list;
    assert_eq!(list.tabs.len(), 1);
    assert_eq!(list.tabs[0].name, "Compare 1");
    let reply = store
        .set_column(tab, Column::Left, "now".to_owned(), ColumnVersion(2))
        .unwrap();
    assert_eq!(tab_texts(&reply).left, "now");
}

#[test]
fn a_failed_rename_removes_its_temporary_file() {
    let dir = tempfile::tempdir().unwrap();
    let (mut store, tab) = first_tab(dir.path());
    store.load_tab(tab).unwrap();
    let left = column_file(dir.path(), tab, "left");
    fs::create_dir(&left).unwrap();
    fs::write(left.join("in the way"), "").unwrap();
    let result = store.set_column(tab, Column::Left, "text".to_owned(), ColumnVersion(1));
    assert!(matches!(result, Err(Error::WriteFailed { path, .. }) if path == left));
    assert!(!dir.path().join(format!("{}-left.txt.tmp", tab.0)).exists());
}
