use serde::Deserialize;

use crate::page::count;
use crate::{DiscussionId, PendingDraft};

/// A draft as `GET …/draft_notes` lists it (`docs.gitlab.com/api/draft_notes`); `discussion_id` is null for a draft
/// that starts a discussion.
#[derive(Deserialize)]
struct DraftNode {
    discussion_id: Option<String>,
    note: String,
}

/// The viewer's drafts in one discussion, and how many they have on the merge request.
pub(super) struct Drafts {
    pub drafts: Vec<PendingDraft>,
    pub pending: u32,
}

/// The drafts `glab api --paginate` printed (one JSON array, or one per page): those whose `discussion_id` is
/// `discussion`'s, in GitLab's order, and the count of all.
pub(super) fn drafts_in(json: &[u8], discussion: &DiscussionId) -> Result<Drafts, String> {
    let mut drafts = Vec::new();
    let mut all = 0;
    for page in serde_json::Deserializer::from_slice(json).into_iter::<Vec<DraftNode>>() {
        let page = page
            .map_err(|error| format!("GitLab's draft notes are not what yamt expects: {error}"))?;
        all += page.len();
        for draft in page {
            if draft.discussion_id.as_deref() == Some(discussion.as_str()) {
                drafts.push(PendingDraft { text: draft.note });
            }
        }
    }
    Ok(Drafts {
        drafts,
        pending: count(all),
    })
}
