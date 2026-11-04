use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::Glab;

use crate::list::one_per_username;
use crate::page::{NO_PROJECT, graphql_data};
use crate::people::{People, UserNode};
use crate::project::Project;
use crate::query::people_search_args;
use crate::{GitLabRepository, OfferedPicture, Person};

/// How searching the project's people ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PeopleSearchReply {
    /// Who matched, in GitLab's order: at most 20 (GitLab's `Autocomplete::UsersFinder::LIMIT`).
    Found {
        /// The people found.
        people: Vec<Person>,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// glab's, GitLab's or yamt's words (an older GitLab's "Field 'autocompleteUsers' doesn't exist…" included).
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// What the shell gets: the reply and its people's uploaded pictures, to offer before replying. Not IPC.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FoundPeople {
    /// The reply the window gets.
    pub reply: PeopleSearchReply,
    /// The uploaded pictures of the people found, one per username.
    pub pictures: Vec<OfferedPicture>,
}

#[derive(Deserialize)]
struct SearchData {
    project: Option<SearchProject>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchProject {
    autocomplete_users: Option<Vec<UserNode>>,
}

/// The project's people whose name, username or public email matches `text`, as GitLab's own dropdown asks: one
/// query, nothing written.
pub fn search_people(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    text: &str,
) -> FoundPeople {
    let found = searched(repository, glab, text);
    let count = match &found.reply {
        PeopleSearchReply::Found { people } => people.len(),
        PeopleSearchReply::GlabMissing
        | PeopleSearchReply::NotLoggedIn { .. }
        | PeopleSearchReply::Failed { .. } => 0,
    };
    tracing::info!(
        outcome = outcome(&found.reply),
        count,
        "searched the project's people"
    );
    found
}

/// glab missing → `GlabMissing`; the remembered project; the search; its failure's words through `refusal`.
fn searched(repository: &GitLabRepository, glab: Option<&Glab>, text: &str) -> FoundPeople {
    let Some(glab) = glab else {
        return without_pictures(PeopleSearchReply::GlabMissing);
    };
    let project = match repository.logged_in_project(glab) {
        Ok(project) => project,
        Err(refused) => return without_pictures(refused.into()),
    };
    let args = people_search_args(&project.full_path, text);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let found = found_people(glab.get(repository.root(), &args), &project);
    if let PeopleSearchReply::Failed { message } = found.reply {
        return without_pictures(repository.refusal(glab, message).into());
    }
    found
}

/// The reply to the search as glab ran it: glab's failure, GitLab's first error, or the people it found.
fn found_people(ran: Result<Vec<u8>, String>, project: &Project) -> FoundPeople {
    let data: SearchData = match ran.and_then(|json| graphql_data(&json)) {
        Ok(data) => data,
        Err(message) => return without_pictures(PeopleSearchReply::Failed { message }),
    };
    let Some(found) = data.project else {
        let message = NO_PROJECT.to_owned();
        return without_pictures(PeopleSearchReply::Failed { message });
    };
    let mut people = People::new(project.web_origin.as_deref());
    let nodes = found.autocomplete_users.unwrap_or_default();
    FoundPeople {
        reply: PeopleSearchReply::Found {
            people: people.persons(nodes),
        },
        pictures: one_per_username(people.pictures),
    }
}

fn without_pictures(reply: PeopleSearchReply) -> FoundPeople {
    FoundPeople {
        reply,
        pictures: Vec::new(),
    }
}

/// The reply's kind, as the log names it: never the searched text or a name.
fn outcome(reply: &PeopleSearchReply) -> &'static str {
    match reply {
        PeopleSearchReply::Found { .. } => "found",
        PeopleSearchReply::GlabMissing => "glabMissing",
        PeopleSearchReply::NotLoggedIn { .. } => "notLoggedIn",
        PeopleSearchReply::Failed { .. } => "failed",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::PersonPicture;
    use crate::picture::{AvatarSource, avatar_source};

    const ORIGIN: &str = "https://gitlab.example";

    fn project() -> Project {
        Project {
            full_path: "taskboard/taskboard".to_owned(),
            web_path: "/taskboard/taskboard".to_owned(),
            web_origin: Some(ORIGIN.to_owned()),
        }
    }

    fn printed(json: &str) -> FoundPeople {
        found_people(Ok(json.as_bytes().to_vec()), &project())
    }

    fn failed(message: &str) -> FoundPeople {
        without_pictures(PeopleSearchReply::Failed {
            message: message.to_owned(),
        })
    }

    #[test]
    fn found_people_keep_gitlabs_order_and_each_uploaded_picture_is_offered_once() {
        let json = r#"{"data":{"project":{"autocompleteUsers":[
            {"username":"erik","name":"Erik Lund","avatarUrl":"/uploads/-/system/user/avatar/7/avatar.png"},
            {"username":"ghost","name":"Ghost User","avatarUrl":null}]}}}"#;

        let found = printed(json);

        let person = |username: &str, name: &str, picture| Person {
            username: username.to_owned(),
            name: name.to_owned(),
            picture,
        };
        let people = vec![
            person("erik", "Erik Lund", PersonPicture::Uploaded),
            person("ghost", "Ghost User", PersonPicture::None),
        ];
        assert_eq!(found.reply, PeopleSearchReply::Found { people });
        let source = avatar_source(
            Some(ORIGIN),
            Some("/uploads/-/system/user/avatar/7/avatar.png"),
        );
        let AvatarSource::Uploaded(address) = source else {
            panic!("not uploaded");
        };
        let username = "erik".to_owned();
        assert_eq!(found.pictures, [OfferedPicture { username, address }]);
    }

    #[test]
    fn no_project_fails_and_no_autocomplete_answer_finds_nobody() {
        let no_project = r#"{"data":{"project":null}}"#;
        let no_users = r#"{"data":{"project":{"autocompleteUsers":null}}}"#;

        assert_eq!(printed(no_project), failed(NO_PROJECT));
        let nobody = PeopleSearchReply::Found { people: Vec::new() };
        assert_eq!(printed(no_users), without_pictures(nobody));
    }

    #[test]
    fn glabs_failure_and_gitlabs_error_are_the_message() {
        let older_gitlab = r#"{"errors":[{"message":"Field 'autocompleteUsers' doesn't exist on type 'Project'"}]}"#;
        let deadline = "glab: a deadline line".to_owned();

        let from_glab = found_people(Err(deadline.clone()), &project());

        assert_eq!(from_glab, failed(&deadline));
        let refused = "Field 'autocompleteUsers' doesn't exist on type 'Project'";
        assert_eq!(printed(older_gitlab), failed(refused));
    }

    #[test]
    fn the_log_names_each_outcome_by_its_kind() {
        let replies = [
            PeopleSearchReply::Found { people: Vec::new() },
            PeopleSearchReply::GlabMissing,
            PeopleSearchReply::NotLoggedIn {
                detail: String::new(),
            },
            PeopleSearchReply::Failed {
                message: String::new(),
            },
        ];
        for reply in replies {
            let serialized = serde_json::to_value(&reply).unwrap();
            assert_eq!(serialized["kind"], outcome(&reply));
        }
    }
}
