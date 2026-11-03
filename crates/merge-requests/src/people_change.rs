use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::Glab;

use crate::list::one_per_username;
use crate::page::{NO_MERGE_REQUEST, Nodes, graphql_data, listed};
use crate::people::{People, ReviewerNode, UserNode, warn_unknown_review_state};
use crate::project::{Project, logged_in_project};
use crate::query::{GRAPHQL_BODY_ARGS, people_change_body};
use crate::{GitLabRepository, MergeRequestIid, OfferedPicture, Person, Reviewer};

/// Which list of a merge request a change is for.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PeopleGroup {
    /// Its assignees.
    Assignees,
    /// Its reviewers.
    Reviewers,
}

/// Whether a change adds a person to a list or removes them from it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PeopleAction {
    /// Add them to GitLab's list as it is then (`APPEND`).
    Add,
    /// Remove them from GitLab's list as it is then (`REMOVE`).
    Remove,
}

/// One person added to or removed from one list of a merge request.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PeopleChange {
    /// The list.
    pub group: PeopleGroup,
    /// Add or remove.
    pub action: PeopleAction,
    /// Who, by their login name without "@".
    pub username: String,
}

/// A merge request's assignees and reviewers as GitLab answered.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequestPeople {
    /// Its assignees.
    pub assignees: Vec<Person>,
    /// Its reviewers and how far each review is.
    pub reviewers: Vec<Reviewer>,
}

/// How asking GitLab for one change ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PeopleChangeReply {
    /// GitLab's answered list shows the change: both lists as answered.
    Changed {
        /// Both lists as GitLab answered.
        people: MergeRequestPeople,
    },
    /// GitLab answered without an error but its list does not show the change (GitLab Free keeps one assignee and one
    /// reviewer; no permission; an unknown user): both lists as answered.
    Unchanged {
        /// Both lists as GitLab answered.
        people: MergeRequestPeople,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// GitLab refused, in its words: the payload's first `errors` entry.
    Refused {
        /// GitLab's sentence.
        message: String,
    },
    /// glab failed, GitLab's top-level error, or an answer naming no merge request.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// Not IPC: the reply and the uploaded pictures of everyone in its lists.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangedPeople {
    /// The reply the window gets.
    pub reply: PeopleChangeReply,
    /// The uploaded pictures of everyone in the answered lists, one per username.
    pub pictures: Vec<OfferedPicture>,
}

/// Both mutations' answers: their field is aliased `changed`.
#[derive(Deserialize)]
struct ChangeData {
    changed: Option<ChangePayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangePayload {
    errors: Vec<String>,
    merge_request: Option<ChangedMergeRequest>,
}

#[derive(Deserialize)]
struct ChangedMergeRequest {
    assignees: Option<Nodes<UserNode>>,
    reviewers: Option<Nodes<ReviewerNode>>,
}

/// Asks GitLab for `change` on merge request `iid`, against GitLab's list at that moment: one `APPEND` or `REMOVE`
/// of one username, nothing read before it; GitLab's answered list tells whether the change shows.
pub fn change_people(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    change: &PeopleChange,
) -> ChangedPeople {
    let changed = asked(repository.root(), glab, iid, change);
    tracing::info!(
        iid = iid.0,
        group = ?change.group,
        action = ?change.action,
        outcome = outcome(&changed.reply),
        "asked GitLab to change a merge request's people"
    );
    changed
}

fn asked(
    root: &Path,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    change: &PeopleChange,
) -> ChangedPeople {
    let Some(glab) = glab else {
        return without_pictures(PeopleChangeReply::GlabMissing);
    };
    let project = match logged_in_project(glab, root) {
        Ok(project) => project,
        Err(refused) => return without_pictures(refused.into()),
    };
    let body = people_change_body(&project.full_path, iid, change);
    answered(glab.post(root, &GRAPHQL_BODY_ARGS, body), &project, change)
}

/// The reply to the mutation as glab ran it: glab's failure, GitLab's top-level error, the mutation's own first
/// error, or both lists as GitLab answered them.
fn answered(
    ran: Result<Vec<u8>, String>,
    project: &Project,
    change: &PeopleChange,
) -> ChangedPeople {
    let data: ChangeData = match ran.and_then(|stdout| graphql_data(&stdout)) {
        Ok(data) => data,
        Err(message) => return without_pictures(PeopleChangeReply::Failed { message }),
    };
    let Some(payload) = data.changed else {
        return without_pictures(no_merge_request());
    };
    if let Some(message) = payload.errors.into_iter().next() {
        return without_pictures(PeopleChangeReply::Refused { message });
    }
    let Some(merge_request) = payload.merge_request else {
        return without_pictures(no_merge_request());
    };
    let mut people = People::new(project.web_origin.as_deref());
    let answered = MergeRequestPeople {
        assignees: people.persons(listed(merge_request.assignees)),
        reviewers: people.reviewers(listed(merge_request.reviewers)),
    };
    for state in &people.unknown_states {
        warn_unknown_review_state(state);
    }
    let reply = if is_shown(change, &answered) {
        PeopleChangeReply::Changed { people: answered }
    } else {
        PeopleChangeReply::Unchanged { people: answered }
    };
    ChangedPeople {
        reply,
        pictures: one_per_username(people.pictures),
    }
}

/// Whether GitLab's answered lists show `change`: an added person listed, a removed one not; usernames compared
/// without ASCII case, as GitLab's `unresolved_usernames` does.
fn is_shown(change: &PeopleChange, people: &MergeRequestPeople) -> bool {
    let is_asked = |person: &Person| person.username.eq_ignore_ascii_case(&change.username);
    let is_listed = match change.group {
        PeopleGroup::Assignees => people.assignees.iter().any(is_asked),
        PeopleGroup::Reviewers => people
            .reviewers
            .iter()
            .any(|reviewer| is_asked(&reviewer.person)),
    };
    match change.action {
        PeopleAction::Add => is_listed,
        PeopleAction::Remove => !is_listed,
    }
}

fn no_merge_request() -> PeopleChangeReply {
    PeopleChangeReply::Failed {
        message: NO_MERGE_REQUEST.to_owned(),
    }
}

fn without_pictures(reply: PeopleChangeReply) -> ChangedPeople {
    ChangedPeople {
        reply,
        pictures: Vec::new(),
    }
}

/// The reply's kind, as the log names it: never a username or a message.
fn outcome(reply: &PeopleChangeReply) -> &'static str {
    match reply {
        PeopleChangeReply::Changed { .. } => "changed",
        PeopleChangeReply::Unchanged { .. } => "unchanged",
        PeopleChangeReply::GlabMissing => "glabMissing",
        PeopleChangeReply::NotLoggedIn { .. } => "notLoggedIn",
        PeopleChangeReply::Refused { .. } => "refused",
        PeopleChangeReply::Failed { .. } => "failed",
    }
}

#[cfg(test)]
mod tests;
