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

#[test]
fn a_range_window_s_merge_request_state_keeps_its_own_ai() {
    for ai in [Ai::Off, Ai::On] {
        let window = crate::range::tests::open_range_window_with(ai);
        assert_eq!(window.webview.state::<MergeRequestState>().ai, ai);
    }
}

#[cfg(unix)]
mod resolve;

#[cfg(unix)]
mod picture_scheme;

#[cfg(unix)]
mod rerequest;

#[cfg(unix)]
mod job_log;

#[cfg(unix)]
mod discussions;

#[cfg(unix)]
mod people;

#[cfg(unix)]
mod description;

#[cfg(unix)]
mod links;

mod csp;

#[cfg(unix)]
mod through_glab {
    use std::path::PathBuf;
    use std::process::Command;
    use std::thread;
    use std::time::{Duration, Instant};

    use tauri::http::{Response, StatusCode};
    use yamt_conflict_repo::run_ignored_in_child;

    use super::*;
    use crate::merge_requests::pictures::picture_answer;

    const FAKE_OPEN_LOG: &str = "YAMT_FAKE_OPEN_LOG";
    const LIST_TEST: &str = "merge_requests::tests::through_glab::a_list_on_path_s_glab";
    const PAGES_TEST: &str = "merge_requests::tests::through_glab::pages_on_path_s_opener";
    const CHECKED_TEST: &str = "merge_requests::tests::through_glab::a_checked_list_on_path_s_glab";
    const SECOND_CHECK_TEST: &str =
        "merge_requests::tests::through_glab::two_checked_lists_on_path_s_glab";
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

    /// A window on `scripts/local-conflicts-repo.sh`'s repository, whose `origin` is the fake GitLab's project.
    fn local_conflicts_window() -> MergeRequestWindow {
        let repo = TempDir::new().unwrap();
        let built = Command::new(in_this_repository("scripts/local-conflicts-repo.sh"))
            .arg(repo.path())
            .output()
            .unwrap();
        assert!(built.status.success(), "{built:?}");
        open_window_in(repo)
    }

    /// The `checked` rows of a load, by iid.
    fn checked_rows(messages: &[Value]) -> Vec<Value> {
        let mut rows: Vec<Value> = messages
            .iter()
            .filter(|message| message["kind"] == "checked")
            .map(|message| message["row"].clone())
            .collect();
        rows.sort_by_key(|row| row["iid"].as_u64());
        rows
    }

    /// The scenario `local-conflicts`' rows the check changes (`tests/glab/README.md`).
    fn scenario_rows() -> Vec<Value> {
        let merges_cleanly = json!({ "kind": "mergesCleanly" });
        let conflicts = json!({ "kind": "conflicts", "also": [] });
        let blocked_conflicts = json!({ "kind": "conflicts", "also": [{ "kind": "discussions" }, { "kind": "draft" }] });
        let row = |iid: u32, readiness: &Value| json!({ "iid": iid, "readiness": readiness });
        vec![
            row(41, &merges_cleanly),
            row(42, &conflicts),
            row(43, &merges_cleanly),
            row(45, &merges_cleanly),
            row(47, &blocked_conflicts),
            row(48, &merges_cleanly),
        ]
    }

    fn kinds(messages: &[Value]) -> Vec<&str> {
        messages
            .iter()
            .map(|message| message["kind"].as_str().unwrap())
            .collect()
    }

    /// Runs `test` in a child whose PATH starts with the committed fake glab on the scenario `tests/glab/<scenario>`
    /// and the fake xdg-open, their logs in a folder of this test's.
    pub(super) fn run_with_fakes(test: &str, scenario: &str) {
        run_with_fakes_in(test, &in_this_repository("tests/glab").join(scenario));
    }

    /// As `run_with_fakes`, on the scenario folder `scenario` wherever it is.
    pub(super) fn run_with_fakes_in(test: &str, scenario: &Path) {
        let fake = TempDir::new().unwrap();
        let inherited = std::env::var_os("PATH").unwrap_or_default();
        let mut folders = vec![
            in_this_repository("scripts/fake-glab"),
            in_this_repository("scripts/fake-open"),
        ];
        folders.extend(std::env::split_paths(&inherited));
        let path = std::env::join_paths(folders).unwrap();
        let ran = run_ignored_in_child(&[test], |child| {
            child
                .env("PATH", path)
                .env("YAMT_FAKE_GLAB", scenario)
                .env("YAMT_FAKE_GLAB_LOG", fake.path().join("glab.log"))
                .env("YAMT_FAKE_GLAB_STATE", fake.path().join("glab.state"))
                .env(FAKE_OPEN_LOG, fake.path().join("open.log"));
        });

        ran.unwrap_or_else(|error| panic!("{error}"));
    }

