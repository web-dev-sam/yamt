use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

use yamt_session::{
    Continued, DiskChange, FileEntry, MergeSession, OperationKind, OperationView, Refreshed,
    SideNames,
};

use crate::ipc_error::IpcError;

const GIT_RUNNING_POLL: Duration = Duration::from_millis(50);

/// The stop this run works on (plan §2 #74, #88, #89).
pub(crate) enum Merge {
    Held(Box<MergeSession>),
    /// git aborts or continues; the session is with the worker.
    Running(OperationKind),
    /// git moved on to another stop: the old session is dropped; the next list opens the new one.
    MovedOn {
        root: PathBuf,
    },
    Aborted(OperationKind),
    Finished(OperationKind),
}

pub(crate) type MergeState = Mutex<Merge>;

/// The files of the stop as git sees them, or `MovedOn`: git is at another stop, the next list opens it.
#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind")]
#[expect(
    clippy::large_enum_variant,
    reason = "one value per list, returned and serialized at once; never stored"
)]
pub enum Listing {
    Files {
        files: Vec<FileEntry>,
        disk_changes: Vec<DiskChange>,
        operation: Option<OperationView>,
        sides: SideNames,
    },
    MovedOn,
}

/// What a Continue git accepted led to: the operation ended, or git stopped at another stop.
#[derive(Debug, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum ContinueReply {
    Finished,
    Stopped { message: String },
}

pub(crate) fn lock(state: &MergeState) -> MutexGuard<'_, Merge> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

/// The merge once no worker runs git: a close waits for git rather than killing it.
pub(crate) fn lock_when_git_is_done(state: &MergeState) -> MutexGuard<'_, Merge> {
    loop {
        let merge = lock(state);
        if !matches!(*merge, Merge::Running(_)) {
            return merge;
        }
        drop(merge);
        thread::sleep(GIT_RUNNING_POLL);
    }
}

impl Merge {
    pub(crate) fn session(&mut self) -> Result<&mut MergeSession, IpcError> {
        match self {
            Merge::Held(session) => Ok(session),
            Merge::Running(_) => Err(IpcError::GitRunning),
            Merge::MovedOn { .. } => Err(IpcError::StopMovedOn),
            Merge::Aborted(_) => Err(IpcError::MergeAborted),
            Merge::Finished(_) => Err(IpcError::MergeFinished),
        }
    }

    pub(crate) fn abort(&mut self) -> Result<(), IpcError> {
        self.session()?.abort_merge()?;
        *self = Merge::Aborted(OperationKind::Merge);
        Ok(())
    }

    /// After a move, opens the new stop first; a list that finds git moved on drops the session.
    pub(crate) fn list_stop(&mut self) -> Result<Listing, IpcError> {
        if let Merge::MovedOn { root } = self {
            *self = Merge::Held(Box::new(MergeSession::open(root)?));
        }
        let session = self.session()?;
        match session.refresh_stop()? {
            Refreshed::Files(list) => Ok(Listing::Files {
                files: list.files,
                disk_changes: list.disk_changes,
                operation: list.operation,
                sides: list.sides,
            }),
            Refreshed::MovedOn => {
                let root = session.root().to_path_buf();
                *self = Merge::MovedOn { root };
                Ok(Listing::MovedOn)
            }
        }
    }

    fn hand_to_worker(&mut self) -> Result<Box<MergeSession>, IpcError> {
        let kind = self
            .session()?
            .operation_kind()
            .ok_or(IpcError::NoOperation)?;
        match std::mem::replace(self, Merge::Running(kind)) {
            Merge::Held(session) => Ok(session),
            other @ (Merge::Running(_)
            | Merge::MovedOn { .. }
            | Merge::Aborted(_)
            | Merge::Finished(_)) => {
                *self = other;
                Err(IpcError::GitRunning)
            }
        }
    }
}

/// Runs `work` on a blocking worker while the merge is `Running`. git's refusal puts the session
/// back; a worker that panicked leaves `MovedOn`, so the next list opens the stop git is at.
async fn on_worker<T, F>(state: &MergeState, work: F) -> Result<(Box<MergeSession>, T), IpcError>
where
    T: Send + 'static,
    F: FnOnce(&mut MergeSession) -> yamt_session::Result<T> + Send + 'static,
{
    let mut session = lock(state).hand_to_worker()?;
    let root = session.root().to_path_buf();
    let worker = tauri::async_runtime::spawn_blocking(move || {
        let result = work(&mut session);
        (session, result)
    });
    match worker.await {
        Ok((session, Ok(value))) => Ok((session, value)),
        Ok((session, Err(error))) => {
            *lock(state) = Merge::Held(session);
            Err(error.into())
        }
        Err(error) => {
            *lock(state) = Merge::MovedOn { root };
            Err(IpcError::Git {
                message: format!("yamt's worker stopped while git ran: {error}"),
            })
        }
    }
}

