use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{Runtime, State};
use yamt_session::{FileEntry, FileMergeData, FileSides, MergeSession, Side, UnsupportedReason};

use crate::frontend_log::LogEntry;

pub(crate) type SessionState = Mutex<MergeSession>;

#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum IpcError {
    Git {
        message: String,
    },
    UnknownPath {
        path: String,
    },
    Unsupported {
        path: String,
        reason: UnsupportedReason,
    },
    WriteFailed {
        path: String,
        message: String,
    },
}

impl From<yamt_session::Error> for IpcError {
    fn from(error: yamt_session::Error) -> IpcError {
        match error {
            yamt_session::Error::Git(source) => IpcError::Git {
                message: source.to_string(),
            },
            yamt_session::Error::UnknownPath { path } => IpcError::UnknownPath { path },
            yamt_session::Error::Unsupported { path, reason } => {
                IpcError::Unsupported { path, reason }
            }
            yamt_session::Error::WriteFailed { path, source } => IpcError::WriteFailed {
                path,
                message: source.to_string(),
            },
        }
    }
}

pub(crate) fn specta_builder<R: Runtime>() -> tauri_specta::Builder<R> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
        list_files,
        load_file,
        finish_file,
        reset_file,
        describe_file,
        take_side,
        log,
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
fn list_files(state: State<'_, SessionState>) -> Vec<FileEntry> {
    lock(&state).files()
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
) -> Result<Vec<FileEntry>, IpcError> {
    let mut session = lock(&state);
    session.finish(path, text)?;
    Ok(session.files())
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
fn reset_file(state: State<'_, SessionState>, path: &str) -> Result<Vec<FileEntry>, IpcError> {
    let mut session = lock(&state);
    session.reset(path)?;
    Ok(session.files())
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
) -> Result<Vec<FileEntry>, IpcError> {
    let mut session = lock(&state);
    session.take(path, side)?;
    Ok(session.files())
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
            ending_on_close(&lock(&self.app.state::<SessionState>())).exit
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

    #[test]
    fn list_files_returns_every_conflicted_file() {
        let window = open_window();
        let unresolved = "Unresolved";
        assert_eq!(
            window.invoke("list_files", json!({})),
            Ok(entries([unresolved, unresolved, unresolved]))
        );
    }

    #[test]
    fn finish_file_writes_crlf_text_verbatim_and_stages_it_while_others_stay_open() {
        let window = open_window();
        let text = "a\r\nmerged\r\n";
        let files = window.invoke("finish_file", json!({ "path": CRLF_PATH, "text": text }));
        assert_eq!(files, Ok(entries(["Unresolved", "Resolved", "Unresolved"])));
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
                .invoke("finish_file", json!({ "path": path, "text": "done\n" }))
                .unwrap();
        }
        assert_eq!(window.unmerged(), "");
        assert_eq!(window.exit_on_close(), Exit::Success);

        let files = window.invoke("reset_file", json!({ "path": CRLF_PATH }));

        assert_eq!(files, Ok(entries(["Resolved", "Unresolved", "Resolved"])));
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
        let sides = json!({ "path": LOGO, "reason": "Binary", "local": local, "remote": remote });
        assert_eq!(window.invoke("describe_file", path), Ok(sides));

        let files = window.invoke("take_side", json!({ "path": LOGO, "side": "remote" }));

        let resolved = json!({ "path": LOGO, "status": "Resolved", "unsupported": "Binary" });
        assert_eq!(files, Ok(json!([resolved])));
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
    fn every_session_error_serialises_with_its_kind_and_fields() {
        let plain_dir = TempDir::new().unwrap();
        let Err(git_error) = MergeSession::open(plain_dir.path()) else {
            panic!("a plain directory opened as a merge");
        };
        let git_json = serde_json::to_value(IpcError::from(git_error)).unwrap();
        assert_eq!(git_json["kind"], "Git");
        assert!(
            git_json["message"]
                .as_str()
                .unwrap()
                .contains("not a git repository"),
            "{git_json}"
        );

        let unsupported = yamt_session::Error::Unsupported {
            path: "logo.png".to_owned(),
            reason: UnsupportedReason::Binary,
        };
        assert_eq!(
            serde_json::to_value(IpcError::from(unsupported)).unwrap(),
            json!({ "kind": "Unsupported", "path": "logo.png", "reason": "Binary" })
        );
        let write_failed = yamt_session::Error::WriteFailed {
            path: "a.ts".to_owned(),
            source: std::io::Error::other("disk full"),
        };
        assert_eq!(
            serde_json::to_value(IpcError::from(write_failed)).unwrap(),
            json!({ "kind": "WriteFailed", "path": "a.ts", "message": "disk full" })
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
