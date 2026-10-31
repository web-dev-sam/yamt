use std::path::Path;
use std::sync::mpsc;

use serde_json::{Value, json};
use tauri::App;
use tauri::async_runtime::block_on;
use tauri::ipc::InvokeResponseBody;
use tauri::test::{MockRuntime, mock_builder, mock_context, noop_assets};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use yamt_conflict_repo::{TempDir, git_ok};

use super::*;
use crate::commands::with_commands;
use crate::mock_window::invoke_on;
use crate::window::app_folder;

const GITLAB_REMOTE: &str = "https://gitlab.example/taskboard/taskboard.git";

/// A window whose merge-request state is managed for the repository in `repo`, its data folder a temp dir.
struct MergeRequestWindow {
    repo: TempDir,
    _data: TempDir,
    webview: WebviewWindow<MockRuntime>,
    _app: App<MockRuntime>,
}

fn open_window_in(repo: TempDir) -> MergeRequestWindow {
    let data = TempDir::new().unwrap();
    let app = with_commands(mock_builder())
        .build(mock_context(noop_assets()))
        .unwrap();
    manage(&app, repo.path(), &app_folder(data.path()), Ai::Off);
    let webview = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
        .build()
        .unwrap();
    MergeRequestWindow {
        repo,
        _data: data,
        webview,
        _app: app,
    }
}

fn invoke(window: &MergeRequestWindow, cmd: &str, args: Value) -> Result<Value, Value> {
    invoke_on(&window.webview, cmd, args)
}

/// A fresh repository whose `origin` is on gitlab.example.
fn gitlab_repo() -> TempDir {
    let repo = TempDir::new().unwrap();
    git_ok(repo.path(), &["init", "-q"]).unwrap();
    git_ok(repo.path(), &["remote", "add", "origin", GITLAB_REMOTE]).unwrap();
    repo
}

/// The absolute common git dir as git prints it.
fn common_dir(root: &Path) -> String {
    let args = ["rev-parse", "--path-format=absolute", "--git-common-dir"];
    let output = git_ok(root, &args).unwrap();
    String::from_utf8(output).unwrap().trim_end().to_owned()
}

#[test]
fn a_repository_with_a_gitlab_remote_is_found_and_one_without_is_none() {
    let found = open_window_in(gitlab_repo());
    let common_dir = common_dir(found.repo.path());
    assert_eq!(
        invoke(&found, "find_gitlab_project", json!({})),
        Ok(json!({ "kind": "found", "repository": common_dir }))
    );

    let plain = TempDir::new().unwrap();
    git_ok(plain.path(), &["init", "-q"]).unwrap();
    let none = open_window_in(plain);
    assert_eq!(
        invoke(&none, "find_gitlab_project", json!({})),
        Ok(json!({ "kind": "none" }))
    );
    let reply = block_on(open_merge_request(
        none.webview.clone(),
        MergeRequestIid(13),
    ));
    assert_eq!(
        serde_json::to_value(reply.unwrap()).unwrap(),
        json!({ "kind": "failed", "message": NO_PROJECT })
    );
    let ended = list(&none);
    assert_eq!(
        ended,
        [json!({ "kind": "end", "end": { "kind": "failed", "message": NO_PROJECT } })]
    );
}

/// Lists through the command; every message, in the order the window's channel got them.
fn list(window: &MergeRequestWindow) -> Vec<Value> {
    let (sender, received) = mpsc::channel();
    let channel = Channel::new(move |body| {
        let InvokeResponseBody::Json(json) = body else {
            panic!("a message that is not JSON");
        };
        sender.send(serde_json::from_str(&json).unwrap()).unwrap();
        Ok(())
    });
    block_on(list_merge_requests(window.webview.clone(), channel)).unwrap();
    received.try_iter().collect()
}

#[cfg(unix)]
mod resolve;

#[cfg(unix)]
mod through_glab {
    use std::path::PathBuf;
    use std::process::Command;
    use std::thread;
    use std::time::{Duration, Instant};

    use yamt_conflict_repo::run_ignored_in_child;

    use super::*;

    const FAKE_OPEN_LOG: &str = "YAMT_FAKE_OPEN_LOG";
    const LIST_TEST: &str = "merge_requests::tests::through_glab::a_list_on_path_s_glab";
    const PAGES_TEST: &str = "merge_requests::tests::through_glab::pages_on_path_s_opener";
    const LISTED_JOB: &str = "https://gitlab.example/taskboard/taskboard/-/jobs/302";
    const UNLISTED_JOB: &str = "https://gitlab.example/taskboard/taskboard/-/jobs/999";
    const LISTED_MERGE_REQUEST: &str =
        "https://gitlab.example/taskboard/taskboard/-/merge_requests/13";
    const UNLISTED_MERGE_REQUEST: &str =
        "https://gitlab.example/taskboard/taskboard/-/merge_requests/999";
    const OPEN_WAIT: Duration = Duration::from_secs(10);
    const POLL: Duration = Duration::from_millis(10);

