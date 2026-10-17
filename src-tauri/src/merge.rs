use std::sync::{Mutex, MutexGuard, PoisonError};

use yamt_session::MergeSession;

use crate::ipc_error::IpcError;

/// The merge this run works on: held from the start until `git merge --abort` succeeds (plan §2 #74).
#[expect(
    clippy::large_enum_variant,
    reason = "one value per run, built once and kept in the app's state"
)]
pub(crate) enum Merge {
    Held(MergeSession),
    Aborted,
}

pub(crate) type MergeState = Mutex<Merge>;

pub(crate) fn lock(state: &MergeState) -> MutexGuard<'_, Merge> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

impl Merge {
    pub(crate) fn session(&mut self) -> Result<&mut MergeSession, IpcError> {
        match self {
            Merge::Held(session) => Ok(session),
            Merge::Aborted => Err(IpcError::MergeAborted),
        }
    }

    pub(crate) fn abort(&mut self) -> Result<(), IpcError> {
        self.session()?.abort_merge()?;
        *self = Merge::Aborted;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::{Value, json};
    use tauri::Manager;
    use yamt_conflict_repo::git_ok;

    use super::*;
    use crate::mock_window::{CRLF_PATH, Window, open_window};
    use crate::outcome::{Ending, Exit, ending_on_close};

    const ADDED: &str = "added.ts";
    const CRLF_AT_HEAD: &[u8] = b"a\r\nlocal\r\n";

    impl Window {
        fn ending(&self) -> Ending {
            ending_on_close(&mut lock(&self.app.state::<MergeState>()))
        }

        fn git_text(&self, args: &[&str]) -> String {
            String::from_utf8(git_ok(self.repo.path(), args).unwrap()).unwrap()
        }
    }

    fn merge_aborted() -> Result<Value, Value> {
        Err(json!({ "kind": "MergeAborted" }))
    }

    fn merge_commands() -> [(&'static str, Value); 9] {
        let path = json!({ "path": CRLF_PATH });
        let write = json!({ "path": CRLF_PATH, "text": "mine\r\n", "diskVersion": 0 });
        [
            ("list_files", json!({})),
            ("load_file", path.clone()),
            ("describe_file", path),
            ("finish_file", write.clone()),
            ("save_file", write),
            ("reset_file", json!({ "path": CRLF_PATH, "diskVersion": 0 })),
            (
                "take_side",
                json!({ "path": CRLF_PATH, "side": "remote", "diskVersion": 0 }),
            ),
            ("side_names", json!({})),
            ("abort_merge", json!({})),
        ]
    }

    #[test]
    fn after_an_abort_every_merge_command_answers_merge_aborted_and_writes_nothing() {
        let window = open_window();

        assert_eq!(window.invoke("abort_merge", json!({})), Ok(Value::Null));

        for (command, args) in merge_commands() {
            assert_eq!(window.invoke(command, args), merge_aborted(), "{command}");
        }
        assert_eq!(window.git_text(&["status", "--porcelain"]), "");
        assert_eq!(
            fs::read(window.repo.path().join(CRLF_PATH)).unwrap(),
            CRLF_AT_HEAD
        );
        assert!(window.invoke("servers_context", json!({})).is_ok());
    }

    #[test]
    fn the_ending_after_an_abort_is_status_one_and_stages_no_file_changed_since() {
        let window = open_window();
        window.invoke("abort_merge", json!({})).unwrap();
        fs::write(window.repo.path().join("view.vue"), "<d/>\n").unwrap();
        let index_before = window.git_text(&["ls-files", "-s"]);

        let ending = window.ending();

        let aborted = Ending {
            exit: Exit::Unresolved,
            message: Some("merge aborted".to_owned()),
        };
        assert_eq!(ending, aborted);
        assert_eq!(window.git_text(&["ls-files", "-s"]), index_before);
    }

    #[test]
    fn an_abort_git_refuses_answers_git_s_message_and_keeps_the_merge() {
        let window = open_window();
        let added = window.repo.path().join(ADDED);
        fs::write(&added, "resolved\n").unwrap();
        git_ok(window.repo.path(), &["add", "--", ADDED]).unwrap();
        fs::write(&added, "saved again\n").unwrap();
        let status_before = window.git_text(&["status", "--porcelain"]);

        let refused = window.invoke("abort_merge", json!({})).unwrap_err();

        assert_eq!(refused["kind"], "Git", "{refused}");
        let message = refused["message"].as_str().unwrap();
        assert!(
            message.contains("error: Entry 'added.ts' not uptodate. Cannot merge."),
            "{message}"
        );
        assert_eq!(window.git_text(&["status", "--porcelain"]), status_before);
        let listed = window.invoke("list_files", json!({})).unwrap();
        assert_eq!(listed["merging"], true, "{listed}");
        assert_eq!(
            window.ending().message.as_deref(),
            Some("2 of 3 files still unresolved")
        );
    }
}
