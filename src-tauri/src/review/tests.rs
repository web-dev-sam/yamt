use std::sync::mpsc;
use std::thread;

use serde_json::{Value, json};
use tauri::async_runtime::block_on;
use tauri::ipc::InvokeResponseBody;

use super::*;
use crate::mock_window::invoke_on;
use crate::range::tests::{RangeWindow, open_range_window};

const FILE: u32 = 0;
const ADDED_LINE: u32 = 0;
const UNKNOWN_ID: u32 = 9;

fn invoke(window: &RangeWindow, cmd: &str, args: Value) -> Result<Value, Value> {
    invoke_on(&window.webview, cmd, args)
}

fn add_first_thread(window: &RangeWindow) -> Value {
    let line = json!({ "kind": "added", "right": ADDED_LINE });
    let args = json!({ "file": FILE, "line": line, "text": "Why two?" });
    invoke(window, "add_thread", args).unwrap()
}

#[test]
fn a_thread_added_through_add_thread_comes_back_from_list_threads() {
    let window = open_range_window();

    let added = add_first_thread(&window);

    let listed = invoke(&window, "list_threads", json!({})).unwrap();
    assert_eq!(listed, added["list"]);
    let thread = &listed["threads"][0];
    assert_eq!(thread["id"], added["thread"]);
    assert_eq!(thread["file"], FILE);
    assert_eq!(
        thread["line"],
        json!({ "kind": "added", "right": ADDED_LINE })
    );
    let note = json!({ "kind": "note", "text": "Why two?" });
    assert_eq!(thread["messages"][0]["body"], note);
}

#[test]
fn a_note_and_a_queue_change_the_listed_thread_and_unqueue_takes_it_back() {
    let window = open_range_window();
    let added = add_first_thread(&window);
    let thread = &added["thread"];

    let noted = invoke(
        &window,
        "add_note",
        json!({ "thread": thread, "text": "Ok." }),
    );
    let message = noted.unwrap()["threads"][0]["messages"][1]["id"].clone();
    let queued = invoke(
        &window,
        "queue_message",
        json!({ "message": message, "text": "Ok!" }),
    );
    let posting = |list: &Value| list["threads"][0]["messages"][1]["posting"].clone();
    assert_eq!(
        posting(&queued.unwrap()),
        json!({ "kind": "queued", "text": "Ok!" })
    );
    let unqueued = invoke(&window, "unqueue_message", json!({ "message": message }));
    assert_eq!(posting(&unqueued.unwrap()), json!({ "kind": "notQueued" }));
}

#[test]
fn thread_commands_answer_the_store_s_refusals_as_their_kinds() {
    let window = open_range_window();
    let blank = json!({ "file": FILE, "line": { "kind": "added", "right": 0 }, "text": " " });
    assert_eq!(
        invoke(&window, "add_thread", blank),
        Err(json!({ "kind": "EmptyMessage" }))
    );
    let note = json!({ "thread": UNKNOWN_ID, "text": "Ok." });
    assert_eq!(
        invoke(&window, "add_note", note),
        Err(json!({ "kind": "UnknownThread", "thread": UNKNOWN_ID }))
    );
    assert_eq!(
        invoke(&window, "unqueue_message", json!({ "message": UNKNOWN_ID })),
        Err(json!({ "kind": "UnknownMessage", "message": UNKNOWN_ID }))
    );
}

#[test]
fn set_thread_session_and_add_ai_answer_reach_the_thread_store() {
    let window = open_range_window();
    let thread = add_first_thread(&window)["thread"].clone();

    let set = invoke(
        &window,
        "set_thread_session",
        json!({ "thread": thread, "session": "omp-1" }),
    );
    assert_eq!(set.unwrap()["threads"][0]["session"], "omp-1");
    let answered = invoke(
        &window,
        "add_ai_answer",
        json!({ "thread": thread, "session": "omp-2" }),
    )
    .unwrap();

    let answer = json!({ "kind": "aiAnswer", "session": "omp-2", "turn": 0 });
    assert_eq!(answered["threads"][0]["messages"][1]["body"], answer);
    assert_eq!(answered["threads"][0]["session"], "omp-2");
    assert_eq!(invoke(&window, "list_threads", json!({})), Ok(answered));
    let unknown = json!({ "thread": UNKNOWN_ID, "session": "omp-1" });
    let refusal = json!({ "kind": "UnknownThread", "thread": UNKNOWN_ID });
    for cmd in ["set_thread_session", "add_ai_answer"] {
        assert_eq!(invoke(&window, cmd, unknown.clone()), Err(refusal.clone()));
    }
}

