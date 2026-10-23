use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{App, Manager, Runtime, State, WebviewWindow};
use yamt_compare::{
    Column, ColumnVersion, CompareStart, Comparison, LoadedTab, TabId, TabLanguage, TabList,
    TabStore, TabTexts, comparison, tab_texts,
};

use crate::ipc_error::IpcError;

const APP_FOLDER: &str = "yamt";
const COMPARE_FOLDER: &str = "compare";

/// The stored compare tabs (plan §2 #97); never locked together with another `Mutex`.
pub(crate) type CompareState = Mutex<TabStore>;

fn lock(state: &CompareState) -> MutexGuard<'_, TabStore> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Opens the store in `<data_dir>/yamt/compare/` and hands it to the app as its `CompareState`,
/// or answers the line `yamt --diff` ends with.
pub(crate) fn manage_store_in<R: Runtime>(app: &App<R>, data_dir: &Path) -> Result<(), String> {
    let store = TabStore::open(&compare_folder(data_dir)).map_err(|error| start_failure(&error))?;
    app.manage(Mutex::new(store));
    Ok(())
}

fn compare_folder(data_dir: &Path) -> PathBuf {
    data_dir.join(APP_FOLDER).join(COMPARE_FOLDER)
}

fn start_failure(error: &yamt_compare::Error) -> String {
    match error {
        yamt_compare::Error::ReadFailed { path, message } => format!(
            "the stored compare tabs {} cannot be read: {message}; nothing was changed",
            path.display()
        ),
        yamt_compare::Error::Locked { .. }
        | yamt_compare::Error::Broken { .. }
        | yamt_compare::Error::NewerFormat { .. }
        | yamt_compare::Error::WriteFailed { .. }
        | yamt_compare::Error::UnknownTab { .. }
        | yamt_compare::Error::TooLarge { .. } => error.to_string(),
    }
}

/// Runs `work` under the store's lock on a blocking worker, then builds the reply from the
/// returned tab after the lock is released (plan §2 #95, #97).
async fn on_worker<R, T>(
    window: WebviewWindow<R>,
    work: impl FnOnce(&mut TabStore) -> yamt_compare::Result<LoadedTab> + Send + 'static,
    reply: fn(&LoadedTab) -> T,
) -> Result<T, IpcError>
where
    R: Runtime,
    T: Send + 'static,
{
    let worker = tauri::async_runtime::spawn_blocking(move || {
        let loaded = with_store(&window, work)?;
        Ok(reply(&loaded))
    });
    worker.await.unwrap_or_else(|error| {
        tracing::error!(%error, "yamt's compare worker stopped");
        Err(IpcError::WorkerStopped)
    })
}

fn with_store<R: Runtime>(
    window: &WebviewWindow<R>,
    work: impl FnOnce(&mut TabStore) -> yamt_compare::Result<LoadedTab>,
) -> yamt_compare::Result<LoadedTab> {
    work(&mut lock(&window.state()))
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
#[expect(
    clippy::unnecessary_wraps,
    reason = "every command answers a Result the window checks"
)]
pub(crate) fn open_compare(state: State<'_, CompareState>) -> Result<CompareStart, IpcError> {
    Ok(lock(&state).start())
}

