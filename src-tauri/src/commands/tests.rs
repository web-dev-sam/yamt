use std::fs;

use serde_json::{Value, json};
use yamt_conflict_repo::git_ok;

use crate::frontend_log::tests::logged;
use crate::mock_window::{CRLF_PATH, Window, file, open_window, open_window_on};
use crate::outcome::Exit;

impl Window {
    fn unmerged(&self) -> String {
        String::from_utf8(git_ok(self.repo.path(), &["ls-files", "-u"]).unwrap()).unwrap()
    }
}

fn entries(statuses: [&str; 3]) -> Value {
    let paths = ["added.ts", CRLF_PATH, "view.vue"];
    let entries: Vec<Value> = paths
        .iter()
        .zip(statuses)
        .map(|(path, status)| json!({ "path": path, "status": status, "unsupported": null }))
        .collect();
    Value::Array(entries)
}

fn written(statuses: [&str; 3]) -> Value {
    json!({ "kind": "Written", "files": entries(statuses) })
}

fn listed(window: &Window) -> Value {
    let listed = window.invoke("list_stop", json!({})).unwrap();
    assert_eq!(listed["kind"], "Files", "{listed}");
    listed
}

fn files_and_changes(listed: &Value) -> (Value, Value) {
    (listed["files"].clone(), listed["disk_changes"].clone())
}

#[test]
fn list_stop_returns_every_conflicted_file_as_git_sees_it_and_no_disk_change() {
    let window = open_window();
    let unresolved = "Unresolved";
    assert_eq!(
        files_and_changes(&listed(&window)),
        (entries([unresolved, unresolved, unresolved]), json!([]))
    );
    git_ok(window.repo.path(), &["add", CRLF_PATH]).unwrap();
    assert_eq!(
        files_and_changes(&listed(&window)),
        (entries([unresolved, "Resolved", unresolved]), json!([]))
    );
}

#[test]
fn list_stop_stages_a_file_changed_on_disk_and_finish_from_an_older_view_changes_nothing() {
    let window = open_window();
    fs::write(window.repo.path().join("view.vue"), "<d/>\n").unwrap();
    let staged = json!({ "path": "view.vue", "result": { "kind": "Staged" } });
    let after = entries(["Unresolved", "Unresolved", "Resolved"]);

    let listed = listed(&window);
    let args = json!({ "path": "view.vue", "text": "mine\n", "diskVersion": 0 });
    let finished = window.invoke("finish_file", args);

    assert_eq!(files_and_changes(&listed), (after.clone(), json!([staged])));
    let changed = json!({ "kind": "ChangedOnDisk", "files": after, "change": staged });
    assert_eq!(finished, Ok(changed));
    assert_eq!(
        fs::read(window.repo.path().join("view.vue")).unwrap(),
        b"<d/>\n"
    );
}

#[test]
fn list_stop_names_both_branches_of_the_merge() {
    let window = open_window();
    let names = json!({
        "local": { "kind": "Branch", "name": "local" },
        "remote": { "kind": "Branch", "name": "remote" },
    });
    assert_eq!(listed(&window)["sides"], names);
}

#[test]
fn finish_file_writes_crlf_text_verbatim_and_stages_it_while_others_stay_open() {
    let window = open_window();
    let text = "a\r\nmerged\r\n";
    let args = json!({ "path": CRLF_PATH, "text": text, "diskVersion": 0 });
    let files = window.invoke("finish_file", args);
    assert_eq!(files, Ok(written(["Unresolved", "Resolved", "Unresolved"])));
    assert_eq!(
        fs::read(window.repo.path().join(CRLF_PATH)).unwrap(),
        text.as_bytes()
    );
    assert!(
        !window.unmerged().contains(CRLF_PATH),
        "{}",
        window.unmerged()
    );
    assert_eq!(window.ending().exit, Exit::Unresolved);
}

