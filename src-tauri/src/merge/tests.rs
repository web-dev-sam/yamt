use std::thread::{self, ScopedJoinHandle};
use std::{fs, path::Path};

use serde_json::{Value, json};
use tauri::Manager;
use yamt_conflict_repo::{
    ConflictFile, FileKind, Run, STEP_TWO_FILE, edit_stop_repo, git, git_ok, install_hook,
    operation_repo,
};

use super::*;
use crate::mock_window::{CRLF_PATH, Window, invoke_on, open_window, open_window_in};
use crate::outcome::{Ending, Exit, ending_when_git_is_done};

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
const PICKED: &str = "picked.ts";
const RELEASE: &str = ".git/release";
const HOOK_WAITING_FOR_RELEASE: &str = "#!/bin/sh\ni=0\nwhile [ ! -e .git/release ] && [ $i -lt 200 ]; do sleep 0.05; i=$((i+1)); done\n";
const CLOSE_WAIT: Duration = Duration::from_millis(300);

impl Window {
    fn git_text(&self, args: &[&str]) -> String {
        String::from_utf8(git_ok(self.repo.path(), args).unwrap()).unwrap()
    }

    fn has_ended(&self) -> bool {
        lock(&self.app.state::<MergeState>()).has_ended()
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

fn ending(exit: Exit, message: &str) -> Ending {
    Ending {
        exit,
        message: Some(message.to_owned()),
    }
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

    let ended = window.ending();

    assert_eq!(ended, ending(Exit::Unresolved, "merge aborted"));
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

fn assert_step_listed(listed: &Value, step: u32) {
    let file = json!({ "path": STEP_TWO_FILE, "status": "Unresolved", "unsupported": null });
    assert_eq!(listed["kind"], "Files", "{listed}");
    assert_eq!(listed["files"], json!([file]), "{listed}");
    let progress = &listed["operation"]["progress"];
    assert_eq!(progress, &json!({ "step": step, "total": 3 }), "{listed}");
}

fn held_on_hook(window: &Window) {
    install_hook(
        window.repo.path(),
        "prepare-commit-msg",
        HOOK_WAITING_FOR_RELEASE,
    )
    .unwrap();
}

fn wait_until_git_runs(
    state: &MergeState,
    continuing: &ScopedJoinHandle<'_, Result<Value, Value>>,
) {
    while !continuing.is_finished() && !matches!(*lock(state), Merge::Running(_)) {
        thread::sleep(GIT_RUNNING_POLL);
    }
    assert!(!continuing.is_finished(), "git ran past the hook");
}

fn released(root: &Path) {
    fs::write(root.join(RELEASE), "").unwrap();
}

// A command run while git commits would read or write files git is rewriting for the next stop.
#[test]
fn while_git_runs_a_write_and_a_list_answer_git_running_and_the_next_stop_lands_as_moved_on() {
    let window = rebase_window();
    resolved_step(&window);
    held_on_hook(&window);
    let state = window.app.state::<MergeState>();
    let git_running = Err(json!({ "kind": "GitRunning" }));

    let reply = thread::scope(|scope| {
        let webview = &window.webview;
        let continuing = scope.spawn(move || invoke_on(webview, "continue_operation", json!({})));
        wait_until_git_runs(&state, &continuing);
        let save = json!({ "path": STEP_TWO_FILE, "text": "mine\n", "diskVersion": 0 });
        assert_eq!(window.invoke("save_file", save), git_running);
        assert_eq!(window.invoke("list_stop", json!({})), git_running);
        assert!(!continuing.is_finished(), "git ran past the hook");
        released(window.repo.path());
        continuing.join().unwrap()
    });

    assert_eq!(reply.unwrap()["kind"], "Stopped");
    assert!(matches!(*lock(&state), Merge::MovedOn { .. }));
}

// Closing mid-continue must not count the stop git is leaving, nor kill git.
#[test]
fn a_close_while_git_continues_waits_for_git_and_counts_the_stop_git_moved_on_to() {
    let window = rebase_window();
    resolved_step(&window);
    held_on_hook(&window);
    let state: &MergeState = &window.app.state::<MergeState>();

    let ended = thread::scope(|scope| {
        let webview = &window.webview;
        let continuing = scope.spawn(move || invoke_on(webview, "continue_operation", json!({})));
        wait_until_git_runs(state, &continuing);
        let closing = scope.spawn(move || ending_when_git_is_done(state));
        thread::sleep(CLOSE_WAIT);
        let waited = !closing.is_finished();
        released(window.repo.path());
        assert!(waited, "the ending did not wait for git");
        assert_eq!(continuing.join().unwrap().unwrap()["kind"], "Stopped");
        closing.join().unwrap()
    });

    assert_eq!(
        ended,
        ending(Exit::Unresolved, "1 of 1 files still unresolved")
    );
}

// Disk versions restart at every stop: a Save meant for step 1 would land on step 2's file.
#[test]
fn a_rebase_continued_stops_at_step_two_where_an_old_save_writes_nothing_then_finishes() {
    let window = rebase_window();
    resolved_step(&window);
    let file = window.repo.path().join(STEP_TWO_FILE);

    let stopped = window.invoke("continue_operation", json!({})).unwrap();

    assert_eq!(stopped["kind"], "Stopped", "{stopped}");
    let message = stopped["message"].as_str().unwrap();
    assert!(message.contains("CONFLICT"), "{message}");
    assert!(!window.has_ended());
    let at_step_two = fs::read(&file).unwrap();
    let save = json!({ "path": STEP_TWO_FILE, "text": "step 1's edit\n", "diskVersion": 0 });
    let moved_on = Err(json!({ "kind": "StopMovedOn" }));
    assert_eq!(window.invoke("save_file", save), moved_on);
    assert_eq!(window.invoke("list_files", json!({})), moved_on);
    assert_eq!(fs::read(&file).unwrap(), at_step_two);
    assert_step_listed(&window.invoke("list_stop", json!({})).unwrap(), 2);

    resolved_step(&window);
    let finished = window.invoke("continue_operation", json!({}));

    assert_eq!(finished, Ok(json!({ "kind": "Finished" })));
    assert!(window.has_ended());
    assert_eq!(window.ending(), ending(Exit::Success, "rebase finished"));
}

#[test]
fn a_continue_git_refuses_answers_git_s_text_and_keeps_the_stop_open() {
    let window = rebase_window();

    let refused = window.invoke("continue_operation", json!({})).unwrap_err();

    assert_eq!(refused["kind"], "Git", "{refused}");
    let message = refused["message"].as_str().unwrap();
    assert!(message.contains("git add"), "{message}");
    assert!(!window.has_ended());
    let save = json!({ "path": STEP_TWO_FILE, "text": "mine\n", "diskVersion": 0 });
    assert_eq!(window.invoke("save_file", save).unwrap()["kind"], "Written");
    assert_step_listed(&window.invoke("list_stop", json!({})).unwrap(), 1);
}

#[test]
fn a_worker_that_panics_leaves_moved_on_and_answers_a_git_error() {
    let repo = operation_repo(Run::Rebase, &STEPS).unwrap();
    let session = MergeSession::open(repo.path()).unwrap();
    let root = session.root().to_path_buf();
    let state: MergeState = Mutex::new(Merge::Held(Box::new(session)));
    let panicking = |_: &mut MergeSession| -> yamt_session::Result<()> { panic!("worker panic") };

    let answered = tauri::async_runtime::block_on(on_worker(&state, panicking));

    let Err(IpcError::Git { message }) = answered else {
        panic!("expected a Git error");
    };
    assert!(
        message.starts_with("yamt's worker stopped while git ran"),
        "{message}"
    );
    assert!(matches!(&*lock(&state), Merge::MovedOn { root: moved } if *moved == root));
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
    assert_step_listed(&window.invoke("list_stop", json!({})).unwrap(), 2);
}

// A pick at an `edit` stop: its continue leaves the rebase at the edit, a stop without conflicts.
#[test]
fn a_continue_that_moves_on_to_a_stop_without_conflicts_lists_no_files_under_the_rebase() {
    let picked = ConflictFile {
        path: PICKED,
        ..STEPS[0]
    };
    let repo = edit_stop_repo(&[picked]).unwrap();
    assert!(
        !git(repo.path(), &["cherry-pick", "local"])
            .unwrap()
            .status
            .success()
    );
    let window = open_window_in(repo);
    let args = json!({ "path": PICKED, "text": "picked\n", "diskVersion": 0 });
    window.invoke("finish_file", args).unwrap();

    let stopped = window.invoke("continue_operation", json!({})).unwrap();

    assert_eq!(stopped["kind"], "Stopped", "{stopped}");
    assert!(!window.has_ended());
    for _ in 0..2 {
        let listed = window.invoke("list_stop", json!({})).unwrap();
        assert_eq!(listed["kind"], "Files", "{listed}");
        assert_eq!(listed["files"], json!([]), "{listed}");
        assert_eq!(listed["operation"]["kind"], "Rebase", "{listed}");
    }
}

#[test]
fn a_rebase_aborted_answers_merge_aborted_to_every_command_and_ends_rebase_aborted() {
    let window = rebase_window();

    assert_eq!(window.invoke("abort_operation", json!({})), Ok(Value::Null));

    assert!(window.has_ended());
    for (command, args) in merge_commands() {
        assert_eq!(window.invoke(command, args), merge_aborted(), "{command}");
    }
    assert_eq!(
        window.git_text(&["rev-parse", "--abbrev-ref", "HEAD"]),
        "remote\n"
    );
    assert!(!window.repo.path().join(".git/rebase-merge").exists());
    assert_eq!(window.ending(), ending(Exit::Unresolved, "rebase aborted"));
}

#[test]
fn a_merge_continued_is_finished_every_command_answers_merge_finished_and_it_ends_with_zero() {
    let window = open_window();
    for path in [ADDED, CRLF_PATH, "view.vue"] {
        let args = json!({ "path": path, "text": "done\n", "diskVersion": 0 });
        window.invoke("finish_file", args).unwrap();
    }

    let finished = window.invoke("continue_operation", json!({}));

    assert_eq!(finished, Ok(json!({ "kind": "Finished" })));
    assert!(window.has_ended());
    let merge_finished = Err(json!({ "kind": "MergeFinished" }));
    for (command, args) in merge_commands() {
        assert_eq!(window.invoke(command, args), merge_finished, "{command}");
    }
    assert_eq!(
        window.git_text(&["rev-list", "--count", "--merges", "HEAD"]),
        "1\n"
    );
    assert_eq!(window.ending(), ending(Exit::Success, "merge finished"));
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
