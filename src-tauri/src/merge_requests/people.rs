use yamt_merge_requests::{
    Glab, MergeRequestIid, PeopleChange, PeopleChangeReply, PeopleSearchReply, change_people,
    search_people,
};

use super::{MergeRequestState, NO_PROJECT};

/// No GitLab project → `Failed`; else glab searches, and the uploaded pictures of the people found are offered
/// before the reply is returned.
pub(super) fn search_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    text: &str,
) -> PeopleSearchReply {
    let Some(repository) = &state.gitlab else {
        return PeopleSearchReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    let found = search_people(repository, glab, text);
    state.pictures.offer(found.pictures);
    found.reply
}

/// No GitLab project → `Failed`; else glab asks for the change, and the uploaded pictures of everyone in GitLab's
/// answered lists are offered before the reply is returned.
pub(super) fn change_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    change: &PeopleChange,
) -> PeopleChangeReply {
    let Some(repository) = &state.gitlab else {
        return PeopleChangeReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    let changed = change_people(repository, glab, iid, change);
    state.pictures.offer(changed.pictures);
    changed.reply
}
