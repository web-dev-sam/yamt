use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{Runtime, State};
use yamt_session::{
    DiskVersion, FileList, FileMergeData, FileSides, MergeSession, RemoteName, Side, WriteReply,
};

use crate::frontend_log::LogEntry;
use crate::ipc_error::IpcError;
use crate::settings;

pub(crate) type SessionState = Mutex<MergeSession>;

pub(crate) fn specta_builder<R: Runtime>() -> tauri_specta::Builder<R> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
        list_files,
        load_file,
        finish_file,
        reset_file,
        describe_file,
        take_side,
        remote_name,
        log,
        settings::load_settings::<tauri::Wry>,
        settings::set_theme::<tauri::Wry>,
        settings::set_keys::<tauri::Wry>,
        settings::move_settings::<tauri::Wry>,
    ])
}

pub(crate) fn with_session<R: Runtime>(
    builder: tauri::Builder<R>,
    session: MergeSession,
) -> tauri::Builder<R> {
    builder
        .manage(Mutex::new(session))
        .invoke_handler(specta_builder().invoke_handler())
}

pub(crate) fn lock(state: &SessionState) -> MutexGuard<'_, MergeSession> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn list_files(state: State<'_, SessionState>) -> Result<FileList, IpcError> {
    Ok(lock(&state).refresh()?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn remote_name(state: State<'_, SessionState>) -> Option<RemoteName> {
    lock(&state).remote_name()
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn load_file(state: State<'_, SessionState>, path: &str) -> Result<FileMergeData, IpcError> {
    Ok(lock(&state).load(path)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn finish_file(
    state: State<'_, SessionState>,
    path: &str,
    text: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).finish(path, text, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn reset_file(
    state: State<'_, SessionState>,
    path: &str,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).reset(path, disk_version)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn describe_file(state: State<'_, SessionState>, path: &str) -> Result<FileSides, IpcError> {
    Ok(lock(&state).describe(path)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn take_side(
    state: State<'_, SessionState>,
    path: &str,
    side: Side,
    disk_version: DiskVersion,
) -> Result<WriteReply, IpcError> {
    Ok(lock(&state).take(path, side, disk_version)?)
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
    use tauri::ipc::{CallbackFn, InvokeBody};
    use tauri::test::{
        INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder, mock_context, noop_assets,
    };
    use tauri::webview::InvokeRequest;
    use tauri::{App, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
    use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo, git_ok};

    use super::*;
    use crate::frontend_log::tests::logged;
    use crate::outcome::{Exit, ending_on_close};

    const CRLF_PATH: &str = "crlf.ts";

    struct Window {
        repo: TempDir,
        app: App<MockRuntime>,
        webview: WebviewWindow<MockRuntime>,
    }

    fn file<'a>(
        path: &'a str,
        base: Option<&'a [u8]>,
        local: &'a [u8],
        remote: &'a [u8],
    ) -> ConflictFile<'a> {
        ConflictFile {
            path,
            kind: FileKind::Regular,
            base,
            local: Some(local),
            remote: Some(remote),
        }
    }

    fn open_window() -> Window {
        open_window_on(&[
            file("added.ts", None, b"local\n", b"remote\n"),
            file(
                CRLF_PATH,
                Some(b"a\r\nb\r\n"),
                b"a\r\nlocal\r\n",
                b"a\r\nremote\r\n",
            ),
            file("view.vue", Some(b"<a/>\n"), b"<b/>\n", b"<c/>\n"),
        ])
    }

    fn open_window_on(files: &[ConflictFile]) -> Window {
        let repo = conflict_repo(files).unwrap();
        let session = MergeSession::open(repo.path()).unwrap();
        let app = with_session(mock_builder(), session)
            .build(mock_context(noop_assets()))
            .unwrap();
        let webview = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
            .build()
            .unwrap();
        Window { repo, app, webview }
    }

    impl Window {
        fn invoke(&self, cmd: &str, args: Value) -> Result<Value, Value> {
            let request = InvokeRequest {
                cmd: cmd.to_owned(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: InvokeBody::Json(args),
                headers: tauri::http::HeaderMap::default(),
                invoke_key: INVOKE_KEY.to_owned(),
            };
            get_ipc_response(&self.webview, request).map(|body| body.deserialize().unwrap())
        }

        fn exit_on_close(&self) -> Exit {
            ending_on_close(&mut lock(&self.app.state::<SessionState>())).exit
        }

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

    #[test]
    fn list_files_returns_every_conflicted_file_as_git_sees_it_and_no_disk_change() {
        let window = open_window();
        let unresolved = "Unresolved";
        let listed = |statuses| json!({ "files": entries(statuses), "disk_changes": [] });
        assert_eq!(
            window.invoke("list_files", json!({})),
            Ok(listed([unresolved, unresolved, unresolved]))
        );
        git_ok(window.repo.path(), &["add", CRLF_PATH]).unwrap();
        assert_eq!(
            window.invoke("list_files", json!({})),
            Ok(listed([unresolved, "Resolved", unresolved]))
        );
    }

    #[test]
    fn list_files_stages_a_file_changed_on_disk_and_finish_from_an_older_view_changes_nothing() {
        let window = open_window();
        fs::write(window.repo.path().join("view.vue"), "<d/>\n").unwrap();
        let staged = json!({ "path": "view.vue", "result": { "kind": "Staged" } });
        let after = entries(["Unresolved", "Unresolved", "Resolved"]);

        let listed = window.invoke("list_files", json!({}));
        let args = json!({ "path": "view.vue", "text": "mine\n", "diskVersion": 0 });
        let finished = window.invoke("finish_file", args);

        assert_eq!(
            listed,
            Ok(json!({ "files": after, "disk_changes": [staged] }))
        );
        let changed = json!({ "kind": "ChangedOnDisk", "files": after, "change": staged });
        assert_eq!(finished, Ok(changed));
        assert_eq!(
            fs::read(window.repo.path().join("view.vue")).unwrap(),
            b"<d/>\n"
        );
    }

    #[test]
    fn remote_name_names_the_merged_branch() {
        let window = open_window();
        let branch = json!({ "kind": "Branch", "name": "remote" });
        assert_eq!(window.invoke("remote_name", json!({})), Ok(branch));
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
        assert_eq!(window.exit_on_close(), Exit::Unresolved);
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
        assert_eq!(window.exit_on_close(), Exit::Success);

        let files = window.invoke("reset_file", json!({ "path": CRLF_PATH, "diskVersion": 0 }));

        assert_eq!(files, Ok(written(["Resolved", "Unresolved", "Resolved"])));
        let crlf_stages: Vec<&str> = unmerged_before
            .lines()
            .filter(|line| line.ends_with(CRLF_PATH))
            .collect();
        assert_eq!(window.unmerged().lines().collect::<Vec<_>>(), crlf_stages);
        let worktree = fs::read_to_string(window.repo.path().join(CRLF_PATH)).unwrap();
        assert!(worktree.contains("<<<<<<<"), "{worktree}");
        assert_eq!(window.exit_on_close(), Exit::Unresolved);
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
