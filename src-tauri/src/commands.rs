use std::sync::Mutex;

use tauri::{Manager, Runtime, State, WebviewWindow};
use yamt_session::{DiskVersion, FileMergeData, FileSides, MergeSession, Side, WriteReply};

use crate::frontend_log::LogEntry;
use crate::ipc_error::IpcError;
use crate::merge::{self, ContinueReply, Listing, Merge, MergeState, lock};
use crate::{clipboard, compare, servers, settings};

pub(crate) fn specta_builder<R: Runtime>() -> tauri_specta::Builder<R> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
        load_file,
        finish_file,
        save_file,
        reset_file,
        describe_file,
        take_side,
        list_stop,
        continue_operation::<tauri::Wry>,
        abort_operation::<tauri::Wry>,
        log,
        settings::load_settings::<tauri::Wry>,
        settings::set_theme::<tauri::Wry>,
        settings::set_antialiasing::<tauri::Wry>,
        settings::set_keys::<tauri::Wry>,
        settings::move_settings::<tauri::Wry>,
        settings::set_server_answer::<tauri::Wry>,
        settings::set_server_switch::<tauri::Wry>,
        settings::set_added_servers::<tauri::Wry>,
        servers::servers_context,
        servers::start_server,
        servers::send_to_server,
        servers::stop_server,
        servers::find_program,
        servers::project_files,
        compare::open_compare,
        compare::load_tab::<tauri::Wry>,
        compare::set_column::<tauri::Wry>,
        compare::add_tab,
        compare::close_tab,
        compare::rename_tab,
        compare::set_tab_language,
        compare::show_tab,
        clipboard::read_clipboard::<tauri::Wry>,
    ])
}

pub(crate) fn with_session<R: Runtime>(
    builder: tauri::Builder<R>,
    session: Box<MergeSession>,
) -> tauri::Builder<R> {
    servers::manage(builder, session.root())
        .manage(Mutex::new(Merge::Held(session)))
        .invoke_handler(specta_builder().invoke_handler())
        // A reloaded page's channels still take events (tauri 2.12 ipc/channel.rs:409-449 fails a
        // send only when `eval` fails), so its runs would never stop themselves.
        .on_page_load(|webview, page| {
            servers::stop_runs_on_page_start(&webview.state(), page.event());
        })
}

