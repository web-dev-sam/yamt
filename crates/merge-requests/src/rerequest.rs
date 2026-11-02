use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::{Glab, GlabRun, TIMED_OUT, last_line};

use crate::open::OPENED;
use crate::page::{NO_PROJECT, Nodes, graphql_data, listed};
use crate::people::{People, ReviewerNode, is_awaiting_review, warn_unknown_review_state};
use crate::project::{Project, logged_in_project};
use crate::query::{GRAPHQL_BODY_ARGS, rerequest_body, reviewers_args};
use crate::{GitLabRepository, MergeRequestIid, Reviewer};

const NO_MERGE_REQUEST: &str = "GitLab's answer names no merge request";
const GLAB_FAILED: &str = "glab failed without saying why";

/// How asking GitLab to re-request a reviewer's review ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RerequestReply {
    /// Done, or already awaiting their review; the merge request's reviewers as GitLab answered.
    Requested {
        /// The merge request's reviewers now.
        reviewers: Vec<Reviewer>,
    },
    /// They are no longer a reviewer of the merge request: nothing was written (owner #2100, #2104).
    NotReviewer,
    /// The merge request is no longer open.
    NotOpen,
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// GitLab refused, in its words (the mutation's first `errors` entry).
    Refused {
        /// GitLab's sentence.
        message: String,
    },
    /// glab failed, timed out or answered something unexpected, in glab's, GitLab's or yamt's words.
    Failed {
        /// What went wrong.
        message: String,
    },
}

