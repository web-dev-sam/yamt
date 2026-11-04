use serde_json::json;

use crate::web_page::ESCAPED_SLASH;
use crate::{DiscussionId, MergeRequestIid};

/// `projects/<full path, "/" as "%2F">/merge_requests/<iid>`, the REST routes' merge request.
fn merge_request_route(full_path: &str, iid: MergeRequestIid) -> String {
    let project = full_path.replace('/', ESCAPED_SLASH);
    format!("projects/{project}/merge_requests/{}", iid.0)
}

/// `glab api --include --method <method> <endpoint> --input -`: one write, its JSON body on stdin, its HTTP answer
/// read by `HttpAnswer`.
fn write_args(method: &str, endpoint: String) -> Vec<String> {
    vec![
        "api".to_owned(),
        "--include".to_owned(),
        "--method".to_owned(),
        method.to_owned(),
        endpoint,
        "--input".to_owned(),
        "-".to_owned(),
    ]
}

/// The viewer's draft notes on merge request `iid`, every page (`docs.gitlab.com/api/draft_notes`).
pub(crate) fn draft_notes_args(full_path: &str, iid: MergeRequestIid) -> Vec<String> {
    let endpoint = format!("{}/draft_notes", merge_request_route(full_path, iid));
    vec!["api".to_owned(), "--paginate".to_owned(), endpoint]
}

/// A reply to discussion `discussion` ("Add note to existing merge request thread", docs.gitlab.com/api/discussions).
pub(crate) fn reply_args(
    full_path: &str,
    iid: MergeRequestIid,
    discussion: &DiscussionId,
) -> Vec<String> {
    let route = merge_request_route(full_path, iid);
    let endpoint = format!("{route}/discussions/{}/notes", discussion.as_str());
    write_args("POST", endpoint)
}

/// A draft note ("Create a draft note", `docs.gitlab.com/api/draft_notes`).
pub(crate) fn draft_reply_args(full_path: &str, iid: MergeRequestIid) -> Vec<String> {
    let endpoint = format!("{}/draft_notes", merge_request_route(full_path, iid));
    write_args("POST", endpoint)
}

/// Resolving or unresolving `discussion` ("Resolve a merge request thread", `docs.gitlab.com/api/discussions`).
pub(crate) fn resolve_args(
    full_path: &str,
    iid: MergeRequestIid,
    discussion: &DiscussionId,
) -> Vec<String> {
    let route = merge_request_route(full_path, iid);
    let endpoint = format!("{route}/discussions/{}", discussion.as_str());
    write_args("PUT", endpoint)
}

/// Publishing every draft note of the viewer ("Publish all pending draft notes", `docs.gitlab.com/api/draft_notes`).
pub(crate) fn submit_review_args(full_path: &str, iid: MergeRequestIid) -> Vec<String> {
    let route = merge_request_route(full_path, iid);
    write_args("POST", format!("{route}/draft_notes/bulk_publish"))
}

/// GitLab's rendering of a text ("Render an arbitrary Markdown document", docs.gitlab.com/api/markdown); a read, so
/// no `--include`.
pub(crate) fn markdown_args() -> Vec<String> {
    Vec::from(["api", "--method", "POST", "markdown", "--input", "-"].map(str::to_owned))
}

pub(crate) fn reply_body(text: &str) -> Vec<u8> {
    json!({ "body": text }).to_string().into_bytes()
}

pub(crate) fn draft_reply_body(text: &str, discussion: &DiscussionId) -> Vec<u8> {
    let body = json!({ "note": text, "in_reply_to_discussion_id": discussion.as_str() });
    body.to_string().into_bytes()
}

pub(crate) fn resolve_body(resolve: bool) -> Vec<u8> {
    json!({ "resolved": resolve }).to_string().into_bytes()
}

/// No `reviewer_state`: submitting never approves or asks for changes (request non-goal).
pub(crate) fn submit_review_body() -> Vec<u8> {
    json!({}).to_string().into_bytes()
}

pub(crate) fn markdown_body(text: &str, full_path: &str) -> Vec<u8> {
    let body = json!({ "text": text, "gfm": true, "project": full_path });
    body.to_string().into_bytes()
}
