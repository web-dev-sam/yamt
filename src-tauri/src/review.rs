use std::sync::{Mutex, MutexGuard, PoisonError, TryLockError};

use tauri::ipc::Channel;
use tauri::{Manager, Runtime, State, WebviewWindow};
use yamt_range::RangeFileId;
use yamt_review::{
    GitLabCheck, Glab, MessageId, SendProgress, SendReply, ThreadAdded, ThreadId, ThreadLine,
    ThreadList, ThreadStore,
};

use crate::ipc_error::{IpcError, blocking_reply};
use crate::range::RangeState;

fn locked(threads: &Mutex<ThreadStore>) -> MutexGuard<'_, ThreadStore> {
    threads.lock().unwrap_or_else(PoisonError::into_inner)
}

/// The send guard, or `SendRunning` while another send holds it.
fn send_guard(sending: &Mutex<()>) -> Result<MutexGuard<'_, ()>, IpcError> {
    match sending.try_lock() {
        Ok(guard) => Ok(guard),
        Err(TryLockError::Poisoned(poisoned)) => Ok(poisoned.into_inner()),
        Err(TryLockError::WouldBlock) => Err(IpcError::SendRunning),
    }
}

fn forward_progress(channel: &Channel<SendProgress>, progress: SendProgress) {
    if let Err(error) = channel.send(progress) {
        tracing::warn!(%error, "a send's progress did not reach the window");
    }
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
#[expect(
    clippy::unnecessary_wraps,
    reason = "every command answers a Result the window checks"
)]
pub(crate) fn list_threads(state: State<'_, RangeState>) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).list(&state.range))
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn add_thread(
    state: State<'_, RangeState>,
    file: RangeFileId,
    line: ThreadLine,
    text: String,
) -> Result<ThreadAdded, IpcError> {
    Ok(locked(&state.threads).add_thread(&state.range, file, line, &text)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn add_note(
    state: State<'_, RangeState>,
    thread: ThreadId,
    text: String,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).add_note(&state.range, thread, &text)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn queue_message(
    state: State<'_, RangeState>,
    message: MessageId,
    text: String,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).queue(&state.range, message, &text)?)
}

#[tauri::command]
#[specta::specta]
#[expect(clippy::needless_pass_by_value, reason = "tauri passes State by value")]
pub(crate) fn unqueue_message(
    state: State<'_, RangeState>,
    message: MessageId,
) -> Result<ThreadList, IpcError> {
    Ok(locked(&state.threads).unqueue(&state.range, message)?)
}

// The range comes from the window: tauri-macros 2.7 checks an async command with a borrowed
// argument such as `State<'_, _>` by an `unreachable!()` that clippy denies (command/wrapper.rs:222).
#[tauri::command]
#[specta::specta]
pub(crate) async fn check_gitlab<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<GitLabCheck, IpcError> {
    blocking_reply(move || {
        let state = window.state::<RangeState>();
        Ok(yamt_review::check_gitlab(
            &state.range,
            Glab::find().as_ref(),
        ))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn send_queue<R: Runtime>(
    window: WebviewWindow<R>,
    progress: Channel<SendProgress>,
) -> Result<SendReply, IpcError> {
    blocking_reply(move || {
        let state = window.state::<RangeState>();
        let _sending = send_guard(&state.sending)?;
        let forward = |done| forward_progress(&progress, done);
        let glab = Glab::find();
        Ok(yamt_review::send_queue(
            &state.range,
            glab.as_ref(),
            &state.threads,
            &forward,
        )?)
    })
    .await
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;

    use serde_json::{Value, json};
    use tauri::ipc::InvokeResponseBody;
    use yamt_review::Error;

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

    // Two sends at once would post the same queued messages twice.
    #[test]
    fn a_second_send_while_one_runs_answers_send_running() {
        let window = open_range_window();
        let state = window.webview.state::<RangeState>();
        let _running = send_guard(&state.sending).unwrap();

        let progress = Channel::new(|_| Ok(()));
        let second = tauri::async_runtime::block_on(send_queue(window.webview.clone(), progress));

        assert!(matches!(second, Err(IpcError::SendRunning)), "{second:?}");
    }

    #[test]
    fn a_send_guard_let_go_is_taken_again() {
        let sending = Mutex::new(());
        drop(send_guard(&sending).unwrap());
        assert!(send_guard(&sending).is_ok());
    }

    #[test]
    fn each_progress_reaches_the_window_s_channel() {
        let (sender, received) = mpsc::channel();
        let channel = Channel::new(move |body| {
            let InvokeResponseBody::Json(json) = body else {
                panic!("progress that is not JSON");
            };
            sender.send(json).unwrap();
            Ok(())
        });

        forward_progress(&channel, SendProgress { done: 2, of: 3 });

        let sent: Value = serde_json::from_str(&received.recv().unwrap()).unwrap();
        assert_eq!(sent, json!({ "done": 2, "of": 3 }));
    }

    fn review_json(error: Error) -> Value {
        serde_json::to_value(IpcError::from(error)).unwrap()
    }

    #[test]
    fn each_review_error_has_its_kind_and_a_write_failure_names_the_file() {
        let write_failed = Error::WriteFailed {
            path: "/d/threads.json".into(),
            message: "disk full".to_owned(),
        };
        assert_eq!(
            review_json(write_failed),
            json!({ "kind": "WriteFailed", "path": "/d/threads.json", "message": "disk full" })
        );
        assert_eq!(
            review_json(Error::UnknownFile {
                file: RangeFileId(4)
            }),
            json!({ "kind": "UnknownRangeFile", "file": 4 })
        );
        assert_eq!(
            review_json(Error::UnknownThread {
                thread: ThreadId(5)
            }),
            json!({ "kind": "UnknownThread", "thread": 5 })
        );
        assert_eq!(
            review_json(Error::UnknownMessage {
                message: MessageId(6)
            }),
            json!({ "kind": "UnknownMessage", "message": 6 })
        );
        assert_eq!(
            review_json(Error::EmptyMessage),
            json!({ "kind": "EmptyMessage" })
        );
        assert_eq!(
            review_json(Error::MessagePending {
                message: MessageId(7)
            }),
            json!({ "kind": "MessagePending", "message": 7 })
        );
        assert_eq!(
            serde_json::to_value(IpcError::SendRunning).unwrap(),
            json!({ "kind": "SendRunning" })
        );
    }

    #[test]
    fn a_start_only_review_error_is_its_line() {
        let newer = Error::NewerFormat {
            path: "/d/threads.json".into(),
            format: 2,
        };
        assert_eq!(
            review_json(newer),
            json!({
                "kind": "Git",
                "message": "the review threads /d/threads.json were written by a newer yamt (format 2)",
            })
        );
    }
}
