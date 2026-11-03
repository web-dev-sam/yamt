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

#[derive(Deserialize)]
struct MergeRequestNode {
    iid: String,
    discussions: Connection<DiscussionNode>,
}

#[derive(Deserialize)]
pub(super) struct DiscussionNode {
    pub resolvable: bool,
    pub resolved: bool,
    pub notes: NoteConnection,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct NoteConnection {
    pub page_info: NotesPageInfo,
    pub nodes: Vec<NoteNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct NotesPageInfo {
    pub has_previous_page: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct NoteNode {
    pub system: bool,
    pub author: Option<UserNode>,
    pub body: String,
    pub created_at: String,
    pub url: Option<String>,
    pub position: Option<PositionNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PositionNode {
    pub file_path: String,
    pub new_line: Option<u32>,
    pub old_line: Option<u32>,
}

/// One GraphQL answer of the discussions query: each merge request's discussions by iid.
pub(super) struct Batch {
    pub complexity: Option<Complexity>,
    pub merge_requests: BTreeMap<MergeRequestIid, Connection<DiscussionNode>>,
}

/// `Err` holds GitLab's first error, or what yamt could not read.
pub(super) fn parsed_batch(json: &[u8]) -> Result<Batch, String> {
    let data: Data = graphql_data(json)?;
    let nodes = data
        .project
        .and_then(|found| found.merge_requests)
        .ok_or(NO_PROJECT)?
        .nodes;
    let mut merge_requests = BTreeMap::new();
    for node in nodes {
        merge_requests.insert(merge_request_iid(&node.iid)?, node.discussions);
    }
    Ok(Batch {
        complexity: data.query_complexity,
        merge_requests,
    })
}
