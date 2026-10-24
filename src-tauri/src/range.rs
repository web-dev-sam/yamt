use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{App, Manager, Runtime, State, WebviewWindow};
use yamt_range::{PairLock, Range, RangeFile, RangeFileId, RangeSpec, RangeStart, Resolved};
use yamt_review::ThreadStore;

use crate::ipc_error::{IpcError, blocking_reply};
use crate::outcome::Ending;
use crate::window::{WindowKind, open_with_data_folder, window_title};

const RANGE_FOLDER: &str = "range";

/// The range the window shows, its review threads and the lock on its commit pair, held for the run
/// (plan §2 #104, #107, #117): a send holds `sending` throughout and locks `threads` only between glab calls.
pub(crate) struct RangeState {
    pub(crate) range: Range,
    pub(crate) threads: Mutex<ThreadStore>,
    pub(crate) sending: Mutex<()>,
    _lock: PairLock,
}

/// `yamt --diff=<range>`: every refusal before the window is one line and exit 2; a closed window is exit 0.
pub(crate) fn run_range(repo: &Path, spec: &RangeSpec) -> Ending {
    let resolved = match Resolved::resolve(repo, spec) {
        Ok(resolved) => resolved,
        Err(error) => return Ending::failure(error.to_string()),
    };
    let title = range_title(spec, resolved.root());
    let manage = |app: &App, app_folder: &Path| manage_range_in(app, app_folder, resolved);
    match open_with_data_folder(&title, WindowKind::Range, manage) {
        Ok(ending) => ending,
        Err(error) => Ending::failure(error.to_string()),
    }
}

/// Takes the pair's lock in `<app_folder>/range/` before listing and reading the pair's threads, then
/// hands the range to the app.
fn manage_range_in<R: Runtime>(
    app: &App<R>,
    app_folder: &Path,
    resolved: Resolved,
) -> Result<(), String> {
    let lock =
        PairLock::take(&range_folder(app_folder), &resolved).map_err(|error| error.to_string())?;
    let range = resolved.list().map_err(|error| error.to_string())?;
    let threads = ThreadStore::open(lock.folder()).map_err(|error| error.to_string())?;
    let unlisted = threads.unlisted_paths(&range);
    if !unlisted.is_empty() {
        tracing::warn!(paths = ?unlisted, "review threads kept on paths this range does not list");
    }
    app.manage(RangeState {
        range,
        threads: Mutex::new(threads),
        sending: Mutex::new(()),
        _lock: lock,
    });
    Ok(())
}

fn range_folder(app_folder: &Path) -> PathBuf {
    app_folder.join(RANGE_FOLDER)
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
    blocking_reply(move || Ok(window.state::<RangeState>().range.load(file)?)).await
}

#[cfg(test)]
pub(crate) mod tests {
    use serde_json::json;
    use tauri::test::{MockRuntime, mock_builder, mock_context, noop_assets};
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo};

    use super::*;
    use crate::commands::with_commands;
    use crate::frontend_log::tests::logged;
    use crate::mock_window::invoke_on;
    use crate::outcome::Exit;
    use crate::window::app_folder;

    const RANGE: &str = "main...remote";
    const THREADS_FILE: &str = "threads.json";
    const GONE_THREAD: &str = r#"{"format":1,"nextThread":2,"nextMessage":2,"threads":[{"id":1,"path":"gone.txt","line":{"kind":"added","right":0},"session":null,"messages":[{"id":1,"body":{"kind":"note","text":"Why?"},"written":0,"posting":{"kind":"notQueued"}}]}]}"#;

    pub(crate) struct RangeWindow {
        pub(crate) repo: TempDir,
        pub(crate) data: TempDir,
        pub(crate) webview: WebviewWindow<MockRuntime>,
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
        with_commands(mock_builder())
            .build(mock_context(noop_assets()))
            .unwrap()
    }

    /// A window on `main...remote` of a repository whose one file `a.txt` changes from "one" to "two".
    pub(crate) fn open_range_window() -> RangeWindow {
        open_range_window_in(repo(), TempDir::new().unwrap())
    }

    fn open_range_window_in(repo: TempDir, data: TempDir) -> RangeWindow {
        let app = range_app();
        manage_range_in(&app, &app_folder(data.path()), resolved(repo.path())).unwrap();
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

    /// The threads file the window will read; the pair's lock is let go again.
    fn threads_path(repo: &Path, data: &Path) -> PathBuf {
        let lock = PairLock::take(&range_folder(&app_folder(data)), &resolved(repo)).unwrap();
        lock.folder().join(THREADS_FILE)
    }

    // Opening on a file it cannot read would show no threads, and the next add would write over them.
    #[test]
    fn a_broken_threads_file_ends_before_any_window_with_exit_2() {
        let (repo, data) = (repo(), TempDir::new().unwrap());
        let threads = threads_path(repo.path(), data.path());
        let broken = b"{\"format\":1,";
        std::fs::write(&threads, broken).unwrap();
        let app = range_app();

        let refused = manage_range_in(&app, &app_folder(data.path()), resolved(repo.path()));

        let line = refused.unwrap_err();
        let named = format!("the review threads {} cannot be read: ", threads.display());
        assert!(line.starts_with(&named), "{line}");
        assert_eq!(Ending::failure(line).exit, Exit::Failure);
        assert!(app.try_state::<RangeState>().is_none());
        assert_eq!(std::fs::read(&threads).unwrap(), broken);
    }

    // A thread on a file this range does not list must survive, and its absence must be traceable.
    #[test]
    fn threads_on_a_path_the_range_does_not_list_are_kept_and_logged_once() {
        let (repo, data) = (repo(), TempDir::new().unwrap());
        let threads = threads_path(repo.path(), data.path());
        std::fs::write(&threads, GONE_THREAD).unwrap();

        let (window, log) = logged(|| open_range_window_in(repo, data));

        let warnings: Vec<&str> = log.lines().filter(|line| line.contains("WARN")).collect();
        assert_eq!(warnings.len(), 1, "{log}");
        assert!(warnings[0].contains(r#"paths=["gone.txt"]"#), "{log}");
        let listed = invoke_on(&window.webview, "list_threads", json!({}));
        assert_eq!(listed, Ok(json!({ "threads": [] })));
        assert_eq!(std::fs::read_to_string(&threads).unwrap(), GONE_THREAD);
    }

    #[test]
    fn a_range_whose_threads_are_all_listed_logs_no_warning() {
        let (_window, log) = logged(open_range_window);
        assert!(!log.contains("WARN"), "{log}");
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
    fn the_pair_lock_lives_under_the_data_folder_s_yamt_range() {
        let window = open_range_window();
        let range_dir = window.data.path().join("yamt").join("range");
        let repo_dir = only_entry(&range_dir);
        let pair_dir = only_entry(&repo_dir);
        assert!(pair_dir.join("lock").is_file(), "{}", pair_dir.display());
    }

    fn only_entry(dir: &Path) -> PathBuf {
        let entries: Vec<PathBuf> = std::fs::read_dir(dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .collect();
        assert_eq!(entries.len(), 1, "{entries:?}");
        entries[0].clone()
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
            &app_folder(window.data.path()),
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
