use serde_json::Value;

use crate::MergeRequestRef;

pub(crate) mod drafts;

const OPENED: &str = "opened";

/// One merge request of a list: enough to ask for its details.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Listed {
    pub(crate) project_id: u64,
    pub(crate) iid: u64,
    pub(crate) is_open: bool,
    pub(crate) head: String,
}

/// One merge request's details: what it is called and which commits its diff compares.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct MergeRequest {
    pub(crate) project_id: u64,
    pub(crate) iid: u64,
    pub(crate) named: MergeRequestRef,
    /// `None` while GitLab still prepares the diff.
    pub(crate) diff_refs: Option<DiffRefs>,
}

/// The three commits of a merge request's diff, as GitLab names them in a position.
#[derive(Clone, Debug, PartialEq, Eq)]
#[expect(
    clippy::struct_field_names,
    reason = "GitLab's own names, written as it writes them"
)]
pub(crate) struct DiffRefs {
    pub(crate) base_sha: String,
    pub(crate) start_sha: String,
    pub(crate) head_sha: String,
}

/// Where a comment sits in a merge request's diff; GitLab's lines are 1-based.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LinePlace {
    pub(crate) old_path: String,
    pub(crate) new_path: String,
    pub(crate) old_line: Option<u32>,
    pub(crate) new_line: Option<u32>,
}

pub(crate) fn merge_requests_from_branch(branch: &str) -> Vec<String> {
    owned(&[
        "api",
        "--method",
        "GET",
        "projects/:fullpath/merge_requests",
        "-f",
        "state=opened",
        "-f",
        &format!("source_branch={branch}"),
    ])
}

pub(crate) fn merge_requests_of_commit(commit: &str) -> Vec<String> {
    owned(&[
        "api",
        &format!("projects/:fullpath/repository/commits/{commit}/merge_requests"),
    ])
}

pub(crate) fn merge_request_details(listed: &Listed) -> Vec<String> {
    let endpoint = merge_request_endpoint(listed.project_id, listed.iid);
    owned(&["api", &endpoint])
}

pub(crate) fn draft_notes(request: &MergeRequest) -> Vec<String> {
    let endpoint = draft_notes_endpoint(request);
    owned(&["api", "--paginate", &endpoint])
}

pub(crate) fn post_draft_note(request: &MergeRequest) -> Vec<String> {
    let endpoint = draft_notes_endpoint(request);
    owned(&[
        "api",
        "--include",
        "--method",
        "POST",
        &endpoint,
        "--input",
        "-",
    ])
}

fn merge_request_endpoint(project_id: u64, iid: u64) -> String {
    format!("projects/{project_id}/merge_requests/{iid}")
}

fn draft_notes_endpoint(request: &MergeRequest) -> String {
    let endpoint = merge_request_endpoint(request.project_id, request.iid);
    format!("{endpoint}/draft_notes")
}

fn owned(args: &[&str]) -> Vec<String> {
    args.iter().map(|arg| (*arg).to_owned()).collect()
}

/// A list of merge requests; an unexpected shape is a message naming the field.
pub(crate) fn listed_from(json: &[u8]) -> Result<Vec<Listed>, String> {
    let mut listed = Vec::new();
    for item in array_from(json)? {
        listed.push(Listed {
            project_id: number_at(&item, "project_id")?,
            iid: number_at(&item, "iid")?,
            is_open: text_at(&item, "state")? == OPENED,
            head: text_at(&item, "sha")?,
        });
    }
    Ok(listed)
}

pub(crate) fn merge_request_from(json: &[u8]) -> Result<MergeRequest, String> {
    let value = value_from(json)?;
    let diff_refs = match value.get("diff_refs") {
        None | Some(Value::Null) => None,
        Some(_) => Some(DiffRefs {
            base_sha: text_at(&value, "diff_refs.base_sha")?,
            start_sha: text_at(&value, "diff_refs.start_sha")?,
            head_sha: text_at(&value, "diff_refs.head_sha")?,
        }),
    };
    Ok(MergeRequest {
        project_id: number_at(&value, "project_id")?,
        iid: number_at(&value, "iid")?,
        named: MergeRequestRef {
            reference: text_at(&value, "references.short")?,
            title: text_at(&value, "title")?,
            web_url: text_at(&value, "web_url")?,
        },
        diff_refs,
    })
}

/// The new draft's id from a post's answer.
pub(crate) fn draft_id_from(json: &[u8]) -> Result<u64, String> {
    number_at(&value_from(json)?, "id")
}

/// GitLab's words in an error body: its `message`, or its `error`.
pub(crate) fn error_message_from(json: &[u8]) -> Option<String> {
    let value = serde_json::from_slice::<Value>(json).ok()?;
    match value.get("message") {
        Some(Value::String(message)) => Some(message.clone()),
        Some(Value::Null) | None => value.get("error")?.as_str().map(str::to_owned),
        Some(message) => Some(message.to_string()),
    }
}

