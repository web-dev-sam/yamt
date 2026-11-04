use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::OfferedPicture;
use crate::picture::{AvatarSource, GravatarAddress, avatar_source};

/// A GitLab user and the picture the window may show for them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    /// The login name, without "@".
    pub username: String,
    /// The display name.
    pub name: String,
    /// The picture the window shows for them.
    pub picture: PersonPicture,
}

/// Which picture the window shows for a person.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PersonPicture {
    /// Uploaded to the project's GitLab: the window asks `yamt-picture://localhost/<username>`.
    Uploaded,
    /// A Gravatar picture: the window loads this address itself.
    Gravatar {
        /// The picture's address on Gravatar.
        address: GravatarAddress,
    },
    /// Nothing yamt may load: initials.
    None,
}

/// How far a reviewer's review is: GitLab's state in the four the window names.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ReviewState {
    /// Their review is asked for, or under way.
    Requested,
    /// They reviewed without approving.
    Reviewed,
    /// They approved.
    Approved,
    /// They asked for changes.
    ChangesRequested,
}

/// A reviewer of a merge request and how far their review is.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Reviewer {
    /// Who reviews.
    pub person: Person,
    /// How far their review is.
    pub state: ReviewState,
}

/// A GitLab user as the queries ask for them; the `Person` it becomes.
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserNode {
    username: String,
    /// GitLab always sends it; the recorded pages of older scenarios name approvers by username only.
    #[serde(default)]
    name: String,
    avatar_url: Option<String>,
}

/// A reviewer as the queries ask for them.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReviewerNode {
    #[serde(flatten)]
    user: UserNode,
    merge_request_interaction: Option<Interaction>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Interaction {
    approved: bool,
    review_state: Option<String>,
}

impl ReviewerNode {
    pub fn username(&self) -> &str {
        &self.user.username
    }
}

/// Turns GitLab's users into people: each uploaded picture is collected for the shell to offer, each review state
/// yamt does not know is collected for one warning per load.
pub(crate) struct People<'a> {
    origin: Option<&'a str>,
    pub pictures: Vec<OfferedPicture>,
    pub unknown_states: BTreeSet<String>,
}

impl People<'_> {
    pub fn new(origin: Option<&str>) -> People<'_> {
        People {
            origin,
            pictures: Vec::new(),
            unknown_states: BTreeSet::new(),
        }
    }

    pub fn person(&mut self, node: UserNode) -> Person {
        let picture = match avatar_source(self.origin, node.avatar_url.as_deref()) {
            AvatarSource::Uploaded(address) => {
                let username = node.username.clone();
                self.pictures.push(OfferedPicture { username, address });
                PersonPicture::Uploaded
            }
            AvatarSource::Gravatar(address) => PersonPicture::Gravatar { address },
            AvatarSource::None => PersonPicture::None,
        };
        Person {
            username: node.username,
            name: node.name,
            picture,
        }
    }

    pub fn persons(&mut self, nodes: Vec<UserNode>) -> Vec<Person> {
        nodes.into_iter().map(|node| self.person(node)).collect()
    }

    pub fn reviewers(&mut self, nodes: Vec<ReviewerNode>) -> Vec<Reviewer> {
        nodes.into_iter().map(|node| self.reviewer(node)).collect()
    }

    fn reviewer(&mut self, node: ReviewerNode) -> Reviewer {
        let state =
            review_state(node.merge_request_interaction.as_ref()).unwrap_or_else(|unknown| {
                self.unknown_states.insert(unknown.to_owned());
                ReviewState::Requested
            });
        Reviewer {
            person: self.person(node.user),
            state,
        }
    }
}

/// The reviewer's state as GitLab's own reviewer list folds it (`uncollapsed_reviewer_list.vue` `reviewStateIcon`):
/// the `approved` flag first, which a GitLab before 16.11 sends without an `APPROVED` state; `Err` names a state yamt
/// does not know, shown as requested.
fn review_state(interaction: Option<&Interaction>) -> Result<ReviewState, &str> {
    let Some(interaction) = interaction else {
        return Ok(ReviewState::Requested);
    };
    if interaction.approved {
        return Ok(ReviewState::Approved);
    }
    match interaction.review_state.as_deref() {
        None | Some("UNREVIEWED" | "REVIEW_STARTED") => Ok(ReviewState::Requested),
        Some("REVIEWED" | "UNAPPROVED") => Ok(ReviewState::Reviewed),
        Some("APPROVED") => Ok(ReviewState::Approved),
        Some("REQUESTED_CHANGES") => Ok(ReviewState::ChangesRequested),
        Some(unknown) => Err(unknown),
    }
}

/// Whether the reviewer's review is asked for and not yet done, as the window shows it.
pub(crate) fn is_awaiting_review(node: &ReviewerNode) -> bool {
    review_state(node.merge_request_interaction.as_ref()).unwrap_or(ReviewState::Requested)
        == ReviewState::Requested
}

pub(crate) fn warn_unknown_review_state(state: &str) {
    tracing::warn!(state, "unknown review state, shown as requested");
}
