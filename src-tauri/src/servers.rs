use std::path::Path;
use std::sync::mpsc::{self, Receiver};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;

use tauri::ipc::Channel;
use tauri::webview::PageLoadEvent;
use tauri::{Runtime, State};
use yamt_lsp_host::{
    Host, HostEvent, ProgramFolders, ProgramFound, ProjectFile, RunId, ServerCommand,
    ServerContext, StartReply,
};

pub(crate) type HostState = Mutex<Host>;

pub(crate) fn lock(state: &HostState) -> MutexGuard<'_, Host> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn manage<R: Runtime>(builder: tauri::Builder<R>, root: &Path) -> tauri::Builder<R> {
    let host: HostState = Mutex::new(Host::new(root));
    builder.manage(host)
}

pub(crate) fn stop_runs_on_page_start(host: &HostState, event: PageLoadEvent) {
    match event {
        PageLoadEvent::Started => lock(host).stop_every(),
        PageLoadEvent::Finished => {}
    }
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
#[expect(
    clippy::needless_pass_by_value,
    reason = "tauri passes arguments by value"
)]
pub(crate) fn find_program(
    host: State<'_, HostState>,
    program: &str,
    project: &str,
    folders: ProgramFolders,
) -> ProgramFound {
    lock(&host).find_program(program, project, &folders)
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

    use crate::merge::{MergeState, lock as lock_merge};
    use crate::mock_window::{Window, open_window};

    fn session_root(window: &Window) -> std::path::PathBuf {
        lock_merge(&window.app.state::<MergeState>())
            .session()
            .unwrap()
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
            json!({
                "program": "tool",
                "project": "frontend",
                "folders": { "project": ["node_modules/.bin"], "home": [] },
            }),
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

#[cfg(test)]
#[cfg(unix)]
mod run_tests {
    use std::process::Command;
    use std::sync::mpsc::{RecvTimeoutError, Sender};
    use std::time::{Duration, Instant};

    use serde_json::{Value, json};
    use tauri::Manager;
    use tauri::ipc::InvokeResponseBody;

    use super::*;
    use crate::mock_window::{Window, open_window};

    const WAIT: Duration = Duration::from_secs(10);
    const POLL: Duration = Duration::from_millis(50);

    /// `sh` writes its pid to stderr and becomes `cat`: framed messages come back as they went.
    fn start_cat(window: &Window, events: Channel<HostEvent>) -> RunId {
        let command = ServerCommand {
            program: "sh".to_owned(),
            args: vec!["-c".to_owned(), "echo $$ >&2; exec cat".to_owned()],
            project: String::new(),
            folders: ProgramFolders::default(),
        };
        let reply = start_server(window.app.state(), command, events);
        let StartReply::Started { run } = reply else {
            panic!("{reply:?}");
        };
        run
    }

    /// A channel that hands each event to `events` and answers like a page that takes it or not.
    fn channel_into(events: Sender<Value>, takes_events: bool) -> Channel<HostEvent> {
        Channel::new(move |body| {
            let InvokeResponseBody::Json(json) = body else {
                panic!("an event that is not JSON");
            };
            events.send(serde_json::from_str(&json).unwrap()).unwrap();
            if takes_events {
                Ok(())
            } else {
                Err(tauri::Error::WebviewNotFound)
            }
        })
    }

    fn next(events: &Receiver<Value>) -> Value {
        events.recv_timeout(WAIT).unwrap()
    }

    fn pid_of(first_event: &Value) -> u32 {
        first_event["line"].as_str().unwrap().parse().unwrap()
    }

    fn is_alive(pid: u32) -> bool {
        let status = Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .unwrap();
        status.success()
    }

    #[test]
    fn a_run_s_messages_reach_its_channel_and_stop_ends_it_with_one_exited() {
        let window = open_window();
        let (sender, events) = mpsc::channel();
        let run = start_cat(&window, channel_into(sender, true));
        let pid = pid_of(&next(&events));
        send_to_server(window.app.state(), run, "{\"id\":1}".to_owned());
        let message = json!({ "kind": "Message", "text": "{\"id\":1}" });
        assert_eq!(next(&events), message);
        stop_server(window.app.state(), run);
        assert_eq!(next(&events), json!({ "kind": "Exited", "code": 0 }));
        assert_eq!(
            events.recv_timeout(WAIT),
            Err(RecvTimeoutError::Disconnected)
        );
        assert!(!is_alive(pid));
    }

    #[test]
    fn a_run_whose_page_refuses_its_events_stops_at_its_next_output() {
        let window = open_window();
        let (sender, events) = mpsc::channel();
        let run = start_cat(&window, channel_into(sender, false));
        let pid = pid_of(&next(&events));
        send_to_server(window.app.state(), run, "anyone there".to_owned());
        let deadline = Instant::now() + WAIT;
        while is_alive(pid) && Instant::now() < deadline {
            thread::sleep(POLL);
        }
        assert!(!is_alive(pid));
    }

    #[test]
    fn a_page_that_starts_loading_stops_the_runs_of_the_page_before() {
        let window = open_window();
        let (sender, events) = mpsc::channel();
        let run = start_cat(&window, channel_into(sender, true));
        let pid = pid_of(&next(&events));
        let host = window.app.state::<HostState>();
        stop_runs_on_page_start(&host, PageLoadEvent::Finished);
        send_to_server(window.app.state(), run, "still here".to_owned());
        let message = json!({ "kind": "Message", "text": "still here" });
        assert_eq!(next(&events), message);
        stop_runs_on_page_start(&host, PageLoadEvent::Started);
        assert_eq!(next(&events), json!({ "kind": "Exited", "code": 0 }));
        assert!(!is_alive(pid));
    }
}
