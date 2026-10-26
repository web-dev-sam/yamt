use std::path::{Path, PathBuf};
use std::sync::mpsc;
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
/// checkout meanwhile, then sweeps the other pairs in `range_dir` with the state released.
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
        Ai::On => sweep_while_held(app.handle().clone(), range_dir, pair_folder.to_owned()),
    }
}

/// Returns once the sweep's thread holds the state.
fn sweep_while_held<R: Runtime>(app: AppHandle<R>, range_dir: PathBuf, pair_folder: PathBuf) {
    let (held, wait) = mpsc::channel();
    thread::spawn(move || {
        {
            let state = app.state();
            let mut ai = lock(&state);
            held.send(()).ok();
            if let AiState::On(workspace) = &mut *ai {
                workspace.remove_own_leftovers();
            }
        }
        yamt_agent::sweep_other_pairs(&range_dir, &pair_folder);
    });
    wait.recv().ok();
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
mod tests {
    use std::fs;
    use std::time::{Duration, Instant};

    use serde_json::{Value, json};
    use yamt_compare::MAX_COLUMN_BYTES;
    use yamt_conflict_repo::TempDir;
    use yamt_range::{PairLock, RangeSpec, Resolved};

    use super::*;
    use crate::mock_window::invoke_on;
    use crate::range::tests::{RangeWindow, open_range_window_in, open_range_window_with, repo};

    const WAIT: Duration = Duration::from_secs(10);
    const POLL: Duration = Duration::from_millis(50);

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
        let started = started(&window, command("sh", &[]), Channel::new(|_| Ok(())));
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
        let checkout = PathBuf::from(ready["folder"].as_str().unwrap());
        let right_text = fs::read_to_string(checkout.join("a.txt")).unwrap();
        assert_eq!(right_text, "two\n", "the right commit's text");
        let pair_lock = checkout.parent().unwrap().join("lock");
        assert!(pair_lock.is_file(), "{}", pair_lock.display());
        checkout
    }

    fn look(window: &RangeWindow) -> Result<Value, Value> {
        invoke_on(&window.webview, "checkout_changes", json!({}))
    }

    #[test]
    fn the_exit_removes_a_clean_checkout_and_leaves_the_ai_off() {
        let window = open_range_window_with(Ai::On);
        let checkout = prepared_checkout(&window);
        assert_eq!(look(&window), Ok(json!({ "kind": "Clean" })));
        end_at_exit(&ai_state(&window));
        assert!(!checkout.exists(), "{}", checkout.display());
        assert_eq!(look(&window), Err(json!({ "kind": "AiOff" })));
    }

    #[test]
    fn the_exit_keeps_a_changed_checkout_and_leaves_the_ai_off() {
        let window = open_range_window_with(Ai::On);
        let checkout = prepared_checkout(&window);
        fs::write(checkout.join("new.txt"), "new\n").unwrap();
        end_at_exit(&ai_state(&window));
        assert!(checkout.join("new.txt").is_file(), "{}", checkout.display());
        assert_eq!(look(&window), Err(json!({ "kind": "AiOff" })));
    }

    #[test]
    fn discard_removes_a_changed_checkout() {
        let window = open_range_window_with(Ai::On);
        let checkout = prepared_checkout(&window);
        fs::write(checkout.join("new.txt"), "new\n").unwrap();
        let changed = look(&window).unwrap();
        assert_eq!(changed["files"], json!(["new.txt"]), "{changed}");
        assert_eq!(
            invoke_on(&window.webview, "discard_checkout", json!({})),
            Ok(json!(null))
        );
        assert!(!checkout.exists(), "{}", checkout.display());
    }

    /// The pair folder a window on `main...remote` will hold; its lock is let go again.
    fn own_pair_folder(repo: &Path, range_dir: &Path) -> PathBuf {
        let spec = RangeSpec::parse("main...remote").unwrap();
        let resolved = Resolved::resolve(repo, &spec).unwrap();
        PairLock::take(range_dir, &resolved)
            .unwrap()
            .folder()
            .to_owned()
    }

    fn gone_within_wait(folder: &Path) -> bool {
        let deadline = Instant::now() + WAIT;
        while folder.exists() && Instant::now() < deadline {
            thread::sleep(POLL);
        }
        !folder.exists()
    }

    // The own pair's partial must be gone before any command holds the state; the other pair's must go while
    // the state stays held, or the sweep of every kept checkout would stall Ask AI and the close question.
    #[test]
    fn an_ai_start_sweeps_its_own_pair_under_the_state_and_other_pairs_without_it() {
        let (repo, data) = (repo(), TempDir::new().unwrap());
        let range_dir = data.path().join("yamt").join("range");
        let own_partial = own_pair_folder(repo.path(), &range_dir).join("checkout.partial");
        let other_partial = range_dir
            .join("x-0123456789abcdef")
            .join("a-b")
            .join("checkout.partial");
        for partial in [&own_partial, &other_partial] {
            fs::create_dir_all(partial.join("inside")).unwrap();
        }

        let window = open_range_window_in(repo, data, Ai::On);

        let state = ai_state(&window);
        let _held = lock(&state);
        assert!(!own_partial.exists(), "{}", own_partial.display());
        assert!(
            gone_within_wait(&other_partial),
            "{}",
            other_partial.display()
        );
    }

    #[cfg(unix)]
    mod page_load {
        use std::sync::mpsc::Receiver;

        use super::*;
        use crate::servers::run_tests::{channel_into, is_alive};

        /// `sh` writes its pid to stderr and becomes `cat`; answers its run, its pid and its events.
        fn started_cat(window: &RangeWindow) -> (AgentRun, u32, Receiver<Value>) {
            let (sender, events) = mpsc::channel();
            let cat = command("sh", &["-c", "echo $$ >&2; exec cat"]);
            let reply = started(window, cat, channel_into(sender, true)).unwrap();
            let AgentStartReply::Started { run } = reply else {
                panic!("{reply:?}");
            };
            let first = events.recv_timeout(WAIT).unwrap();
            let pid = first["line"].as_str().unwrap().parse().unwrap();
            (run, pid, events)
        }

        // A reload while a start, prepare or discard holds the state must still stop the old page's agent.
        #[test]
        fn a_page_load_stops_the_agent_at_once_or_once_the_state_is_free_and_keeps_the_checkout() {
            let window = open_range_window_with(Ai::On);
            let checkout = prepared_checkout(&window);
            let app = window.webview.app_handle();
            let (run, pid, events) = started_cat(&window);
            stop_agent_on_page_start(app, PageLoadEvent::Finished);
            send_to_agent(ai_state(&window), run, "still here".to_owned()).unwrap();
            assert_eq!(events.recv_timeout(WAIT).unwrap()["text"], "still here");
            stop_agent_on_page_start(app, PageLoadEvent::Started);
            assert_eq!(events.recv_timeout(WAIT).unwrap()["kind"], "Exited");
            assert!(!is_alive(pid));

            let (_, pid, events) = started_cat(&window);
            let state = ai_state(&window);
            let held = lock(&state);
            stop_agent_on_page_start(app, PageLoadEvent::Started);
            assert!(is_alive(pid));
            drop(held);
            assert_eq!(events.recv_timeout(WAIT).unwrap()["kind"], "Exited");
            assert!(!is_alive(pid));
            assert!(checkout.is_dir(), "{}", checkout.display());
        }
    }
}