/// The compare window's commands; its `CompareState` is managed once the data folder is known.
pub(crate) fn with_compare<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(specta_builder().invoke_handler())
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn load_file(state: State<'_, MergeState>, path: &str) -> Result<FileMergeData, IpcError> {
    Ok(lock(&state).session()?.load(path)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn finish_file(
    state: State<'_, MergeState>,
    path: &str,
    text: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.finish(path, text, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn save_file(
    state: State<'_, MergeState>,
    path: &str,
    text: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.save(path, text, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn reset_file(
    state: State<'_, MergeState>,
    path: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.reset(path, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn describe_file(state: State<'_, MergeState>, path: &str) -> Result<FileSides, IpcError> {
    Ok(lock(&state).session()?.describe(path)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn take_side(
    state: State<'_, MergeState>,
    path: &str,
    side: Side,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).session()?.take(path, side, disk_version)?)
}

// tauri 2.12 `WebviewWindow::destroy` "does not emit any events": no `CloseRequested`, so the page's
// unsaved-work question does not run; the last window gone ends `run_return`.
fn close_window<R: Runtime>(window: &WebviewWindow<R>, ended: &str) {
    if let Err(error) = window.destroy() {
        tracing::warn!(%error, ended, "git is done but the window stays: closing it ends yamt");
    }
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn list_stop(state: State<'_, MergeState>) -> Result<Listing, IpcError> {
    lock(&state).list_stop()
}

// The merge state comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
async fn continue_operation<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<ContinueReply, IpcError> {
    let reply = merge::continue_operation(&window.state()).await?;
    close_window_if_ended(&window, "finished");
    Ok(reply)
}

#[tauri::command]
#[specta::specta]
async fn abort_operation<R: Runtime>(window: WebviewWindow<R>) -> Result<(), IpcError> {
    merge::abort_operation(&window.state()).await?;
    close_window_if_ended(&window, "aborted");
    Ok(())
}

fn close_window_if_ended<R: Runtime>(window: &WebviewWindow<R>, ended: &str) {
    if lock(&window.state()).has_ended() {
        close_window(window, ended);
    }
}

#[tauri::command]
#[specta::specta]
fn log(entry: LogEntry) {
    entry.emit();
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::{Value, json};
    use yamt_conflict_repo::git_ok;

    use crate::frontend_log::tests::logged;
    use crate::mock_window::{CRLF_PATH, Window, file, open_window, open_window_on};
    use crate::outcome::Exit;

    impl Window {
        fn unmerged(&self) -> String {
            String::from_utf8(git_ok(self.repo.path(), &["ls-files", "-u"]).unwrap()).unwrap()
        }
    }

    fn entries(statuses: [&str; 3]) -> Value {
        let paths = ["added.ts", CRLF_PATH, "view.vue"];
        let entries: Vec<Value> = paths
            .iter()
            .zip(statuses)
            .map(|(path, status)| json!({ "path": path, "status": status, "unsupported": null }))
            .collect();
        Value::Array(entries)
    }

    fn written(statuses: [&str; 3]) -> Value {
        json!({ "kind": "Written", "files": entries(statuses) })
    }

    fn listed(window: &Window) -> Value {
        let listed = window.invoke("list_stop", json!({})).unwrap();
        assert_eq!(listed["kind"], "Files", "{listed}");
        listed
    }

    fn files_and_changes(listed: &Value) -> (Value, Value) {
        (listed["files"].clone(), listed["disk_changes"].clone())
    }

    #[test]
    fn list_stop_returns_every_conflicted_file_as_git_sees_it_and_no_disk_change() {
        let window = open_window();
        let unresolved = "Unresolved";
        assert_eq!(
            files_and_changes(&listed(&window)),
            (entries([unresolved, unresolved, unresolved]), json!([]))
        );
        git_ok(window.repo.path(), &["add", CRLF_PATH]).unwrap();
        assert_eq!(
            files_and_changes(&listed(&window)),
            (entries([unresolved, "Resolved", unresolved]), json!([]))
        );
    }

    #[test]
    fn list_stop_stages_a_file_changed_on_disk_and_finish_from_an_older_view_changes_nothing() {
        let window = open_window();
        fs::write(window.repo.path().join("view.vue"), "<d/>\n").unwrap();
        let staged = json!({ "path": "view.vue", "result": { "kind": "Staged" } });
        let after = entries(["Unresolved", "Unresolved", "Resolved"]);

        let listed = listed(&window);
        let args = json!({ "path": "view.vue", "text": "mine\n", "diskVersion": 0 });
        let finished = window.invoke("finish_file", args);

        assert_eq!(files_and_changes(&listed), (after.clone(), json!([staged])));
        let changed = json!({ "kind": "ChangedOnDisk", "files": after, "change": staged });
        assert_eq!(finished, Ok(changed));
        assert_eq!(
            fs::read(window.repo.path().join("view.vue")).unwrap(),
            b"<d/>\n"
        );
    }

    #[test]
    fn list_stop_names_both_branches_of_the_merge() {
        let window = open_window();
        let names = json!({
            "local": { "kind": "Branch", "name": "local" },
            "remote": { "kind": "Branch", "name": "remote" },
        });
        assert_eq!(listed(&window)["sides"], names);
    }

    #[test]
    fn finish_file_writes_crlf_text_verbatim_and_stages_it_while_others_stay_open() {
        let window = open_window();
        let text = "a\r\nmerged\r\n";
        let args = json!({ "path": CRLF_PATH, "text": text, "diskVersion": 0 });
        let files = window.invoke("finish_file", args);
        assert_eq!(files, Ok(written(["Unresolved", "Resolved", "Unresolved"])));
        assert_eq!(
            fs::read(window.repo.path().join(CRLF_PATH)).unwrap(),
            text.as_bytes()
        );
        assert!(
            !window.unmerged().contains(CRLF_PATH),
            "{}",
            window.unmerged()
        );
        assert_eq!(window.ending().exit, Exit::Unresolved);
    }

    #[test]
    fn finishing_every_file_exits_zero_and_reset_reopens_the_file() {
        let window = open_window();
        let unmerged_before = window.unmerged();
        for path in ["added.ts", CRLF_PATH, "view.vue"] {
            window
                .invoke(
                    "finish_file",
                    json!({ "path": path, "text": "done\n", "diskVersion": 0 }),
                )
                .unwrap();
        }
        assert_eq!(window.unmerged(), "");
        assert_eq!(window.ending().exit, Exit::Success);

        let files = window.invoke("reset_file", json!({ "path": CRLF_PATH, "diskVersion": 0 }));

        assert_eq!(files, Ok(written(["Resolved", "Unresolved", "Resolved"])));
        let crlf_stages: Vec<&str> = unmerged_before
            .lines()
            .filter(|line| line.ends_with(CRLF_PATH))
            .collect();
        assert_eq!(window.unmerged().lines().collect::<Vec<_>>(), crlf_stages);
        let worktree = fs::read_to_string(window.repo.path().join(CRLF_PATH)).unwrap();
        assert!(worktree.contains("<<<<<<<"), "{worktree}");
        assert_eq!(window.ending().exit, Exit::Unresolved);
    }

    #[test]
    fn save_file_writes_the_text_and_leaves_the_file_listed_conflicted() {
        let window = open_window();
        let unmerged_before = window.unmerged();
        let text = "a\r\nsaved\r\n";
        let args = json!({ "path": CRLF_PATH, "text": text, "diskVersion": 0 });

        let saved = window.invoke("save_file", args);

        let unresolved = ["Unresolved", "Unresolved", "Unresolved"];
        assert_eq!(saved, Ok(written(unresolved)));
        assert_eq!(
            fs::read(window.repo.path().join(CRLF_PATH)).unwrap(),
            text.as_bytes()
        );
        assert_eq!(window.unmerged(), unmerged_before);
        assert_eq!(
            files_and_changes(&listed(&window)),
            (entries(unresolved), json!([]))
        );
    }

    #[test]
    fn describe_file_tells_both_sides_and_take_side_remote_resolves_the_binary_file() {
        const LOGO: &str = "logo.bin";
        let window = open_window_on(&[file(LOGO, Some(b"\0base"), b"\0local", b"\0remote")]);
        let path = json!({ "path": LOGO });
        let local = json!({ "kind": "Binary", "bytes": 6 });
        let remote = json!({ "kind": "Binary", "bytes": 7 });
        let sides = json!({
            "path": LOGO, "reason": "Binary", "local": local, "remote": remote, "disk_version": 0
        });
        assert_eq!(window.invoke("describe_file", path), Ok(sides));

        let args = json!({ "path": LOGO, "side": "remote", "diskVersion": 0 });
        let files = window.invoke("take_side", args);

        let resolved = json!({ "path": LOGO, "status": "Resolved", "unsupported": "Binary" });
        assert_eq!(files, Ok(json!({ "kind": "Written", "files": [resolved] })));
        assert_eq!(
            fs::read(window.repo.path().join(LOGO)).unwrap(),
            b"\0remote"
        );
        assert_eq!(window.unmerged(), "");
    }

    #[test]
    fn unknown_path_reaches_the_frontend_as_a_tagged_error() {
        let window = open_window();
        assert_eq!(
            window.invoke("load_file", json!({ "path": "missing.ts" })),
            Err(json!({ "kind": "UnknownPath", "path": "missing.ts" }))
        );
    }

    #[test]
    fn log_emits_a_frontend_entry_to_tracing_and_rejects_an_unknown_level() {
        let window = open_window();
        let fields = json!({ "lines": 3, "ok": true, "name": "a" });
        let entry = json!({ "level": "warn", "event": "scroll.drift", "fields": fields });
        let (response, logged) = logged(|| window.invoke("log", json!({ "entry": entry })));
        assert_eq!(response, Ok(Value::Null));
        assert_eq!(
            logged.trim_end(),
            r#" WARN frontend: event="scroll.drift" fields=lines=3 name="a" ok=true"#
        );
        let bad = json!({ "level": "loud", "event": "scroll.drift", "fields": {} });
        let rejected = window.invoke("log", json!({ "entry": bad })).unwrap_err();
        assert!(
            rejected
                .as_str()
                .unwrap()
                .contains("unknown variant `loud`"),
            "{rejected}"
        );
    }
}
