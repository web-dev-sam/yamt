use std::sync::mpsc::{self, Receiver};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;

use tauri::State;
use tauri::ipc::Channel;
use yamt_lsp_host::{
    Host, HostEvent, ProgramFound, ProjectFile, RunId, ServerCommand, ServerContext, StartReply,
};

pub(crate) type HostState = Mutex<Host>;

pub(crate) fn lock(state: &HostState) -> MutexGuard<'_, Host> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn servers_context(host: State<'_, HostState>) -> ServerContext {
    lock(&host).context()
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn start_server(
    host: State<'_, HostState>,
    command: ServerCommand,
    events: Channel<HostEvent>,
) -> StartReply {
    let (sender, receiver) = mpsc::channel();
    let reply = lock(&host).start(&command, sender);
    thread::spawn(move || forward(&receiver, &events));
    reply
}

/// Returning drops `receiver`, which stops the run once the page cannot take its events.
fn forward(receiver: &Receiver<HostEvent>, events: &Channel<HostEvent>) {
    for event in receiver {
        if events.send(event).is_err() {
            return;
        }
    }
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn send_to_server(host: State<'_, HostState>, run: RunId, message: String) {
    lock(&host).send(run, message);
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn stop_server(host: State<'_, HostState>, run: RunId) {
    lock(&host).stop(run);
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn find_program(
    host: State<'_, HostState>,
    program: &str,
    project: &str,
) -> ProgramFound {
    lock(&host).find_program(program, project)
}

#[tauri::command]
#[specta::specta]
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn project_files(host: State<'_, HostState>, paths: Vec<String>) -> Vec<ProjectFile> {
    lock(&host).project_files(&paths)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::json;
    use tauri::Manager;

    use crate::commands::tests::{Window, open_window};
    use crate::commands::{SessionState, lock as lock_session};

    fn session_root(window: &Window) -> std::path::PathBuf {
        lock_session(&window.app.state::<SessionState>())
            .root()
            .to_owned()
    }

    #[test]
    fn servers_context_names_the_session_s_repository_and_this_process() {
        let window = open_window();
        let root = session_root(&window).to_str().unwrap().to_owned();
        let context = json!({ "root": root, "process_id": std::process::id() });
        assert_eq!(window.invoke("servers_context", json!({})), Ok(context));
    }

    #[test]
    fn find_program_finds_a_project_s_program_and_project_files_reads_the_repository() {
        let window = open_window();
        let frontend = session_root(&window).join("frontend");
        let bin = frontend.join("node_modules").join(".bin");
        fs::create_dir_all(&bin).unwrap();
        let tool = bin.join(if cfg!(windows) { "tool.cmd" } else { "tool" });
        fs::write(&tool, "#!/bin/sh\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&tool, fs::Permissions::from_mode(0o755)).unwrap();
        }
        fs::write(frontend.join("package.json"), "{}").unwrap();

        let found = window.invoke(
            "find_program",
            json!({ "program": "tool", "project": "frontend" }),
        );
        let files = window.invoke(
            "project_files",
            json!({ "paths": ["frontend/package.json", "frontend", "../elsewhere"] }),
        );

        let path = tool.display().to_string();
        let project = json!({ "kind": "Found", "path": path, "place": "Project" });
        assert_eq!(found, Ok(project));
        let text = json!({ "kind": "Text", "text": "{}" });
        let answers = json!([text, { "kind": "Folder" }, { "kind": "Missing" }]);
        assert_eq!(files, Ok(answers));
    }
}