// Two sends at once would post the same queued messages twice.
#[test]
fn a_second_send_while_one_runs_answers_send_running() {
    let window = open_range_window();
    let state = window.webview.state::<RangeState>();
    let _running = send_guard(&state.sending).unwrap();

    let progress = Channel::new(|_| Ok(()));
    let second = block_on(send_queue(window.webview.clone(), progress));

    assert!(matches!(second, Err(IpcError::SendRunning)), "{second:?}");
}

// A draft posted for a message deleted or edited meanwhile would leave GitLab and the file apart (#123).
#[test]
fn edit_note_and_delete_message_answer_send_running_while_a_send_runs_and_change_nothing() {
    let window = open_range_window();
    let list = add_first_thread(&window)["list"].clone();
    let message = list["threads"][0]["messages"][0]["id"].clone();
    let state = window.webview.state::<RangeState>();
    let running = send_guard(&state.sending).unwrap();

    let edit = json!({ "message": message, "text": "Why three?" });
    assert_eq!(
        invoke(&window, "edit_note", edit),
        Err(json!({ "kind": "SendRunning" }))
    );
    let delete = json!({ "message": message });
    assert_eq!(
        invoke(&window, "delete_message", delete),
        Err(json!({ "kind": "SendRunning" }))
    );
    drop(running);
    assert_eq!(invoke(&window, "list_threads", json!({})), Ok(list));
}

#[test]
fn edit_note_and_delete_message_reach_the_thread_store() {
    let window = open_range_window();
    let list = add_first_thread(&window)["list"].clone();
    let message = list["threads"][0]["messages"][0]["id"].clone();

    let edit = json!({ "message": message, "text": "Why three?" });
    let edited = invoke(&window, "edit_note", edit).unwrap();
    let note = json!({ "kind": "note", "text": "Why three?" });
    assert_eq!(edited["threads"][0]["messages"][0]["body"], note);
    let blank = json!({ "message": message, "text": " " });
    assert_eq!(
        invoke(&window, "edit_note", blank),
        Err(json!({ "kind": "EmptyMessage" }))
    );

    let deleted = invoke(&window, "delete_message", json!({ "message": message }));
    assert_eq!(deleted, Ok(json!({ "threads": [] })));
    assert_eq!(
        invoke(&window, "delete_message", json!({ "message": message })),
        Err(json!({ "kind": "UnknownMessage", "message": message }))
    );
}

#[test]
fn a_send_guard_whose_holder_panicked_is_taken_again() {
    let sending = Mutex::new(());
    thread::scope(|scope| {
        let holder = scope.spawn(|| {
            let _held = send_guard(&sending);
            panic!("a send's worker panics");
        });
        assert!(holder.join().is_err());
    });
    assert!(sending.is_poisoned());
    assert!(send_guard(&sending).is_ok());
}

/// A channel whose every progress arrives on the receiver as its JSON text.
fn collecting_channel() -> (Channel<SendProgress>, mpsc::Receiver<String>) {
    let (sender, received) = mpsc::channel();
    let channel = Channel::new(move |body| {
        let InvokeResponseBody::Json(json) = body else {
            panic!("progress that is not JSON");
        };
        sender.send(json).unwrap();
        Ok(())
    });
    (channel, received)
}

#[test]
fn each_progress_reaches_the_window_s_channel() {
    let (channel, received) = collecting_channel();

    forward_progress(&channel, SendProgress { done: 2, of: 3 });

    let sent: Value = serde_json::from_str(&received.recv().unwrap()).unwrap();
    assert_eq!(sent, json!({ "done": 2, "of": 3 }));
}

#[cfg(unix)]
mod through_glab {
    use std::path::PathBuf;
    use std::process::Command;
    use std::time::{Duration, Instant};

    use yamt_conflict_repo::{TempDir, run_ignored_in_child};

    use super::*;
    use crate::range::tests::open_range_window_on;

    const FAKE_GLAB_LOG: &str = "YAMT_FAKE_GLAB_LOG";
    const SEND_TEST: &str = "review::tests::through_glab::a_send_on_path_s_glab";
    const CHECK_TEST: &str = "review::tests::through_glab::check_gitlab_on_path_s_glab";
    const POST_ARGV: &str =
        "argv: api --include --method POST projects/7/merge_requests/12/draft_notes --input -";
    const ADDED_FILE: &str = "src/board/reminders.ts";
    const ADDED_FILE_LINE: u32 = 2;
    const POST_WAIT: Duration = Duration::from_secs(10);
    const POLL: Duration = Duration::from_millis(10);

