use serde_json::{Value, json};

use super::*;
use crate::picture::{AvatarSource, avatar_source};
use crate::{PersonPicture, ReviewState};

const ORIGIN: &str = "https://gitlab.example";
const ERIK_S_AVATAR: &str = "/uploads/-/system/user/avatar/7/avatar.png";

fn project() -> Project {
    Project {
        full_path: "taskboard/taskboard".to_owned(),
        web_path: "/taskboard/taskboard".to_owned(),
        web_origin: Some(ORIGIN.to_owned()),
    }
}

fn change(group: PeopleGroup, action: PeopleAction, username: &str) -> PeopleChange {
    PeopleChange {
        group,
        action,
        username: username.to_owned(),
    }
}

fn user(username: &str) -> Value {
    json!({ "username": username, "name": username.to_uppercase(), "avatarUrl": null })
}

fn reviewer(username: &str) -> Value {
    let interaction = json!({ "approved": false, "reviewState": "UNREVIEWED" });
    json!({ "username": username, "name": username.to_uppercase(), "avatarUrl": null,
        "mergeRequestInteraction": interaction })
}

/// The mutation's answer listing `assignees` and `reviewers`, without pictures.
fn answer(assignees: &[&str], reviewers: &[&str]) -> Value {
    let assignees: Vec<Value> = assignees.iter().map(|username| user(username)).collect();
    let reviewers: Vec<Value> = reviewers
        .iter()
        .map(|username| reviewer(username))
        .collect();
    let merge_request =
        json!({ "assignees": { "nodes": assignees }, "reviewers": { "nodes": reviewers } });
    json!({ "data": { "changed": { "errors": [], "mergeRequest": merge_request } } })
}

fn answered_to(change: &PeopleChange, json: &Value) -> ChangedPeople {
    answered(Ok(json.to_string().into_bytes()), &project(), change)
}

fn kind(change: &PeopleChange, json: &Value) -> &'static str {
    outcome(&answered_to(change, json).reply)
}

fn person(username: &str) -> Person {
    Person {
        username: username.to_owned(),
        name: username.to_uppercase(),
        picture: PersonPicture::None,
    }
}

#[test]
fn an_added_person_in_the_answer_is_changed_and_missing_is_unchanged() {
    let add_assignee = change(PeopleGroup::Assignees, PeopleAction::Add, "erik");
    let add_reviewer = change(PeopleGroup::Reviewers, PeopleAction::Add, "erik");
    let assigned = answer(&["sam", "erik"], &["ben"]);
    let reviewing = answer(&["sam"], &["ben", "erik"]);

    assert_eq!(kind(&add_assignee, &assigned), "changed");
    assert_eq!(kind(&add_assignee, &reviewing), "unchanged");
    assert_eq!(kind(&add_reviewer, &reviewing), "changed");
    assert_eq!(kind(&add_reviewer, &assigned), "unchanged");
    let people = MergeRequestPeople {
        assignees: vec![person("sam")],
        reviewers: vec![Reviewer {
            person: person("ben"),
            state: ReviewState::Requested,
        }],
    };
    let dropped = answered_to(&add_assignee, &answer(&["sam"], &["ben"]));
    assert_eq!(dropped.reply, PeopleChangeReply::Unchanged { people });
}

#[test]
fn a_removed_person_missing_is_changed_and_still_listed_is_unchanged() {
    let remove_assignee = change(PeopleGroup::Assignees, PeopleAction::Remove, "sam");
    let remove_reviewer = change(PeopleGroup::Reviewers, PeopleAction::Remove, "sam");
    let assigned = answer(&["sam"], &["ben"]);
    let reviewing = answer(&["erik"], &["sam"]);

    assert_eq!(kind(&remove_assignee, &reviewing), "changed");
    assert_eq!(kind(&remove_assignee, &assigned), "unchanged");
    assert_eq!(kind(&remove_reviewer, &assigned), "changed");
    assert_eq!(kind(&remove_reviewer, &reviewing), "unchanged");
    let people = MergeRequestPeople {
        assignees: vec![person("erik")],
        reviewers: vec![Reviewer {
            person: person("sam"),
            state: ReviewState::Requested,
        }],
    };
    let removed = answered_to(&remove_assignee, &reviewing);
    assert_eq!(removed.reply, PeopleChangeReply::Changed { people });
}

