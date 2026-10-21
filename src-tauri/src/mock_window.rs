use serde_json::Value;
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{
    INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder, mock_context, noop_assets,
};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, conflict_repo};
use yamt_session::MergeSession;

use crate::commands::with_session;

pub(crate) const CRLF_PATH: &str = "crlf.ts";

pub(crate) struct Window {
    pub(crate) repo: TempDir,
    pub(crate) app: App<MockRuntime>,
    pub(crate) webview: WebviewWindow<MockRuntime>,
}

pub(crate) fn file<'a>(
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

pub(crate) fn open_window() -> Window {
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

pub(crate) fn open_window_on(files: &[ConflictFile]) -> Window {
    open_window_in(conflict_repo(files).unwrap())
}

pub(crate) fn open_window_in(repo: TempDir) -> Window {
    let session = MergeSession::open(repo.path()).unwrap();
    let app = with_session(mock_builder(), Box::new(session))
        .build(mock_context(noop_assets()))
        .unwrap();
    let webview = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
        .build()
        .unwrap();
    Window { repo, app, webview }
}

impl Window {
    pub(crate) fn invoke(&self, cmd: &str, args: Value) -> Result<Value, Value> {
        invoke_on(&self.webview, cmd, args)
    }
}

/// `Window::invoke` from another thread: the app itself is not `Sync`, its webview is.
pub(crate) fn invoke_on(
    webview: &WebviewWindow<MockRuntime>,
    cmd: &str,
    args: Value,
) -> Result<Value, Value> {
    let request = InvokeRequest {
        cmd: cmd.to_owned(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: webview.url().unwrap(),
        body: InvokeBody::Json(args),
        headers: tauri::http::HeaderMap::default(),
        invoke_key: INVOKE_KEY.to_owned(),
    };
    get_ipc_response(webview, request).map(|body| body.deserialize().unwrap())
}