    fn in_this_repository(relative: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join(relative)
    }

    /// Runs `test` in a child whose PATH starts with the committed fake glab (`tests/glab/README.md`) on
    /// `scenario`, its post count and log in a folder of this test's.
    fn run_with_fake_glab(test: &str, scenario: &str) {
        let fake = TempDir::new().unwrap();
        let inherited = std::env::var_os("PATH").unwrap_or_default();
        let mut folders = vec![in_this_repository("scripts/fake-glab")];
        folders.extend(std::env::split_paths(&inherited));
        let path = std::env::join_paths(folders).unwrap();
        let scenario = in_this_repository(&format!("tests/glab/{scenario}"));

        let ran = run_ignored_in_child(&[test], |child| {
            child
                .env("PATH", path)
                .env("YAMT_FAKE_GLAB", scenario)
                .env("YAMT_FAKE_GLAB_STATE", fake.path().join("state"))
                .env(FAKE_GLAB_LOG, fake.path().join("log"));
        });

        ran.unwrap_or_else(|error| panic!("{error}"));
    }

    /// A window on `scripts/range-repo.sh`'s `main...feature`, the range `tests/glab` pins.
    fn range_repo_window() -> RangeWindow {
        let repo = TempDir::new().unwrap();
        let built = Command::new(in_this_repository("scripts/range-repo.sh"))
            .arg(repo.path())
            .output()
            .unwrap();
        assert!(built.status.success(), "{built:?}");
        open_range_window_on(repo, "main...feature")
    }

    fn queue_one_message(window: &RangeWindow) {
        let state = window.webview.state::<RangeState>();
        let entries = state.range.entries();
        let file = entries.iter().find(|entry| entry.path == ADDED_FILE);
        let line = json!({ "kind": "added", "right": ADDED_FILE_LINE });
        let args = json!({ "file": file.unwrap().id, "line": line, "text": "Why?" });
        let added = invoke(window, "add_thread", args).unwrap();
        let message = &added["list"]["threads"][0]["messages"][0]["id"];
        let queued = json!({ "message": message, "text": "Why not a Duration?" });
        invoke(window, "queue_message", queued).unwrap();
    }

    fn send(window: &RangeWindow) -> Result<SendReply, IpcError> {
        block_on(send_queue(window.webview.clone(), Channel::new(|_| Ok(()))))
    }

    fn wait_for_the_post() {
        let log = std::env::var_os(FAKE_GLAB_LOG).unwrap();
        let deadline = Instant::now() + POST_WAIT;
        loop {
            let logged = std::fs::read_to_string(&log).unwrap_or_default();
            if logged.lines().any(|line| line == POST_ARGV) {
                return;
            }
            assert!(Instant::now() < deadline, "no POST: {logged}");
            thread::sleep(POLL);
        }
    }

    #[test]
    fn a_send_holds_off_a_second_send_until_its_post_ends() {
        run_with_fake_glab(SEND_TEST, "slow-post");
    }

    #[test]
    #[ignore = "run by a_send_holds_off_a_second_send_until_its_post_ends"]
    fn a_send_on_path_s_glab() {
        let window = range_repo_window();
        queue_one_message(&window);
        let (progress, received) = collecting_channel();
        let webview = window.webview.clone();
        let first = thread::spawn(move || block_on(send_queue(webview, progress)));

        wait_for_the_post();
        let second = send(&window);
        let first = first.join().unwrap();
        let third = send(&window);

        assert!(matches!(second, Err(IpcError::SendRunning)), "{second:?}");
        let Ok(SendReply::Sent { sent, refused, .. }) = first else {
            panic!("not sent: {first:?}");
        };
        assert_eq!((sent, refused), (1, 0));
        let steps: Vec<String> = received.try_iter().collect();
        assert_eq!(steps, [json!({ "done": 1, "of": 1 }).to_string()]);
        assert!(matches!(third, Ok(SendReply::Sent { .. })), "{third:?}");
    }

    #[test]
    fn check_gitlab_answers_lined_up_on_the_lined_up_merge_request() {
        run_with_fake_glab(CHECK_TEST, "lined-up");
    }

    #[test]
    #[ignore = "run by check_gitlab_answers_lined_up_on_the_lined_up_merge_request"]
    fn check_gitlab_on_path_s_glab() {
        let window = range_repo_window();
        let checked = block_on(check_gitlab(window.webview.clone())).unwrap();
        assert_eq!(serde_json::to_value(checked).unwrap()["kind"], "linedUp");
    }
}
