use std::path::{Path, PathBuf};

use tauri::{App, Manager, Runtime, State, WebviewWindow};
use yamt_range::{PairLock, Range, RangeFile, RangeFileId, RangeSpec, RangeStart, Resolved};

use crate::commands::with_range;
use crate::ipc_error::IpcError;
use crate::outcome::{Ending, Exit};
use crate::window::{WindowKind, context, open_and_wait, window_title};

const APP_FOLDER: &str = "yamt";
const RANGE_FOLDER: &str = "range";

/// The range the window shows and the lock on its commit pair, both held for the run (plan §2 #104, #107).
pub(crate) struct RangeState {
    range: Range,
    _lock: PairLock,
}

/// `yamt --diff=<range>`: every refusal before the window is one line and exit 2; a closed window is exit 0.
pub(crate) fn run_range(repo: &Path, spec: &RangeSpec) -> Ending {
    let resolved = match Resolved::resolve(repo, spec) {
        Ok(resolved) => resolved,
        Err(error) => return Ending::failure(error.to_string()),
    };
    let title = range_title(spec, resolved.root());
    match open_window(resolved, &title) {
        Ok(ending) => ending,
        Err(error) => Ending::failure(error.to_string()),
    }
}

fn open_window(resolved: Resolved, title: &str) -> tauri::Result<Ending> {
    let app = with_range(tauri::Builder::default()).build(context())?;
    let managed = app
        .path()
        .data_dir()
        .map_err(|error| format!("no data folder: {error}"))
        .and_then(|data_dir| manage_range_in(&app, &data_dir, resolved));
    if let Err(problem) = managed {
        return Ok(Ending::failure(problem));
    }
    open_and_wait(app, title, WindowKind::Range)?;
    Ok(Ending {
        exit: Exit::Success,
        message: None,
    })
}

/// Takes the pair's lock in `<data_dir>/yamt/range/` before listing, then hands the range to the app.
fn manage_range_in<R: Runtime>(
    app: &App<R>,
    data_dir: &Path,
    resolved: Resolved,
) -> Result<(), String> {
    let lock =
        PairLock::take(&range_folder(data_dir), &resolved).map_err(|error| error.to_string())?;
    let range = resolved.list().map_err(|error| error.to_string())?;
    app.manage(RangeState { range, _lock: lock });
    Ok(())
}

fn range_folder(data_dir: &Path) -> PathBuf {
    data_dir.join(APP_FOLDER).join(RANGE_FOLDER)
}

fn range_title(spec: &RangeSpec, root: &Path) -> String {
    format!("{} — {}", spec.text(), window_title(root))
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn open_range(state: State<'_, RangeState>) -> RangeStart {
    state.range.start()
}

// The range comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
pub(crate) async fn load_range_file<R: Runtime>(
    window: WebviewWindow<R>,
    file: RangeFileId,
) -> Result<RangeFile, IpcError> {
    let worker = tauri::async_runtime::spawn_blocking(move || {
        Ok(window.state::<RangeState>().range.load(file)?)
    });
    worker.await.unwrap_or_else(|error| {
        tracing::error!(%error, "yamt's range worker stopped");
        Err(IpcError::WorkerStopped)
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use tauri::test::{MockRuntime, mock_builder, mock_context, noop_assets};
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo};

    use super::*;
    use crate::mock_window::invoke_on;

    const RANGE: &str = "main...remote";

    struct RangeWindow {
        repo: TempDir,
        data: TempDir,
        webview: WebviewWindow<MockRuntime>,
        _app: App<MockRuntime>,
    }

    fn repo() -> TempDir {
        let file = ConflictFile {
            path: "a.txt",
            kind: FileKind::Regular,
            base: Some(b"one\n"),
            local: Some(b"one\n"),
            remote: Some(b"two\n"),
        };
        diverged_repo(&[file]).unwrap()
    }

    fn resolved(root: &Path) -> Resolved {
        Resolved::resolve(root, &RangeSpec::parse(RANGE).unwrap()).unwrap()
    }

    fn range_app() -> App<MockRuntime> {
        with_range(mock_builder())
            .build(mock_context(noop_assets()))
            .unwrap()
    }

    fn open_range_window() -> RangeWindow {
        let repo = repo();
        let data = TempDir::new().unwrap();
        let app = range_app();
        manage_range_in(&app, data.path(), resolved(repo.path())).unwrap();
        let webview = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
            .build()
            .unwrap();
        RangeWindow {
            repo,
            data,
            webview,
            _app: app,
        }
    }

    #[test]
    fn open_range_answers_the_range_s_start() {
        let window = open_range_window();
        let start = resolved(window.repo.path()).list().unwrap().start();
        assert_eq!(
            invoke_on(&window.webview, "open_range", json!({})),
            Ok(serde_json::to_value(start).unwrap())
        );
    }

    #[test]
    fn a_listed_file_loads_and_an_unknown_id_answers_unknown_range_file() {
        let window = open_range_window();
        let loaded = invoke_on(&window.webview, "load_range_file", json!({ "file": 0 })).unwrap();
        assert_eq!(loaded["kind"], "texts");
        assert_eq!(loaded["right"], "two\n");
        assert_eq!(
            invoke_on(&window.webview, "load_range_file", json!({ "file": 7 })),
            Err(json!({ "kind": "UnknownRangeFile", "file": 7 }))
        );
    }

    #[test]
    fn a_second_window_on_the_same_pair_is_refused_naming_both_short_ids() {
        let window = open_range_window();
        let refused = manage_range_in(
            &range_app(),
            window.data.path(),
            resolved(window.repo.path()),
        );
        let start = resolved(window.repo.path()).list().unwrap().start();
        assert_eq!(
            refused,
            Err(format!(
                "another yamt window shows {}..{} of {}",
                start.left.short_id,
                start.right.short_id,
                resolved(window.repo.path()).root().display()
            ))
        );
    }

    #[test]
    fn the_title_is_the_range_as_typed_then_the_repository_folder() {
        let spec = RangeSpec::parse("main...feature").unwrap();
        assert_eq!(
            range_title(&spec, Path::new("/home/me/proj")),
            "main...feature — proj — yamt"
        );
    }
}
