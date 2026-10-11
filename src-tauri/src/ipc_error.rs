use yamt_session::UnsupportedReason;

const NOT_A_FILE: &str = "it is not a regular file";

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
    ReadFailed {
        path: String,
        message: String,
    },
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
            yamt_session::Error::NotAFile { path } => IpcError::WriteFailed {
                path,
                message: NOT_A_FILE.to_owned(),
            },
            yamt_session::Error::ReadFailed { path, source } => IpcError::ReadFailed {
                path,
                message: source.to_string(),
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
            json!({ "kind": "WriteFailed", "path": "a.ts", "message": "it is not a regular file" })
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
}
