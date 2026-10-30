use serde_json::{Value, json};
use yamt_conflict_repo::TempDir;
use yamt_session::MergeSession;

use super::*;

fn ipc_json(error: yamt_session::Error) -> Value {
    serde_json::to_value(IpcError::from(error)).unwrap()
}

#[test]
fn a_git_error_serialises_with_git_s_message() {
    let plain_dir = TempDir::new().unwrap();
    let Err(git_error) = MergeSession::open(plain_dir.path()) else {
        panic!("a plain directory opened as a merge");
    };
    let git_json = ipc_json(git_error);
    assert_eq!(git_json["kind"], "Git");
    assert!(
        git_json["message"]
            .as_str()
            .unwrap()
            .contains("not a git repository"),
        "{git_json}"
    );
}

#[test]
fn every_other_session_error_serialises_with_its_kind_and_fields() {
    let unsupported = yamt_session::Error::Unsupported {
        path: "logo.png".to_owned(),
        reason: UnsupportedReason::Binary,
    };
    assert_eq!(
        ipc_json(unsupported),
        json!({ "kind": "Unsupported", "path": "logo.png", "reason": "Binary" })
    );
    let write_failed = yamt_session::Error::WriteFailed {
        path: "a.ts".to_owned(),
        source: std::io::Error::other("disk full"),
    };
    assert_eq!(
        ipc_json(write_failed),
        json!({ "kind": "WriteFailed", "path": "a.ts", "message": "disk full" })
    );
    let not_a_file = yamt_session::Error::NotAFile {
        path: "a.ts".to_owned(),
    };
    assert_eq!(
        ipc_json(not_a_file),
        json!({ "kind": "NotAFile", "path": "a.ts" })
    );
    let read_failed = yamt_session::Error::ReadFailed {
        path: "a.ts".to_owned(),
        source: std::io::Error::other("permission denied"),
    };
    assert_eq!(
        ipc_json(read_failed),
        json!({ "kind": "ReadFailed", "path": "a.ts", "message": "permission denied" })
    );
}

// A refusal read as "git refused: …" would say it twice under the window's "Could not continue".
#[test]
fn operation_errors_have_their_own_kinds_and_git_s_refusal_is_git_s_text() {
    assert_eq!(
        ipc_json(yamt_session::Error::NoOperation),
        json!({ "kind": "NoOperation" })
    );
    assert_eq!(
        ipc_json(yamt_session::Error::StopMovedOn),
        json!({ "kind": "StopMovedOn" })
    );
    let message = "error: commit is not possible because you have unmerged files.";
    let refused = yamt_session::Error::GitRefused {
        message: message.to_owned(),
    };
    assert_eq!(
        ipc_json(refused),
        json!({ "kind": "Git", "message": message })
    );
}

#[test]
fn settings_errors_serialise_with_their_kind_and_fields() {
    let settings_json = |error| serde_json::to_value(IpcError::from(error)).unwrap();
    let broken = yamt_settings::Error::Broken {
        path: "/c/yamt/settings.json".into(),
        message: "trailing comma at line 3 column 1".to_owned(),
    };
    assert_eq!(
        settings_json(broken),
        json!({
            "kind": "SettingsBroken",
            "path": "/c/yamt/settings.json",
            "message": "trailing comma at line 3 column 1",
        })
    );
    let not_absolute = yamt_settings::Error::NotAbsolute {
        path: "s.json".to_owned(),
    };
    assert_eq!(
        settings_json(not_absolute),
        json!({ "kind": "NotAbsolute", "path": "s.json" })
    );
    let read_failed = yamt_settings::Error::ReadFailed {
        path: "/c/yamt/settings-location".into(),
        message: "is a directory".to_owned(),
    };
    assert_eq!(
        settings_json(read_failed),
        json!({ "kind": "ReadFailed", "path": "/c/yamt/settings-location", "message": "is a directory" })
    );
    let write_failed = yamt_settings::Error::WriteFailed {
        path: "/locked/s.json".into(),
        message: "permission denied".to_owned(),
    };
    assert_eq!(
        settings_json(write_failed),
        json!({ "kind": "WriteFailed", "path": "/locked/s.json", "message": "permission denied" })
    );
    assert_eq!(
        serde_json::to_value(IpcError::NoConfigFolder).unwrap(),
        json!({ "kind": "NoConfigFolder" })
    );
}

