use std::collections::BTreeMap;

use serde::Deserialize;

use crate::MergeRequestIid;
use crate::page::{Complexity, Connection, NO_PROJECT, Nodes, graphql_data, merge_request_iid};
use crate::people::UserNode;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Data {
    query_complexity: Option<Complexity>,
    project: Option<ProjectNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectNode {
    merge_requests: Option<Nodes<MergeRequestNode>>,
}

/// A merge request as the discussions query asks for it: whether the viewer may comment, beside its discussions.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MergeRequestNode {
    iid: String,
    pub discussion_locked: bool,
    pub user_permissions: NotePermission,
    pub discussions: Connection<DiscussionNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotePermission {
    pub create_note: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiscussionNode {
    /// GitLab's global id, `gid://gitlab/Discussion/<hex>`.
    pub id: String,
    pub resolvable: bool,
    pub resolved: bool,
    pub user_permissions: ResolvePermission,
    pub notes: NoteConnection,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResolvePermission {
    pub resolve_note: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NoteConnection {
    pub page_info: NotesPageInfo,
    pub nodes: Vec<NoteNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotesPageInfo {
    pub has_next_page: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NoteNode {
    pub system: bool,
    pub author: Option<UserNode>,
    pub body: String,
    /// GitLab's rendering of `body`; GitLab's schema lets it be null.
    pub body_html: Option<String>,
    pub created_at: String,
    pub last_edited_at: Option<String>,
    pub last_edited_by: Option<UserNode>,
    pub url: Option<String>,
    pub position: Option<PositionNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PositionNode {
    pub file_path: String,
    pub new_line: Option<u32>,
    pub old_line: Option<u32>,
}

/// One GraphQL answer of the discussions query: each merge request by iid.
pub(crate) struct Batch {
    pub complexity: Option<Complexity>,
    pub merge_requests: BTreeMap<MergeRequestIid, MergeRequestNode>,
}

/// `Err` holds GitLab's first error, or what yamt could not read.
pub(crate) fn parsed_batch(json: &[u8]) -> Result<Batch, String> {
    let data: Data = graphql_data(json)?;
    let nodes = data
        .project
        .and_then(|found| found.merge_requests)
        .ok_or(NO_PROJECT)?
        .nodes;
    let mut merge_requests = BTreeMap::new();
    for node in nodes {
        merge_requests.insert(merge_request_iid(&node.iid)?, node);
    }
    Ok(Batch {
        complexity: data.query_complexity,
        merge_requests,
    })
}
