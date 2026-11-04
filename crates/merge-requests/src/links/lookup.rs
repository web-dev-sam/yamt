use std::collections::BTreeMap;

use serde::Deserialize;
use url::Url;

use super::target::{Namespace, Server, Target, iid_of, reference, target_of};
use super::{LinkedParent, ShownEpic, ShownIssue};
use crate::WebPage;
use crate::page::{Complexity, Nodes, count, graphql_data, listed};
use crate::query::part_name;

/// GitLab's largest `workItems(iids:)` list (facts §11).
pub(crate) const MAX_IIDS_PER_PART: usize = 100;
/// What one part adds to GitLab's score beside its iids: 25 for one iid, 27 for three, 74 for fifty (measured
/// logged out on gitlab.com, 2026-11-04, design §1.2).
pub(crate) const PART_SCORE: u32 = 25;
/// The highest estimated score of one call, below GitLab's limit of 250 logged in (plan §2 #131).
pub(crate) const LOOKUP_BUDGET: u32 = 200;
/// GitLab's `WorkItemType.name` of an epic, and `WorkItemState` of a closed item (GraphQL reference).
const EPIC_TYPE: &str = "Epic";
const CLOSED_STATE: &str = "CLOSED";

/// The iids asked of one project or group.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Part {
    pub namespace: Namespace,
    pub iids: Vec<u64>,
}

/// What GitLab showed of an item: an epic, or an issue of any other type.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Shown {
    Epic(ShownEpic),
    Issue(ShownIssue),
}

/// The lookup's answers by item, and what its log line counts.
pub(crate) struct Looked {
    pub shown: BTreeMap<(Namespace, u64), Shown>,
    pub calls: u32,
    /// GitLab's highest score among the calls; None when it sent none.
    pub score: Option<u32>,
}

/// Asks GitLab for one call's parts.
pub(crate) type Fetch<'a> = dyn FnMut(&[Part]) -> Result<Vec<u8>, String> + 'a;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinksData {
    query_complexity: Option<Complexity>,
    /// `part<k>` → the namespace's work items; null for a namespace the user may not see, or none.
    #[serde(flatten)]
    parts: BTreeMap<String, Option<PartNode>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartNode {
    work_items: Option<Nodes<WorkItemNode>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkItemNode {
    iid: String,
    title: String,
    state: String,
    work_item_type: TypeNode,
    widgets: Option<Vec<WidgetNode>>,
}

#[derive(Deserialize)]
struct TypeNode {
    name: String,
}

#[derive(Deserialize)]
struct WidgetNode {
    parent: Option<ParentNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParentNode {
    title: String,
    web_url: String,
    work_item_type: TypeNode,
}

/// The parts in order of each namespace's first mention, its iids in order of first mention, cut at
/// `MAX_IIDS_PER_PART`; packed in that order into calls whose `PART_SCORE × parts + iids` stays ≤ `LOOKUP_BUDGET`.
pub(crate) fn calls(parts: Vec<Part>) -> Vec<Vec<Part>> {
    let mut calls: Vec<Vec<Part>> = Vec::new();
    let mut score = 0;
    for part in parts {
        for iids in part.iids.chunks(MAX_IIDS_PER_PART) {
            let cut = Part {
                namespace: part.namespace.clone(),
                iids: iids.to_vec(),
            };
            let cost = PART_SCORE + count(iids.len());
            match calls.last_mut() {
                Some(call) if score + cost <= LOOKUP_BUDGET => {
                    call.push(cut);
                    score += cost;
                }
                Some(_) | None => {
                    calls.push(vec![cut]);
                    score = cost;
                }
            }
        }
    }
    calls
}

/// Each call through `fetch`, one after another; glab's or GitLab's first error ends the lookup in its words. An
/// item GitLab did not send is not in `shown`.
pub(crate) fn looked_up(
    calls: &[Vec<Part>],
    server: &Server,
    project: &str,
    fetch: &mut Fetch,
) -> Result<Looked, String> {
    let mut looked = Looked {
        shown: BTreeMap::new(),
        calls: 0,
        score: None,
    };
    for call in calls {
        looked.calls += 1;
        let mut data: LinksData = fetch(call).and_then(|json| graphql_data(&json))?;
        let score = data.query_complexity.map(|complexity| complexity.score);
        looked.score = looked.score.max(score);
        for (k, part) in call.iter().enumerate() {
            let answered = data.parts.remove(&part_name(k)).flatten();
            let nodes = listed(answered.and_then(|answered| answered.work_items));
            for node in nodes {
                if let Some((iid, shown)) = shown_of(node, server, project) {
                    looked.shown.insert((part.namespace.clone(), iid), shown);
                }
            }
        }
    }
    Ok(looked)
}

/// An epic for GitLab's type `Epic`, else an issue with its direct parent; None for an iid that is no number.
fn shown_of(node: WorkItemNode, server: &Server, project: &str) -> Option<(u64, Shown)> {
    let iid = iid_of(&node.iid)?;
    let closed = node.state == CLOSED_STATE;
    let title = node.title;
    let shown = if node.work_item_type.name == EPIC_TYPE {
        Shown::Epic(ShownEpic { title, closed })
    } else {
        let parent = node
            .widgets
            .into_iter()
            .flatten()
            .find_map(|widget| widget.parent);
        Shown::Issue(ShownIssue {
            title,
            closed,
            parent: parent.and_then(|parent| linked_parent(parent, server, project)),
        })
    };
    Some((iid, shown))
}

/// The parent when its `webUrl` names an item on the project's server; its page is that address.
fn linked_parent(parent: ParentNode, server: &Server, project: &str) -> Option<LinkedParent> {
    let url = Url::parse(&parent.web_url).ok()?;
    let page = WebPage::linked(&url)?;
    let target = target_of(server, &page)?;
    let is_epic = parent.work_item_type.name == EPIC_TYPE;
    let reference = match &target {
        Target::Item { .. } => reference(&target, is_epic, project),
        Target::Commit { .. } | Target::Range { .. } => return None,
    };
    Some(LinkedParent {
        reference,
        title: parent.title,
        page,
    })
}
