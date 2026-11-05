use crate::MergeRequestIid;
use crate::page::{Connection, PageInfo};

use super::Fetch;
use super::answer::{DiscussionNode, MergeRequestNode, parsed_batch};

pub(super) const MAX_DISCUSSION_PAGES: u32 = 10;
const TOO_MANY_DISCUSSIONS: &str = "more than 1,000 discussions";
const NO_CURSOR: &str = "GitLab says more discussions follow, but sent no cursor for them";

pub(super) fn not_sent(iid: MergeRequestIid) -> String {
    format!("GitLab sent no merge request !{}", iid.0)
}

/// Merge request `iid` as the discussions query for `[iid]` answers it, from the page after `after`.
pub(crate) fn merge_request_page(
    iid: MergeRequestIid,
    after: Option<&str>,
    fetch: &mut Fetch,
) -> Result<MergeRequestNode, String> {
    let mut batch = fetch(&[iid], after).and_then(|json| parsed_batch(&json))?;
    batch
        .merge_requests
        .remove(&iid)
        .ok_or_else(|| not_sent(iid))
}

/// `first` and each later page of merge request `iid`'s discussions, at most `MAX_DISCUSSION_PAGES` pages.
pub(super) fn every_discussion(
    iid: MergeRequestIid,
    first: Connection<DiscussionNode>,
    fetch: &mut Fetch,
) -> Result<Vec<DiscussionNode>, String> {
    let mut discussions = Vec::new();
    let mut page = Some(first);
    let mut pages = 0;
    while let Some(read) = page {
        pages += 1;
        discussions.extend(read.nodes);
        page = later_page(iid, read.page_info, pages, fetch)?;
    }
    Ok(discussions)
}

/// The page of merge request `iid`'s discussions after `page_info`, once `pages` pages are read; `None` after the
/// last. A page past `MAX_DISCUSSION_PAGES` fails.
pub(crate) fn later_page(
    iid: MergeRequestIid,
    page_info: PageInfo,
    pages: u32,
    fetch: &mut Fetch,
) -> Result<Option<Connection<DiscussionNode>>, String> {
    if !page_info.has_next_page {
        return Ok(None);
    }
    if pages == MAX_DISCUSSION_PAGES {
        return Err(TOO_MANY_DISCUSSIONS.to_owned());
    }
    let cursor = page_info.end_cursor.ok_or(NO_CURSOR)?;
    let later = merge_request_page(iid, Some(&cursor), fetch)?;
    Ok(Some(later.discussions))
}