    pub(super) fn in_this_repository(relative: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join(relative)
    }

    /// A window on `scripts/range-repo.sh`'s repository, whose `origin` is the fake GitLab's project.
    fn range_repo_window() -> MergeRequestWindow {
        let repo = TempDir::new().unwrap();
        let built = Command::new(in_this_repository("scripts/range-repo.sh"))
            .arg(repo.path())
            .output()
            .unwrap();
        assert!(built.status.success(), "{built:?}");
        open_window_in(repo)
    }

    /// Runs `test` in a child whose PATH starts with the committed fake glab on the scenario `tests/glab/<scenario>`
    /// and the fake xdg-open, their logs in a folder of this test's.
    pub(super) fn run_with_fakes(test: &str, scenario: &str) {
        let fake = TempDir::new().unwrap();
        let inherited = std::env::var_os("PATH").unwrap_or_default();
        let mut folders = vec![
            in_this_repository("scripts/fake-glab"),
            in_this_repository("scripts/fake-open"),
        ];
        folders.extend(std::env::split_paths(&inherited));
        let path = std::env::join_paths(folders).unwrap();
        let scenario = in_this_repository("tests/glab").join(scenario);

        let ran = run_ignored_in_child(&[test], |child| {
            child
                .env("PATH", path)
                .env("YAMT_FAKE_GLAB", scenario)
                .env("YAMT_FAKE_GLAB_LOG", fake.path().join("glab.log"))
                .env(FAKE_OPEN_LOG, fake.path().join("open.log"));
        });

        ran.unwrap_or_else(|error| panic!("{error}"));
    }

    fn iids(page: &Value) -> Vec<u64> {
        let rows = page["rows"].as_array().unwrap();
        rows.iter()
            .map(|row| row["iid"].as_u64().unwrap())
            .collect()
    }

    fn open(window: &MergeRequestWindow, page: &str) -> Value {
        invoke(window, "open_page", json!({ "page": page })).unwrap()
    }

    fn opened_log() -> String {
        let log = std::env::var_os(FAKE_OPEN_LOG).unwrap();
        std::fs::read_to_string(log).unwrap_or_default()
    }

    /// The opener's log once it is no longer `before`.
    fn log_after(before: &str) -> String {
        let deadline = Instant::now() + OPEN_WAIT;
        loop {
            let logged = opened_log();
            if logged != before {
                return logged;
            }
            assert!(Instant::now() < deadline, "the opener never ran");
            thread::sleep(POLL);
        }
    }

    #[test]
    fn every_page_then_one_end_reaches_the_window_s_channel() {
        run_with_fakes(LIST_TEST, "merge-requests");
    }

    #[test]
    #[ignore = "run by every_page_then_one_end_reaches_the_window_s_channel"]
    fn a_list_on_path_s_glab() {
        let window = range_repo_window();

        let messages = list(&window);

        let kinds: Vec<&str> = messages
            .iter()
            .map(|message| message["kind"].as_str().unwrap())
            .collect();
        assert_eq!(kinds, ["page", "page", "end"]);
        assert_eq!(messages[2]["end"], json!({ "kind": "loaded" }));
        let sent: Vec<Vec<u64>> = messages[..2]
            .iter()
            .map(|message| iids(&message["page"]))
            .collect();
        assert_eq!(sent, [vec![13, 12, 11], vec![9, 8]]);
        assert_eq!(messages[0]["page"]["me"], "sam");
    }

    #[test]
    fn only_a_page_a_list_sent_is_handed_to_the_browser() {
        run_with_fakes(PAGES_TEST, "merge-requests");
    }

    #[test]
    #[ignore = "run by only_a_page_a_list_sent_is_handed_to_the_browser"]
    fn pages_on_path_s_opener() {
        let window = range_repo_window();
        let not_offered = json!({ "kind": "notOffered" });

        assert_eq!(open(&window, LISTED_JOB), not_offered);
        assert_eq!(open(&window, LISTED_MERGE_REQUEST), not_offered);
        list(&window);
        assert_eq!(open(&window, UNLISTED_JOB), not_offered);
        assert_eq!(open(&window, UNLISTED_MERGE_REQUEST), not_offered);
        assert_eq!(opened_log(), "");
        // macOS starts `/usr/bin/open` by its path (`yamt_merge_requests` `web_page.rs`), not PATH's fake: it would
        // open the real browser.
        if cfg!(target_os = "macos") {
            return;
        }
        let opened = json!({ "kind": "opened" });
        assert_eq!(open(&window, LISTED_JOB), opened);
        let job_opened = format!("argv: {LISTED_JOB}\n");
        assert_eq!(log_after(""), job_opened);
        assert_eq!(open(&window, LISTED_MERGE_REQUEST), opened);

        let both_opened = format!("{job_opened}argv: {LISTED_MERGE_REQUEST}\n");
        assert_eq!(log_after(&job_opened), both_opened);
    }
}
