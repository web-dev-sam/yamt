use serde_json::json;
use tauri::test::{MockRuntime, mock_builder, mock_context, noop_assets};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use yamt_conflict_repo::{ConflictFile, FileKind, TempDir, diverged_repo};
use yamt_range::{MergeRequestNames, pair_folders};

use super::*;
use crate::commands::with_commands;
use crate::frontend_log::tests::logged;
use crate::mock_window::invoke_on;
use crate::window::app_folder;

const RANGE: &str = "main...remote";
const THREADS_FILE: &str = "threads.json";
const REVIEWED_FILE: &str = "reviewed.json";
const GONE_THREAD: &str = r#"{"format":1,"nextThread":2,"nextMessage":2,"threads":[{"id":1,"path":"gone.txt","line":{"kind":"added","right":0},"session":null,"messages":[{"id":1,"body":{"kind":"note","text":"Why?"},"written":0,"posting":{"kind":"notQueued"}}]}]}"#;

pub(crate) struct RangeWindow {
    pub(crate) repo: TempDir,
    pub(crate) data: TempDir,
    pub(crate) webview: WebviewWindow<MockRuntime>,
    _app: App<MockRuntime>,
}

impl RangeWindow {
    /// Its repository and a new data folder holding a copy of its `yamt/reviewed/`, for the next window: a dropped
    /// mock app keeps its state, so this data folder's pair lock stays taken.
    pub(crate) fn with_marks_copied(self) -> (TempDir, TempDir) {
        let data = TempDir::new().unwrap();
        copy_tree(
            &app_folder(self.data.path()).join(REVIEWED_FOLDER),
            &app_folder(data.path()).join(REVIEWED_FOLDER),
        );
        (self.repo, data)
    }
}

fn copy_tree(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).unwrap();
    for entry in std::fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let target = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_tree(&entry.path(), &target);
        } else {
            std::fs::copy(entry.path(), target).unwrap();
        }
    }
}

pub(crate) fn repo() -> TempDir {
    let file = ConflictFile {
        path: "a.txt",
        kind: FileKind::Regular,
        base: Some(b"one\n"),
        local: Some(b"one\n"),
        remote: Some(b"two\n"),
    };
    diverged_repo(&[file]).unwrap()
}

fn resolved(root: &Path) -> Resolved {
    resolved_on(root, RANGE)
}

fn resolved_on(root: &Path, range: &str) -> Resolved {
    Resolved::resolve(root, &RangeSpec::parse(range).unwrap()).unwrap()
}

fn range_app() -> App<MockRuntime> {
    with_commands(mock_builder())
        .build(mock_context(noop_assets()))
        .unwrap()
}

/// A window on `main...remote` of a repository whose one file `a.txt` changes from "one" to "two".
pub(crate) fn open_range_window() -> RangeWindow {
    open_range_window_with(Ai::Off)
}

pub(crate) fn open_range_window_with(ai: Ai) -> RangeWindow {
    open_range_window_in(repo(), TempDir::new().unwrap(), ai)
}

/// A window on `range` of the repository in `repo`'s folder.
#[cfg(unix)]
pub(crate) fn open_range_window_on(repo: TempDir, range: &str) -> RangeWindow {
    let resolved = resolved_on(repo.path(), range);
    open_resolved_window(
        repo,
        TempDir::new().unwrap(),
        resolved,
        Ai::Off,
        RangeOf::SideNames,
    )
}

pub(crate) fn open_range_window_in(repo: TempDir, data: TempDir, ai: Ai) -> RangeWindow {
    let resolved = resolved(repo.path());
    open_resolved_window(repo, data, resolved, ai, RangeOf::SideNames)
}

/// A window on `main...remote` of a merge request's changes or of its sides by name, as `range_of` says.
pub(crate) fn open_marked_window(repo: TempDir, data: TempDir, range_of: RangeOf) -> RangeWindow {
    let resolved = resolved(repo.path());
    open_resolved_window(repo, data, resolved, Ai::Off, range_of)
}