#[test]
fn finishing_every_file_exits_zero_and_reset_reopens_the_file() {
    let window = open_window();
    let unmerged_before = window.unmerged();
    for path in ["added.ts", CRLF_PATH, "view.vue"] {
        window
            .invoke(
                "finish_file",
                json!({ "path": path, "text": "done\n", "diskVersion": 0 }),
            )
            .unwrap();
    }
    assert_eq!(window.unmerged(), "");
    assert_eq!(window.ending().exit, Exit::Success);

    let files = window.invoke("reset_file", json!({ "path": CRLF_PATH, "diskVersion": 0 }));

    assert_eq!(files, Ok(written(["Resolved", "Unresolved", "Resolved"])));
    let crlf_stages: Vec<&str> = unmerged_before
        .lines()
        .filter(|line| line.ends_with(CRLF_PATH))
        .collect();
    assert_eq!(window.unmerged().lines().collect::<Vec<_>>(), crlf_stages);
    let worktree = fs::read_to_string(window.repo.path().join(CRLF_PATH)).unwrap();
    assert!(worktree.contains("<<<<<<<"), "{worktree}");
    assert_eq!(window.ending().exit, Exit::Unresolved);
}

#[test]
fn save_file_writes_the_text_and_leaves_the_file_listed_conflicted() {
    let window = open_window();
    let unmerged_before = window.unmerged();
    let text = "a\r\nsaved\r\n";
    let args = json!({ "path": CRLF_PATH, "text": text, "diskVersion": 0 });

    let saved = window.invoke("save_file", args);

    let unresolved = ["Unresolved", "Unresolved", "Unresolved"];
    assert_eq!(saved, Ok(written(unresolved)));
    assert_eq!(
        fs::read(window.repo.path().join(CRLF_PATH)).unwrap(),
        text.as_bytes()
    );
    assert_eq!(window.unmerged(), unmerged_before);
    assert_eq!(
        files_and_changes(&listed(&window)),
        (entries(unresolved), json!([]))
    );
}

#[test]
fn describe_file_tells_both_sides_and_take_side_remote_resolves_the_binary_file() {
    const LOGO: &str = "logo.bin";
    let window = open_window_on(&[file(LOGO, Some(b"\0base"), b"\0local", b"\0remote")]);
    let path = json!({ "path": LOGO });
    let local = json!({ "kind": "Binary", "bytes": 6 });
    let remote = json!({ "kind": "Binary", "bytes": 7 });
    let sides = json!({
        "path": LOGO, "reason": "Binary", "local": local, "remote": remote, "disk_version": 0
    });
    assert_eq!(window.invoke("describe_file", path), Ok(sides));

    let args = json!({ "path": LOGO, "side": "remote", "diskVersion": 0 });
    let files = window.invoke("take_side", args);

    let resolved = json!({ "path": LOGO, "status": "Resolved", "unsupported": "Binary" });
    assert_eq!(files, Ok(json!({ "kind": "Written", "files": [resolved] })));
    assert_eq!(
        fs::read(window.repo.path().join(LOGO)).unwrap(),
        b"\0remote"
    );
    assert_eq!(window.unmerged(), "");
}

#[test]
fn unknown_path_reaches_the_frontend_as_a_tagged_error() {
    let window = open_window();
    assert_eq!(
        window.invoke("load_file", json!({ "path": "missing.ts" })),
        Err(json!({ "kind": "UnknownPath", "path": "missing.ts" }))
    );
}

#[test]
fn log_emits_a_frontend_entry_to_tracing_and_rejects_an_unknown_level() {
    let window = open_window();
    let fields = json!({ "lines": 3, "ok": true, "name": "a" });
    let entry = json!({ "level": "warn", "event": "scroll.drift", "fields": fields });
    let (response, logged) = logged(|| window.invoke("log", json!({ "entry": entry })));
    assert_eq!(response, Ok(Value::Null));
    assert_eq!(
        logged.trim_end(),
        r#" WARN frontend: event="scroll.drift" fields=lines=3 name="a" ok=true"#
    );
    let bad = json!({ "level": "loud", "event": "scroll.drift", "fields": {} });
    let rejected = window.invoke("log", json!({ "entry": bad })).unwrap_err();
    assert!(
        rejected
            .as_str()
            .unwrap()
            .contains("unknown variant `loud`"),
        "{rejected}"
    );
}
