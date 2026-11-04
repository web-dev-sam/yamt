use std::path::Path;
use std::sync::{Mutex, MutexGuard, PoisonError};

use serde::Deserialize;
use yamt_gitio::{AuthStatus, Glab};

use crate::page::NO_PROJECT;
use crate::web_page::HTTPS;
use crate::{
    DescriptionReply, DiscussionThreadReply, DiscussionWriteReply, DiscussionsAnswer,
    GitLabRepository, JobLogReply, LinksReply, ListEnd, MarkdownPreviewReply, OpenReply,
    PeopleChangeReply, PeopleSearchReply, RerequestReply, ResolveRefusal,
};

/// glab fills `:fullpath` with the project of the folder's remotes (glab docs, `glab api`).
const PROJECT_ROUTE: &str = "projects/:fullpath";
/// glab's last line for a REST call GitLab answers 401 ends so (`glab: 401 Unauthorized (HTTP 401)`, measured with
/// glab 1.126.0 against gitlab.com on 2026-11-04, `tests/glab/README.md`).
const UNAUTHORIZED: &str = "(HTTP 401)";
/// glab's whole line for a GraphQL call GitLab answers 401: GitLab's `errors[0].message`, no `(HTTP 401)` (measured
/// with glab 1.126.0 against gitlab.com on 2026-11-04, `tests/glab/README.md`).
const GRAPHQL_UNAUTHORIZED: &str = "glab: Invalid token";
/// GitLab's words for a project it does not find or the reader may not see (`tests/glab/README.md:73-75`).
const PROJECT_NOT_FOUND: &str = "404 Project Not Found";
/// GitLab's GraphQL error for a mutation sent without a login, and for a logged-in reader's missing or forbidden
/// merge request: `glab auth status` tells them apart (measured with glab 1.126.0 against gitlab.com on 2026-11-04,
/// `tests/glab/README.md`).
const NO_PERMISSION: &str = "The resource that you are attempting to access does not exist or you don't have permission to perform this action";

/// The GitLab project of the repository's remotes.
#[derive(Clone)]
pub(crate) struct Project {
    pub full_path: String,
    /// Its `web_url` after the origin: `/<full_path>` behind any sub-path GitLab is installed under; empty when
    /// GitLab is not on https.
    pub web_path: String,
    /// `https://<host[:port]>` of its web page; `None` when GitLab is not on https.
    pub web_origin: Option<String>,
}

#[derive(Deserialize)]
struct ProjectAnswer {
    path_with_namespace: String,
    web_url: String,
}

/// Why an action got no answer from GitLab: logged out, or a call failed.
pub(crate) enum NoProject {
    NotLoggedIn { detail: String },
    Failed { message: String },
}

/// The project glab named for a repository while logged in, kept for the app's run (plan §2 #187). Only this module
/// reads or writes it.
#[derive(Default)]
pub(crate) struct Remembered {
    project: Mutex<Option<Project>>,
}

impl Remembered {
    fn held(&self) -> MutexGuard<'_, Option<Project>> {
        self.project.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn forget(&self, reason: Forget) {
        *self.held() = None;
        let reason = match reason {
            Forget::Refresh => "refresh",
            Forget::Lost(Lost::Login) => "login",
            Forget::Lost(Lost::Project) => "project",
        };
        tracing::info!(reason, "forgot GitLab's login and project");
    }
}

/// What a failed call's words say is gone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Lost {
    Login,
    Project,
}

/// Why the remembered project is forgotten.
#[derive(Clone, Copy)]
enum Forget {
    Refresh,
    Lost(Lost),
}

impl GitLabRepository {
    /// The remembered project; else `glab auth status` (logged out → `NotLoggedIn` with glab's first line, failed →
    /// `Failed`) and `glab api projects/:fullpath`, remembered when found. The lock is held while asking, so actions
    /// started together ask once; a refusal is never remembered. One `tracing::info!` per ask (outcome only).
    pub(crate) fn logged_in_project(&self, glab: &Glab) -> Result<Project, NoProject> {
        let mut remembered = self.remembered.held();
        if let Some(project) = remembered.as_ref() {
            return Ok(project.clone());
        }
        let asked = asked_project(glab, self.root());
        let outcome = match &asked {
            Ok(_) => "found",
            Err(NoProject::NotLoggedIn { .. }) => "notLoggedIn",
            Err(NoProject::Failed { .. }) => "failed",
        };
        tracing::info!(outcome, "asked glab for the login and the project");
        let project = asked?;
        *remembered = Some(project.clone());
        Ok(project)
    }

    /// Forgets the remembered project (waiting for an ask in flight): the next action asks glab both again. One
    /// `tracing::info!` with the reason (`refresh`, `login`, `project`).
    pub fn forget_project(&self) {
        self.remembered.forget(Forget::Refresh);
    }