#[derive(Deserialize)]
struct ReviewersData {
    project: Option<ReviewersProject>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewersProject {
    merge_request: Option<FreshMergeRequest>,
}

#[derive(Deserialize)]
struct FreshMergeRequest {
    state: String,
    reviewers: Option<Nodes<FreshReviewer>>,
}

/// A reviewer as GitLab has them now, with the global id the mutation takes.
#[derive(Deserialize)]
struct FreshReviewer {
    id: String,
    #[serde(flatten)]
    reviewer: ReviewerNode,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RereviewData {
    merge_request_reviewer_rereview: Option<Rereviewed>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Rereviewed {
    errors: Vec<String>,
    merge_request: Option<RereviewedMergeRequest>,
}

#[derive(Deserialize)]
struct RereviewedMergeRequest {
    reviewers: Option<Nodes<ReviewerNode>>,
}

/// Asks GitLab to request `username`'s review of merge request `iid` again, as GitLab's own "Re-request review" does:
/// only when they are still a reviewer and their review is not awaited already, so nothing adds a reviewer and no
/// one is notified twice. The mutation is the only write.
pub fn rerequest_review(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    username: &str,
) -> RerequestReply {
    let reply = asked_again(repository, glab, iid, username);
    tracing::info!(
        iid = iid.0,
        outcome = outcome(&reply),
        "asked GitLab to re-request a review"
    );
    reply
}

fn asked_again(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    username: &str,
) -> RerequestReply {
    let Some(glab) = glab else {
        return RerequestReply::GlabMissing;
    };
    let root = repository.root();
    let project = match logged_in_project(glab, root) {
        Ok(project) => project,
        Err(refused) => return refused.into(),
    };
    let reviewers = match fresh_reviewers(glab, root, &project, iid) {
        Ok(reviewers) => reviewers,
        Err(reply) => return reply,
    };
    let Some(asked) = reviewers
        .iter()
        .find(|fresh| fresh.reviewer.username() == username)
    else {
        return RerequestReply::NotReviewer;
    };
    if is_awaiting_review(&asked.reviewer) {
        let nodes = reviewers.into_iter().map(|fresh| fresh.reviewer);
        return requested(&project, nodes.collect());
    }
    let body = rerequest_body(&project.full_path, iid, &asked.id);
    rereviewed(glab.run(root, &GRAPHQL_BODY_ARGS, Some(body)), &project)
}

/// The reviewers of merge request `iid` as GitLab has them now; a merge request not open is `NotOpen`.
fn fresh_reviewers(
    glab: &Glab,
    root: &Path,
    project: &Project,
    iid: MergeRequestIid,
) -> Result<Vec<FreshReviewer>, RerequestReply> {
    let args = reviewers_args(&project.full_path, iid);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let json = glab.get(root, &args).map_err(failed)?;
    let data: ReviewersData = graphql_data(&json).map_err(failed)?;
    let found = data.project.ok_or_else(|| failed(NO_PROJECT.to_owned()))?;
    let open = found
        .merge_request
        .filter(|merge_request| merge_request.state == OPENED);
    let merge_request = open.ok_or(RerequestReply::NotOpen)?;
    Ok(listed(merge_request.reviewers))
}

/// The reply to the mutation as glab ran it: glab's failure in its last line, GitLab's top-level error, the
/// mutation's own first error, or the reviewers it answered.
fn rereviewed(ran: yamt_gitio::Result<GlabRun>, project: &Project) -> RerequestReply {
    let stdout = match ran {
        Err(error) => return failed(error.to_string()),
        Ok(GlabRun::TimedOut) => return failed(TIMED_OUT.to_owned()),
        Ok(GlabRun::Failed { stderr, .. }) => {
            return failed(last_line(&stderr).unwrap_or_else(|| GLAB_FAILED.to_owned()));
        }
        Ok(GlabRun::Printed { stdout }) => stdout,
    };
    let data: RereviewData = match graphql_data(&stdout) {
        Ok(data) => data,
        Err(message) => return failed(message),
    };
    let Some(payload) = data.merge_request_reviewer_rereview else {
        return failed(NO_MERGE_REQUEST.to_owned());
    };
    if let Some(message) = payload.errors.into_iter().next() {
        return RerequestReply::Refused { message };
    }
    let Some(merge_request) = payload.merge_request else {
        return failed(NO_MERGE_REQUEST.to_owned());
    };
    requested(project, listed(merge_request.reviewers))
}

fn requested(project: &Project, nodes: Vec<ReviewerNode>) -> RerequestReply {
    let mut people = People::new(project.web_origin.as_deref());
    let reviewers = people.reviewers(nodes);
    for state in &people.unknown_states {
        warn_unknown_review_state(state);
    }
    RerequestReply::Requested { reviewers }
}

fn failed(message: String) -> RerequestReply {
    RerequestReply::Failed { message }
}

/// The reply's kind, as the log names it: never a person's picture or a message.
fn outcome(reply: &RerequestReply) -> &'static str {
    match reply {
        RerequestReply::Requested { .. } => "requested",
        RerequestReply::NotReviewer => "notReviewer",
        RerequestReply::NotOpen => "notOpen",
        RerequestReply::GlabMissing => "glabMissing",
        RerequestReply::NotLoggedIn { .. } => "notLoggedIn",
        RerequestReply::Refused { .. } => "refused",
        RerequestReply::Failed { .. } => "failed",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> Project {
        Project {
            full_path: "taskboard/taskboard".to_owned(),
            web_path: "/taskboard/taskboard".to_owned(),
            web_origin: Some("https://gitlab.example".to_owned()),
        }
    }

    fn ran(run: GlabRun) -> RerequestReply {
        rereviewed(Ok(run), &project())
    }

    fn glab_failed(stderr: &[u8]) -> GlabRun {
        GlabRun::Failed {
            status: Some(1),
            stdout: b"{\"errors\":[{\"message\":\"not this one\"}]}".to_vec(),
            stderr: stderr.to_vec(),
        }
    }

    fn printed(json: &str) -> GlabRun {
        GlabRun::Printed {
            stdout: json.as_bytes().to_vec(),
        }
    }

    #[test]
    fn glab_s_failure_is_its_last_line_and_a_time_out_glab_s_words() {
        let failed_with = |message: &str| RerequestReply::Failed {
            message: message.to_owned(),
        };
        let stderr =
            b"What's new\n\nglab: Variable $userId of type UserID! was provided invalid value\n";
        assert_eq!(
            ran(glab_failed(stderr)),
            failed_with("glab: Variable $userId of type UserID! was provided invalid value")
        );
        assert_eq!(ran(glab_failed(b"")), failed_with(GLAB_FAILED));
        assert_eq!(ran(GlabRun::TimedOut), failed_with(TIMED_OUT));
    }

    #[test]
    fn a_top_level_error_fails_and_a_payload_error_is_gitlab_s_refusal() {
        let top_level = r#"{"data":null,"errors":[{"message":"The resource that you are attempting to access does not exist"}]}"#;
        let refused = r#"{"data":{"mergeRequestReviewerRereview":{"errors":["first","second"],"mergeRequest":null}}}"#;
        let no_payload = r#"{"data":{"mergeRequestReviewerRereview":null}}"#;
        let no_merge_request =
            r#"{"data":{"mergeRequestReviewerRereview":{"errors":[],"mergeRequest":null}}}"#;

        let message = "The resource that you are attempting to access does not exist".to_owned();
        assert_eq!(ran(printed(top_level)), RerequestReply::Failed { message });
        let message = "first".to_owned();
        assert_eq!(ran(printed(refused)), RerequestReply::Refused { message });
        let no_answer = RerequestReply::Failed {
            message: NO_MERGE_REQUEST.to_owned(),
        };
        assert_eq!(ran(printed(no_payload)), no_answer);
        assert_eq!(ran(printed(no_merge_request)), no_answer);
    }

    #[test]
    fn the_log_names_each_outcome_by_its_kind() {
        let replies = [
            RerequestReply::Requested {
                reviewers: Vec::new(),
            },
            RerequestReply::NotReviewer,
            RerequestReply::NotOpen,
            RerequestReply::GlabMissing,
            RerequestReply::NotLoggedIn {
                detail: String::new(),
            },
            RerequestReply::Refused {
                message: String::new(),
            },
            RerequestReply::Failed {
                message: String::new(),
            },
        ];
        for reply in replies {
            let serialized = serde_json::to_value(&reply).unwrap();
            assert_eq!(serialized["kind"], outcome(&reply));
        }
    }
}