fn value_from(json: &[u8]) -> Result<Value, String> {
    serde_json::from_slice(json).map_err(|error| format!("GitLab's answer is not JSON: {error}"))
}

fn array_from(json: &[u8]) -> Result<Vec<Value>, String> {
    let Value::Array(items) = value_from(json)? else {
        return Err(unexpected("merge requests", "list"));
    };
    Ok(items)
}

/// `path` names a field, `references.short` one inside another.
fn field_at<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    value.pointer(&format!("/{}", path.replace('.', "/")))
}

fn text_at(value: &Value, path: &str) -> Result<String, String> {
    field_at(value, path)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| unexpected(path, "text"))
}

fn number_at(value: &Value, path: &str) -> Result<u64, String> {
    field_at(value, path)
        .and_then(Value::as_u64)
        .ok_or_else(|| unexpected(path, "number"))
}

fn optional_line_at(value: &Value, path: &str) -> Result<Option<u32>, String> {
    match field_at(value, path) {
        None | Some(Value::Null) => Ok(None),
        Some(line) => line
            .as_u64()
            .and_then(|line| u32::try_from(line).ok())
            .map(Some)
            .ok_or_else(|| unexpected(path, "line number")),
    }
}

fn unexpected(field: &str, kind: &str) -> String {
    format!("unexpected answer from GitLab: `{field}` is not a {kind}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const REQUEST: &str = r#"{"iid":12,"project_id":7,"title":"T","web_url":"https://gitlab.example/p/-/merge_requests/12",
        "references":{"short":"!12"},"diff_refs":{"base_sha":"b","start_sha":"s","head_sha":"h"}}"#;

    fn changed(from: &str, to: &str) -> Vec<u8> {
        REQUEST.replacen(from, to, 1).into_bytes()
    }

    #[test]
    fn unexpected_json_is_failed_naming_the_field() {
        let parsed = merge_request_from(REQUEST.as_bytes()).unwrap();
        assert_eq!(parsed.named.reference, "!12");
        assert_eq!(
            parsed.diff_refs.map(|refs| refs.start_sha),
            Some("s".to_owned())
        );
        let field_named = |json: &[u8]| merge_request_from(json).unwrap_err();
        assert_eq!(
            field_named(&changed(r#""project_id":7"#, r#""project_id":"7""#)),
            "unexpected answer from GitLab: `project_id` is not a number"
        );
        assert_eq!(
            field_named(&changed(r#""short":"!12""#, r#""long":"!12""#)),
            "unexpected answer from GitLab: `references.short` is not a text"
        );
        assert_eq!(
            field_named(&changed(r#""head_sha":"h""#, r#""head_sha":null"#)),
            "unexpected answer from GitLab: `diff_refs.head_sha` is not a text"
        );
        assert!(field_named(b"<html>").starts_with("GitLab's answer is not JSON: "));
        assert_eq!(
            listed_from(br#"{"message":"404 Not Found"}"#),
            Err("unexpected answer from GitLab: `merge requests` is not a list".to_owned())
        );
        assert_eq!(
            listed_from(br#"[{"project_id":7,"iid":12,"state":"opened"}]"#),
            Err("unexpected answer from GitLab: `sha` is not a text".to_owned())
        );
        assert_eq!(
            draft_id_from(br#"{"id":-1}"#),
            Err("unexpected answer from GitLab: `id` is not a number".to_owned())
        );
    }

    #[test]
    fn gitlab_s_words_are_its_message_or_its_error() {
        let words = |json: &[u8]| error_message_from(json);
        assert_eq!(
            words(br#"{"message":"400 Bad request"}"#),
            Some("400 Bad request".to_owned())
        );
        assert_eq!(
            words(br#"{"message":{"note":["is too long"]}}"#),
            Some(r#"{"note":["is too long"]}"#.to_owned())
        );
        assert_eq!(
            words(br#"{"error":"invalid_token"}"#),
            Some("invalid_token".to_owned())
        );
        assert_eq!(
            words(br#"{"message":null,"error":"x"}"#),
            Some("x".to_owned())
        );
        assert_eq!(words(b"{}"), None);
        assert_eq!(words(b"Bad Gateway"), None);
    }

    #[test]
    fn the_calls_name_the_merge_request_s_project_and_iid() {
        let listed = Listed {
            project_id: 7,
            iid: 12,
            is_open: true,
            head: "h".to_owned(),
        };
        assert_eq!(
            merge_request_details(&listed),
            ["api", "projects/7/merge_requests/12"]
        );
        let request = merge_request_from(REQUEST.as_bytes()).unwrap();
        assert_eq!(
            draft_notes(&request),
            [
                "api",
                "--paginate",
                "projects/7/merge_requests/12/draft_notes"
            ]
        );
        assert_eq!(
            merge_requests_of_commit("abc"),
            [
                "api",
                "projects/:fullpath/repository/commits/abc/merge_requests"
            ]
        );
    }
}
