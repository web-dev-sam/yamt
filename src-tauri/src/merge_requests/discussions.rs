use yamt_merge_requests::{
    DiscussionsAnswer, Glab, MergeRequestIid, RowDiscussions, read_discussions, unread_discussions,
};

use super::{MergeRequestState, NO_PROJECT, offered};

/// No GitLab project → each asked row fails; else glab reads them, and every answered note's page joins `pages` and
/// the authors' uploaded pictures are offered, both before the rows are returned. Never holds `pages` while glab
/// runs.
pub(super) fn discussions_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iids: &[MergeRequestIid],
) -> Vec<RowDiscussions> {
    let Some(repository) = &state.gitlab else {
        return unread_discussions(iids, NO_PROJECT);
    };
    let read = read_discussions(repository, glab, iids);
    let mut pages = offered(&state.pages);
    for row in &read.rows {
        if let DiscussionsAnswer::Open { discussions } = &row.answer {
            pages.extend(discussions.iter().filter_map(|open| open.last.page.clone()));
        }
    }
    drop(pages);
    state.pictures.offer(read.pictures);
    read.rows
}
