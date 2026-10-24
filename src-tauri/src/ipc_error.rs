use yamt_compare::{MAX_COLUMN_BYTES, TabId};
use yamt_range::RangeFileId;
use yamt_session::UnsupportedReason;

#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum IpcError {
    Git {
        message: String,
    },
    UnknownPath {
        path: String,
    },
    Unsupported {
        path: String,
        reason: UnsupportedReason,
    },
    WriteFailed {
        path: String,
        message: String,
    },
    NotAFile {
        path: String,
    },
    ReadFailed {
        path: String,
        message: String,
    },
    SettingsBroken {
        path: String,
        message: String,
    },
    NotAbsolute {
        path: String,
    },
    NoConfigFolder,
    MergeAborted,
    StopMovedOn,
    GitRunning,
    MergeFinished,
    NoOperation,
    UnknownTab {
        tab: TabId,
    },
    ColumnTooLarge {
        limit: u32,
    },
    UnknownRangeFile {
        file: RangeFileId,
    },
    WorkerStopped,
}

/// Runs `work` on a blocking worker; a worker that panicked is logged and answers `WorkerStopped`.
pub(crate) async fn blocking_reply<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, IpcError> + Send + 'static,
) -> Result<T, IpcError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .unwrap_or_else(|error| {
            tracing::error!(%error, "yamt's worker stopped");
            Err(IpcError::WorkerStopped)
        })
}

impl From<yamt_session::Error> for IpcError {
    fn from(error: yamt_session::Error) -> IpcError {
        match error {
            yamt_session::Error::Git(source) => IpcError::Git {
                message: source.to_string(),
            },
            yamt_session::Error::UnknownPath { path } => IpcError::UnknownPath { path },
            yamt_session::Error::Unsupported { path, reason } => {
                IpcError::Unsupported { path, reason }
            }
            yamt_session::Error::WriteFailed { path, source } => IpcError::WriteFailed {
                path,
                message: source.to_string(),
            },
            yamt_session::Error::NotAFile { path } => IpcError::NotAFile { path },
            yamt_session::Error::ReadFailed { path, source } => IpcError::ReadFailed {
                path,
                message: source.to_string(),
            },
            yamt_session::Error::NoOperation => IpcError::NoOperation,
            yamt_session::Error::StopMovedOn => IpcError::StopMovedOn,
            yamt_session::Error::GitRefused { message } => IpcError::Git { message },
        }
    }
}

impl From<yamt_settings::Error> for IpcError {
    fn from(error: yamt_settings::Error) -> IpcError {
        match error {
            yamt_settings::Error::ReadFailed { path, message } => IpcError::ReadFailed {
                path: path.display().to_string(),
                message,
            },
            yamt_settings::Error::Broken { path, message } => IpcError::SettingsBroken {
                path: path.display().to_string(),
                message,
            },
            yamt_settings::Error::WriteFailed { path, message } => IpcError::WriteFailed {
                path: path.display().to_string(),
                message,
            },
            yamt_settings::Error::NotAbsolute { path } => IpcError::NotAbsolute { path },
        }
    }
}

impl From<yamt_compare::Error> for IpcError {
    fn from(error: yamt_compare::Error) -> IpcError {
        match error {
            yamt_compare::Error::ReadFailed { path, message }
            | yamt_compare::Error::Broken { path, message } => IpcError::ReadFailed {
                path: path.display().to_string(),
                message,
            },
            yamt_compare::Error::Locked { path } => IpcError::ReadFailed {
                path: path.display().to_string(),
                message: "another yamt --diff window holds it".to_owned(),
            },
            yamt_compare::Error::NewerFormat { path, format } => IpcError::ReadFailed {
                path: path.display().to_string(),
                message: format!("written by a newer yamt (format {format})"),
            },
            yamt_compare::Error::WriteFailed { path, message } => IpcError::WriteFailed {
                path: path.display().to_string(),
                message,
            },
            yamt_compare::Error::UnknownTab { tab } => IpcError::UnknownTab { tab },
            yamt_compare::Error::TooLarge { .. } => IpcError::ColumnTooLarge {
                limit: MAX_COLUMN_BYTES,
            },
        }
    }
}

impl From<yamt_range::Error> for IpcError {
    fn from(error: yamt_range::Error) -> IpcError {
        match error {
            yamt_range::Error::UnknownFile { file } => IpcError::UnknownRangeFile { file },
            yamt_range::Error::Git(source) => IpcError::Git {
                message: source.to_string(),
            },
            yamt_range::Error::NotARepository { .. }
            | yamt_range::Error::UnknownName { .. }
            | yamt_range::Error::NoMergeBase { .. }
            | yamt_range::Error::Locked { .. }
            | yamt_range::Error::LockFailed { .. } => IpcError::Git {
                message: error.to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
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

    #[test]
    fn a_worker_that_panics_answers_worker_stopped() {
        let answered =
            tauri::async_runtime::block_on(blocking_reply(|| -> Result<(), IpcError> {
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
}