// The store comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
pub(crate) async fn load_tab<R: Runtime>(
    window: WebviewWindow<R>,
    tab: TabId,
) -> Result<TabTexts, IpcError> {
    on_worker(window, move |store| store.load_tab(tab), tab_texts).await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn set_column<R: Runtime>(
    window: WebviewWindow<R>,
    tab: TabId,
    column: Column,
    text: String,
    version: ColumnVersion,
) -> Result<Comparison, IpcError> {
    let work = move |store: &mut TabStore| store.set_column(tab, column, text, version);
    on_worker(window, work, comparison).await
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn add_tab(state: State<'_, CompareState>) -> Result<TabList, IpcError> {
    Ok(lock(&state).add_tab()?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn close_tab(state: State<'_, CompareState>, tab: TabId) -> Result<TabList, IpcError> {
    Ok(lock(&state).close_tab(tab)?)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn rename_tab(
    state: State<'_, CompareState>,
    tab: TabId,
    name: String,
) -> Result<TabList, IpcError> {
    Ok(lock(&state).rename_tab(tab, &name)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn set_tab_language(
    state: State<'_, CompareState>,
    tab: TabId,
    language: TabLanguage,
) -> Result<TabList, IpcError> {
    Ok(lock(&state).set_language(tab, language)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn show_tab(state: State<'_, CompareState>, tab: TabId) -> Result<TabList, IpcError> {
    Ok(lock(&state).show_tab(tab)?)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::{Value, json};
    use yamt_compare::MAX_COLUMN_BYTES;
    use yamt_conflict_repo::TempDir;

    use super::*;
    use crate::mock_window::{compare_app, open_compare_window};

    fn tab(id: u32, name: &str, language: &Value, holds_text: bool) -> Value {
        json!({ "id": id, "name": name, "language": language, "holds_text": holds_text })
    }

    fn auto() -> Value {
        json!({ "kind": "auto" })
    }

    #[test]
    fn a_fresh_store_lists_one_tab_and_every_tab_command_answers_the_list() {
        let window = open_compare_window();
        let first = tab(1, "Compare 1", &auto(), false);
        assert_eq!(
            window.invoke("open_compare", json!({})),
            Ok(
                json!({ "list": { "tabs": [first], "shown": 1 }, "column_limit": MAX_COLUMN_BYTES })
            )
        );
        let second = tab(2, "Compare 2", &auto(), false);
        assert_eq!(
            window.invoke("add_tab", json!({})),
            Ok(json!({ "tabs": [first, second], "shown": 2 }))
        );
        let mine = tab(2, "Mine", &auto(), false);
        assert_eq!(
            window.invoke("rename_tab", json!({ "tab": 2, "name": " Mine " })),
            Ok(json!({ "tabs": [first, mine], "shown": 2 }))
        );
        let json_language = json!({ "kind": "picked", "name": "json" });
        let picked = tab(2, "Mine", &json_language, false);
        let language = json!({ "tab": 2, "language": json_language });
        assert_eq!(
            window.invoke("set_tab_language", language),
            Ok(json!({ "tabs": [first, picked], "shown": 2 }))
        );
        assert_eq!(
            window.invoke("show_tab", json!({ "tab": 1 })),
            Ok(json!({ "tabs": [first, picked], "shown": 1 }))
        );
        assert_eq!(
            window.invoke("close_tab", json!({ "tab": 2 })),
            Ok(json!({ "tabs": [first], "shown": 1 }))
        );
    }

    #[test]
    fn a_fresh_tab_loads_two_empty_texts_without_differences() {
        let window = open_compare_window();
        let versions = json!({ "left": 0, "right": 0 });
        assert_eq!(
            window.invoke("load_tab", json!({ "tab": 1 })),
            Ok(json!({
                "left": "",
                "right": "",
                "comparison": { "versions": versions, "differences": [] },
            }))
        );
    }

    #[test]
    fn set_column_stores_the_text_and_load_tab_gives_it_with_the_differences() {
        let window = open_compare_window();
        let left = json!({ "tab": 1, "column": "left", "text": "a\nb\n", "version": 1 });
        window.invoke("set_column", left).unwrap();
        let right = json!({ "tab": 1, "column": "right", "text": "a\nc\n", "version": 1 });

        let compared = window.invoke("set_column", right).unwrap();

        let differences = json!([{
            "left": { "start": 1, "len": 1 },
            "right": { "start": 1, "len": 1 },
            "words": {
                "left": { "changed": [{ "line": 1, "start": 0, "len": 1 }], "removals": [] },
                "right": { "changed": [{ "line": 1, "start": 0, "len": 1 }], "removals": [] },
            },
        }]);
        let comparison =
            json!({ "versions": { "left": 1, "right": 1 }, "differences": differences });
        assert_eq!(compared, comparison);
        assert_eq!(
            window.invoke("load_tab", json!({ "tab": 1 })),
            Ok(json!({ "left": "a\nb\n", "right": "a\nc\n", "comparison": comparison }))
        );
        let stored = window.data.path().join("yamt/compare/1-right.txt");
        assert_eq!(fs::read_to_string(stored).unwrap(), "a\nc\n");
    }

    #[test]
    fn an_unknown_tab_and_a_too_large_column_reach_the_window_as_their_kinds() {
        let window = open_compare_window();
        assert_eq!(
            window.invoke("load_tab", json!({ "tab": 99 })),
            Err(json!({ "kind": "UnknownTab", "tab": 99 }))
        );
        assert_eq!(
            window.invoke("close_tab", json!({ "tab": 99 })),
            Err(json!({ "kind": "UnknownTab", "tab": 99 }))
        );
        let too_large = "x".repeat(MAX_COLUMN_BYTES as usize + 1);
        let args = json!({ "tab": 1, "column": "left", "text": too_large, "version": 1 });
        assert_eq!(
            window.invoke("set_column", args),
            Err(json!({ "kind": "ColumnTooLarge", "limit": MAX_COLUMN_BYTES }))
        );
    }

    #[test]
    fn a_worker_that_panics_answers_worker_stopped_and_the_store_still_answers() {
        let window = open_compare_window();
        let panicking =
            |_: &mut TabStore| -> yamt_compare::Result<LoadedTab> { panic!("worker panic") };

        let answered =
            tauri::async_runtime::block_on(on_worker(window.webview.clone(), panicking, tab_texts))
                .err();

        assert!(
            matches!(answered, Some(IpcError::WorkerStopped)),
            "{answered:?}"
        );
        assert!(window.invoke("load_tab", json!({ "tab": 1 })).is_ok());
    }

    fn store_opened_in(data_dir: &Path) -> Result<(), String> {
        manage_store_in(&compare_app(), data_dir)
    }

    fn tabs_file(data: &TempDir, text: &str) -> PathBuf {
        let folder = compare_folder(data.path());
        fs::create_dir_all(&folder).unwrap();
        let path = folder.join("tabs.json");
        fs::write(&path, text).unwrap();
        path
    }

    #[test]
    fn a_second_open_of_the_same_data_folder_says_another_window_is_open() {
        let held = open_compare_window();
        let folder = compare_folder(held.data.path());
        assert_eq!(
            store_opened_in(held.data.path()).unwrap_err(),
            format!("another yamt --diff window is open ({})", folder.display())
        );
    }

    #[test]
    fn a_broken_tabs_file_says_where_and_that_nothing_was_changed() {
        let data = TempDir::new().unwrap();
        let path = tabs_file(&data, r#"{"format":1,"shown":1,"nextId":2,"tabs":[]}"#);
        assert_eq!(
            store_opened_in(data.path()).unwrap_err(),
            format!(
                "the stored compare tabs {} cannot be read: `tabs` is empty; nothing was changed",
                path.display()
            )
        );
    }

    #[test]
    fn a_newer_tabs_file_names_its_format() {
        let data = TempDir::new().unwrap();
        let path = tabs_file(&data, r#"{"format":2}"#);
        assert_eq!(
            store_opened_in(data.path()).unwrap_err(),
            format!(
                "the stored compare tabs {} were written by a newer yamt (format 2)",
                path.display()
            )
        );
    }

    #[test]
    fn a_read_failure_says_the_tabs_cannot_be_read() {
        let error = yamt_compare::Error::ReadFailed {
            path: "/d/1-left.txt".into(),
            message: "not UTF-8".to_owned(),
        };
        assert_eq!(
            start_failure(&error),
            "the stored compare tabs /d/1-left.txt cannot be read: not UTF-8; nothing was changed"
        );
    }
}
