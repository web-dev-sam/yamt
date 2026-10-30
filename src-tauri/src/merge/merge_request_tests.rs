use std::fs;
use std::path::Path;
use std::process::Command;

use serde_json::{Value, json};
use tauri::Manager;
use yamt_conflict_repo::{TempDir, git_ok};
use yamt_local_merge::{MergeRequestBranches, claim_window};

use super::*;
use crate::mock_window::{Window, open_window, open_window_in};
use crate::outcome::{Ending, Exit, Startup, startup};

const IID: u32 = 21;
const DUE_DATES: &str = "feature/due-dates";
const CLEAN: &str = "feature/clean";
const CARD: &str = "src/board/card.ts";
const GITLAB: &str = ".git/fake-gitlab.git";
const RECORD: &str = ".git/yamt-merge-request.json";

/// `scripts/mr-conflict-repo.sh`'s repository, on `develop`.
fn mr_conflict_repo() -> TempDir {
    let repo = TempDir::new().unwrap();
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../scripts/mr-conflict-repo.sh");
    let built = Command::new(script).arg(repo.path()).output().unwrap();
    assert!(built.status.success(), "{built:?}");
    repo
}

/// Merge request !21 of `branch` into `main` started in `repo` as the page's Resolve starts it.
fn start_merge(repo: &TempDir, branch: &str) {
    let branches = MergeRequestBranches {
        iid: IID,
        remote: "origin".to_owned(),
        branch: branch.to_owned(),
        target: "main".to_owned(),
    };
    yamt_local_merge::start(repo.path(), &branches).unwrap();
}

fn window_on_started(branch: &str) -> Window {
    let repo = mr_conflict_repo();
    start_merge(&repo, branch);
    open_window_in(repo)
}