    /// The fake glab's log lines that start with `prefix`, in the order it wrote them.
    pub(super) fn glab_log(prefix: &str) -> Vec<String> {
        let log = std::env::var_os("YAMT_FAKE_GLAB_LOG").unwrap();
        let log = std::fs::read_to_string(log).unwrap_or_default();
        let lines = log.lines().filter(|line| line.starts_with(prefix));
        lines.map(str::to_owned).collect()
    }

    fn iids(page: &Value) -> Vec<u64> {
        let rows = page["rows"].as_array().unwrap();
        rows.iter()
            .map(|row| row["iid"].as_u64().unwrap())
            .collect()
    }

    pub(super) fn open(window: &MergeRequestWindow, page: &str) -> Value {
        invoke(window, "open_page", json!({ "page": page })).unwrap()
    }

    pub(super) fn opened_log() -> String {
        let log = std::env::var_os(FAKE_OPEN_LOG).unwrap();
        std::fs::read_to_string(log).unwrap_or_default()
    }

    /// The picture the window gets for `path` (`/<username>` or `/upload~<secret>`) through PATH's glab.
    pub(super) fn asked(window: &MergeRequestWindow, path: &str) -> Response<Vec<u8>> {
        picture_answer(&window.webview.state(), Glab::find().as_ref(), path)
    }

    pub(super) fn is_not_found(answer: &Response<Vec<u8>>) -> bool {
        answer.status() == StatusCode::NOT_FOUND && answer.body().is_empty()
    }

    /// The opener's log once it is no longer `before`.
    pub(super) fn log_after(before: &str) -> String {
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
    fn a_load_sends_its_pages_then_its_end_then_the_checked_rows() {
        run_with_fakes(CHECKED_TEST, "local-conflicts");
    }

    #[test]
    #[ignore = "run by a_load_sends_its_pages_then_its_end_then_the_checked_rows"]
    fn a_checked_list_on_path_s_glab() {
        let window = local_conflicts_window();

        let messages = list(&window);

        let checked = ["checked"; 6];
        assert_eq!(
            kinds(&messages),
            [["page", "end"].as_slice(), &checked].concat()
        );
        let shown: Vec<u64> = iids(&messages[0]["page"]);
        assert_eq!(shown, [49, 48, 47, 46, 45, 44, 43, 42, 41]);
        assert_eq!(messages[1]["end"], json!({ "kind": "loaded" }));
        assert_eq!(checked_rows(&messages), scenario_rows());
    }

    #[test]
    fn a_second_load_sends_the_same_checked_rows() {
        run_with_fakes(SECOND_CHECK_TEST, "local-conflicts");
    }

    #[test]
    #[ignore = "run by a_second_load_sends_the_same_checked_rows"]
    fn two_checked_lists_on_path_s_glab() {
        let window = local_conflicts_window();
        list(&window);
        forget_the_fork_commit(window.repo.path());

        let messages = list(&window);

        let checked = ["checked"; 6];
        assert_eq!(
            kinds(&messages),
            [["page", "end"].as_slice(), &checked].concat()
        );
        assert_eq!(checked_rows(&messages), scenario_rows());
    }

    /// Deletes !45's commit from the checkout and the fake GitLab, its ref kept: only a remembered merge can still
    /// decide !45.
    fn forget_the_fork_commit(root: &Path) {
        let bare = root.join(".git/fake-gitlab.git");
        let git_dir = format!("--git-dir={}", bare.display());
        let id = git_ok(
            root,
            &[&git_dir, "rev-parse", "refs/merge-requests/45/head"],
        )
        .unwrap();
        let id = String::from_utf8(id).unwrap();
        let (directory, file) = id.trim().split_at(2);
        for objects in [bare.join("objects"), root.join(".git/objects")] {
            std::fs::remove_file(objects.join(directory).join(file)).unwrap();
        }
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
