use yamt_merge_requests::{
    DiscussionsAnswer, Glab, MergeRequestIid, OpenDiscussion, RowDiscussions, read_discussions,
    unread_discussions,
};

use super::{MergeRequestState, NO_PROJECT, offer};

/// No GitLab project → each asked row fails; else glab reads them, and every answered note's page and the authors'
/// uploaded pictures are offered before the rows are returned. Never holds `pages` while glab runs.
pub(super) fn discussions_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iids: &[MergeRequestIid],
) -> Vec<RowDiscussions> {
    let Some(repository) = &state.gitlab else {
        return unread_discussions(iids, NO_PROJECT);
    };
    let read = read_discussions(repository, glab, iids);
    let notes = read.rows.iter().flat_map(open_discussions);
    offer(
        state,
        notes.filter_map(|open| open.last.page.clone()),
        read.pictures,
    );
    read.rows
}

fn open_discussions(row: &RowDiscussions) -> &[OpenDiscussion] {
    let DiscussionsAnswer::Open { discussions } = &row.answer else {
        return &[];
    };
    discussions
}