fn open_resolved_window(
    repo: TempDir,
    data: TempDir,
    resolved: Resolved,
    ai: Ai,
    range_of: RangeOf,
) -> RangeWindow {
    let app = range_app();
    manage_range_in(&app, &app_folder(data.path()), resolved, ai, range_of).unwrap();
    let webview = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
        .build()
        .unwrap();
    RangeWindow {
        repo,
        data,
        webview,
        _app: app,
    }
}

/// The threads file the window will read; the pair's lock is let go again.
fn threads_path(repo: &Path, data: &Path) -> PathBuf {
    let lock = PairLock::take(&range_folder(&app_folder(data)), &resolved(repo)).unwrap();
    lock.folder().join(THREADS_FILE)
}

// Opening on a file it cannot read would show no threads, and the next add would write over them. That the
// refusal ends with exit 2 before any window rests on window.rs:111-113 and the real-app smoke.
#[test]
fn a_broken_threads_file_is_refused_before_the_range_state_and_left_unchanged() {
    let (repo, data) = (repo(), TempDir::new().unwrap());
    let threads = threads_path(repo.path(), data.path());
    let broken = b"{\"format\":1,";
    std::fs::write(&threads, broken).unwrap();
    let app = range_app();

    let refused = manage_range_in(
        &app,
        &app_folder(data.path()),
        resolved(repo.path()),
        Ai::Off,
        RangeOf::SideNames,
    );

    let line = refused.unwrap_err();
    let named = format!("the review threads {} cannot be read: ", threads.display());
    assert!(line.starts_with(&named), "{line}");
    assert!(app.try_state::<RangeState>().is_none());
    assert_eq!(std::fs::read(&threads).unwrap(), broken);
}

/// The one review's `reviewed.json` under `<data>/yamt/reviewed/<repo key>/`.
fn reviewed_file(data: &Path) -> PathBuf {
    let reviewed_dir = app_folder(data).join(REVIEWED_FOLDER);
    only_entry(&only_entry(&reviewed_dir)).join(REVIEWED_FILE)
}

// Opening on marks it cannot read would show none, and the next click would write over them.
#[test]
fn a_newer_reviewed_file_refuses_the_range_before_any_window() {
    let window = open_range_window();
    invoke_on(&window.webview, "mark_reviewed", json!({ "file": 0 })).unwrap();
    let (repo, data) = window.with_marks_copied();
    let reviewed = reviewed_file(data.path());
    let newer = r#"{"format":2,"anything":"new"}"#;
    std::fs::write(&reviewed, newer).unwrap();
    let app = range_app();

    let refused = manage_range_in(
        &app,
        &app_folder(data.path()),
        resolved(repo.path()),
        Ai::Off,
        RangeOf::SideNames,
    );

    let named = format!(
        "the reviewed marks {} were written by a newer yamt (format 2)",
        reviewed.display()
    );
    assert_eq!(refused, Err(named));
    assert!(app.try_state::<RangeState>().is_none());
    assert_eq!(std::fs::read_to_string(&reviewed).unwrap(), newer);
}

// A refused window must not have written: pruning the unlisted mark would rewrite `reviewed.json` (plan §2 #117).
#[test]
fn a_broken_threads_file_leaves_reviewed_json_unwritten() {
    let window = open_range_window();
    invoke_on(&window.webview, "mark_reviewed", json!({ "file": 0 })).unwrap();
    let (repo, data) = window.with_marks_copied();
    let reviewed = reviewed_file(data.path());
    let mut stored: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&reviewed).unwrap()).unwrap();
    let mut gone = stored["marks"][0].clone();
    gone["path"] = json!("gone.txt");
    stored["marks"].as_array_mut().unwrap().push(gone);
    let with_unlisted = serde_json::to_string(&stored).unwrap();
    std::fs::write(&reviewed, &with_unlisted).unwrap();
    std::fs::write(threads_path(repo.path(), data.path()), b"{").unwrap();
    let app = range_app();

    let refused = manage_range_in(
        &app,
        &app_folder(data.path()),
        resolved(repo.path()),
        Ai::Off,
        RangeOf::SideNames,
    );

    let line = refused.unwrap_err();
    assert!(line.starts_with("the review threads "), "{line}");
    assert_eq!(std::fs::read_to_string(&reviewed).unwrap(), with_unlisted);
}

