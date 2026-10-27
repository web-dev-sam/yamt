use yamt_compare::{MAX_COLUMN_BYTES, TabId};
use yamt_range::RangeFileId;
use yamt_review::{MessageId, ThreadId};
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
    UnknownThread {
        thread: ThreadId,
    },
    UnknownMessage {
        message: MessageId,
    },
    EmptyMessage,
    MessagePending {
        message: MessageId,
    },
    NotANote {
        message: MessageId,
    },
    SendRunning,
    AiOff,
    RemoveFailed {
        folder: String,
        message: String,
    },
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

impl From<yamt_review::Error> for IpcError {
    fn from(error: yamt_review::Error) -> IpcError {
        match error {
            yamt_review::Error::WriteFailed { path, message } => IpcError::WriteFailed {
                path: path.display().to_string(),
                message,
            },
            yamt_review::Error::UnknownFile { file } => IpcError::UnknownRangeFile { file },
            yamt_review::Error::UnknownThread { thread } => IpcError::UnknownThread { thread },
            yamt_review::Error::UnknownMessage { message } => IpcError::UnknownMessage { message },
            yamt_review::Error::EmptyMessage => IpcError::EmptyMessage,
            yamt_review::Error::MessagePending { message } => IpcError::MessagePending { message },
            yamt_review::Error::NotANote { message } => IpcError::NotANote { message },
            yamt_review::Error::ReadFailed { .. }
            | yamt_review::Error::Broken { .. }
            | yamt_review::Error::NewerFormat { .. } => IpcError::Git {
                message: error.to_string(),
            },
        }
    }
}

impl From<yamt_agent::Error> for IpcError {
    fn from(error: yamt_agent::Error) -> IpcError {
        match error {
            yamt_agent::Error::Remove { folder, source }
            | yamt_agent::Error::Rename {
                from: folder,
                source,
                ..
            } => IpcError::RemoveFailed {
                folder: folder.display().to_string(),
                message: source.to_string(),
            },
            yamt_agent::Error::Git(source) => IpcError::Git {
                message: source.to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests;