fn git_line(root: &Path, args: &[&str]) -> String {
    let output = git_ok(root, args).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

fn merge_has_ended(window: &Window) -> bool {
    lock(&window.app.state::<MergeState>()).has_ended()
}

fn finished(message: &str) -> Ending {
    Ending {
        exit: Exit::Success,
        message: Some(message.to_owned()),
    }
}

/// A clean merge yamt started, committed by the window's Continue.
fn committed_clean_merge() -> Window {
    let window = window_on_started(CLEAN);
    let continued = window.invoke("continue_operation", json!({}));
    assert_eq!(
        continued,
        Ok(json!({ "kind": "ReadyToPush", "branch": CLEAN }))
    );
    window
}

#[test]
fn list_names_the_recorded_merge() {
    let window = window_on_started(DUE_DATES);

    let listed = window.invoke("list_stop", json!({})).unwrap();

    let view = json!({
        "branch": DUE_DATES,
        "target": "main",
        "returnTo": { "kind": "branch", "name": "develop" },
        "branchBefore": { "kind": "created" },
    });
    assert_eq!(listed["merge_request"], view, "{listed}");
    let users_own = open_window().invoke("list_stop", json!({})).unwrap();
    assert_eq!(users_own["merge_request"], Value::Null, "{users_own}");
}

#[test]
fn abort_of_a_merge_yamt_started_restores_and_closes() {
    let window = window_on_started(DUE_DATES);
    let root = window.repo.path();

    let aborted = window.invoke("abort_operation", json!({}));

    assert_eq!(aborted, Ok(json!({ "leftovers": [] })));
    assert!(merge_has_ended(&window));
    assert_eq!(git_line(root, &["branch", "--show-current"]), "develop");
    let due_dates = format!("refs/heads/{DUE_DATES}");
    assert_eq!(git_line(root, &["for-each-ref", &due_dates]), "");
    assert!(!root.join(RECORD).exists());
    assert_eq!(
        window.ending(),
        Ending {
            exit: Exit::Unresolved,
            message: Some("merge aborted".to_owned()),
        }
    );
}

// develop's docs/develop.md, untracked on the merge request's branch, refuses the return to develop.
#[test]
fn abort_with_leftovers_keeps_the_window_and_answers_them() {
    let window = window_on_started(DUE_DATES);
    let root = window.repo.path();
    fs::create_dir_all(root.join("docs")).unwrap();
    fs::write(root.join("docs/develop.md"), "mine\n").unwrap();

    let aborted = window.invoke("abort_operation", json!({})).unwrap();

    let leftovers = aborted["leftovers"].as_array().unwrap();
    assert_eq!(leftovers.len(), 2, "{aborted}");
    assert_eq!(leftovers[0]["kind"], "returnRefused", "{aborted}");
    assert_eq!(
        leftovers[0]["to"],
        json!({ "kind": "branch", "name": "develop" })
    );
    assert!(merge_has_ended(&window));
    assert_eq!(git_line(root, &["branch", "--show-current"]), DUE_DATES);

    assert_eq!(
        window.invoke("close_ended_merge", json!({})),
        Ok(Value::Null)
    );
    assert!(merge_has_ended(&window));
}

#[test]
fn continue_on_a_recorded_merge_answers_ready_to_push_and_keeps_the_window() {
    let window = window_on_started(DUE_DATES);
    let root = window.repo.path();
    let args = json!({ "path": CARD, "text": "merged\n", "diskVersion": 0 });
    assert_eq!(
        window.invoke("finish_file", args).unwrap()["kind"],
        "Written"
    );

    let continued = window.invoke("continue_operation", json!({}));

    assert_eq!(
        continued,
        Ok(json!({ "kind": "ReadyToPush", "branch": DUE_DATES }))
    );
    assert!(!merge_has_ended(&window));
    assert!(!root.join(RECORD).exists());
    assert_eq!(
        git_line(root, &["rev-list", "--count", "--merges", "HEAD"]),
        "1"
    );
    let merge_finished = Err(json!({ "kind": "MergeFinished" }));
    assert_eq!(window.invoke("list_stop", json!({})), merge_finished);
}

#[test]
fn push_merged_branch_pushes_and_ends_with_exit_0() {
    let window = committed_clean_merge();
    let root = window.repo.path();

    let pushed = window.invoke("push_merged_branch", json!({}));

    assert_eq!(pushed, Ok(json!({ "kind": "pushed" })));
    let merge_commit = git_line(root, &["rev-parse", "HEAD"]);
    assert_eq!(
        git_line(&root.join(GITLAB), &["rev-parse", CLEAN]),
        merge_commit
    );
    assert_eq!(git_line(root, &["branch", "--show-current"]), CLEAN);
    assert!(merge_has_ended(&window));
    assert_eq!(window.ending(), finished("merge finished"));
}

#[test]
fn a_rejected_push_keeps_the_merge_committed_and_the_window() {
    let window = committed_clean_merge();
    let gitlab = window.repo.path().join(GITLAB);
    let tree = format!("{CLEAN}^{{tree}}");
    let theirs = git_line(
        &gitlab,
        &["commit-tree", "-p", CLEAN, "-m", "Theirs", &tree],
    );
    git_ok(
        &gitlab,
        &["update-ref", &format!("refs/heads/{CLEAN}"), &theirs],
    )
    .unwrap();

    let pushed = window.invoke("push_merged_branch", json!({})).unwrap();

    assert_eq!(pushed["kind"], "failed", "{pushed}");
    let message = pushed["message"].as_str().unwrap();
    assert!(message.starts_with("[rejected]"), "{message}");
    assert_eq!(git_line(&gitlab, &["rev-parse", CLEAN]), theirs);
    assert!(!merge_has_ended(&window));
    assert!(matches!(
        &*lock(&window.app.state::<MergeState>()),
        Merge::Committed { .. }
    ));
    assert_eq!(window.ending(), finished("merge finished"));
}

#[test]
fn push_merged_branch_refuses_unless_a_recorded_merge_was_just_committed() {
    let no_operation = Err(json!({ "kind": "NoOperation" }));
    let held = open_window();

    assert_eq!(held.invoke("push_merged_branch", json!({})), no_operation);

    assert!(matches!(
        &*lock(&held.app.state::<MergeState>()),
        Merge::Held(_)
    ));
    for path in ["added.ts", "crlf.ts", "view.vue"] {
        let args = json!({ "path": path, "text": "done\n", "diskVersion": 0 });
        held.invoke("finish_file", args).unwrap();
    }
    let continued = held.invoke("continue_operation", json!({}));
    assert_eq!(continued, Ok(json!({ "kind": "Finished" })));
    assert_eq!(held.invoke("push_merged_branch", json!({})), no_operation);
    assert_eq!(held.ending(), finished("merge finished"));
}

#[test]
fn close_ended_merge_after_keep_local_ends_with_exit_0() {
    let held = open_window();
    assert_eq!(held.invoke("close_ended_merge", json!({})), Ok(Value::Null));
    assert!(!merge_has_ended(&held));
    let window = committed_clean_merge();

    assert_eq!(
        window.invoke("close_ended_merge", json!({})),
        Ok(Value::Null)
    );

    assert!(merge_has_ended(&window));
    assert_eq!(window.ending(), finished("merge finished"));
    let gitlab = window.repo.path().join(GITLAB);
    let gitlab_tip = git_line(&gitlab, &["rev-parse", CLEAN]);
    assert_ne!(
        gitlab_tip,
        git_line(window.repo.path(), &["rev-parse", "HEAD"])
    );
}

fn startup_ending(started: Startup) -> Ending {
    match started {
        Startup::Merge { session, .. } => panic!("a merge in {:?}", session.root()),
        Startup::Done(ending) => ending,
    }
}

#[test]
fn startup_opens_a_clean_merge_yamt_started() {
    let repo = mr_conflict_repo();
    start_merge(&repo, CLEAN);

    let Startup::Merge { session, claim } = startup(repo.path()) else {
        panic!("expected a merge");
    };

    assert_eq!(session.files(), []);
    assert!(claim.is_some());
}

#[test]
fn startup_still_says_nothing_to_merge_without_a_record() {
    let repo = mr_conflict_repo();
    start_merge(&repo, CLEAN);
    fs::remove_file(repo.path().join(RECORD)).unwrap();

    let ending = startup_ending(startup(repo.path()));

    assert_eq!(ending.exit, Exit::Success);
    let message = ending.message.unwrap();
    assert!(message.starts_with("nothing to merge in "), "{message}");
}

#[test]
fn startup_refuses_a_second_window_on_a_recorded_merge() {
    let repo = mr_conflict_repo();
    start_merge(&repo, DUE_DATES);
    let refused = Ending::failure(format!(
        "the merge of !{IID} is already open in another yamt window"
    ));
    let held_by_the_test = claim_window(repo.path()).unwrap().unwrap();

    assert_eq!(startup_ending(startup(repo.path())), refused);

    drop(held_by_the_test);
    let first = startup(repo.path());
    assert!(matches!(first, Startup::Merge { claim: Some(_), .. }));
    assert_eq!(startup_ending(startup(repo.path())), refused);
    assert_eq!(refused.exit as u8, 2);
}