fn compare_json(error: yamt_compare::Error) -> Value {
    serde_json::to_value(IpcError::from(error)).unwrap()
}

#[test]
fn compare_store_problems_serialise_as_read_failures_naming_the_file() {
    let locked = yamt_compare::Error::Locked {
        path: "/d/yamt/compare".into(),
    };
    assert_eq!(
        compare_json(locked),
        json!({ "kind": "ReadFailed", "path": "/d/yamt/compare", "message": "another yamt --diff window holds it" })
    );
    let newer = yamt_compare::Error::NewerFormat {
        path: "/d/tabs.json".into(),
        format: 2,
    };
    assert_eq!(
        compare_json(newer),
        json!({ "kind": "ReadFailed", "path": "/d/tabs.json", "message": "written by a newer yamt (format 2)" })
    );
    let broken = yamt_compare::Error::Broken {
        path: "/d/tabs.json".into(),
        message: "`tabs` is empty".to_owned(),
    };
    assert_eq!(
        compare_json(broken),
        json!({ "kind": "ReadFailed", "path": "/d/tabs.json", "message": "`tabs` is empty" })
    );
}

#[test]
fn compare_write_tab_and_size_errors_serialise_with_their_kinds() {
    let write_failed = yamt_compare::Error::WriteFailed {
        path: "/d/1-left.txt".into(),
        message: "disk full".to_owned(),
    };
    assert_eq!(
        compare_json(write_failed),
        json!({ "kind": "WriteFailed", "path": "/d/1-left.txt", "message": "disk full" })
    );
    let too_large = yamt_compare::Error::TooLarge { bytes: 9_000_000 };
    assert_eq!(
        compare_json(too_large),
        json!({ "kind": "ColumnTooLarge", "limit": MAX_COLUMN_BYTES })
    );
    assert_eq!(
        compare_json(yamt_compare::Error::UnknownTab { tab: TabId(7) }),
        json!({ "kind": "UnknownTab", "tab": 7 })
    );
}

fn range_json(error: yamt_range::Error) -> Value {
    serde_json::to_value(IpcError::from(error)).unwrap()
}

#[test]
fn an_unknown_range_file_has_its_kind_and_a_start_refusal_is_its_line() {
    let unknown = yamt_range::Error::UnknownFile {
        file: RangeFileId(9),
    };
    assert_eq!(
        range_json(unknown),
        json!({ "kind": "UnknownRangeFile", "file": 9 })
    );
    let no_base = yamt_range::Error::NoMergeBase {
        left: "main".to_owned(),
        right: "other".to_owned(),
    };
    assert_eq!(
        range_json(no_base),
        json!({ "kind": "Git", "message": "main and other have no merge base" })
    );
}

fn review_json(error: yamt_review::Error) -> Value {
    serde_json::to_value(IpcError::from(error)).unwrap()
}