/// git's abort of the operation (plan §2 #88); `Aborted` only after git succeeded.
pub(crate) async fn abort_operation(state: &MergeState) -> Result<(), IpcError> {
    let (_session, kind) = on_worker(state, MergeSession::abort_operation).await?;
    *lock(state) = Merge::Aborted(kind);
    Ok(())
}

/// git's continue (plan §2 #89): finished, or stopped at another stop (`MovedOn`).
pub(crate) async fn continue_operation(state: &MergeState) -> Result<ContinueReply, IpcError> {
    let (session, continued) = on_worker(state, MergeSession::continue_operation).await?;
    let mut merge = lock(state);
    match continued {
        Continued::Finished { kind, output } => {
            tracing::info!(%output, "git finished the operation");
            *merge = Merge::Finished(kind);
            Ok(ContinueReply::Finished)
        }
        Continued::Stopped { message } => {
            let root = session.root().to_path_buf();
            *merge = Merge::MovedOn { root };
            Ok(ContinueReply::Stopped { message })
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, thread};

    use serde_json::{Value, json};
    use tauri::Manager;
    use yamt_conflict_repo::{
        ConflictFile, FileKind, Run, STEP_TWO_FILE, git, git_ok, install_hook, operation_repo,
    };

    use super::*;
    use crate::mock_window::{CRLF_PATH, Window, invoke_on, open_window, open_window_in};
    use crate::outcome::{Ending, Exit, ending_on_close};

    const ADDED: &str = "added.ts";
    const CRLF_AT_HEAD: &[u8] = b"a\r\nlocal\r\n";
    /// Conflicts at step 1 and, whatever it was resolved to, again at step 2 of the rebase.
    const STEPS: [ConflictFile<'static>; 1] = [ConflictFile {
        path: STEP_TWO_FILE,
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(b"local-1\n"),
        remote: Some(b"remote-1\n"),
    }];
    const RELEASE: &str = ".git/release";
    const HOOK_WAITING_FOR_RELEASE: &str = "#!/bin/sh\ni=0\nwhile [ ! -e .git/release ] && [ $i -lt 200 ]; do sleep 0.05; i=$((i+1)); done\n";

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

    fn merge_commands() -> [(&'static str, Value); 12] {
        let path = json!({ "path": CRLF_PATH });
        let write = json!({ "path": CRLF_PATH, "text": "mine\r\n", "diskVersion": 0 });
        [
            ("list_files", json!({})),
            ("list_stop", json!({})),
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
            ("continue_operation", json!({})),
            ("abort_operation", json!({})),
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

    fn rebase_window() -> Window {
        open_window_in(operation_repo(Run::Rebase, &STEPS).unwrap())
    }

    fn resolved_step(window: &Window) {
        let args = json!({ "path": STEP_TWO_FILE, "text": "resolved\n", "diskVersion": 0 });
        let written = window.invoke("finish_file", args).unwrap();
        assert_eq!(written["kind"], "Written", "{written}");
    }

    fn assert_step_two_listed(listed: &Value) {
        let file = json!({ "path": STEP_TWO_FILE, "status": "Unresolved", "unsupported": null });
        assert_eq!(listed["kind"], "Files", "{listed}");
        assert_eq!(listed["files"], json!([file]), "{listed}");
        let progress = &listed["operation"]["progress"];
        assert_eq!(progress, &json!({ "step": 2, "total": 3 }), "{listed}");
    }

    // A command run while git commits would read or write files git is rewriting for the next stop.
    #[test]
    fn while_git_runs_a_write_and_a_list_answer_git_running_and_the_next_stop_lands_as_moved_on() {
        let window = rebase_window();
        resolved_step(&window);
        install_hook(
            window.repo.path(),
            "prepare-commit-msg",
            HOOK_WAITING_FOR_RELEASE,
        )
        .unwrap();
        let state = window.app.state::<MergeState>();
        let git_running = Err(json!({ "kind": "GitRunning" }));

        let reply = thread::scope(|scope| {
            let webview = &window.webview;
            let continuing =
                scope.spawn(move || invoke_on(webview, "continue_operation", json!({})));
            while !continuing.is_finished() && !matches!(*lock(&state), Merge::Running(_)) {
                thread::sleep(GIT_RUNNING_POLL);
            }
            let save = json!({ "path": STEP_TWO_FILE, "text": "mine\n", "diskVersion": 0 });
            assert_eq!(window.invoke("save_file", save), git_running);
            assert_eq!(window.invoke("list_stop", json!({})), git_running);
            assert!(!continuing.is_finished(), "git ran past the hook");
            fs::write(window.repo.path().join(RELEASE), "").unwrap();
            continuing.join().unwrap()
        });

        assert_eq!(reply.unwrap()["kind"], "Stopped");
        assert!(matches!(*lock(&state), Merge::MovedOn { .. }));
    }

    // Disk versions restart at every stop: a Save meant for step 1 would land on step 2's file.
    #[test]
    fn after_a_continue_stops_again_an_old_save_writes_nothing_and_the_next_list_is_step_two() {
        let window = rebase_window();
        resolved_step(&window);
        let file = window.repo.path().join(STEP_TWO_FILE);

        let stopped = window.invoke("continue_operation", json!({})).unwrap();

        assert_eq!(stopped["kind"], "Stopped", "{stopped}");
        let message = stopped["message"].as_str().unwrap();
        assert!(message.contains("CONFLICT"), "{message}");
        let at_step_two = fs::read(&file).unwrap();
        let save = json!({ "path": STEP_TWO_FILE, "text": "step 1's edit\n", "diskVersion": 0 });
        let moved_on = Err(json!({ "kind": "StopMovedOn" }));
        assert_eq!(window.invoke("save_file", save), moved_on);
        assert_eq!(window.invoke("list_files", json!({})), moved_on);
        assert_eq!(fs::read(&file).unwrap(), at_step_two);
        assert_step_two_listed(&window.invoke("list_stop", json!({})).unwrap());
    }

    #[test]
    fn a_list_after_a_terminal_rebase_continue_is_moved_on_and_the_next_one_lists_the_new_stop() {
        let window = rebase_window();
        let root = window.repo.path();
        fs::write(root.join(STEP_TWO_FILE), "resolved\n").unwrap();
        git_ok(root, &["add", "--", STEP_TWO_FILE]).unwrap();
        assert!(
            !git(root, &["rebase", "--continue"])
                .unwrap()
                .status
                .success()
        );

        let moved_on = window.invoke("list_stop", json!({}));

        assert_eq!(moved_on, Ok(json!({ "kind": "MovedOn" })));
        let load = json!({ "path": STEP_TWO_FILE });
        assert_eq!(
            window.invoke("load_file", load),
            Err(json!({ "kind": "StopMovedOn" }))
        );
        assert_step_two_listed(&window.invoke("list_stop", json!({})).unwrap());
    }

    #[test]
    fn a_rebase_aborted_answers_merge_aborted_to_every_command_and_ends_rebase_aborted() {
        let window = rebase_window();

        assert_eq!(window.invoke("abort_operation", json!({})), Ok(Value::Null));

        for (command, args) in merge_commands() {
            assert_eq!(window.invoke(command, args), merge_aborted(), "{command}");
        }
        assert_eq!(
            window.git_text(&["rev-parse", "--abbrev-ref", "HEAD"]),
            "remote\n"
        );
        assert!(!window.repo.path().join(".git/rebase-merge").exists());
        let aborted = Ending {
            exit: Exit::Unresolved,
            message: Some("rebase aborted".to_owned()),
        };
        assert_eq!(window.ending(), aborted);
    }

    #[test]
    fn a_merge_continued_is_finished_every_command_answers_merge_finished_and_it_ends_with_zero() {
        let window = open_window();
        for path in ["added.ts", CRLF_PATH, "view.vue"] {
            let args = json!({ "path": path, "text": "done\n", "diskVersion": 0 });
            window.invoke("finish_file", args).unwrap();
        }

        let finished = window.invoke("continue_operation", json!({}));

        assert_eq!(finished, Ok(json!({ "kind": "Finished" })));
        let merge_finished = Err(json!({ "kind": "MergeFinished" }));
        for (command, args) in merge_commands() {
            assert_eq!(window.invoke(command, args), merge_finished, "{command}");
        }
        assert_eq!(
            window.git_text(&["rev-list", "--count", "--merges", "HEAD"]),
            "1\n"
        );
        let ending = Ending {
            exit: Exit::Success,
            message: Some("merge finished".to_owned()),
        };
        assert_eq!(window.ending(), ending);
    }

    #[test]
    fn continue_and_abort_at_a_stop_git_records_no_operation_for_answer_no_operation() {
        let window = open_window_in(operation_repo(Run::StashPop, &STEPS).unwrap());
        let no_operation = Err(json!({ "kind": "NoOperation" }));

        assert_eq!(window.invoke("continue_operation", json!({})), no_operation);
        assert_eq!(window.invoke("abort_operation", json!({})), no_operation);

        assert_eq!(
            window.invoke("list_stop", json!({})).unwrap()["operation"],
            Value::Null
        );
    }
}