    /// `words`: the failure an action is about to reply with, after the project was found — a read's `Failed`
    /// message, a write's `HttpAnswer::glab_line`, or `NO_PROJECT`. When `lost(words)`: forgets, then one `glab auth
    /// status`; `Some(detail)` when it says logged out (the action replies `NotLoggedIn { detail }`), else None (the
    /// action replies as today). Not lost → None, nothing forgotten, no glab run. Never repeats the action's call (RK54).
    pub(crate) fn logged_out_after(&self, glab: &Glab, words: &str) -> Option<String> {
        let lost = lost(words)?;
        self.remembered.forget(Forget::Lost(lost));
        match glab.auth_status(self.root()) {
            AuthStatus::LoggedOut { detail } => Some(detail),
            AuthStatus::LoggedIn | AuthStatus::Failed { .. } => None,
        }
    }

    /// What an action replies for `message`, a failed call's words after the project was found: `NotLoggedIn` when
    /// `logged_out_after` says so, else `Failed` with `message`.
    pub(crate) fn refusal(&self, glab: &Glab, message: String) -> NoProject {
        match self.logged_out_after(glab, &message) {
            Some(detail) => NoProject::NotLoggedIn { detail },
            None => NoProject::Failed { message },
        }
    }
}

/// What a failed call's words say is gone: the login when they end `UNAUTHORIZED`, are `GRAPHQL_UNAUTHORIZED` or
/// hold `NO_PERMISSION`; the project when they hold `PROJECT_NOT_FOUND` or are `page.rs` `NO_PROJECT`; nothing for a
/// 403 (design §1.4) or any other words.
fn lost(words: &str) -> Option<Lost> {
    if words.ends_with(UNAUTHORIZED)
        || words == GRAPHQL_UNAUTHORIZED
        || words.contains(NO_PERMISSION)
    {
        Some(Lost::Login)
    } else if words.contains(PROJECT_NOT_FOUND) || words == NO_PROJECT {
        Some(Lost::Project)
    } else {
        None
    }
}

/// `glab auth status`, then the project of the repository's remotes once it says glab is logged in.
fn asked_project(glab: &Glab, root: &Path) -> Result<Project, NoProject> {
    match glab.auth_status(root) {
        AuthStatus::LoggedIn => {}
        AuthStatus::LoggedOut { detail } => return Err(NoProject::NotLoggedIn { detail }),
        AuthStatus::Failed { message } => return Err(NoProject::Failed { message }),
    }
    let json = glab
        .get(root, &["api", PROJECT_ROUTE])
        .map_err(|message| NoProject::Failed { message })?;
    project_from(&json).map_err(|message| NoProject::Failed { message })
}

fn project_from(json: &[u8]) -> Result<Project, String> {
    let answer: ProjectAnswer = serde_json::from_slice(json)
        .map_err(|error| format!("GitLab's project answer is not what yamt expects: {error}"))?;
    Ok(Project {
        full_path: answer.path_with_namespace,
        web_path: web_path(&answer.web_url),
        web_origin: web_origin(&answer.web_url),
    })
}

fn web_path(web_url: &str) -> String {
    web_url
        .strip_prefix(HTTPS)
        .and_then(|address| address.split_once('/'))
        .map_or_else(String::new, |(_, path)| format!("/{path}"))
}

fn web_origin(web_url: &str) -> Option<String> {
    let authority = web_url.strip_prefix(HTTPS)?.split('/').next()?;
    Some(format!("{HTTPS}{authority}"))
}

impl From<NoProject> for ListEnd {
    fn from(refused: NoProject) -> ListEnd {
        match refused {
            NoProject::NotLoggedIn { detail } => ListEnd::NotLoggedIn { detail },
            NoProject::Failed { message } => ListEnd::Failed { message },
        }
    }
}

impl From<NoProject> for OpenReply {
    fn from(refused: NoProject) -> OpenReply {
        match refused {
            NoProject::NotLoggedIn { detail } => OpenReply::NotLoggedIn { detail },
            NoProject::Failed { message } => OpenReply::Failed { message },
        }
    }
}

impl From<NoProject> for ResolveRefusal {
    fn from(refused: NoProject) -> ResolveRefusal {
        match refused {
            NoProject::NotLoggedIn { detail } => ResolveRefusal::NotLoggedIn { detail },
            NoProject::Failed { message } => ResolveRefusal::Failed { message },
        }
    }
}

impl From<NoProject> for RerequestReply {
    fn from(refused: NoProject) -> RerequestReply {
        match refused {
            NoProject::NotLoggedIn { detail } => RerequestReply::NotLoggedIn { detail },
            NoProject::Failed { message } => RerequestReply::Failed { message },
        }
    }
}

impl From<NoProject> for JobLogReply {
    fn from(refused: NoProject) -> JobLogReply {
        match refused {
            NoProject::NotLoggedIn { detail } => JobLogReply::NotLoggedIn { detail },
            NoProject::Failed { message } => JobLogReply::Failed { message },
        }
    }
}

