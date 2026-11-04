use serde_json::{Value, json};

use crate::MergeRequestIid;
use crate::project::Project;

pub(crate) const ORIGIN: &str = "https://gitlab.example";

pub(crate) fn project() -> Project {
    Project {
        full_path: "taskboard/taskboard".to_owned(),
        web_path: "/taskboard/taskboard".to_owned(),
        web_origin: Some(ORIGIN.to_owned()),
    }
}

pub(crate) fn iids(numbers: &[u32]) -> Vec<MergeRequestIid> {
    numbers
        .iter()
        .map(|&number| MergeRequestIid(number))
        .collect()
}

/// Discussion `n`'s 40 hex digits.
pub(crate) fn hex(n: u32) -> String {
    format!("{n:040x}")
}

/// A person's note on merge request 1 itself, its body naming its author and `n`, never edited.
pub(crate) fn comment(username: &str, n: u32) -> Value {
    let created_at = format!("2026-11-03T10:00:0{n}Z");
    json!({
        "system": false,
        "author": { "username": username, "name": format!("{username} name"), "avatarUrl": null },
        "body": format!("{username} {n}"),
        "bodyHtml": format!("<p>{username} {n}</p>"),
        "createdAt": created_at,
        "lastEditedAt": created_at,
        "lastEditedBy": null,
        "url": format!("https://gitlab.example/taskboard/taskboard/-/merge_requests/1#note_{n}"),
        "position": null,
    })
}

pub(crate) fn system_note(n: u32) -> Value {
    let mut note = comment("pusher", n);
    note["system"] = json!(true);
    note
}

/// `note` with GitLab's link to each user after its text.
pub(crate) fn mentioning(mut note: Value, usernames: &[&str]) -> Value {
    let link = |username: &&str| {
        format!(
            r#"<a href="/{username}" data-reference-type="user" data-user="1" title="{username} name">@{username}</a>"#
        )
    };
    let links: String = usernames.iter().map(link).collect();
    let text = note["bodyHtml"].as_str().unwrap_or_default();
    note["bodyHtml"] = json!(format!("{text}{links}"));
    note
}

pub(crate) fn on_file(mut note: Value, new_line: Option<u32>, old_line: Option<u32>) -> Value {
    note["position"] =
        json!({ "filePath": "src/card.ts", "newLine": new_line, "oldLine": old_line });
    note
}

/// Discussion 1 holding `notes`, none after them.
pub(crate) fn discussion(resolvable: bool, resolved: bool, notes: &[Value]) -> Value {
    json!({
        "id": format!("gid://gitlab/Discussion/{}", hex(1)),
        "resolvable": resolvable,
        "resolved": resolved,
        "userPermissions": { "resolveNote": true },
        "notes": { "pageInfo": { "hasNextPage": false }, "nodes": notes },
    })
}

pub(crate) fn open(notes: &[Value]) -> Value {
    discussion(true, false, notes)
}

/// `discussion` as discussion `n`.
pub(crate) fn with_id(mut discussion: Value, n: u32) -> Value {
    discussion["id"] = json!(format!("gid://gitlab/Discussion/{}", hex(n)));
    discussion
}

pub(crate) fn merge_request(iid: u32, discussions: &[Value], next: Option<&str>) -> Value {
    json!({
        "iid": iid.to_string(),
        "discussionLocked": false,
        "userPermissions": { "createNote": true },
        "discussions": {
            "pageInfo": { "hasNextPage": next.is_some(), "endCursor": next },
            "nodes": discussions,
        },
    })
}

pub(crate) fn answer(merge_requests: &[Value]) -> Vec<u8> {
    let data = json!({
        "queryComplexity": { "score": 58, "limit": 250 },
        "project": { "mergeRequests": { "nodes": merge_requests } },
    });
    json!({ "data": data }).to_string().into_bytes()
}
