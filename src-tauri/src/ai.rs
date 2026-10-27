use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
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
use crate::servers::forward;

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

fn lock(state: &Mutex<AiState>) -> MutexGuard<'_, AiState> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Manages the range window's `Mutex<AiState>`. With `--ai`, the workspace on its pair, and a background
/// thread that removes this pair's leftovers while it holds the state, so no command makes or removes the
/// checkout meanwhile, then sweeps the other pairs in `range_dir` with the state released. Returns once
/// that thread holds the state.
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
        Ai::On => {
            let (app, pair_folder) = (app.handle().clone(), pair_folder.to_owned());
            let (held, wait) = mpsc::channel();
            thread::spawn(move || {
                let others = || yamt_agent::sweep_other_pairs(&range_dir, &pair_folder);
                sweep_own_then_others(app.state::<Mutex<AiState>>().inner(), &held, others);
            });
            wait.recv().ok();
        }
    }
}

fn sweep_own_then_others(state: &Mutex<AiState>, held: &Sender<()>, others: impl FnOnce()) {
    {
        let mut ai = lock(state);
        held.send(()).ok();
        if let AiState::On(workspace) = &mut *ai {
            workspace.remove_own_leftovers();
        }
    }
    others();
}

/// A page that starts loading stops the agent of the page before. While a command holds the state (a
/// prepare, a start, a discard, the own-pair sweep), a thread waits for it and stops the agent then, so an
/// agent a start in flight spawns for the old page stops too. The checkout stays.
pub(crate) fn stop_agent_on_page_start<R: Runtime>(app: &AppHandle<R>, event: PageLoadEvent) {
    match event {
        PageLoadEvent::Started => {
            let Some(state) = app.try_state::<Mutex<AiState>>() else {
                return;
            };
            match state.try_lock() {
                Ok(ai) => stop_agent_in(&ai),
                Err(TryLockError::Poisoned(poisoned)) => stop_agent_in(&poisoned.into_inner()),
                Err(TryLockError::WouldBlock) => {
                    let app = app.clone();
                    thread::spawn(move || stop_agent_in(&lock(&app.state())));
                }
            }
        }
        PageLoadEvent::Finished => {}
    }
}

fn stop_agent_in(ai: &AiState) {
    match ai {
        AiState::On(workspace) => workspace.stop_agent(),
        AiState::Off => {}
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
mod tests;
