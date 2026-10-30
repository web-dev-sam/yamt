use std::path::Path;

use serde::Deserialize;
use yamt_gitio::{AuthStatus, Glab};

use crate::web_page::HTTPS;
use crate::{ListEnd, OpenReply, ResolveRefusal};

/// glab fills `:fullpath` with the project of the folder's remotes (glab docs, `glab api`).
const PROJECT_ROUTE: &str = "projects/:fullpath";

/// The GitLab project of the repository's remotes.
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

/// Why glab named no project: logged out, or a call failed.
pub(crate) enum NoProject {
    NotLoggedIn { detail: String },
    Failed { message: String },
}

/// The project of the repository's remotes, asked once `glab auth status` says glab is logged in.
pub(crate) fn logged_in_project(glab: &Glab, root: &Path) -> Result<Project, NoProject> {
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
}
