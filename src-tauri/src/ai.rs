use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Mutex, MutexGuard, PoisonError, TryLockError};
use std::thread;

use tauri::ipc::Channel;
use tauri::webview::PageLoadEvent;
use tauri::{App, AppHandle, Manager, Runtime, State, WebviewWindow};
use yamt_agent::{
    AgentCommand, AgentRun, AgentStartReply, CheckoutLook, CheckoutReply, HostEvent, Pair,
    Workspace,
};
use yamt_compare::Difference;
use yamt_range::Range;

use crate::args::Ai;
use crate::ipc_error::{IpcError, blocking_reply};

/// The range window's AI (plan §2 #108): `On` only when it was started with `--ai`.
pub(crate) enum AiState {
    Off,
    On(Workspace),
}

impl AiState {
    fn workspace(&mut self) -> Result<&mut Workspace, IpcError> {
        match self {
            AiState::On(workspace) => Ok(workspace),
            AiState::Off => Err(IpcError::AiOff),
        }
    }
}

pub(crate) fn lock(state: &Mutex<AiState>) -> MutexGuard<'_, AiState> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Manages the range window's `Mutex<AiState>`. With `--ai`, the workspace on its pair, and a background
/// thread that sweeps what earlier runs left in `range_dir` while it holds the state, so no command makes
/// or removes this pair's checkout during the sweep.
pub(crate) fn manage<R: Runtime>(
    app: &App<R>,
    ai: Ai,
    range_dir: PathBuf,
    pair_folder: &Path,
    range: &Range,
) {
    let state = match ai {
        Ai::Off => AiState::Off,
        Ai::On => AiState::On(Workspace::new(Pair {
            repo: range.root().to_owned(),
            folder: pair_folder.to_owned(),
            new_commit: range.compared().right.as_str().to_owned(),
        })),
    };
    app.manage(Mutex::new(state));
    match ai {
        Ai::Off => {}
        Ai::On => sweep_while_held(app.handle().clone(), range_dir),
    }
}

/// Returns once the sweep's thread holds the state.
fn sweep_while_held<R: Runtime>(app: AppHandle<R>, range_dir: PathBuf) {
    let (held, wait) = mpsc::channel();
    thread::spawn(move || {
        let state = app.state();
        let mut ai = lock(&state);
        held.send(()).ok();
        if let AiState::On(workspace) = &mut *ai {
            workspace.sweep_leftovers(&range_dir);
        }
    });
    wait.recv().ok();
}

/// A page that starts loading stops the agent of the page before; a prepare holding the state is
/// left alone (no agent runs during one). The checkout stays.
pub(crate) fn stop_agent_on_page_start(state: &Mutex<AiState>, event: PageLoadEvent) {
    match event {
        PageLoadEvent::Started => {
            let ai = match state.try_lock() {
                Ok(ai) => ai,
                Err(TryLockError::Poisoned(poisoned)) => poisoned.into_inner(),
                Err(TryLockError::WouldBlock) => return,
            };
            if let AiState::On(workspace) = &*ai {
                workspace.stop_agent();
            }
        }
        PageLoadEvent::Finished => {}
    }
}

/// After the window closed: stops the agent, looks again and removes the checkout only when clean.
pub(crate) fn end_at_exit(state: &Mutex<AiState>) {
    let ai = std::mem::replace(&mut *lock(state), AiState::Off);
    match ai {
        AiState::On(workspace) => workspace.end(),
        AiState::Off => {}
    }
}

