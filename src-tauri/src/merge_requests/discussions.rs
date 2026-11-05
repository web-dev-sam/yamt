use yamt_merge_requests::{
    Glab, MergeRequestIid, RowDiscussions, read_discussions, unread_discussions,
};

use super::{MergeRequestState, NO_PROJECT, offer};

/// No GitLab project → each asked row fails; else glab reads them, and every answered note's page, the first
/// comments' pages and uploads and the authors' uploaded pictures are offered before the rows are returned. Never
/// holds `pages` while glab runs.
pub(super) fn discussions_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iids: &[MergeRequestIid],
) -> Vec<RowDiscussions> {
    let Some(repository) = &state.gitlab else {
        return unread_discussions(iids, NO_PROJECT);
    };
    let read = read_discussions(repository, glab, iids);
    offer(state, read.pages, read.pictures);
    state.pictures.offer_uploads(read.uploads);
    read.rows
}