impl From<NoProject> for DiscussionsAnswer {
    fn from(refused: NoProject) -> DiscussionsAnswer {
        match refused {
            NoProject::NotLoggedIn { detail } => DiscussionsAnswer::NotLoggedIn { detail },
            NoProject::Failed { message } => DiscussionsAnswer::Failed { message },
        }
    }
}

impl From<NoProject> for PeopleSearchReply {
    fn from(refused: NoProject) -> PeopleSearchReply {
        match refused {
            NoProject::NotLoggedIn { detail } => PeopleSearchReply::NotLoggedIn { detail },
            NoProject::Failed { message } => PeopleSearchReply::Failed { message },
        }
    }
}

impl From<NoProject> for PeopleChangeReply {
    fn from(refused: NoProject) -> PeopleChangeReply {
        match refused {
            NoProject::NotLoggedIn { detail } => PeopleChangeReply::NotLoggedIn { detail },
            NoProject::Failed { message } => PeopleChangeReply::Failed { message },
        }
    }
}

impl From<NoProject> for DescriptionReply {
    fn from(refused: NoProject) -> DescriptionReply {
        match refused {
            NoProject::NotLoggedIn { detail } => DescriptionReply::NotLoggedIn { detail },
            NoProject::Failed { message } => DescriptionReply::Failed { message },
        }
    }
}

impl From<NoProject> for LinksReply {
    fn from(refused: NoProject) -> LinksReply {
        match refused {
            NoProject::NotLoggedIn { detail } => LinksReply::NotLoggedIn { detail },
            NoProject::Failed { message } => LinksReply::Failed { message },
        }
    }
}

impl From<NoProject> for DiscussionThreadReply {
    fn from(refused: NoProject) -> DiscussionThreadReply {
        match refused {
            NoProject::NotLoggedIn { detail } => DiscussionThreadReply::NotLoggedIn { detail },
            NoProject::Failed { message } => DiscussionThreadReply::Failed { message },
        }
    }
}

impl From<NoProject> for DiscussionWriteReply {
    fn from(refused: NoProject) -> DiscussionWriteReply {
        match refused {
            NoProject::NotLoggedIn { detail } => DiscussionWriteReply::NotLoggedIn { detail },
            NoProject::Failed { message } => DiscussionWriteReply::Failed { message },
        }
    }
}

impl From<NoProject> for MarkdownPreviewReply {
    fn from(refused: NoProject) -> MarkdownPreviewReply {
        match refused {
            NoProject::NotLoggedIn { detail } => MarkdownPreviewReply::NotLoggedIn { detail },
            NoProject::Failed { message } => MarkdownPreviewReply::Failed { message },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_full_path_the_web_path_and_the_https_origin_come_from_the_project() {
        let json = br#"{"id":7,"path_with_namespace":"taskboard/taskboard","web_url":"https://gitlab.example:8443/taskboard/taskboard"}"#;

        let project = project_from(json).unwrap();

        assert_eq!(project.full_path, "taskboard/taskboard");
        assert_eq!(project.web_path, "/taskboard/taskboard");
        assert_eq!(
            project.web_origin.as_deref(),
            Some("https://gitlab.example:8443")
        );
    }

    #[test]
    fn a_gitlab_under_a_sub_path_keeps_it_in_the_web_path_not_in_the_full_path() {
        let json = br#"{"path_with_namespace":"grp/proj","web_url":"https://host.example/gitlab/grp/proj"}"#;

        let project = project_from(json).unwrap();

        assert_eq!(project.full_path, "grp/proj");
        assert_eq!(project.web_path, "/gitlab/grp/proj");
        assert_eq!(project.web_origin.as_deref(), Some("https://host.example"));
    }

    #[test]
    fn a_gitlab_on_http_has_no_origin_nor_web_path_and_a_strange_answer_is_an_error() {
        let http = "http://gitlab.example/taskboard/taskboard";
        assert_eq!(web_origin(http), None);
        assert_eq!(web_path(http), "");
        let refused = project_from(br#"{"message":"404 Project Not Found"}"#);
        assert!(refused.is_err());
    }

    #[test]
    fn lost_reads_glabs_words() {
        let lost_words = [
            ("glab: 401 Unauthorized (HTTP 401)", Lost::Login),
            ("glab: Invalid token", Lost::Login),
            (&format!("glab: {NO_PERMISSION}"), Lost::Login),
            (NO_PERMISSION, Lost::Login),
            ("glab: 404 Project Not Found (HTTP 404)", Lost::Project),
            (NO_PROJECT, Lost::Project),
        ];
        for (words, gone) in lost_words {
            assert_eq!(lost(words), Some(gone), "{words}");
        }
        let kept = [
            "glab: 404 Not Found (HTTP 404)",
            "glab: 403 Forbidden (HTTP 403)",
            "glab timed out",
            "glab: Invalid token for a moment",
            "The resource that you are attempting to access does not exist",
            "",
        ];
        for words in kept {
            assert_eq!(lost(words), None, "{words}");
        }
    }
}