// Under `range/` the review's folder would be taken for a commit pair, and the AI sweep would walk it.
#[test]
fn the_reviewed_marks_live_in_yamt_reviewed_beside_range_and_no_pair_names_them() {
    let window = open_range_window();

    invoke_on(&window.webview, "mark_reviewed", json!({ "file": 0 })).unwrap();

    assert!(reviewed_file(window.data.path()).is_file());
    let range_dir = range_folder(&app_folder(window.data.path()));
    let pair_dir = only_entry(&only_entry(&range_dir));
    assert_eq!(pair_folders(&range_dir), [pair_dir]);
}

// A thread on a file this range does not list must survive, and its absence must be traceable.
#[test]
fn threads_on_a_path_the_range_does_not_list_are_kept_and_logged_once() {
    let (repo, data) = (repo(), TempDir::new().unwrap());
    let threads = threads_path(repo.path(), data.path());
    std::fs::write(&threads, GONE_THREAD).unwrap();

    let (window, log) = logged(|| open_range_window_in(repo, data, Ai::Off));

    let warnings: Vec<&str> = log.lines().filter(|line| line.contains("WARN")).collect();
    assert_eq!(warnings.len(), 1, "{log}");
    assert!(warnings[0].contains(r#"paths=["gone.txt"]"#), "{log}");
    let listed = invoke_on(&window.webview, "list_threads", json!({}));
    assert_eq!(listed, Ok(json!({ "threads": [] })));
    assert_eq!(std::fs::read_to_string(&threads).unwrap(), GONE_THREAD);
}

#[test]
fn a_range_whose_threads_are_all_listed_logs_no_warning() {
    let (_window, log) = logged(open_range_window);
    assert!(!log.contains("WARN"), "{log}");
}

#[test]
fn open_range_answers_the_range_s_start() {
    let window = open_range_window();
    let start = resolved(window.repo.path())
        .list()
        .unwrap()
        .start(RangeHeading::Typed);
    assert_eq!(
        invoke_on(&window.webview, "open_range", json!({})),
        Ok(serde_json::to_value(start).unwrap())
    );
}

#[test]
fn the_pair_lock_lives_under_the_data_folder_s_yamt_range() {
    let window = open_range_window();
    let range_dir = window.data.path().join("yamt").join("range");
    let repo_dir = only_entry(&range_dir);
    let pair_dir = only_entry(&repo_dir);
    assert!(pair_dir.join("lock").is_file(), "{}", pair_dir.display());
}

fn only_entry(dir: &Path) -> PathBuf {
    let entries: Vec<PathBuf> = std::fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect();
    assert_eq!(entries.len(), 1, "{entries:?}");
    entries[0].clone()
}

#[test]
fn a_listed_file_loads_and_an_unknown_id_answers_unknown_range_file() {
    let window = open_range_window();
    let loaded = invoke_on(&window.webview, "load_range_file", json!({ "file": 0 })).unwrap();
    assert_eq!(loaded["kind"], "texts");
    assert_eq!(loaded["right"], "two\n");
    assert_eq!(
        invoke_on(&window.webview, "load_range_file", json!({ "file": 7 })),
        Err(json!({ "kind": "UnknownRangeFile", "file": 7 }))
    );
}

#[test]
fn search_range_texts_pages_the_text_files_and_refuses_an_id_past_the_end() {
    let window = open_range_window();
    let page = invoke_on(&window.webview, "search_range_texts", json!({ "from": 0 }));
    let change = json!({ "left": { "start": 0, "len": 1 }, "right": { "start": 0, "len": 1 } });
    let text = json!({ "file": 0, "left": "one\n", "right": "two\n", "changes": [change] });
    assert_eq!(page, Ok(json!({ "files": [text], "next": null })));
    assert_eq!(
        invoke_on(&window.webview, "search_range_texts", json!({ "from": 2 })),
        Err(json!({ "kind": "UnknownRangeFile", "file": 2 }))
    );
}

#[test]
fn a_second_window_on_the_same_pair_is_refused_naming_both_short_ids() {
    let window = open_range_window();
    let refused = manage_range_in(
        &range_app(),
        &app_folder(window.data.path()),
        resolved(window.repo.path()),
        Ai::Off,
        RangeOf::SideNames,
    );
    let start = resolved(window.repo.path())
        .list()
        .unwrap()
        .start(RangeHeading::Typed);
    assert_eq!(
        refused,
        Err(format!(
            "another yamt window shows {}..{} of {}",
            start.left.short_id,
            start.right.short_id,
            resolved(window.repo.path()).root().display()
        ))
    );
}

fn snooze(title: &str) -> RangeOf {
    RangeOf::MergeRequest {
        project: "taskboard/taskboard".to_owned(),
        iid: 13,
        names: Some(MergeRequestNames {
            title: title.to_owned(),
            source: "snooze".to_owned(),
            target: "main".to_owned(),
        }),
    }
}

/// The title `manage_range_in` answers for a window on `main...remote` of `repo()`, the repository's folder name and
/// the range's start.
fn title_of(range_of: RangeOf) -> (String, String, RangeStart) {
    let (repo, data) = (repo(), TempDir::new().unwrap());
    let title = manage_range_in(
        &range_app(),
        &app_folder(data.path()),
        resolved(repo.path()),
        Ai::Off,
        range_of,
    );
    let folder = repo
        .path()
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    let start = resolved(repo.path())
        .list()
        .unwrap()
        .start(RangeHeading::Typed);
    (title.unwrap(), folder, start)
}

fn assert_no_separator(title: &str) {
    for separator in ['·', '|', '•'] {
        assert!(!title.contains(separator), "{title}");
    }
}

#[test]
fn a_typed_window_s_title_is_the_range_its_totals_and_folder() {
    let (title, folder, _) = title_of(RangeOf::SideNames);

    assert_eq!(title, format!("main...remote  +1 −1 — {folder} — yamt"));
    assert_no_separator(&title);
}

#[test]
fn a_merge_request_window_s_title_names_it_its_branches_and_totals() {
    let (title, folder, _) = title_of(snooze("Snooze a reminder"));

    let wanted = format!("!13 Snooze a reminder  snooze → main  +1 −1 — {folder} — yamt");
    assert_eq!(title, wanted);
    assert_no_separator(&title);
}

#[test]
fn an_unnamed_merge_request_s_title_names_its_short_ids() {
    let unnamed = RangeOf::MergeRequest {
        project: "taskboard/taskboard".to_owned(),
        iid: 13,
        names: None,
    };
    let (title, folder, start) = title_of(unnamed);

    let (left, right) = (start.left.short_id, start.right.short_id);
    let wanted = format!("!13  {left}..{right}  +1 −1 — {folder} — yamt");
    assert_eq!(title, wanted);
    assert_no_separator(&title);
}

#[test]
fn a_control_character_in_the_title_is_a_space_in_the_title_bar() {
    let (title, folder, _) = title_of(snooze("Snooze\na\treminder"));

    let wanted = format!("!13 Snooze a reminder  snooze → main  +1 −1 — {folder} — yamt");
    assert_eq!(title, wanted);
}

#[test]
fn open_range_answers_the_heading_and_totals() {
    let window = open_marked_window(repo(), TempDir::new().unwrap(), snooze("Snooze a reminder"));

    let start = invoke_on(&window.webview, "open_range", json!({})).unwrap();

    let names = json!({ "title": "Snooze a reminder", "source": "snooze", "target": "main" });
    let heading = json!({ "kind": "mergeRequest", "iid": 13, "names": names });
    assert_eq!(start["heading"], heading);
    assert_eq!(start["totals"], json!({ "added": 1, "removed": 1 }));
}