#[test]
fn each_review_error_has_its_kind_and_a_write_failure_names_the_file() {
    let write_failed = yamt_review::Error::WriteFailed {
        path: "/d/threads.json".into(),
        message: "disk full".to_owned(),
    };
    assert_eq!(
        review_json(write_failed),
        json!({ "kind": "WriteFailed", "path": "/d/threads.json", "message": "disk full" })
    );
    assert_eq!(
        review_json(yamt_review::Error::UnknownFile {
            file: RangeFileId(4)
        }),
        json!({ "kind": "UnknownRangeFile", "file": 4 })
    );
    assert_eq!(
        review_json(yamt_review::Error::UnknownThread {
            thread: ThreadId(5)
        }),
        json!({ "kind": "UnknownThread", "thread": 5 })
    );
    assert_eq!(
        review_json(yamt_review::Error::UnknownMessage {
            message: MessageId(6)
        }),
        json!({ "kind": "UnknownMessage", "message": 6 })
    );
    assert_eq!(
        review_json(yamt_review::Error::EmptyMessage),
        json!({ "kind": "EmptyMessage" })
    );
    assert_eq!(
        review_json(yamt_review::Error::MessagePending {
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
fn an_ai_answer_refused_as_a_note_has_its_kind_and_message() {
    assert_eq!(
        review_json(yamt_review::Error::NotANote {
            message: MessageId(8)
        }),
        json!({ "kind": "NotANote", "message": 8 })
    );
}

#[test]
fn a_start_only_review_error_is_its_line() {
    let newer = yamt_review::Error::NewerFormat {
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

// The window's close shows the folder it could not remove, so the user can remove it by hand.
#[test]
fn ai_off_and_a_failed_removal_serialise_with_their_kinds() {
    assert_eq!(
        serde_json::to_value(IpcError::AiOff).unwrap(),
        json!({ "kind": "AiOff" })
    );
    let agent_json = |error| serde_json::to_value(IpcError::from(error)).unwrap();
    let remove = yamt_agent::Error::Remove {
        folder: "/d/pair/checkout.removing".into(),
        source: std::io::Error::other("busy"),
    };
    assert_eq!(
        agent_json(remove),
        json!({ "kind": "RemoveFailed", "folder": "/d/pair/checkout.removing", "message": "busy" })
    );
    let rename = yamt_agent::Error::Rename {
        from: "/d/pair/checkout".into(),
        to: "/d/pair/checkout.removing".into(),
        source: std::io::Error::other("permission denied"),
    };
    assert_eq!(
        agent_json(rename),
        json!({ "kind": "RemoveFailed", "folder": "/d/pair/checkout", "message": "permission denied" })
    );
}

#[test]
fn a_local_merge_error_is_git_s_message_or_the_lock_that_failed() {
    let plain_dir = TempDir::new().unwrap();
    let Err(git_error) = yamt_local_merge::find_live(plain_dir.path()) else {
        panic!("a plain directory had a recorded merge");
    };
    let git_json = serde_json::to_value(IpcError::from(git_error)).unwrap();
    assert_eq!(git_json["kind"], "Git");
    let message = git_json["message"].as_str().unwrap();
    assert!(message.contains("not a git repository"), "{git_json}");
    let lock_failed = yamt_local_merge::Error::LockFailed {
        path: "/r/.git/yamt-merge-window.lock".into(),
        source: std::io::Error::other("busy"),
    };
    assert_eq!(
        serde_json::to_value(IpcError::from(lock_failed)).unwrap(),
        json!({ "kind": "Git", "message": "cannot lock /r/.git/yamt-merge-window.lock: busy" })
    );
}

#[test]
fn a_worker_that_panics_answers_worker_stopped() {
    let answered = tauri::async_runtime::block_on(blocking_reply(|| -> Result<(), IpcError> {
        panic!("worker panic")
    }))
    .err();
    assert!(
        matches!(answered, Some(IpcError::WorkerStopped)),
        "{answered:?}"
    );
}

#[test]
fn a_worker_s_own_answer_is_the_reply() {
    let answered = tauri::async_runtime::block_on(blocking_reply(|| Ok(7)));
    assert!(matches!(answered, Ok(7)), "{answered:?}");
    let refused = tauri::async_runtime::block_on(blocking_reply(|| -> Result<(), IpcError> {
        Err(IpcError::NoOperation)
    }));
    assert!(matches!(refused, Err(IpcError::NoOperation)), "{refused:?}");
}