// The state comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
pub(crate) async fn prepare_checkout<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<CheckoutReply, IpcError> {
    blocking_reply(move || Ok(lock(&window.state()).workspace()?.prepare())).await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn start_agent<R: Runtime>(
    window: WebviewWindow<R>,
    command: AgentCommand,
    events: Channel<HostEvent>,
) -> Result<AgentStartReply, IpcError> {
    blocking_reply(move || {
        let (sender, receiver) = mpsc::channel();
        let reply = lock(&window.state()).workspace()?.start(&command, sender);
        thread::spawn(move || forward(&receiver, &events));
        Ok(reply)
    })
    .await
}

/// Returning drops `receiver`, which stops the agent once the page cannot take its events.
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
pub(crate) fn send_to_agent(
    state: State<'_, Mutex<AiState>>,
    run: AgentRun,
    message: String,
) -> Result<(), IpcError> {
    lock(&state).workspace()?.send(run, message);
    Ok(())
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn stop_agent(state: State<'_, Mutex<AiState>>, run: AgentRun) -> Result<(), IpcError> {
    lock(&state).workspace()?.stop(run);
    Ok(())
}

/// The checkout's folder is taken under the lock; git looks at it after the lock is released.
#[tauri::command]
#[specta::specta]
pub(crate) async fn checkout_changes<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<CheckoutLook, IpcError> {
    blocking_reply(move || {
        let job = lock(&window.state()).workspace()?.look_job();
        Ok(job.look())
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn discard_checkout<R: Runtime>(window: WebviewWindow<R>) -> Result<(), IpcError> {
    blocking_reply(move || Ok(lock(&window.state()).workspace()?.discard()?)).await
}

/// An edit's two texts as the compare window's differences (plan §2 #114); needs no AI state.
#[tauri::command]
#[specta::specta]
pub(crate) async fn diff_texts(old: String, next: String) -> Result<Vec<Difference>, IpcError> {
    blocking_reply(move || Ok(yamt_compare::text_differences(&old, &next)?)).await
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use yamt_compare::MAX_COLUMN_BYTES;

    use super::*;
    use crate::mock_window::invoke_on;
    use crate::range::tests::{RangeWindow, open_range_window_with};

    fn ai_state(window: &RangeWindow) -> State<'_, Mutex<AiState>> {
        window.webview.state()
    }

    fn started(
        window: &RangeWindow,
        command: AgentCommand,
        events: Channel<HostEvent>,
    ) -> Result<AgentStartReply, IpcError> {
        tauri::async_runtime::block_on(start_agent(window.webview.clone(), command, events))
    }

    fn no_events() -> Channel<HostEvent> {
        Channel::new(|_| Ok(()))
    }

    fn command(program: &str, args: &[&str]) -> AgentCommand {
        AgentCommand {
            program: program.to_owned(),
            args: args.iter().map(|&arg| arg.to_owned()).collect(),
            home_folders: Vec::new(),
        }
    }

    #[test]
    fn every_agent_command_answers_ai_off_without_the_flag() {
        let window = open_range_window_with(Ai::Off);
        let off = Err(json!({ "kind": "AiOff" }));
        for cmd in ["prepare_checkout", "checkout_changes", "discard_checkout"] {
            assert_eq!(invoke_on(&window.webview, cmd, json!({})), off, "{cmd}");
        }
        let run = json!({ "run": 0 });
        assert_eq!(invoke_on(&window.webview, "stop_agent", run), off);
        let message = json!({ "run": 0, "message": "hello" });
        assert_eq!(invoke_on(&window.webview, "send_to_agent", message), off);
        let started = started(&window, command("sh", &[]), no_events());
        assert!(matches!(started, Err(IpcError::AiOff)), "{started:?}");
    }

    #[test]
    fn diff_texts_refuses_a_side_over_the_limit() {
        let over = "x".repeat(usize::try_from(MAX_COLUMN_BYTES).unwrap() + 1);
        let block = |old: &str, next: &str| {
            tauri::async_runtime::block_on(diff_texts(old.to_owned(), next.to_owned()))
        };
        let limit = MAX_COLUMN_BYTES;
        assert!(
            matches!(block(&over, ""), Err(IpcError::ColumnTooLarge { limit: l }) if l == limit)
        );
        assert!(
            matches!(block("", &over), Err(IpcError::ColumnTooLarge { limit: l }) if l == limit)
        );
        let differences = block("one\n", "two\n").unwrap();
        assert_eq!(differences.len(), 1, "{differences:?}");
    }

    fn prepared_checkout(window: &RangeWindow) -> PathBuf {
        let ready = invoke_on(&window.webview, "prepare_checkout", json!({})).unwrap();
        assert_eq!(ready["kind"], "Ready", "{ready}");
        PathBuf::from(ready["folder"].as_str().unwrap())
    }

    #[test]
    fn the_exit_removes_a_clean_checkout_and_leaves_the_ai_off() {
        let window = open_range_window_with(Ai::On);
        let checkout = prepared_checkout(&window);
        assert_eq!(
            invoke_on(&window.webview, "checkout_changes", json!({})),
            Ok(json!({ "kind": "Clean" }))
        );
        end_at_exit(&ai_state(&window));
        assert!(!checkout.exists(), "{}", checkout.display());
        let off = Err(json!({ "kind": "AiOff" }));
        assert_eq!(
            invoke_on(&window.webview, "checkout_changes", json!({})),
            off
        );
    }

    #[test]
    fn discard_removes_a_changed_checkout() {
        let window = open_range_window_with(Ai::On);
        let checkout = prepared_checkout(&window);
        std::fs::write(checkout.join("new.txt"), "new\n").unwrap();
        let changed = invoke_on(&window.webview, "checkout_changes", json!({})).unwrap();
        assert_eq!(changed["files"], json!(["new.txt"]), "{changed}");
        assert_eq!(
            invoke_on(&window.webview, "discard_checkout", json!({})),
            Ok(json!(null))
        );
        assert!(!checkout.exists(), "{}", checkout.display());
    }

    #[cfg(unix)]
    mod page_load {
        use std::process::Command;
        use std::sync::mpsc::Sender;
        use std::time::Duration;

        use serde_json::Value;
        use tauri::ipc::InvokeResponseBody;

        use super::*;

        const WAIT: Duration = Duration::from_secs(10);

        fn channel_into(events: Sender<Value>) -> Channel<HostEvent> {
            Channel::new(move |body| {
                let InvokeResponseBody::Json(json) = body else {
                    panic!("an event that is not JSON");
                };
                events.send(serde_json::from_str(&json).unwrap()).unwrap();
                Ok(())
            })
        }

        fn is_alive(pid: u32) -> bool {
            let status = Command::new("kill")
                .args(["-0", &pid.to_string()])
                .status()
                .unwrap();
            status.success()
        }

        #[test]
        fn a_page_load_stops_the_agent_and_keeps_the_checkout() {
            let window = open_range_window_with(Ai::On);
            let checkout = prepared_checkout(&window);
            let (sender, events) = mpsc::channel();
            let cat = command("sh", &["-c", "echo $$ >&2; exec cat"]);
            let reply = started(&window, cat, channel_into(sender)).unwrap();
            let AgentStartReply::Started { run } = reply else {
                panic!("{reply:?}");
            };
            let first = events.recv_timeout(WAIT).unwrap();
            let pid: u32 = first["line"].as_str().unwrap().parse().unwrap();

            let state = ai_state(&window);
            let held = lock(&state);
            stop_agent_on_page_start(&state, PageLoadEvent::Started);
            drop(held);
            stop_agent_on_page_start(&state, PageLoadEvent::Finished);
            send_to_agent(ai_state(&window), run, "still here".to_owned()).unwrap();
            let echoed = json!({ "kind": "Message", "text": "still here" });
            assert_eq!(events.recv_timeout(WAIT).unwrap(), echoed);

            stop_agent_on_page_start(&state, PageLoadEvent::Started);
            assert_eq!(events.recv_timeout(WAIT).unwrap()["kind"], "Exited");
            assert!(!is_alive(pid));
            assert!(checkout.is_dir(), "{}", checkout.display());
        }
    }
}