#[test]
fn usernames_compare_without_ascii_case() {
    let add = change(PeopleGroup::Reviewers, PeopleAction::Add, "Erik");
    let remove = change(PeopleGroup::Assignees, PeopleAction::Remove, "SAM");

    assert_eq!(kind(&add, &answer(&[], &["erik"])), "changed");
    assert_eq!(kind(&remove, &answer(&["sam"], &[])), "unchanged");
}

#[test]
fn a_payload_error_is_refused_and_a_top_level_error_fails() {
    let add = change(PeopleGroup::Reviewers, PeopleAction::Add, "ghost");
    let refusal = "Reviewers not able to be set: ghost";
    let refused =
        json!({ "data": { "changed": { "errors": [refusal, "second"], "mergeRequest": null } } });
    let denial = "The resource that you are attempting to access does not exist or you don't have permission \
         to perform this action";
    let top_level = json!({ "data": { "changed": null }, "errors": [{ "message": denial }] });
    let deadline = "glab: a deadline line";

    let message = refusal.to_owned();
    let refused_reply = PeopleChangeReply::Refused { message };
    assert_eq!(answered_to(&add, &refused).reply, refused_reply);
    let message = denial.to_owned();
    let failed = PeopleChangeReply::Failed { message };
    assert_eq!(answered_to(&add, &top_level).reply, failed);
    let from_glab = answered(Err(deadline.to_owned()), &project(), &add).reply;
    let message = deadline.to_owned();
    assert_eq!(from_glab, PeopleChangeReply::Failed { message });
}

#[test]
fn no_payload_or_no_merge_request_fails() {
    let add = change(PeopleGroup::Assignees, PeopleAction::Add, "erik");
    let no_payload = json!({ "data": { "changed": null } });
    let no_answer = json!({ "data": { "changed": { "errors": [], "mergeRequest": null } } });

    for json in [no_payload, no_answer] {
        let failed = answered_to(&add, &json);
        let message = NO_MERGE_REQUEST.to_owned();
        let expected = without_pictures(PeopleChangeReply::Failed { message });
        assert_eq!(failed, expected, "{json}");
    }
}

#[test]
fn every_uploaded_picture_in_the_answer_is_offered_once() {
    let add = change(PeopleGroup::Reviewers, PeopleAction::Add, "erik");
    let mut json = answer(&["erik"], &["erik", "ben"]);
    let merge_request = &mut json["data"]["changed"]["mergeRequest"];
    merge_request["assignees"]["nodes"][0]["avatarUrl"] = json!(ERIK_S_AVATAR);
    merge_request["reviewers"]["nodes"][0]["avatarUrl"] = json!(ERIK_S_AVATAR);

    let changed = answered_to(&add, &json);

    let AvatarSource::Uploaded(address) = avatar_source(Some(ORIGIN), Some(ERIK_S_AVATAR)) else {
        panic!("not uploaded");
    };
    let username = "erik".to_owned();
    assert_eq!(changed.pictures, [OfferedPicture { username, address }]);
}

#[test]
fn the_log_names_each_outcome_by_its_kind() {
    let people = || MergeRequestPeople {
        assignees: Vec::new(),
        reviewers: Vec::new(),
    };
    let replies = [
        PeopleChangeReply::Changed { people: people() },
        PeopleChangeReply::Unchanged { people: people() },
        PeopleChangeReply::GlabMissing,
        PeopleChangeReply::NotLoggedIn {
            detail: String::new(),
        },
        PeopleChangeReply::Refused {
            message: String::new(),
        },
        PeopleChangeReply::Failed {
            message: String::new(),
        },
    ];
    for reply in replies {
        let serialized = serde_json::to_value(&reply).unwrap();
        assert_eq!(serialized["kind"], outcome(&reply));
    }
}
