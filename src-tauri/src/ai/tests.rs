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
    assert!(matches!(block(&over, ""), Err(IpcError::ColumnTooLarge { limit: l }) if l == limit));
    assert!(matches!(block("", &over), Err(IpcError::ColumnTooLarge { limit: l }) if l == limit));
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

#[test]
fn the_other_pairs_are_swept_with_the_state_released() {
    let state = Mutex::new(AiState::Off);
    let (held, wait) = mpsc::channel();
    let mut swept = false;
    sweep_own_then_others(&state, &held, || {
        assert_eq!(wait.try_recv(), Ok(()), "held before the other pairs");
        assert!(state.try_lock().is_ok(), "the state is still held");
        swept = true;
    });
    assert!(swept);
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
